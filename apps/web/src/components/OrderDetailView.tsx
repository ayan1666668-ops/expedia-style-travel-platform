'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError, mediaUrl, type CancellationQuote, type OrderDetail } from '@/lib/api';
import { readToken } from '@/lib/session';
import { formatDate, formatDateTime, formatMoney, orderStatusLabel, orderStatusTone, relativeDay } from '@/lib/format';
import type { LocaleCode } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

export function OrderDetailView({
  orderId,
  initial,
  initialQuote = null,
  locale,
}: {
  orderId: string;
  /** Server-fetched order, when a valid session cookie was present. */
  initial?: OrderDetail | null;
  initialQuote?: CancellationQuote | null;
  locale: LocaleCode;
}) {
  const t = createTranslator(locale);
  const params = useSearchParams();
  const isNew = params.get('new') === '1';

  const [order, setOrder] = useState<OrderDetail | null>(initial ?? null);
  const [quote, setQuote] = useState<CancellationQuote | null>(initialQuote);
  const [loading, setLoading] = useState(initial == null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    // Nothing to do on the server-rendered path; re-fetching would be a wasted
    // round-trip and could briefly flash stale data after an in-page cancel.
    if (initial) return;

    const token = readToken();
    if (!token) {
      setError(t('account.signInToView'));
      setLoading(false);
      return;
    }

    api
      .order(orderId, token)
      .then((result) => {
        setOrder(result);
        // Only cancellable states get a refund quote.
        if (['CONFIRMED', 'PAID'].includes(result.status)) {
          api.cancellationQuote(orderId, token).then(setQuote).catch(() => undefined);
        }
      })
      .catch((caught) =>
        setError(
          caught instanceof ApiError && caught.status === 403
            ? t('account.orderNotYours')
            : t('account.couldNotLoadOrder'),
        ),
      )
      .finally(() => setLoading(false));
  }, [orderId, initial, t]);

  async function cancelOrder() {
    if (!order) return;
    if (!window.confirm(t('account.cancelConfirm'))) {
      return;
    }

    const token = readToken();
    if (!token) return;

    setCancelling(true);
    try {
      await api.cancelOrder(order.id, { reason: t('account.cancelReason') }, token);
      const refreshed = await api.order(order.id, token);
      setOrder(refreshed);
      setQuote(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('account.couldNotCancel'));
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="stack">
        <div className="skeleton" style={{ height: 90 }} />
        <div className="skeleton" style={{ height: 240 }} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="card card-pad center stack">
        <p className="muted">{error ?? t('account.orderNotFound')}</p>
        <Link href="/orders" className="btn btn-primary">
          {t('account.myBookings')}
        </Link>
      </div>
    );
  }

  const canCancel = ['CONFIRMED', 'PAID'].includes(order.status);
  const upcomingTickets = order.tickets.filter((ticket) => ticket.status === 'ISSUED');

  return (
    <div className="stack-lg">
      {isNew && (
        <div className="card card-pad" style={{ background: 'var(--success-50)', borderColor: 'var(--success-600)' }}>
          <div className="row" style={{ gap: 'var(--sp-3)' }}>
            <span style={{ fontSize: 22 }} aria-hidden>
              ✓
            </span>
            <div>
              <h3>{t('account.thanks')}</h3>
              <p className="small muted" style={{ margin: 0 }}>
                {t('account.thanksWithEmail', order.contactEmail)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="card card-pad">
        <div className="row-between wrap">
          <div>
            <div className="row" style={{ gap: 'var(--sp-2)' }}>
              <h1 className="mono" style={{ fontSize: 22 }}>
                {order.orderNumber}
              </h1>
              <span className={`badge badge-${orderStatusTone(order.status)}`}>
                {orderStatusLabel(order.status, locale)}
              </span>
            </div>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              {t('account.placedOn')} {formatDateTime(order.placedAt, locale)} · {order.contactEmail}
            </p>
          </div>
          <div className="right">
            <div className="bold" style={{ fontSize: 22 }}>
              {formatMoney(order.totals.totalCents, order.currency)}
            </div>
            {order.totals.refundedCents > 0 && (
              <div className="small" style={{ color: 'var(--success-600)' }}>
                {formatMoney(order.totals.refundedCents, order.currency)} {t('account.refunded')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="with-rail">
        <div className="with-rail-main stack-lg">
          {/* ---------------------------------------------------------------- */}
          {/* E-tickets                                                       */}
          {/* ---------------------------------------------------------------- */}
          {order.tickets.length > 0 && (
            <section className="stack">
              <h2 style={{ fontSize: 18 }}>{t('account.eTickets')}</h2>
              {order.tickets.map((ticket) => (
                <article key={ticket.id} className="ticket-pass">
                  <div className="ticket-pass-header">
                    <div style={{ minWidth: 0 }}>
                      <div className="tiny" style={{ opacity: 0.8 }}>
                        {ticket.destinationName ?? 'Voyahub'}
                      </div>
                      <div className="bold truncate" style={{ fontSize: 16 }}>
                        {ticket.productName}
                      </div>
                    </div>
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                      {ticket.status === 'REDEEMED'
                        ? t('account.used')
                        : relativeDay(ticket.serviceDate, new Date(), locale)}
                    </span>
                  </div>

                  <div className="ticket-perf" />

                  <div className="ticket-pass-body">
                    {mediaUrl(ticket.qrImageUrl) ? (
                      <img src={mediaUrl(ticket.qrImageUrl) ?? ''} alt={`QR code for ticket ${ticket.ticketNumber}`} className="ticket-qr" />
                    ) : (
                      <div className="ticket-qr" style={{ display: 'grid', placeItems: 'center', fontSize: 11 }}>
                        {t('account.qrUnavailable')}
                      </div>
                    )}

                    <div className="grow stack-sm" style={{ minWidth: 0 }}>
                      <Row label={t('product.dateLabel')} value={formatDate(ticket.serviceDate, locale)} />
                      {ticket.timeSlot && <Row label={t('account.timeSlot')} value={ticket.timeSlot} />}
                      <Row label={t('account.guestLabel')} value={ticket.holderName} />
                      <Row label={t('account.guestsLabel')} value={String(ticket.items.length)} />
                      <div>
                        <div className="tiny subtle">{t('account.ticketNumber')}</div>
                        <div className="ticket-number">{ticket.ticketNumber}</div>
                      </div>

                      {ticket.items.some((item) => item.redeemedQty > 0) && (
                        <span className="badge badge-neutral">{t('account.scannedAtGate')}</span>
                      )}

                      <div className="row wrap ticket-pass-actions" style={{ gap: 'var(--sp-2)', marginTop: 'auto', paddingTop: 'var(--sp-2)' }}>
                        {mediaUrl(ticket.pdfUrl) && (
                          <a href={mediaUrl(ticket.pdfUrl) ?? '#'} className="btn btn-secondary btn-sm" download>
                            {t('account.downloadPdf')}
                          </a>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => navigator.clipboard?.writeText(ticket.barcode)}
                        >
                          {t('account.copyCode')}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* What you booked                                                 */}
          {/* ---------------------------------------------------------------- */}
          <section className="card card-pad stack">
            <h2 style={{ fontSize: 18 }}>{t('account.whatYouBooked')}</h2>
            {order.items.map((item) => (
              <div key={item.id} className="row" style={{ gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
                {item.thumbnailUrl && (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                  />
                )}
                <div className="grow" style={{ minWidth: 0 }}>
                  <Link href={`/products/${item.productSlug}`} className="bold small">
                    {item.productName}
                  </Link>
                  <div className="tiny subtle">
                    {item.ticketTypeName} · {formatDate(item.serviceDate, locale)}
                    {item.timeSlot ? ` ${t('account.atTime', item.timeSlot)}` : ''}
                  </div>
                  {item.destination && <div className="tiny subtle">📍 {item.destination}</div>}
                  {item.meetingPoint && <div className="tiny subtle">📌 {item.meetingPoint}</div>}
                </div>
                <div className="right nowrap">
                  <div className="bold small">{formatMoney(item.lineTotalCents, order.currency)}</div>
                  <div className="tiny subtle">
                    {item.quantity} {item.quantity === 1 ? t('common.guest') : t('common.guests')}
                  </div>
                </div>
              </div>
            ))}

            <hr className="divider" style={{ margin: 'var(--sp-2) 0' }} />

            <div className="price-row">
              <span className="label">{t('product.subtotal')}</span>
              <span>{formatMoney(order.totals.subtotalCents, order.currency)}</span>
            </div>
            {order.totals.discountCents > 0 && (
              <div className="price-row">
                <span className="label" style={{ color: 'var(--success-600)' }}>
                  {t('product.discount')}
                </span>
                <span style={{ color: 'var(--success-600)' }}>
                  −{formatMoney(order.totals.discountCents, order.currency)}
                </span>
              </div>
            )}
            <div className="price-row">
              <span className="label">{t('product.taxesAndFees')}</span>
              <span>{formatMoney(order.totals.taxCents + order.totals.feeCents, order.currency)}</span>
            </div>
            <div className="price-row total">
              <span>{t('account.totalPaid')}</span>
              <span>{formatMoney(order.totals.totalCents, order.currency)}</span>
            </div>
            {order.totals.pointsEarned > 0 && (
              <div className="small" style={{ color: 'var(--success-600)' }}>
                {t('account.pointsEarned', order.totals.pointsEarned.toLocaleString())}
              </div>
            )}
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Refunds                                                         */}
          {/* ---------------------------------------------------------------- */}
          {order.refunds.length > 0 && (
            <section className="card card-pad stack">
              <h2 style={{ fontSize: 18 }}>{t('account.refunds')}</h2>
              {order.refunds.map((refund) => (
                <div key={refund.id} className="row-between small">
                  <span className="muted">
                    {refund.reason} · {formatDate(refund.processedAt, locale)}
                  </span>
                  <span className="bold" style={{ color: 'var(--success-600)' }}>
                    +{formatMoney(refund.amountCents, order.currency)}
                  </span>
                </div>
              ))}
            </section>
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Sidebar: cancellation + timeline                                  */}
        {/* ------------------------------------------------------------------ */}
        <aside className="with-rail-side stack">
          {canCancel && (
            <div className="card card-pad stack">
              <h3 style={{ fontSize: 16 }}>{t('account.needToCancel')}</h3>
              {quote && (
                <>
                  <div className="panel small">
                    <div className="row-between">
                      <span className="muted">{t('account.refundableNow')}</span>
                      <span className="bold" style={{ color: 'var(--success-600)' }}>
                        {formatMoney(quote.refundCents, order.currency)}
                      </span>
                    </div>
                    {quote.penaltyCents > 0 && (
                      <div className="row-between" style={{ marginTop: 4 }}>
                        <span className="muted">{t('account.cancellationFee')}</span>
                        <span className="bold">{formatMoney(quote.penaltyCents, order.currency)}</span>
                      </div>
                    )}
                    <div className="tiny subtle" style={{ marginTop: 6 }}>
                      {quote.reason}
                    </div>
                  </div>

                  <button className="btn btn-secondary btn-block" onClick={cancelOrder} disabled={cancelling}>
                    {cancelling ? t('account.cancelling') : t('account.cancelBooking')}
                  </button>
                </>
              )}
            </div>
          )}

          {order.timeline.length > 0 && (
            <div className="card card-pad stack">
              <h3 style={{ fontSize: 16 }}>{t('account.orderTimeline')}</h3>
              <div className="stack-sm">
                {order.timeline
                  .slice()
                  .reverse()
                  .map((entry, index) => (
                    <div key={index} className="row" style={{ gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
                      <span
                        aria-hidden
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--brand-500)',
                          marginTop: 6,
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div className="small bold">{orderStatusLabel(entry.to, locale)}</div>
                        <div className="tiny subtle">{formatDateTime(entry.createdAt, locale)}</div>
                        {entry.reason && <div className="tiny muted">{entry.reason}</div>}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="card card-pad stack-sm">
            <h3 style={{ fontSize: 15 }}>{t('account.needHelp')}</h3>
            <p className="small muted" style={{ margin: 0 }}>
              {t('account.needHelpBody')} <span className="mono">{order.orderNumber}</span>.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="row-between small">
      <span className="subtle">{label}</span>
      <span className="bold">{value}</span>
    </div>
  );
}