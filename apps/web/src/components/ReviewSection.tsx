'use client';

import { useState } from 'react';
import type { ProductDetail } from '@/lib/api';
import { formatDate, relativeDay, stars } from '@/lib/format';

type Props = {
  slug: string;
  reviews: ProductDetail['reviews'];
  rating: ProductDetail['rating'];
};

const SORTS = [
  { value: 'RECENT', label: 'Most recent' },
  { value: 'MOST_HELPFUL', label: 'Most helpful' },
  { value: 'HIGHEST', label: 'Highest rated' },
  { value: 'LOWEST', label: 'Lowest rated' },
];

export function ReviewSection({ slug, reviews, rating }: Props) {
  const [sort, setSort] = useState('RECENT');
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? reviews : reviews.slice(0, 4);

  return (
    <section className="card card-pad stack">
      <div className="row-between wrap">
        <h2 style={{ fontSize: 18 }}>Traveller reviews</h2>
        <select
          className="select"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          style={{ width: 'auto' }}
          aria-label="Sort reviews"
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {rating.count === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>
          No reviews yet. Be the first to share your experience after your visit.
        </p>
      ) : (
        <>
          {/* Summary + distribution */}
          <div className="row wrap" style={{ gap: 'var(--sp-6)', alignItems: 'flex-start' }}>
            <div className="center" style={{ minWidth: 120 }}>
              <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em' }}>
                {rating.average.toFixed(1)}
              </div>
              <div className="rating-stars" aria-hidden>
                {stars(rating.average)}
              </div>
              <div className="tiny subtle" style={{ marginTop: 4 }}>
                {rating.count.toLocaleString()} reviews
              </div>
            </div>

            <div className="grow stack-sm" style={{ minWidth: 220 }}>
              {rating.breakdown
                .slice()
                .reverse()
                .map((row) => (
                  <div key={row.stars} className="row" style={{ gap: 'var(--sp-2)' }}>
                    <span className="tiny muted nowrap" style={{ width: 40 }}>
                      {row.stars} star
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 7,
                        borderRadius: 4,
                        background: 'var(--bg-muted)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${row.percent}%`,
                          height: '100%',
                          background: 'var(--brand-500)',
                        }}
                      />
                    </div>
                    <span className="tiny subtle" style={{ width: 34, textAlign: 'right' }}>
                      {row.percent}%
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <hr className="divider" style={{ margin: 'var(--sp-2) 0' }} />

          {/* Individual reviews */}
          <div className="stack">
            {visible.map((review) => (
              <article key={review.id} className="stack-sm" style={{ paddingBottom: 'var(--sp-4)' }}>
                <div className="row-between wrap">
                  <div className="row" style={{ gap: 'var(--sp-3)' }}>
                    <span
                      aria-hidden
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        background: 'var(--brand-100)',
                        color: 'var(--brand-700)',
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {(review.author?.name ?? 'V').charAt(0)}
                    </span>
                    <div>
                      <div className="row" style={{ gap: 'var(--sp-2)' }}>
                        <span className="small bold">{review.author?.name ?? 'Voyahub traveller'}</span>
                        {review.verified && (
                          <span className="badge badge-positive" style={{ fontSize: 10.5 }}>
                            ✓ Verified booking
                          </span>
                        )}
                      </div>
                      <div className="tiny subtle">{formatDate(review.createdAt)}</div>
                    </div>
                  </div>
                  <div className="rating-stars small" aria-hidden>
                    {stars(review.rating)}
                  </div>
                </div>

                {review.title && <h4 style={{ fontSize: 14.5 }}>{review.title}</h4>}
                <p className="small" style={{ margin: 0, color: 'var(--text-muted)' }}>
                  {review.body}
                </p>

                {review.merchantReply && (
                  <div
                    className="panel small"
                    style={{ borderLeft: '3px solid var(--brand-500)', padding: 'var(--sp-3)' }}
                  >
                    <div className="tiny bold" style={{ color: 'var(--brand-700)' }}>
                      Response from the operator
                    </div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {review.merchantReply}
                    </div>
                  </div>
                )}

                {review.media.length > 0 && (
                  <div className="row wrap" style={{ gap: 'var(--sp-2)' }}>
                    {review.media.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt=""
                        style={{ width: 84, height: 84, borderRadius: 8, objectFit: 'cover' }}
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}

                <span className="tiny subtle">
                  {review.helpfulCount > 0 && `${review.helpfulCount} found this helpful · `}
                  <a href={`/products/${slug}#reviews`} style={{ color: 'var(--brand-600)' }}>
                    Report
                  </a>
                </span>
              </article>
            ))}
          </div>

          {reviews.length > 4 && (
            <button className="btn btn-secondary" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Show fewer reviews' : `Show all ${reviews.length} reviews`}
            </button>
          )}

          <p className="tiny subtle" style={{ margin: 0 }}>
            Reviews are only accepted from travellers who completed a booking on Voyahub.
          </p>
        </>
      )}
    </section>
  );
}