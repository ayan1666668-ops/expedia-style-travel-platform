'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ProductDetail } from '@/lib/api';
import { formatDate, formatMoney, relativeDay } from '@/lib/format';

/**
 * The sticky booking panel. Everything a shopper needs to commit is here:
 * date, option, quantity, live price breakdown and the checkout CTA.
 *
 * State is entirely client-side and the URL is kept in sync so the choice
 * survives a refresh and is shareable.
 */
export function BookingPanel({
  product,
  selectedDate,
  quantity: initialQuantity,
  lowestPrice,
}: {
  product: ProductDetail;
  selectedDate: string;
  quantity: number;
  lowestPrice: number | null;
}) {
  const router = useRouter();

  const [ticketTypeId, setTicketTypeId] = useState(product.ticketTypes[0]?.id ?? '');
  const [quantity, setQuantity] = useState(Math.min(Math.max(1, initialQuantity), product.ticketTypes[0]?.maxPerOrder ?? 1));
  const [coupon, setCoupon] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selected = product.ticketTypes.find((t) => t.id === ticketTypeId) ?? product.ticketTypes[0];

  // The server is the source of truth for money. It returns authoritative
  // per-unit figures for the requested quantity, so scale those linearly and
  // let checkout re-price server-side before charging anything.
  const priced = useMemo(() => {
    if (!selected) return null;
    return {
      lineTotal: selected.totalPerUnitCents * quantity,
      discountTotal: selected.discountCents * quantity,
    };
  }, [selected, quantity]);

  if (!selected || !priced) {
    return (
      <aside className="booking-panel">
        <p className="muted">This experience is not currently bookable online.</p>
      </aside>
    );
  }

  const maxQty = selected.maxPerOrder;

  function changeQuantity(next: number) {
    const clamped = Math.min(Math.max(selected.minPerOrder, next), maxQty);
    setQuantity(clamped);
  }

  function updateUrl(nextTicketTypeId: string, nextQuantity: number) {
    const params = new URLSearchParams({ date: selectedDate, quantity: String(nextQuantity) });
    router.replace(`/products/${product.slug}?${params.toString()}`, { scroll: false });
  }

  async function checkout() {
    setSubmitting(true);
    const params = new URLSearchParams({
      ticketTypeId: selected.id,
      date: selectedDate,
      quantity: String(quantity),
    });
    if (coupon.trim()) params.set('coupon', coupon.trim());
    router.push(`/checkout?${params.toString()}`);
  }

  const offPercent =
    selected.compareAtPriceCents && selected.compareAtPriceCents > selected.totalPerUnitCents
      ? Math.round(
          ((selected.compareAtPriceCents - selected.totalPerUnitCents) / selected.compareAtPriceCents) * 100,
        )
      : null;

  return (
    <aside className="booking-panel">
      {/* Price anchor */}
      <div>
        <div className="row wrap" style={{ gap: 'var(--sp-2)', marginBottom: 4 }}>
          {offPercent && <span className="badge badge-accent">-{offPercent}% today</span>}
          {lowestPrice !== null && lowestPrice < selected.totalPerUnitCents && (
            <span className="badge badge-positive">Lowest price</span>
          )}
        </div>
        <div className="row" style={{ alignItems: 'baseline', gap: 'var(--sp-2)' }}>
          <span className="price-now" style={{ fontSize: 26 }}>
            {formatMoney(selected.totalPerUnitCents, selected.currency)}
          </span>
          {selected.compareAtPriceCents && offPercent && (
            <span className="price-was">{formatMoney(selected.compareAtPriceCents, selected.currency)}</span>
          )}
        </div>
        <div className="tiny subtle">per person, taxes &amp; fees included</div>
      </div>

      {/* Date summary */}
      <div className="panel stack-sm" style={{ padding: 'var(--sp-3)' }}>
        <div className="row-between">
          <span className="small muted">Date</span>
          <a
            href={`/products/${product.slug}?quantity=${quantity}`}
            className="small bold"
            style={{ color: 'var(--brand-600)' }}
          >
            {formatDate(selectedDate)} · {relativeDay(selectedDate)}
          </a>
        </div>
        {product.destination && (
          <div className="row-between">
            <span className="small muted">Location</span>
            <span className="small bold">{product.destination.name}</span>
          </div>
        )}
      </div>

      {/* Options */}
      <div className="stack-sm">
        <span className="label">Choose an option</span>
        {product.ticketTypes.map((ticketType) => (
          <label
            key={ticketType.id}
            className={`ticket-option ${ticketType.id === selected.id ? 'selected' : ''}`}
            onClick={() => {
              setTicketTypeId(ticketType.id);
              updateUrl(ticketType.id, Math.min(quantity, ticketType.maxPerOrder));
            }}
          >
            <input
              type="radio"
              name="ticketType"
              value={ticketType.id}
              checked={ticketType.id === selected.id}
              onChange={() => {
                setTicketTypeId(ticketType.id);
                updateUrl(ticketType.id, Math.min(quantity, ticketType.maxPerOrder));
              }}
              style={{ pointerEvents: 'none' }}
            />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="small bold">{ticketType.name}</div>
              {ticketType.description && <div className="tiny subtle">{ticketType.description}</div>}
              {ticketType.discountCents > 0 && (
                <div className="tiny" style={{ color: 'var(--success-600)', fontWeight: 600 }}>
                  Save {formatMoney(ticketType.discountCents, ticketType.currency)} with this option
                </div>
              )}
            </div>
            <div className="right nowrap">
              <div className="bold small">{formatMoney(ticketType.totalPerUnitCents, ticketType.currency)}</div>
              <div className="tiny subtle">per person</div>
            </div>
          </label>
        ))}
      </div>

      {/* Quantity */}
      <div className="row-between">
        <span className="label">
          {selected.minPerOrder > 1 ? `Guests (min ${selected.minPerOrder})` : 'Guests'}
        </span>
        <div className="qty-control">
          <button
            type="button"
            onClick={() => {
              changeQuantity(quantity - 1);
              updateUrl(selected.id, Math.max(selected.minPerOrder, quantity - 1));
            }}
            disabled={quantity <= selected.minPerOrder}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span>{quantity}</span>
          <button
            type="button"
            onClick={() => {
              changeQuantity(quantity + 1);
              updateUrl(selected.id, Math.min(maxQty, quantity + 1));
            }}
            disabled={quantity >= maxQty}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      {/* Discount codes applied at checkout */}
      <div className="field">
        <label htmlFor="coupon" className="label">
          Promo code
        </label>
        <input
          id="coupon"
          className="input"
          placeholder="Have a code? Try WELCOME10"
          value={coupon}
          onChange={(event) => setCoupon(event.target.value)}
        />
      </div>

      {/* Price breakdown */}
      <div className="panel">
        <div className="price-row">
          <span className="label">
            {formatMoney(selected.totalPerUnitCents, selected.currency)} × {quantity}
          </span>
          <span className="bold">{formatMoney(priced.lineTotal, selected.currency)}</span>
        </div>
        {priced.discountTotal > 0 && (
          <div className="price-row">
            <span className="label" style={{ color: 'var(--success-600)' }}>
              Promotion savings
            </span>
            <span style={{ color: 'var(--success-600)', fontWeight: 600 }}>
              −{formatMoney(priced.discountTotal, selected.currency)}
            </span>
          </div>
        )}
        <div className="price-row total">
          <span>Total</span>
          <span>{formatMoney(priced.lineTotal, selected.currency)}</span>
        </div>
      </div>

      <button className="btn btn-accent btn-lg btn-block" onClick={checkout} disabled={submitting}>
        {submitting ? 'Preparing checkout…' : 'Reserve & continue to payment'}
      </button>

      <p className="tiny subtle center">
        You won&rsquo;t be charged yet. Free cancellation up to{' '}
        {product.cancellationPolicy?.freeCancelHours ?? 24} hours before.
      </p>

      {/* Applied pricing rules — transparency about why the price moved */}
      {selected.appliedRules.length > 0 && (
        <div className="stack-sm">
          <span className="label">Price adjustments applied</span>
          {selected.appliedRules.map((rule) => (
            <div key={rule.ruleId} className="row-between tiny">
              <span className="muted truncate">{rule.name}</span>
              <span className="nowrap" style={{ color: rule.deltaCents < 0 ? 'var(--success-600)' : 'var(--text-muted)' }}>
                {rule.deltaCents < 0 ? '−' : '+'}
                {formatMoney(Math.abs(rule.deltaCents), selected.currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}