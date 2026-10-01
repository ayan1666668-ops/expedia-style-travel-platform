import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { ProductCard } from '@/components/ProductCard';
import { EmptyState } from '@/components/PageShell';

export const metadata: Metadata = {
  title: 'Search tickets, tours and experiences',
  description: 'Filter by price, rating, cancellation policy and destination across 20+ cities.',
};

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SORT_OPTIONS = [
  { value: 'RELEVANCE', label: 'Recommended' },
  { value: 'PRICE_ASC', label: 'Price: low to high' },
  { value: 'PRICE_DESC', label: 'Price: high to low' },
  { value: 'RATING', label: 'Top rated' },
  { value: 'POPULARITY', label: 'Most popular' },
];

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

/**
 * Filters arrive as strings from the query string, but a few are normalised
 * before use (page is a number, flags are booleans). One shared alias keeps the
 * chip links, the sidebar form and the API call reading the same values.
 */
type ActiveFilters = Record<string, string | number | undefined> & { page: number };

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;

  const query: ActiveFilters = {
    q: first(params.q),
    destination: first(params.destination),
    type: first(params.type),
    date: first(params.date),
    minPrice: first(params.minPrice),
    maxPrice: first(params.maxPrice),
    minRating: first(params.minRating),
    instantConfirm: first(params.instantConfirm),
    freeCancellation: first(params.freeCancellation),
    skipTheLine: first(params.skipTheLine),
    sort: first(params.sort),
    page: Number(first(params.page) ?? 1),
  };

  const result = await api
    .search({
      q: query.q,
      destination: query.destination,
      type: query.type,
      date: query.date,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      minRating: query.minRating,
      instantConfirm: query.instantConfirm,
      freeCancellation: query.freeCancellation,
      skipTheLine: query.skipTheLine,
      sort: query.sort,
      page: query.page,
      pageSize: 20,
    })
    .catch(() => null);

  if (!result) {
    return (
      <div className="container" style={{ padding: 'var(--sp-8) 0' }}>
        <EmptyState
          title="Search is unavailable right now"
          description="We could not reach the search service. Please try again in a moment."
          action={{ label: 'Back to home', href: '/' }}
        />
      </div>
    );
  }

  const heading = query.destination
    ? `Experiences in ${String(query.destination).replace(/-/g, ' ')}`
    : query.q
      ? `Results for “${query.q}”`
      : 'All experiences';

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-5)', paddingBottom: 'var(--sp-7)' }}>
      {/* ------------------------------------------------------------------ */}
      {/* Header + summary                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="row-between wrap" style={{ marginBottom: 'var(--sp-4)' }}>
        <div>
          <h1 style={{ fontSize: 26 }} className="capitalize">
            {heading}
          </h1>
          <p className="small muted" style={{ margin: 0 }}>
            {result.total.toLocaleString()} option{result.total === 1 ? '' : 's'} found
            {query.date && ` · ${query.date}`}
            {result.tookMs !== undefined && ` · ${result.tookMs}ms`}
          </p>
        </div>

        <form method="get" className="row" style={{ gap: 'var(--sp-2)' }}>
          {/* Preserve active filters when the shopper changes sort. */}
          {query.q && <input type="hidden" name="q" value={query.q} />}
          {query.destination && <input type="hidden" name="destination" value={query.destination} />}
          {query.type && <input type="hidden" name="type" value={query.type} />}
          {query.date && <input type="hidden" name="date" value={query.date} />}
          {query.freeCancellation && <input type="hidden" name="freeCancellation" value={query.freeCancellation} />}
          {query.skipTheLine && <input type="hidden" name="skipTheLine" value={query.skipTheLine} />}
          {query.instantConfirm && <input type="hidden" name="instantConfirm" value={query.instantConfirm} />}
          {query.minPrice && <input type="hidden" name="minPrice" value={query.minPrice} />}
          {query.maxPrice && <input type="hidden" name="maxPrice" value={query.maxPrice} />}
          {query.minRating && <input type="hidden" name="minRating" value={query.minRating} />}

          <label htmlFor="sort" className="small muted nowrap">
            Sort
          </label>
          <select id="sort" name="sort" className="select" defaultValue={query.sort ?? 'RELEVANCE'} style={{ width: 'auto' }}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary btn-sm">
            Apply
          </button>
        </form>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Quick filter chips                                                 */}
      {/* ------------------------------------------------------------------ */}
      <FilterChips active={query} />

      <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--sp-5)', marginTop: 'var(--sp-4)' }}>
        {/* ---------------------------------------------------------------- */}
        {/* Filter sidebar                                                   */}
        {/* ---------------------------------------------------------------- */}
        <aside style={{ width: 244, flexShrink: 0 }} className="sticky-filters">
          <FilterPanel facets={result.facets} active={query} />
        </aside>

        {/* ---------------------------------------------------------------- */}
        {/* Results                                                          */}
        {/* ---------------------------------------------------------------- */}
        <div className="grow stack">
          {result.items.length === 0 ? (
            <EmptyState
              title="Nothing matches those filters"
              description="Try widening your price range, removing a date, or searching a nearby city."
              action={{ label: 'Clear all filters', href: '/search' }}
            />
          ) : (
            <>
              {result.items.map((hit) => (
                <ProductCard key={hit.productId} hit={hit} />
              ))}

              {result.totalPages > 1 && <Pagination result={result} params={query} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function FilterChips({ active }: { active: ActiveFilters }) {
  const chips: { label: string; active: boolean; href: string }[] = [
    {
      label: 'Free cancellation',
      active: Boolean(active.freeCancellation),
      href: toggleParam(active, 'freeCancellation', 'true'),
    },
    {
      label: 'Skip the line',
      active: Boolean(active.skipTheLine),
      href: toggleParam(active, 'skipTheLine', 'true'),
    },
    {
      label: 'Instant confirmation',
      active: Boolean(active.instantConfirm),
      href: toggleParam(active, 'instantConfirm', 'true'),
    },
    {
      label: 'Top rated 4.5+',
      active: active.minRating === '4.5',
      href: toggleParam(active, 'minRating', '4.5'),
    },
  ];

  return (
    <div className="row wrap" style={{ gap: 'var(--sp-2)' }}>
      {chips.map((chip) => (
        <Link
          key={chip.label}
          href={chip.href}
          className={`badge ${chip.active ? 'badge-brand' : 'badge-neutral'}`}
          style={{ padding: '7px 13px', fontSize: 13 }}
        >
          {chip.active && '✓ '}
          {chip.label}
        </Link>
      ))}
    </div>
  );
}

/** Builds a query string with one parameter added or removed. */
function toggleParam(active: ActiveFilters, key: string, value: string): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(active)) {
    if (v === undefined || v === null || v === '') continue;
    if (k === key) continue;
    if (k === 'page') continue;
    if (k === 'sort') continue;
    params.set(k, String(v));
  }

  const currentlyOn = Boolean(active[key]);
  params.set(key, currentlyOn ? '' : value);
  if (currentlyOn) params.delete(key);

  const query = params.toString();
  return query ? `/search?${query}` : '/search';
}

function FilterPanel({
  facets,
  active,
}: {
  facets: Awaited<ReturnType<typeof api.search>>['facets'];
  active: ActiveFilters;
}) {
  const hasFilters =
    active.type || active.minPrice || active.maxPrice || active.minRating || active.freeCancellation || active.skipTheLine;

  return (
    <form method="get" className="stack" style={{ gap: 'var(--sp-5)' }}>
      {active.q && <input type="hidden" name="q" value={String(active.q)} />}
      {active.destination && <input type="hidden" name="destination" value={String(active.destination)} />}
      {active.date && <input type="hidden" name="date" value={String(active.date)} />}
      {active.sort && <input type="hidden" name="sort" value={String(active.sort)} />}

      <div className="card card-pad stack" style={{ gap: 'var(--sp-4)' }}>
        <div className="row-between">
          <h3 style={{ fontSize: 15 }}>Filters</h3>
          {hasFilters && (
            <Link href="/search" className="tiny" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>
              Clear all
            </Link>
          )}
        </div>

        {/* Category */}
        {facets.types.length > 0 && (
          <div className="field">
            <span className="label">Category</span>
            <div className="stack-sm">
              <label className="checkbox-row small">
                <input type="radio" name="type" value="" defaultChecked={!active.type} />
                All categories
              </label>
              {facets.types.slice(0, 6).map((type) => (
                <label key={type.value} className="checkbox-row small">
                  <input type="radio" name="type" value={type.value} defaultChecked={active.type === type.value} />
                  <span className="grow">{type.label}</span>
                  <span className="tiny subtle">{type.count}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Price */}
        <div className="field">
          <span className="label">Price per person</span>
          <div className="row" style={{ gap: 'var(--sp-2)' }}>
            <input
              className="input"
              type="number"
              name="minPrice"
              placeholder="Min"
              defaultValue={active.minPrice ? String(active.minPrice) : ''}
              style={{ padding: '8px 10px' }}
            />
            <span className="subtle">–</span>
            <input
              className="input"
              type="number"
              name="maxPrice"
              placeholder="Max"
              defaultValue={active.maxPrice ? String(active.maxPrice) : ''}
              style={{ padding: '8px 10px' }}
            />
          </div>
          {facets.priceRange.maxCents > 0 && (
            <span className="tiny subtle">
              Available from {formatMoney(facets.priceRange.minCents)} to {formatMoney(facets.priceRange.maxCents)}
            </span>
          )}
        </div>

        {/* Rating */}
        <div className="field">
          <span className="label">Rating</span>
          <div className="stack-sm">
            <label className="checkbox-row small">
              <input type="radio" name="minRating" value="" defaultChecked={!active.minRating} />
              Any rating
            </label>
            {[4.5, 4, 3.5].map((rating) => (
              <label key={rating} className="checkbox-row small">
                <input type="radio" name="minRating" value={rating} defaultChecked={active.minRating === String(rating)} />
                <span className="rating-stars" aria-hidden>
                  {'★'.repeat(Math.floor(rating))}
                </span>
                <span>{rating} &amp; up</span>
              </label>
            ))}
          </div>
        </div>

        {/* Convenience */}
        <div className="field">
          <span className="label">Booking options</span>
          <div className="stack-sm">
            <label className="checkbox-row small">
              <input type="checkbox" name="freeCancellation" value="true" defaultChecked={Boolean(active.freeCancellation)} />
              Free cancellation
            </label>
            <label className="checkbox-row small">
              <input type="checkbox" name="skipTheLine" value="true" defaultChecked={Boolean(active.skipTheLine)} />
              Skip the line
            </label>
            <label className="checkbox-row small">
              <input type="checkbox" name="instantConfirm" value="true" defaultChecked={Boolean(active.instantConfirm)} />
              Instant confirmation
            </label>
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-block">
          Apply filters
        </button>
      </div>

      {/* Top destinations */}
      {facets.destinations.length > 0 && (
        <div className="card card-pad stack" style={{ gap: 'var(--sp-2)' }}>
          <h3 style={{ fontSize: 14 }}>Top destinations</h3>
          <div className="stack-sm">
            {facets.destinations.slice(0, 8).map((destination) => (
              <Link
                key={destination.value}
                href={`/search?destination=${encodeURIComponent(destination.value)}`}
                className="row-between small"
                style={{ color: 'var(--text-muted)' }}
              >
                <span className="truncate">{destination.label}</span>
                <span className="tiny subtle">{destination.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

function Pagination({
  result,
  params,
}: {
  result: Awaited<ReturnType<typeof api.search>>;
  params: Record<string, unknown>;
}) {
  const href = (page: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '' || key === 'page') continue;
      search.set(key, String(value));
    }
    if (page > 1) search.set('page', String(page));
    const query = search.toString();
    return query ? `/search?${query}` : '/search';
  };

  // Window the page numbers so the pager stays readable on long result sets.
  const pages: number[] = [];
  const start = Math.max(1, result.page - 2);
  const end = Math.min(result.totalPages, start + 4);
  for (let page = start; page <= end; page += 1) pages.push(page);

  return (
    <nav className="row" style={{ gap: 'var(--sp-2)', justifyContent: 'center', paddingTop: 'var(--sp-4)' }}>
      {result.page > 1 && (
        <Link href={href(result.page - 1)} className="btn btn-secondary btn-sm">
          ← Previous
        </Link>
      )}

      {pages.map((page) => (
        <Link
          key={page}
          href={href(page)}
          className={`btn btn-sm ${page === result.page ? 'btn-primary' : 'btn-secondary'}`}
          aria-current={page === result.page ? 'page' : undefined}
        >
          {page}
        </Link>
      ))}

      {result.page < result.totalPages && (
        <Link href={href(result.page + 1)} className="btn btn-secondary btn-sm">
          Next →
        </Link>
      )}
    </nav>
  );
}