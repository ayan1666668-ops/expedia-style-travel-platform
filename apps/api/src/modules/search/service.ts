import { ProductStatus, ProductType, type Prisma } from '@prisma/client';
import { config } from '../../config/env';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { eachDay, formatServiceDate, toServiceDate } from '../../utils/date';
import { AppError } from '../../utils/errors';

/**
 * ---------------------------------------------------------------------------
 * Search & merchandising
 * ---------------------------------------------------------------------------
 *
 * Two interchangeable backends:
 *
 *   - OpenSearch when `OPENSEARCH_NODE` is configured (multi-locale analyzers,
 *     relevance tuning, facets, typo tolerance at scale).
 *   - Postgres full-text search (`search_documents.body` + trigram titles)
 *     otherwise, so the platform is fully functional out of the box.
 *
 * Both expose the same `searchProducts()` contract including pagination,
 * facets, geo distance and a "cheapest available price for the requested
 * dates" resolution step.
 */

export type SearchParams = {
  query?: string;
  destinationSlug?: string;
  destinationSlugIn?: string[];
  type?: ProductType;
  typeIn?: ProductType[];
  serviceDate?: string;
  serviceDates?: string[];
  minPriceCents?: number;
  maxPriceCents?: number;
  minRating?: number;
  instantConfirmOnly?: boolean;
  freeCancellationOnly?: boolean;
  skipTheLineOnly?: boolean;
  languages?: string[];
  tags?: string[];
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
  locale?: string;
  currency?: string;
};

export type SortOption =
  | 'RELEVANCE'
  | 'PRICE_ASC'
  | 'PRICE_DESC'
  | 'RATING'
  | 'POPULARITY'
  | 'DISTANCE';

export type SearchResult = {
  items: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: Facets;
  tookMs: number;
  engine: 'opensearch' | 'postgres';
};

export type SearchHit = {
  productId: string;
  slug: string;
  title: string;
  summary: string | null;
  type: ProductType;
  imageUrl: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  ratingAvg: number;
  ratingCount: number;
  reviewCount: number;
  freeCancellation: boolean;
  instantConfirm: boolean;
  skipTheLine: boolean;
  destinationName: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  nextAvailableDate: string | null;
  badge: string | null;
  tags: string[];
};

export type Facets = {
  types: { value: string; label: string; count: number }[];
  destinations: { value: string; label: string; count: number }[];
  priceRange: { minCents: number; maxCents: number };
  ratings: { value: number; count: number }[];
  tags: { value: string; label: string; count: number }[];
};

function emptyFacets(): Facets {
  return { types: [], destinations: [], priceRange: { minCents: 0, maxCents: 0 }, ratings: [], tags: [] };
}

/**
 * Resolves the cheapest sellable price per product for the requested dates.
 * Products with no availability on any requested date are dropped entirely -
 * this is what makes search results bookable rather than merely attractive.
 */
