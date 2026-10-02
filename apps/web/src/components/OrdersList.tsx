'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError, type OrderSummary } from '@/lib/api';
import { readToken } from '@/lib/session';
import { formatDate, formatMoney, orderStatusLabel, orderStatusTone } from '@/lib/format';
import type { LocaleCode } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

/** Filter values are API status codes; labels are resolved per locale. */
const TABS = [
  { value: '', key: 'account.all' },
  { value: 'CONFIRMED', key: 'account.upcoming' },
  { value: 'COMPLETED', key: 'account.completed' },
  { value: 'CANCELLED', key: 'account.cancelled' },
] as const;

export function OrdersList({ locale }: { locale: LocaleCode }) {
  const t = createTranslator(locale);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = readToken();
    if (!token) {
      setLoading(false);
      setError(t('account.signInToView'));
      return;
    }

    setLoading(true);
    api
      .orders(status ? { status } : {}, token)
      .then((result) => setOrders(result.items))
      .catch((caught) =>
        setError(
          caught instanceof ApiError && caught.status === 401
            ? t('common_errors.sessionExpired')
            : t('account.couldNotLoad'),
        ),
      )
      .finally(() => setLoading(false));
  }, [status]);

  if (loading) {
    return (
      <div className="stack">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton" style={{ height: 118 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card card-pad center stack">
        <p className="muted">{error}</p>
        <Link href="/login" className="btn btn-primary">
          {t('common.signIn')}
        </Link>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: 40 }} aria-hidden>
          🧳
        </div>
        <h3>{t('account.noBookings')}</h3>
        <p className="muted" style={{ maxWidth: 380 }}>
          {t('account.noBookingsHint')}
        </p>
        <Link href="/search" className="btn btn-primary">
          {t('account.browse')}
        </Link>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            className={`tab ${status === tab.value ? 'active' : ''}`}
            onClick={() => setStatus(tab.value)}
          >
            {t(tab.key)}
          </button>
        ))}
      </div>

      {orders.map((order) => (
        <Link key={order.id} href={`/orders/${order.id}`} className="card card-hover card-pad stack">
          <div className="row-between wrap">
            <div>
              <div className="row" style={{ gap: 'var(--sp-2)' }}>
                <span className="bold mono">{order.orderNumber}</span>
                <span className={`badge badge-${orderStatusTone(order.status)}`}>
                  {orderStatusLabel(order.status, locale)}
                </span>
              </div>
              <div className="tiny subtle" style={{ marginTop: 2 }}>
                {t('account.bookedOn')} {formatDate(order.placedAt, locale)}
              </div>
            </div>
            <div className="right">
              <div className="bold" style={{ fontSize: 18 }}>
                {formatMoney(order.totalCents, order.currency)}
              </div>
              <div className="tiny subtle">
                {order.ticketCount} {order.ticketCount === 1 ? t('common.guest') : t('account.tickets')}
              </div>
            </div>
          </div>

          <div className="stack-sm">
            {order.items.map((item, index) => (
              <div key={index} className="row" style={{ gap: 'var(--sp-3)' }}>
                {item.thumbnailUrl && (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                  />
                )}
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="small bold truncate">{item.productName}</div>
                  <div className="tiny subtle">
                    {formatDate(item.serviceDate, locale)}
                    {item.timeSlot ? ` · ${item.timeSlot}` : ''} · {item.quantity}{' '}
                    {item.quantity === 1 ? t('common.guest') : t('common.guests')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}