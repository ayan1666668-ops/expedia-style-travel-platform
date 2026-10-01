import Link from 'next/link';
import type { SearchHit } from '@/lib/api';
import { discountPercent, formatMoney, stars } from '@/lib/format';

function priceNote(hit: SearchHit): string {
  if (hit.freeCancellation) return 'Free cancellation';
  if (hit.instantConfirm) return 'Instant confirmation';
  return 'Confirmation required';
}

export function ProductCard({ hit }: { hit: SearchHit }) {
  const off = discountPercent(hit.priceCents, hit.compareAtPriceCents);

  return (
    <article className="product-card">
      <Link href={`/products/${hit.slug}`} className="product-media" aria-hidden tabIndex={-1}>
        {hit.imageUrl ? (
          // Plain <img> keeps the build dependency-free; Next's image optimiser
          // would need every merchant CDN allow-listed.
          <img src={hit.imageUrl} alt="" loading="lazy" />
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: 28 }}>🖼</div>
        )}
        {hit.badge && (
          <span
            className="badge badge-accent"
            style={{ position: 'absolute', top: 8, left: 8, boxShadow: 'var(--shadow-sm)' }}
          >
            {hit.badge}
          </span>
        )}
      </Link>

      <div className="product-body">
        {hit.destinationName && (
          <span className="tiny subtle bold" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {hit.destinationName}
          </span>
        )}

        <Link href={`/products/${hit.slug}`} className="product-title">
          {hit.title}
        </Link>

        {hit.summary && (
          <p className="small muted truncate" style={{ maxWidth: '62ch' }}>
            {hit.summary}
          </p>
        )}

        <div className="row wrap" style={{ gap: 'var(--sp-3)' }}>
          {hit.ratingCount > 0 && (
            <span className="rating">
              <span className="rating-stars" aria-hidden>
                {stars(hit.ratingAvg)}
              </span>
              <span className="rating-score">{hit.ratingAvg.toFixed(1)}</span>
              <span className="rating-count">({hit.ratingCount.toLocaleString()})</span>
            </span>
          )}

          {hit.skipTheLine && <span className="badge badge-brand">Skip the line</span>}
          {hit.freeCancellation && <span className="badge badge-positive">Free cancellation</span>}
          {hit.instantConfirm && !hit.freeCancellation && !hit.skipTheLine && (
            <span className="badge badge-neutral">Instant confirmation</span>
          )}
        </div>

        <div className="row wrap" style={{ gap: 'var(--sp-2)', marginTop: 'auto' }}>
          <span className="tiny subtle">{priceNote(hit)}</span>
          {hit.distanceKm !== null && <span className="tiny subtle">· {hit.distanceKm.toFixed(1)} km away</span>}
        </div>
      </div>

      <div className="product-price">
        <div>
          {off && (
            <div className="row" style={{ justifyContent: 'flex-end', gap: 5 }}>
              <span className="badge badge-accent">-{off}%</span>
            </div>
          )}
          <div className="price-now">{formatMoney(hit.priceCents, hit.currency)}</div>
          {hit.compareAtPriceCents && off && (
            <div className="price-was">{formatMoney(hit.compareAtPriceCents, hit.currency)}</div>
          )}
          <div className="price-note">per person</div>
        </div>

        <Link
          href={`/products/${hit.slug}`}
          className="btn btn-secondary btn-sm"
          style={{ marginTop: 'var(--sp-3)' }}
        >
          View deals
        </Link>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="product-card" aria-hidden>
      <div className="skeleton" style={{ width: 232, height: 168, borderRadius: 'var(--r-md)' }} />
      <div className="product-body">
        <div className="skeleton" style={{ height: 12, width: '35%' }} />
        <div className="skeleton" style={{ height: 18, width: '85%' }} />
        <div className="skeleton" style={{ height: 13, width: '100%' }} />
        <div className="skeleton" style={{ height: 13, width: '60%' }} />
      </div>
      <div className="product-price">
        <div className="skeleton" style={{ height: 20, width: 90, marginLeft: 'auto' }} />
        <div className="skeleton" style={{ height: 30, width: 110, marginTop: 'var(--sp-3)' }} />
      </div>
    </div>
  );
}