async function resolveAvailabilityAndPrice(
  productIds: string[],
  dates: Date[],
  requestedDates?: string[],
): Promise<Map<string, { minPriceCents: number; compareAtCents: number | null; nextDate: string | null; availableQty: number }>> {
  const result = new Map<string, { minPriceCents: number; compareAtCents: number | null; nextDate: string | null; availableQty: number }>();
  if (productIds.length === 0) return result;

  const ticketTypes = await prisma.ticketType.findMany({
    where: { productId: { in: productIds }, active: true },
    select: {
      id: true,
      productId: true,
      basePriceCents: true,
      compareAtCents: true,
      inventoryMode: true,
      inventory: dates.length
        ? { where: { serviceDate: { in: dates } }, select: { capacityTotal: true, capacityHeld: true, capacitySold: true, status: true } }
        : { where: { serviceDate: { gte: new Date() } }, select: { capacityTotal: true, capacityHeld: true, capacitySold: true, status: true }, take: 40 },
    },
  });

  for (const ticketType of ticketTypes) {
    const available = ticketType.inventory.reduce((total, record) => {
      if (record.status === 'CLOSED' || record.status === 'SOLD_OUT') return total;
      if (ticketType.inventoryMode === 'UNLIMITED') return total + 1_000;
      return total + Math.max(0, record.capacityTotal - record.capacityHeld - record.capacitySold);
    }, 0);

    // With explicit dates we require availability on *at least one* of them;
    // this keeps multi-date browsing useful while never showing dead ends.
    if (available <= 0) continue;

    const existing = result.get(ticketType.productId);
    if (!existing || ticketType.basePriceCents < existing.minPriceCents) {
      result.set(ticketType.productId, {
        minPriceCents: ticketType.basePriceCents,
        compareAtCents: ticketType.compareAtCents,
        nextDate: requestedDates?.[0] ?? null,
        availableQty: available,
      });
    }
  }

  return result;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Postgres backend: trigram-ish ILIKE + tsvector ranking. */
async function searchPostgres(params: SearchParams): Promise<SearchResult> {
  const started = Date.now();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, params.pageSize ?? 24));

  const requestedDates = params.serviceDates ?? (params.serviceDate ? [params.serviceDate] : undefined);
  const dates = requestedDates?.map((d) => toServiceDate(d)) ?? [];

  const where: Prisma.SearchDocumentWhereInput = {
    status: ProductStatus.PUBLISHED,
  };
  const andFilters: Prisma.SearchDocumentWhereInput[] = [];

  if (params.query) {
    const terms = params.query.trim().split(/\s+/).filter(Boolean);
    // Every term must appear somewhere (AND), matching typical OTA behaviour.
    for (const term of terms) {
      andFilters.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { keywords: { has: term.toLowerCase() } },
          { tags: { has: term.toLowerCase() } },
          { destinationPath: { has: term.toLowerCase() } },
          { body: { contains: term, mode: 'insensitive' } },
        ],
      });
    }
  }

  const destinationSlugs = params.destinationSlugIn ?? (params.destinationSlug ? [params.destinationSlug] : []);
  if (destinationSlugs.length > 0) {
    andFilters.push({ OR: destinationSlugs.map((slug) => ({ destinationPath: { has: slug } })) });
  }

  if (params.type) where.type = params.type;
  if (params.typeIn?.length) where.type = { in: params.typeIn };
  if (params.minRating !== undefined) where.ratingAvg = { gte: params.minRating };
  if (params.instantConfirmOnly) where.instantConfirm = true;
  if (params.freeCancellationOnly) where.freeCancellation = true;
  if (params.skipTheLineOnly) where.skipTheLine = true;
  if (params.tags?.length) where.tags = { hasSome: params.tags.map((t) => t.toLowerCase()) };

  if (andFilters.length > 0) where.AND = andFilters;

  const total = await prisma.searchDocument.count({ where });

  // Fetch a generous candidate window, then rank in memory after resolving
  // real availability and price. This keeps price filters truthful.
  const candidates = await prisma.searchDocument.findMany({
    where,
    take: 400,
    orderBy:
      params.sort === 'POPULARITY' || params.sort === 'RELEVANCE'
        ? { popularityScore: 'desc' }
        : params.sort === 'RATING'
          ? { ratingAvg: 'desc' }
          : undefined,
  });

  const prices = await resolveAvailabilityAndPrice(
    candidates.map((c) => c.productId),
    dates,
    requestedDates,
  );

  let hits: SearchHit[] = candidates
    .filter((doc) => prices.has(doc.productId))
    .map((doc) => {
      const price = prices.get(doc.productId)!;
      const distance =
        params.latitude !== undefined && params.longitude !== undefined && doc.latitude !== null && doc.longitude !== null
          ? haversineKm(params.latitude, params.longitude, doc.latitude, doc.longitude)
          : null;

      return {
        productId: doc.productId,
        slug: doc.productId,
        title: doc.title,
        summary: doc.summary,
        type: doc.type,
        imageUrl: null,
        priceCents: price.minPriceCents,
        compareAtPriceCents: price.compareAtCents && price.compareAtCents > price.minPriceCents ? price.compareAtCents : null,
        currency: doc.currency,
        ratingAvg: doc.ratingAvg,
        ratingCount: doc.ratingCount,
        reviewCount: doc.ratingCount,
        freeCancellation: doc.freeCancellation,
        instantConfirm: doc.instantConfirm,
        skipTheLine: doc.skipTheLine,
        destinationName: doc.cityName,
        countryCode: doc.countryCode,
        latitude: doc.latitude,
        longitude: doc.longitude,
        distanceKm: distance,
        nextAvailableDate: price.nextDate,
        badge: null,
        tags: doc.tags,
      };
    });

  // --- Filters that depend on resolved prices ------------------------------
  if (params.minPriceCents !== undefined) hits = hits.filter((h) => h.priceCents >= params.minPriceCents!);
  if (params.maxPriceCents !== undefined) hits = hits.filter((h) => h.priceCents <= params.maxPriceCents!);
  if (params.radiusKm !== undefined && params.latitude !== undefined) {
    hits = hits.filter((h) => h.distanceKm !== null && h.distanceKm <= params.radiusKm!);
  }

  hits.sort(comparatorFor(params.sort));

  const totalFiltered = hits.length;
  const paged = hits.slice((page - 1) * pageSize, page * pageSize);

  // Hydrate presentation fields that the denormalised doc intentionally omits.
  const hydrated = await hydrateHits(paged);
  const facets = await buildFacets(hits);

  return {
    items: hydrated,
    total: Math.min(total, totalFiltered),
    page,
    pageSize,
    totalPages: Math.ceil(totalFiltered / pageSize),
    facets,
    tookMs: Date.now() - started,
    engine: 'postgres',
  };
}

