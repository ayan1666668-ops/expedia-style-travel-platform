import { ProductType } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config/env';
import { prisma } from '../lib/prisma';
import { resolveLocale } from '../plugins/auth';
import { TYPE_LABELS, searchProducts } from '../modules/search/service';
import { AppError } from '../utils/errors';

const listSchema = z.object({
  q: z.string().trim().max(200).optional(),
  destination: z.string().trim().max(200).optional(),
  destinations: z.string().trim().max(600).optional(),
  type: z.enum(Object.keys(TYPE_LABELS) as [string, ...string[]]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dates: z.string().trim().max(200).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  instantConfirm: z.coerce.boolean().optional(),
  freeCancellation: z.coerce.boolean().optional(),
  skipTheLine: z.coerce.boolean().optional(),
  tags: z.string().trim().max(400).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(500).optional(),
  sort: z.enum(['RELEVANCE', 'PRICE_ASC', 'PRICE_DESC', 'RATING', 'POPULARITY', 'DISTANCE']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(60).optional(),
  locale: z.string().optional(),
});

/**
 * Search + discovery endpoints.
 * Mirrors the shape Expedia-style clients expect: filters, facets, sorting
 * and pagination all round-trip through the same query string.
 */
export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/search', async (request) => {
    const params = listSchema.parse(request.query);
    const locale = resolveLocale(request);

    const started = Date.now();
    const result = await searchProducts({
      query: params.q,
      destinationSlug: params.destination,
      destinationSlugIn: params.destinations?.split(',').map((s) => s.trim()).filter(Boolean),
      type: params.type as ProductType | undefined,
      serviceDate: params.date,
      serviceDates: params.dates?.split(',').map((s) => s.trim()).filter(Boolean),
      minPriceCents: params.minPrice,
      maxPriceCents: params.maxPrice,
      minRating: params.minRating,
      instantConfirmOnly: params.instantConfirm,
      freeCancellationOnly: params.freeCancellation,
      skipTheLineOnly: params.skipTheLine,
      tags: params.tags?.split(',').map((s) => s.trim()).filter(Boolean),
      latitude: params.lat,
      longitude: params.lng,
      radiusKm: params.radiusKm,
      sort: params.sort,
      page: params.page,
      pageSize: params.pageSize,
      locale,
    });

    // Fire-and-forget merchandising analytics.
    if (request.user) {
      void prisma.searchQueryLog.create({
        data: {
          userId: request.user.id,
          query: params.q,
          productType: params.type as ProductType | undefined,
          filters: JSON.parse(JSON.stringify(params)),
          sort: params.sort,
          resultCount: result.total,
          tookMs: Date.now() - started,
        },
      });
    }

    return result;
  });

  /** Popular destinations for the landing page and the nav mega-menu. */
  app.get('/destinations', async () => {
    const destinations = await prisma.destination.findMany({
      where: { level: 'CITY', isPopular: true },
      orderBy: { sortWeight: 'asc' },
      take: 24,
      include: {
        products: {
          where: { status: 'PUBLISHED' },
          select: { id: true },
        },
      },
    });

    return destinations.map((d) => ({
      slug: d.slug,
      name: d.name,
      countryCode: d.countryCode,
      heroImageUrl: d.heroImageUrl,
      latitude: d.latitude,
      longitude: d.longitude,
      productCount: d.products.length,
    }));
  });

  /** Curated landing rails: "Trending now", "Top rated", "Family picks". */
  app.get('/collections/:slug', async (request) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);

    const known: Record<string, { title: string; filter: Record<string, unknown> }> = {
      trending: { title: 'Trending now', filter: { sort: 'POPULARITY', pageSize: 12 } },
      'top-rated': { title: 'Traveler favorites', filter: { sort: 'RATING', minRating: 4.5, pageSize: 12 } },
      'skip-the-line': { title: 'Skip the line', filter: { skipTheLineOnly: true, pageSize: 12 } },
      'free-cancellation': { title: 'Free cancellation', filter: { freeCancellationOnly: true, pageSize: 12 } },
      'instant-confirmation': { title: 'Instant confirmation', filter: { instantConfirmOnly: true, pageSize: 12 } },
      deals: { title: 'Deals of the day', filter: { sort: 'PRICE_ASC', pageSize: 12 } },
    };

    const collection = known[slug];
    if (!collection) throw AppError.notFound('Collection');

    const result = await searchProducts({
      ...(collection.filter as Parameters<typeof searchProducts>[0]),
      page: 1,
    });

    return { ...result, title: collection.title };
  });
}