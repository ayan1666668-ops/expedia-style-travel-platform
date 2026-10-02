'use client';

import { Fragment, useState } from 'react';
import { api, ApiError, type SupportOrderSummary } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { readToken } from '@/lib/session';
import type { LocaleCode } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

/**
 * Order lookup with goodwill refunds.
 *
 * The refund form only appears for orders that have a refundable balance, and
 * it states the remaining amount before the agent commits — the API enforces
 * the same cap server-side, but showing it here is what prevents the mistake in
 * the first place.
 */
export function SupportOrders({ locale }: { locale: LocaleCode }) {
  const t = createTranslator(locale);

  const [token, setToken] = useState<string | null>(null);
  const [form, setForm] = useState({ orderNumber: '', email: '' });
  const [rows, setRows] = useState<SupportOrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refund, setRefund] = useState({ amount: '', reason: '' });

  async function search() {
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const result = await api.supportOrders(
        {
          ...(form.orderNumber.trim() ? { orderNumber: form.orderNumber.trim() } : {}),
          ...(form.email.trim() ? { email: form.email.trim() } : {}),
          limit: 20,
        },
        token,
      );
      setRows(result.items);
      setExpanded(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('common_errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  function lookup(event: React.FormEvent) {
    event.preventDefault();
    void search();
  }

  async function issueRefund(order: SupportOrderSummary) {
    if (!token) return;

    const amountCents = Math.round(Number(refund.amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError(t('common_errors.generic'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.supportRefund(
        order.id,
        { amountCents, reason: refund.reason || 'Goodwill refund' },
        token,
      );
      setRefund({ amount: '', reason: '' });
      setExpanded(null);
      // Re-run the current search so the refunded amount shows immediately.
      await search();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('common_errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  if (!token) return <p className="muted">{t('common_errors.sessionExpired')}</p>;

  return (
    <div className="stack-lg">
      <section className="card card-pad">
        <h2 style={{ fontSize: 16, marginBottom: 'var(--sp-3)' }}>
          {t('support.lookupOrder')}
        </h2>

        <form onSubmit={lookup} className="row wrap" style={{ gap: 'var(--sp-3)' }}>
          <label className="field grow" style={{ minWidth: 180 }}>
            <span className="label">{t('support.orderNumber')}</span>
            <input
              className="input"
              placeholder="VY-261001-ABCD"
              value={form.orderNumber}
              onChange={(e) => setForm({ ...form, orderNumber: e.target.value })}
            />
          </label>

          <label className="field grow" style={{ minWidth: 180 }}>
            <span className="label">{t('support.orEmail')}</span>
            <input
              className="input"
              type="email"
              placeholder="customer@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>

          <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} disabled={loading}>
            {loading ? t('common.loading') : t('common.search')}
          </button>
        </form>
      </section>

      {error && <p className="form-error">{error}</p>}

      {rows.length > 0 && (
        <section className="card">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('staff.order')}</th>
                  <th>{t('staff.customer')}</th>
                  <th>{t('staff.placed')}</th>
                  <th className="right">{t('staff.total')}</th>
                  <th className="right">{t('support.issueRefund')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => {
                  const remaining = order.totalCents - order.refundedCents;
                  const refundable =
                    remaining > 0 && ['PAID', 'CONFIRMED', 'COMPLETED', 'PARTIALLY_REFUNDED'].includes(order.status);

                  return (
                    <Fragment key={order.id}>
                      <tr>
                        <td>
                          <div className="mono small bold">{order.orderNumber}</div>
                          <div className="tiny subtle">
                            {order.status} · {order.ticketCount} {t('account.tickets')}
                          </div>
                        </td>
                        <td className="small truncate">{order.customer.email}</td>
                        <td className="tiny subtle">{formatDate(order.placedAt, locale)}</td>
                        <td className="right small">
                          <div className="bold">{formatMoney(order.totalCents, order.currency)}</div>
                          {order.refundedCents > 0 && (
                            <div className="tiny" style={{ color: 'var(--success-600)' }}>
                              −{formatMoney(order.refundedCents, order.currency)}
                            </div>
                          )}
                        </td>
                        <td className="right">
                          {refundable ? (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                            >
                              {t('support.issueRefund')}
                            </button>
                          ) : (
                            <span className="tiny subtle">{t('common.none')}</span>
                          )}
                        </td>
                      </tr>

                      {expanded === order.id && (
                        <tr>
                          <td colSpan={5}>
                            <div className="panel row wrap" style={{ gap: 'var(--sp-3)' }}>
                              <span className="small bold">
                                {t('account.refundableNow')}: {formatMoney(remaining, order.currency)}
                              </span>

                              <label className="field" style={{ width: 130 }}>
                                <span className="label">USD</span>
                                <input
                                  className="input"
                                  type="number"
                                  step="0.01"
                                  max={remaining / 100}
                                  placeholder={(remaining / 100).toFixed(2)}
                                  value={refund.amount}
                                  onChange={(e) => setRefund({ ...refund, amount: e.target.value })}
                                />
                              </label>

                              <label className="field grow" style={{ minWidth: 200 }}>
                                <span className="label">{t('support.reason')}</span>
                                <input
                                  className="input"
                                  value={refund.reason}
                                  onChange={(e) => setRefund({ ...refund, reason: e.target.value })}
                                />
                              </label>

                              <button
                                className="btn btn-secondary"
                                style={{ alignSelf: 'flex-end' }}
                                onClick={() => issueRefund(order)}
                                disabled={loading}
                              >
                                {t('support.issueRefund')}
                              </button>

                              <span className="tiny subtle" style={{ width: '100%' }}>
                                {t('support.refundHint')}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}