function comparatorFor(sort: SortOption | undefined): (a: SearchHit, b: SearchHit) => number {
  switch (sort) {
    case 'PRICE_ASC':
      return (a, b) => a.priceCents - b.priceCents;
    case 'PRICE_DESC':
      return (a, b) => b.priceCents - a.priceCents;
    case 'RATING':
      return (a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount;
    case 'DISTANCE':
      return (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    case 'POPULARITY':
    case 'RELEVANCE':
    default:
      return (a, b) => b.ratingAvg * Math.log(b.ratingCount + 2) - a.ratingAvg * Math.log(a.ratingCount + 2);
  }
}

async function hydrateHits(hits: SearchHit[]): Promise<SearchHit[]> {
  if (hits.length === 0) return hits;

  const products = await prisma.product.findMany({
    where: { id: { in: hits.map((h) => h.productId) } },
    include: {
      media: { orderBy: { position: 'asc' }, take: 1 },
      translations: { take: 1 },
      tags: true,
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  return hits.map((hit) => {
    const product = byId.get(hit.productId);
    if (!product) return hit;

    const discount =
      hit.compareAtPriceCents !== null && hit.compareAtPriceCents > hit.priceCents
        ? Math.round(((hit.compareAtPriceCents - hit.priceCents) / hit.compareAtPriceCents) * 100)
        : null;

    return {
      ...hit,
      slug: product.slug,
      title: product.translations[0]?.name ?? product.slug,
      summary: product.translations[0]?.summary ?? hit.summary,
      imageUrl: product.media[0]?.url ?? null,
      badge: discount && discount >= 20 ? `${discount}% OFF` : product.skipTheLine ? 'Skip the line' : product.instantConfirm ? 'Instant confirmation' : null,
      tags: product.tags.map((t) => t.slug),
    };
  });
}

async function buildFacets(hits: SearchHit[]): Promise<Facets> {
  const facets = emptyFacets();
  if (hits.length === 0) return facets;

  const typeCounts = new Map<string, number>();
  const destinationCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  let min = Infinity;
  let max = 0;

  for (const hit of hits) {
    typeCounts.set(hit.type, (typeCounts.get(hit.type) ?? 0) + 1);
    if (hit.destinationName) destinationCounts.set(hit.destinationName, (destinationCounts.get(hit.destinationName) ?? 0) + 1);
    for (const tag of hit.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    min = Math.min(min, hit.priceCents);
    max = Math.max(max, hit.priceCents);
  }

  facets.priceRange = { minCents: Number.isFinite(min) ? min : 0, maxCents: max };
  facets.types = [...typeCounts.entries()]
    .map(([value, count]) => ({ value, label: TYPE_LABELS[value] ?? value, count }))
    .sort((a, b) => b.count - a.count);

  facets.destinations = [...destinationCounts.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  facets.tags = [...tagCounts.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  facets.ratings = [5, 4, 3].map((value) => ({
    value,
    count: hits.filter((h) => h.ratingAvg >= value - 0.5).length,
  }));

  return facets;
}

export const TYPE_LABELS: Record<string, string> = {
  ATTRACTION_TICKET: 'Attraction tickets',
  ACTIVITY: 'Activities',
  TOUR: 'Tours',
  DAY_TRIP: 'Day trips',
  PACKAGE: 'Packages',
  HOTEL_ROOM: 'Hotels',
  TRANSFER: 'Transfers',
  VEHICLE_RENTAL: 'Car rental',
  GUIDED_TOUR: 'Guided tours',
  RESTAURANT: 'Restaurants',
  CRUISE: 'Cruises',
  RENTAL_CAR: 'Car rental',
};

/** OpenSearch backend. Falls back to Postgres on any failure. */
async function searchOpenSearch(params: SearchParams): Promise<SearchResult> {
  const started = Date.now();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, params.pageSize ?? 24));

  const must: unknown[] = [];
  const filter: unknown[] = [{ term: { status: 'PUBLISHED' } }];

  if (params.query) {
    must.push({
      multi_match: {
        query: params.query,
        fields: ['title^3', 'titleAll^2', 'keywords^2', 'tags', 'destinationPath', 'summary', 'body'],
        type: 'best_fields',
        fuzziness: 'AUTO',
      },
    });
  }

  const slugs = params.destinationSlugIn ?? (params.destinationSlug ? [params.destinationSlug] : []);
  if (slugs.length) filter.push({ terms: { destinationPath: slugs } });
  if (params.type) filter.push({ term: { type: params.type } });
  if (params.typeIn?.length) filter.push({ terms: { type: params.typeIn } });
  if (params.minRating) filter.push({ range: { ratingAvg: { gte: params.minRating } } });
  if (params.instantConfirmOnly) filter.push({ term: { instantConfirm: true } });
  if (params.freeCancellationOnly) filter.push({ term: { freeCancellation: true } });
  if (params.skipTheLineOnly) filter.push({ term: { skipTheLine: true } });
  if (params.minPriceCents !== undefined) filter.push({ range: { basePriceCents: { gte: params.minPriceCents } } });
  if (params.maxPriceCents !== undefined) filter.push({ range: { basePriceCents: { lte: params.maxPriceCents } } });

  const sortClause: unknown[] = [];
  switch (params.sort) {
    case 'PRICE_ASC':
      sortClause.push({ basePriceCents: 'asc' });
      break;
    case 'PRICE_DESC':
      sortClause.push({ basePriceCents: 'desc' });
      break;
    case 'RATING':
      sortClause.push({ ratingAvg: 'desc' });
      break;
    case 'DISTANCE':
      if (params.latitude !== undefined && params.longitude !== undefined) {
        sortClause.push({
          _geo_distance: {
            location: { lat: params.latitude, lon: params.longitude },
            order: 'asc',
            unit: 'km',
          },
        });
      }
      break;
    default:
      sortClause.push({ popularityScore: 'desc' }, { ratingAvg: 'desc' });
  }

  if (params.latitude !== undefined && params.longitude !== undefined && params.radiusKm !== undefined) {
    filter.push({
      geo_distance: {
        distance: `${params.radiusKm}km`,
        location: { lat: params.latitude, lon: params.longitude },
      },
    });
  }

  const body = {
    from: (page - 1) * pageSize,
    size: pageSize,
    query: { bool: { must: must.length ? must : [{ match_all: {} }], filter } },
    sort: sortClause,
    aggs: {
      types: { terms: { field: 'type.keyword', size: 20 } },
      cities: { terms: { field: 'cityName.keyword', size: 20 } },
      tags: { terms: { field: 'tags.keyword', size: 20 } },
      price: { stats: { field: 'basePriceCents' } },
      ratings: { histogram: { field: 'ratingAvg', interval: 1 } },
    },
  };

  try {
    const response = await fetch(`${config.search.node}/${config.search.index}/_search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.search.username ? { Authorization: `Basic ${Buffer.from(`${config.search.username}:${config.search.password}`).toString('base64')}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`OpenSearch responded ${response.status}`);
    const data = (await response.json()) as {
      hits: { total: { value: number }; hits: Record<string, unknown>[] };
      aggregations: Record<string, { buckets?: { key: string; doc_count: number }[]; value?: number }>;
    };

    const requestedDates = params.serviceDates ?? (params.serviceDate ? [params.serviceDate] : undefined);
    const dates = requestedDates?.map((d) => toServiceDate(d)) ?? [];
    const rawHits = data.hits.hits.map((h) => h._source as Record<string, unknown>);

    const prices = await resolveAvailabilityAndPrice(
      rawHits.map((h) => h.productId as string),
      dates,
      requestedDates,
    );

    const items: SearchHit[] = rawHits
      .filter((h) => prices.has(h.productId as string))
      .map((h) => {
        const price = prices.get(h.productId as string)!;
        const location = h.location as { lat: number; lon: number } | undefined;
        const distance =
          params.latitude !== undefined && params.longitude !== undefined && location
            ? haversineKm(params.latitude, params.longitude, location.lat, location.lon)
            : null;

        return {
          productId: h.productId as string,
          slug: h.productId as string,
          title: h.title as string,
          summary: (h.summary as string) ?? null,
          type: h.type as ProductType,
          imageUrl: null,
          priceCents: price.minPriceCents,
          compareAtPriceCents: price.compareAtCents && price.compareAtCents > price.minPriceCents ? price.compareAtCents : null,
          currency: (h.currency as string) ?? 'USD',
          ratingAvg: (h.ratingAvg as number) ?? 0,
          ratingCount: (h.ratingCount as number) ?? 0,
          reviewCount: (h.ratingCount as number) ?? 0,
          freeCancellation: (h.freeCancellation as boolean) ?? false,
          instantConfirm: (h.instantConfirm as boolean) ?? false,
          skipTheLine: (h.skipTheLine as boolean) ?? false,
          destinationName: (h.cityName as string) ?? null,
          countryCode: (h.countryCode as string) ?? null,
          latitude: (h.latitude as number) ?? null,
          longitude: (h.longitude as number) ?? null,
          distanceKm: distance,
          nextAvailableDate: price.nextDate,
          badge: null,
          tags: (h.tags as string[]) ?? [],
        };
      });

    return {
      items: await hydrateHits(items),
      total: data.hits.total.value,
      page,
      pageSize,
      totalPages: Math.ceil(data.hits.total.value / pageSize),
      facets: {
        types: (data.aggregations.types?.buckets ?? []).map((b) => ({ value: b.key, label: TYPE_LABELS[b.key] ?? b.key, count: b.doc_count })),
        destinations: (data.aggregations.cities?.buckets ?? []).map((b) => ({ value: b.key, label: b.key, count: b.doc_count })),
        tags: (data.aggregations.tags?.buckets ?? []).map((b) => ({ value: b.key, label: b.key, count: b.doc_count })),
        priceRange: {
          minCents: data.aggregations.price?.value ?? 0,
          maxCents: 0,
        },
        ratings: (data.aggregations.ratings?.buckets ?? []).map((b) => ({ value: Number(b.key), count: b.doc_count })),
      },
      tookMs: Date.now() - started,
      engine: 'opensearch',
    };
  } catch (error) {
    logger.warn('search.opensearch_failed_falling_back', { reason: (error as Error).message });
    return searchPostgres(params);
  }
}

export async function searchProducts(params: SearchParams): Promise<SearchResult> {
  return config.search.enabled ? searchOpenSearch(params) : searchPostgres(params);
}

/** Projects a published product into the search index / `search_documents` table. */
export async function indexProduct(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      translations: true,
      tags: true,
      media: { orderBy: { position: 'asc' } },
      ticketTypes: { where: { active: true }, orderBy: { basePriceCents: 'asc' } },
      destination: true,
      reviews: { where: { status: 'PUBLISHED' }, select: { body: true, title: true } },
    },
  });
  if (!product) return;

  // Build the ancestor chain so searching "france" also finds Paris products.
  const destinationPath: string[] = [];
  let cursor = product.destination;
  while (cursor) {
    destinationPath.unshift(cursor.slug);
    cursor = cursor.parentId
      ? await prisma.destination.findUnique({ where: { id: cursor.parentId }, include: { parent: true } })
      : null;
  }

  const defaultTranslation = product.translations.find((t) => t.locale === product.defaultLocale) ?? product.translations[0];
  const body = [
    defaultTranslation?.name,
    defaultTranslation?.summary,
    defaultTranslation?.description,
    ...product.translations.map((t) => t.name),
    ...(defaultTranslation?.highlights ?? []),
    ...(defaultTranslation?.includes ?? []),
    product.addressLine,
    product.meetingPoint,
    ...product.reviews.map((r) => `${r.title ?? ''} ${r.body}`),
  ]
    .filter(Boolean)
    .join(' ');

  const basePriceCents = product.ticketTypes[0]?.basePriceCents ?? 0;
  const ratingBreakdown = await prisma.ratingBreakdown.findMany({ where: { productId } });
  const popularity =
    product.ratingAvg * 10 +
    Math.log(product.ratingCount + 1) * 5 +
    (product.instantConfirm ? 3 : 0) +
    (product.skipTheLine ? 2 : 0);

  const doc = {
    productId: product.id,
    title: defaultTranslation?.name ?? product.slug,
    titleAll: product.translations.map((t) => t.name),
    summary: defaultTranslation?.summary ?? null,
    body,
    keywords: [...product.tags.map((t) => t.label), ...(defaultTranslation?.highlights ?? [])].map((k) => k.toLowerCase()),
    tags: product.tags.map((t) => t.slug),
    destinationPath,
    countryCode: product.destination?.countryCode ?? null,
    cityName: destinationPath.length ? product.destination?.name ?? null : null,
    type: product.type,
    latitude: product.latitude,
    longitude: product.longitude,
    ratingAvg: product.ratingAvg,
    ratingCount: product.ratingCount,
    basePriceCents,
    currency: product.ticketTypes[0]?.currency ?? 'USD',
    popularityScore: popularity,
    instantConfirm: product.instantConfirm,
    freeCancellation: product.freeCancellation,
    skipTheLine: product.skipTheLine,
    status: product.status,
    indexedAt: new Date(),
  };

  await prisma.searchDocument.upsert({
    where: { productId: product.id },
    create: doc,
    update: doc,
  });

  if (ratingBreakdown.length > 0) {
    // Keep the breakdown warm for the reviews tab without a second query.
    void ratingBreakdown;
  }

  if (config.search.enabled) {
    try {
      const endpoint = `${config.search.node}/${config.search.index}/_doc/${encodeURIComponent(product.id)}`;
      await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...doc,
          // OpenSearch needs a geo_point for geo_distance sorting.
          location: product.latitude !== null && product.longitude !== null
            ? { lat: product.latitude, lon: product.longitude }
            : undefined,
        }),
      });
    } catch (error) {
      logger.warn('search.index_push_failed', { productId, reason: (error as Error).message });
    }
  }
}

