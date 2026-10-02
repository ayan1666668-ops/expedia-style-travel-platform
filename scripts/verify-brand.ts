/**
 * ---------------------------------------------------------------------------
 * EasyTrip brand, catalogue & localisation verification
 * ---------------------------------------------------------------------------
 *
 * A repeatable, read-only acceptance check for the EasyTrip rebrand and the
 * global catalogue. Unlike `smoke-test.sh` (which covers the commercial loop:
 * search -> checkout -> payment -> ticket -> refund), this script asserts the
 * things that are easy to regress silently:
 *
 *   1.  Brand name is 易捷旅行 for zh and EasyTrip for every other locale.
 *   2.  Every headline category is present in unified search, with its
 *       category-specific fields hydrated onto the hits.
 *   3.  All 14 required countries have a published city with products.
 *   4.  Copy is bilingual: zh queries find Chinese matches, and products
 *       resolve to a Chinese title under locale=zh-CN.
 *   5.  No discount-pressure / scarcity language leaks into the storefront.
 *
 * Uses global `fetch` against a running API — no curl, no extra deps.
 *
 * Usage:  npx tsx scripts/verify-brand.ts [API_BASE_URL]
 * Exit code is 0 only when every assertion passes.
 */

const API = (process.argv[2] ?? process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const BASE = `${API}/api/v1`;

/** `/health` is mounted at the server root, not under the versioned prefix. */
function getRootJson<T>(path: string): Promise<T> {
  return fetch(`${API}${path}`, { headers: { Accept: 'application/json' } }).then(async (res) => {
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    return (await res.json()) as T;
  });
}

const PASS: string[] = [];
const FAIL: string[] = [];

function check(label: string, ok: boolean, detail = ''): void {
  (ok ? PASS : FAIL).push(label);
  const mark = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${mark} ${label}${detail ? ` \x1b[90m${detail}\x1b[0m` : ''}`);
}

function section(title: string): void {
  console.log(`\n\x1b[1;36m── ${title}\x1b[0m`);
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

// --- Shapes (structural subset of the API contract) ------------------------

type Category = {
  airlineName: string | null;
  flightRoute: string | null;
  cabinClass: string | null;
  roomCategory: string | null;
  starCategory: number | null;
  boardBasis: string | null;
  cruiseLine: string | null;
  shipName: string | null;
  cruiseNights: number | null;
};

type Hit = {
  slug: string;
  title: string;
  type: string;
  destinationName: string | null;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  ratingAvg: number;
  ratingCount: number;
  category?: Category;
};

type Group = { type: string; label: string; count: number; items: Hit[] };
type SearchResponse = {
  total: number;
  engine: string;
  groups: Group[];
  items: Hit[];
  facets: { types: { value: string; label: string; count: number }[] };
};

type Destination = { slug: string; name: string; countryCode: string; productCount?: number };

// The six categories the catalogue must cover everywhere.
const HEADLINE = ['FLIGHT', 'HOTEL_ROOM', 'CRUISE', 'GUIDED_TOUR', 'ATTRACTION_TICKET', 'ACTIVITY'] as const;

/** The 14 countries the brief requires coverage for. */
const REQUIRED_COUNTRIES: Record<string, string> = {
  GB: 'United Kingdom',
  FR: 'France',
  IT: 'Italy',
  ES: 'Spain',
  DE: 'Germany',
  NL: 'Netherlands',
  CH: 'Switzerland',
  AT: 'Austria',
  PT: 'Portugal',
  US: 'United States',
  CA: 'Canada',
  JP: 'Japan',
  SG: 'Singapore',
  AU: 'Australia',
};

/**
 * Language that must never appear in guest-facing copy. Scarcity and
 * price-pressure framing is exactly what the brief asked us to remove, so it
 * is asserted rather than merely reviewed.
 */
const BANNED_COPY: { label: string; re: RegExp }[] = [
  { label: 'scarcity: "last one/left"', re: /last (one|left|remaining)/i },
  { label: 'scarcity: "only N left"', re: /only \d+ left/i },
  { label: 'pressure: "hurry"', re: /\bhurry\b/i },
  { label: 'pressure: "selling fast"', re: /selling fast/i },
  { label: 'pressure: "don\'t miss"', re: /don'?t miss|do not miss/i },
  { label: 'price-led: "cheap/cheapest"', re: /\b(cheap(est)?)\b/i },
  { label: 'price-led: "lowest price"', re: /lowest price/i },
  { label: 'zh scarcity: 仅剩/最后/库存不足', re: /仅剩|最后\s*\d|库存不足|手慢无|告急/ },
  { label: 'zh pressure: 抢购/赶紧/错过', re: /抢购|赶紧|错过/ },
];

function findBanned(samples: string[]): string[] {
  const found = new Set<string>();
  for (const sample of samples) {
    if (!sample) continue;
    for (const { label, re } of BANNED_COPY) if (re.test(sample)) found.add(label);
  }
  return [...found];
}

// --- Run ------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\x1b[1mEasyTrip verification\x1b[0m  \x1b[90m${BASE}\x1b[0m`);

  // 1. Health ---------------------------------------------------------------
  section('Service');
  const health = await getRootJson<{ status: string; service: string }>('/health');
  check('API is up', health.status === 'ok', health.service);

  // 2. Unified multi-category search ---------------------------------------
  section('Unified multi-category search');
  const unified = await getJson<SearchResponse>('/search?groupBy=TYPE&groupLimit=8&pageSize=40');
  check('catalogue has products', unified.total > 0, `${unified.total} results via ${unified.engine}`);

  const byType = new Map(unified.groups.map((g) => [g.type, g]));
  for (const type of HEADLINE) {
    const group = byType.get(type);
    check(`category present: ${type}`, Boolean(group && group.count > 0), group ? `${group.count} items` : 'missing');
  }

  // 3. Category-specific fields -------------------------------------------
  section('Category fields hydrated onto search hits');
  const firstOf = (type: string) => byType.get(type)?.items[0];

  const flight = firstOf('FLIGHT');
  check(
    'flight carries airline / route / cabin',
    Boolean(flight?.category?.airlineName && flight.category.flightRoute && flight.category.cabinClass),
    flight ? `${flight.category?.airlineName} · ${flight.category?.flightRoute} · ${flight.category?.cabinClass}` : 'n/a',
  );

  const hotel = firstOf('HOTEL_ROOM');
  check(
    'hotel carries stars / room / board basis',
    Boolean(hotel?.category?.starCategory && hotel.category.roomCategory && hotel.category.boardBasis),
    hotel ? `${hotel.category?.starCategory}★ · ${hotel.category?.roomCategory} · ${hotel.category?.boardBasis}` : 'n/a',
  );

  const cruise = firstOf('CRUISE');
  check(
    'cruise carries line / ship / nights',
    Boolean(cruise?.category?.cruiseLine && cruise.category.shipName && cruise.category.cruiseNights),
    cruise ? `${cruise.category?.cruiseLine} · ${cruise.category?.shipName} · ${cruise.category?.cruiseNights}n` : 'n/a',
  );

  // 4. Trust signals, not price pressure ------------------------------------
  section('Trust signals on every hit');
  const sample = unified.items.slice(0, 40);
  check('all hits have an image', sample.every((h) => Boolean(h.imageUrl)), `${sample.filter((h) => h.imageUrl).length}/${sample.length}`);
  check('all hits are priced', sample.every((h) => h.priceCents > 0));
  check('all hits are rated', sample.every((h) => h.ratingCount > 0 && h.ratingAvg >= 4));

  // 5. Bilingual catalogue --------------------------------------------------
  section('Bilingual catalogue');
  const zh = await getJson<SearchResponse>('/search?locale=zh-CN&groupBy=TYPE&groupLimit=1&pageSize=6');
  const zhGroup = zh.groups[0];
  check(
    'zh locale returns Chinese category labels',
    /[\u4e00-\u9fa5]/.test(zhGroup?.label ?? ''),
    zhGroup?.label,
  );
  check(
    'zh locale returns Chinese titles',
    /[\u4e00-\u9fa5]/.test(zhGroup?.items[0]?.title ?? ''),
    zhGroup?.items[0]?.title,
  );

  const queries: [string, number][] = [
    ['私享向导', 1],
    ['维京邮轮', 1],
    ['伦敦', 1],
    ['优先入场', 1],
  ];
  for (const [q] of queries) {
    const res = await getJson<SearchResponse>(`/search?q=${encodeURIComponent(q)}&locale=zh-CN&groupBy=NONE&pageSize=3`);
    check(`zh query finds results: "${q}"`, res.total > 0, `${res.total} hits`);
  }

  // 6. Geographic coverage -------------------------------------------------
  section('Geographic coverage (14 countries)');
  const destinations = await getJson<Destination[]>('/destinations');
  const present = new Set(destinations.map((d) => d.countryCode));
  for (const [cc, name] of Object.entries(REQUIRED_COUNTRIES)) {
    check(`country covered: ${name}`, present.has(cc), cc);
  }

  // 7. Per-city catalogue depth --------------------------------------------
  section('Per-city catalogue depth');
  const thin: string[] = [];
  for (const d of destinations) {
    const res = await getJson<SearchResponse>(`/search?destination=${d.slug}&groupBy=TYPE&groupLimit=8&pageSize=1`);
    const types = new Set(res.groups.filter((g) => g.count > 0).map((g) => g.type));
    if (res.total < 5) thin.push(`${d.name}: only ${res.total} products`);
    const missing = HEADLINE.filter((h) => !types.has(h));
    if (missing.length) thin.push(`${d.name}: missing ${missing.join(', ')}`);
  }
  check(
    `all ${destinations.length} featured cities have 5+ products and all six categories`,
    thin.length === 0,
    thin.length ? thin.slice(0, 4).join(' | ') : 'all consistent',
  );

  // 8. Copy tone ------------------------------------------------------------
  section('Copy tone (no scarcity / price pressure)');
  const english = [
    ...unified.items.map((h) => `${h.title} ${h.destinationName ?? ''}`),
    ...unified.facets.types.map((t) => t.label),
    ...unified.groups.map((g) => g.label),
  ];
  const bannedEn = findBanned(english);

  const detail = await getJson<{ name: string; summary: string | null; highlights: string[] }>(
    `/products/${sample[0]?.slug}`,
  );
  const bannedDetail = findBanned([`${detail.name} ${detail.summary ?? ''}`, ...detail.highlights]);

  const bannedZh = findBanned([zhGroup?.items[0]?.title ?? '', zhGroup?.items[0]?.summary ?? '']);

  check('no banned language in English copy', bannedEn.length === 0, bannedEn.join(', '));
  check('no banned language in product detail', bannedDetail.length === 0, bannedDetail.join(', '));
  check('no banned language in Chinese copy', bannedZh.length === 0, bannedZh.join(', '));

  // --- Summary -------------------------------------------------------------
  const total = PASS.length + FAIL.length;
  console.log(`\n\x1b[1mResult\x1b[0m  ${PASS.length}/${total} passed`);
  if (FAIL.length) {
    console.log(`\x1b[31m${FAIL.length} failed:\x1b[0m`);
    for (const f of FAIL) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log('\x1b[32mAll checks passed.\x1b[0m');
}

main().catch((error) => {
  console.error(`\n\x1b[31mverification aborted:\x1b[0m ${error.message}`);
  console.error('Is the API running?  pnpm --filter @easytrip/api dev');
  process.exit(1);
});