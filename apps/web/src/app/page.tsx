import Link from 'next/link';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { ProductCard } from '@/components/ProductCard';

// Destination rails and curated collections change slowly; revalidate hourly.
export const revalidate = 3600;

const TRUST_POINTS = [
  'Instant e-tickets on most bookings',
  'Free cancellation up to 24 hours',
  'Skip-the-line options in 20+ cities',
  'Secure checkout · no booking fees',
];

export default async function HomePage() {
  // Every rail is independent: one failing call must not blank the page.
  const [destinations, trending, freeCancel, skipLine, topRated] = await Promise.all([
    api.destinations().catch(() => []),
    api.collection('trending').catch(() => null),
    api.collection('free-cancellation').catch(() => null),
    api.collection('skip-the-line').catch(() => null),
    api.collection('top-rated').catch(() => null),
  ]);

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero + search                                                  */}
      {/* ---------------------------------------------------------------- */}
      <section
        style={{
          background: 'linear-gradient(135deg, var(--brand-800) 0%, var(--brand-600) 55%, var(--brand-500) 100%)',
          color: '#fff',
          padding: 'var(--sp-7) 0 var(--sp-8)',
        }}
      >
        <div className="container">
          <div className="stack" style={{ maxWidth: 720 }}>
            <h1 style={{ fontSize: 38, letterSpacing: '-0.03em' }}>
              Book the thing you actually want to do
            </h1>
            <p style={{ fontSize: 17, opacity: 0.9, maxWidth: 560 }}>
              Skip-the-line tickets, guided tours, river cruises and day trips across Europe and North
              America. One checkout, instant e-tickets, free cancellation on most bookings.
            </p>
          </div>

          <SearchBox />

          <div className="row wrap" style={{ gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
            {TRUST_POINTS.map((point) => (
              <span key={point} className="small" style={{ opacity: 0.9, display: 'inline-flex', gap: 6 }}>
                <span aria-hidden>✓</span>
                {point}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="container">
        {/* -------------------------------------------------------------- */}
        {/* Destination grid                                              */}
        {/* -------------------------------------------------------------- */}
        {destinations.length > 0 && (
          <section style={{ padding: 'var(--sp-7) 0' }}>
            <div className="row-between" style={{ marginBottom: 'var(--sp-4)' }}>
              <div>
                <h2>Where to next?</h2>
                <p className="small muted" style={{ margin: 0 }}>
                  Popular destinations with instant confirmation
                </p>
              </div>
              <Link href="/search" className="btn btn-ghost btn-sm">
                See all →
              </Link>
            </div>

            <div className="grid grid-4">
              {destinations.slice(0, 8).map((destination) => (
                <Link
                  key={destination.slug}
                  href={`/search?destination=${destination.slug}`}
                  className="card card-hover"
                  style={{ color: 'inherit' }}
                >
                  <div style={{ position: 'relative', height: 132 }}>
                    {destination.heroImageUrl ? (
                      <img
                        src={destination.heroImageUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                    ) : (
                      <div className="skeleton" style={{ width: '100%', height: '100%' }} />
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.65), transparent 60%)',
                      }}
                    />
                    <div style={{ position: 'absolute', bottom: 10, left: 12, color: '#fff' }}>
                      <div className="bold" style={{ fontSize: 16 }}>
                        {destination.name}
                      </div>
                      <div className="tiny" style={{ opacity: 0.85 }}>
                        {destination.productCount} experiences
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* -------------------------------------------------------------- */}
        {/* Trending                                                      */}
        {/* -------------------------------------------------------------- */}
        {trending && trending.items.length > 0 && <Rail title={trending.title} subtitle="What other travellers are booking right now" hits={trending.items} />}

        {/* -------------------------------------------------------------- */}
        {/* Promo split: free cancellation + skip the line                */}
        {/* -------------------------------------------------------------- */}
        <section style={{ paddingBottom: 'var(--sp-7)' }}>
          <div className="grid grid-2">
            {freeCancel && (
              <CollectionCard
                title="Free cancellation"
                subtitle="Cancel up to 24 hours before, get every cent back"
                href="/collections/free-cancellation"
                hits={freeCancel.items.slice(0, 3)}
                tone="success"
              />
            )}
            {skipLine && (
              <CollectionCard
                title="Skip the line"
                subtitle="Priority entry so you walk straight past the queue"
                href="/collections/skip-the-line"
                hits={skipLine.items.slice(0, 3)}
                tone="brand"
              />
            )}
          </div>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Top rated                                                     */}
        {/* -------------------------------------------------------------- */}
        {topRated && topRated.items.length > 0 && (
          <Rail
            title="Traveller favourites"
            subtitle="Rated 4.5 and above by people who actually went"
            hits={topRated.items}
          />
        )}

        {/* -------------------------------------------------------------- */}
        {/* Loyalty pitch                                                 */}
        {/* -------------------------------------------------------------- */}
        <section style={{ padding: 'var(--sp-7) 0' }}>
          <div
            className="card card-pad"
            style={{
              background: 'linear-gradient(135deg, var(--brand-50), var(--surface))',
              borderColor: 'var(--brand-100)',
              padding: 'var(--sp-6)',
            }}
          >
            <div className="row-between wrap" style={{ gap: 'var(--sp-5)' }}>
              <div className="stack-sm" style={{ maxWidth: 480 }}>
                <span className="badge badge-brand">Voyahub Rewards</span>
                <h2>Earn a point for every dollar</h2>
                <p className="muted">
                  100 points = $1 off. Reach Silver, Gold and Platinum for early access to flash sales,
                  free ticket changes and priority support.
                </p>
              </div>
              <Link href="/loyalty" className="btn btn-primary btn-lg">
                Join the programme
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function SearchBox() {
  return (
    <form
      action="/search"
      method="get"
      className="card"
      style={{
        marginTop: 'var(--sp-6)',
        padding: 'var(--sp-3)',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.2fr) minmax(0, 1fr) auto',
        gap: 'var(--sp-2)',
        alignItems: 'center',
      }}
    >
      <div>
        <label htmlFor="q" className="tiny subtle bold" style={{ display: 'block', marginBottom: 2 }}>
          What do you want to do?
        </label>
        <input
          id="q"
          name="q"
          className="input"
          placeholder="Louvre, bike tour, flamenco, river cruise…"
          style={{ border: 'none', padding: '4px 0', fontSize: 16 }}
        />
      </div>

      <div>
        <label htmlFor="destination" className="tiny subtle bold" style={{ display: 'block', marginBottom: 2 }}>
          Where
        </label>
        <input
          id="destination"
          name="destination"
          className="input"
          placeholder="City or destination"
          style={{ border: 'none', padding: '4px 0', fontSize: 16 }}
        />
      </div>

      <div>
        <label htmlFor="date" className="tiny subtle bold" style={{ display: 'block', marginBottom: 2 }}>
          When
        </label>
        <input
          id="date"
          name="date"
          type="date"
          className="input"
          style={{ border: 'none', padding: '4px 0', fontSize: 16 }}
        />
      </div>

      <button type="submit" className="btn btn-accent btn-lg" style={{ height: 48 }}>
        Search
      </button>
    </form>
  );
}

function Rail({ title, subtitle, hits }: { title: string; subtitle?: string; hits: Parameters<typeof ProductCard>[0]['hit'][] }) {
  return (
    <section style={{ paddingBottom: 'var(--sp-7)' }}>
      <div className="row-between" style={{ marginBottom: 'var(--sp-4)' }}>
        <div>
          <h2>{title}</h2>
          {subtitle && (
            <p className="small muted" style={{ margin: 0 }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="stack">
        {hits.slice(0, 5).map((hit) => (
          <ProductCard key={hit.productId} hit={hit} />
        ))}
      </div>
    </section>
  );
}

function CollectionCard({
  title,
  subtitle,
  href,
  hits,
  tone,
}: {
  title: string;
  subtitle: string;
  href: string;
  hits: Parameters<typeof ProductCard>[0]['hit'][];
  tone: 'brand' | 'success';
}) {
  return (
    <div
      className="card"
      style={{
        padding: 'var(--sp-5)',
        background: tone === 'success' ? 'var(--success-50)' : 'var(--brand-50)',
        borderColor: tone === 'success' ? 'var(--success-600)' : 'var(--brand-100)',
      }}
    >
      <div className="row-between" style={{ marginBottom: 'var(--sp-4)' }}>
        <div>
          <h3>{title}</h3>
          <p className="small muted" style={{ margin: 0 }}>
            {subtitle}
          </p>
        </div>
        <Link href={href} className="btn btn-secondary btn-sm">
          Browse
        </Link>
      </div>

      <div className="stack-sm">
        {hits.map((hit) => (
          <Link
            key={hit.productId}
            href={`/products/${hit.slug}`}
            className="row"
            style={{
              padding: 'var(--sp-2)',
              background: 'var(--surface)',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--border)',
              gap: 'var(--sp-3)',
            }}
          >
            {hit.imageUrl && (
              <img
                src={hit.imageUrl}
                alt=""
                style={{ width: 46, height: 46, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                loading="lazy"
              />
            )}
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="small bold truncate">{hit.title}</div>
              <div className="tiny subtle">
                {hit.ratingCount > 0 ? `★ ${hit.ratingAvg.toFixed(1)} (${hit.ratingCount})` : 'New listing'}
              </div>
            </div>
            <div className="bold nowrap">{formatMoney(hit.priceCents, hit.currency)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}