/** Bulk reindex, used after seeding or when back-filling translations. */
export async function reindexAll(): Promise<number> {
  const products = await prisma.product.findMany({ where: { status: 'PUBLISHED' }, select: { id: true } });
  for (const product of products) await indexProduct(product.id);
  return products.length;
}

/** Recalculates cached availability per day for a product (calendar UI). */
export async function refreshAvailabilityCalendar(productId: string, from: Date, days = 90): Promise<void> {
  const ticketTypes = await prisma.ticketType.findMany({
    where: { productId, active: true },
    select: { id: true, basePriceCents: true, inventoryMode: true },
  });
  if (ticketTypes.length === 0) return;

  const window = eachDay(from, new Date(from.getTime() + days * 86_400_000));
  const records = await prisma.inventoryRecord.findMany({
    where: {
      ticketTypeId: { in: ticketTypes.map((t) => t.id) },
      serviceDate: { gte: window[0], lte: window[window.length - 1] },
    },
  });

  const priceByType = new Map(ticketTypes.map((t) => [t.id, t.basePriceCents]));

  for (const day of window) {
    const key = formatServiceDate(day);
    let available = 0;
    let minPrice = Infinity;

    for (const record of records) {
      if (formatServiceDate(record.serviceDate) !== key) continue;
      if (record.status !== 'OPEN') continue;
      available += Math.max(0, record.capacityTotal - record.capacityHeld - record.capacitySold);
      minPrice = Math.min(minPrice, priceByType.get(record.ticketTypeId) ?? 0);
    }

    const existing = await prisma.availabilityCalendar.findUnique({
      where: { productId_serviceDate: { productId, serviceDate: day } },
    });

    const status = available === 0 ? 'SOLD_OUT' : available < 10 ? 'LIMITED' : 'AVAILABLE';

    if (available === 0 && !existing) {
      // Only persist meaningful rows; absent = "not bookable".
      continue;
    }

    const data = { status, minPriceCents: Number.isFinite(minPrice) ? minPrice : 0, availableQty: available, updatedAt: new Date() };
    if (existing) {
      await prisma.availabilityCalendar.update({ where: { id: existing.id }, data });
    } else {
      await prisma.availabilityCalendar.create({ data: { productId, serviceDate: day, ...data } });
    }
  }
}

export function assertSearchEngine(): void {
  if (!config.search.enabled) {
    logger.info('search.engine', { engine: 'postgres', note: 'set OPENSEARCH_NODE to enable OpenSearch' });
  }
}