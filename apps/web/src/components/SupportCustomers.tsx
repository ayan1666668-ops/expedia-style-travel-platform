'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  api,
  ApiError,
  type SupportCustomer,
  type SupportCustomerDetail,
} from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { readToken } from '@/lib/session';
import type { LocaleCode } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

const TIERS = ['MEMBER', 'SILVER', 'GOLD', 'PLATINUM'] as const;

/**
 * Customer directory and profile editor.
 *
 * Two panels rather than two pages: an agent handling "where is my order" is
 * almost always looking at one customer while a list sits behind it, and a
 * route change per lookup loses that context.
 *
 * Every save goes through the API, which writes an AuditLog entry. The UI
 * deliberately does not offer an undo — support corrections are meant to be
 * visible and attributable, not casually reversible.
 */
export function SupportCustomers({ locale }: { locale: LocaleCode }) {
  const t = createTranslator(locale);

  const [token, setToken] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<SupportCustomer[]>([]);
  const [selected, setSelected] = useState<SupportCustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Editable copy of the selected customer. Kept separate so a failed save
  // does not leave the form silently out of sync with the server.
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    locale: 'en-US',
    countryCode: '',
    marketingOptIn: false,
    walletEnabled: false,
    loyaltyPoints: 0,
    loyaltyTier: 'MEMBER',
  });
  const [walletDraft, setWalletDraft] = useState({ amount: '', note: '' });
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(
    async (authToken: string, q: string) => {
      setLoading(true);
      try {
        const result = await api.supportCustomers(q ? { q, limit: 50 } : { limit: 50 }, authToken);
        setRows(result.items);
      } catch (caught) {
        setError(
          caught instanceof ApiError && caught.status === 403
            ? t('staff.staffOnly')
            : t('common_errors.generic'),
        );
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    const stored = readToken();
    if (!stored) return;
    setToken(stored);
    loadList(stored, '');
  }, [loadList]);

  function hydrate(customer: SupportCustomerDetail) {
    setSelected(customer);
    setForm({
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone ?? '',
      locale: customer.locale,
      countryCode: customer.countryCode ?? '',
      marketingOptIn: customer.marketingOptIn,
      walletEnabled: customer.walletEnabled,
      loyaltyPoints: customer.loyaltyPoints,
      loyaltyTier: customer.loyaltyTier,
    });
    setSaved(false);
  }

  async function openCustomer(id: string) {
    if (!token) return;
    try {
      hydrate(await api.supportCustomer(id, token));
    } catch {
      setError(t('common_errors.generic'));
    }
  }

  async function saveProfile() {
    if (!token || !selected) return;

    setBusy(true);
    setError(null);
    try {
      await api.updateSupportCustomer(
        selected.id,
        {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim() || null,
          locale: form.locale,
          countryCode: form.countryCode.trim().toUpperCase() || null,
          marketingOptIn: form.marketingOptIn,
          walletEnabled: form.walletEnabled,
          loyaltyPoints: Number(form.loyaltyPoints) || 0,
          loyaltyTier: form.loyaltyTier,
        },
        token,
      );
      await openCustomer(selected.id);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('common_errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function adjustWallet() {
    if (!token || !selected) return;

    const amount = Math.round(Number(walletDraft.amount) * 100);
    if (!Number.isFinite(amount) || amount === 0) {
      setError(t('common_errors.generic'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // The field is in major units because that is how an agent thinks; the
      // API is in minor units, so convert here rather than making the agent
      // type cents.
      await api.adjustWallet(
        selected.id,
        { amountCents: amount, currency: 'USD', note: walletDraft.note || 'Support adjustment' },
        token,
      );
      setWalletDraft({ amount: '', note: '' });
      await openCustomer(selected.id);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('common_errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  if (!token) return <p className="muted">{t('common_errors.sessionExpired')}</p>;

  return (
    <div className="support-split">
      {/* ---------------------------------------------------------------- */}
      {/* Directory                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="card card-pad stack">
        <h2 style={{ fontSize: 16 }}>{t('support.customers')}</h2>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (token) loadList(token, query);
          }}
        >
          <input
            className="input"
            placeholder={t('support.searchCustomer')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>

        {error && <p className="form-error">{error}</p>}

        {loading ? (
          <div className="skeleton" style={{ height: 240 }} />
        ) : rows.length === 0 ? (
          <p className="muted small" style={{ padding: 'var(--sp-4) 0' }}>
            {t('support.noCustomers')}
          </p>
        ) : (
          <div className="table-scroll" style={{ maxHeight: 560, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('staff.customer')}</th>
                  <th className="right">{t('support.balances')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => openCustomer(row.id)}
                    style={{
                      cursor: 'pointer',
                      background: selected?.id === row.id ? 'var(--bg-muted)' : undefined,
                    }}
                  >
                    <td>
                      <div className="small bold truncate">
                        {row.firstName} {row.lastName}
                      </div>
                      <div className="tiny subtle truncate">{row.email}</div>
                    </td>
                    <td className="right nowrap">
                      <div className="small bold">{formatMoney(row.walletCents, 'USD')}</div>
                      <div className="tiny subtle">{row.loyaltyPoints.toLocaleString()} pts</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Detail                                                          */}
      {/* ---------------------------------------------------------------- */}
      {!selected ? (
        <section className="card card-pad center muted" style={{ minHeight: 300 }}>
          {t('support.customerDetail')}
        </section>
      ) : (
        <div className="stack-lg">
          <section className="card card-pad stack">
            <div className="row-between wrap">
              <div>
                <h2 style={{ fontSize: 17 }}>
                  {selected.firstName} {selected.lastName}
                </h2>
                <p className="small muted" style={{ margin: 0 }}>
                  {selected.email}
                  {selected.emailVerified && ` · ${t('support.emailVerified')}`}
                </p>
              </div>
              {saved && <span className="badge badge-success">{t('support.saved')}</span>}
            </div>

            <div className="grid grid-2">
              <label className="field">
                <span className="label">{t('auth.firstName')}</span>
                <input
                  className="input"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </label>

              <label className="field">
                <span className="label">{t('auth.lastName')}</span>
                <input
                  className="input"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </label>

              <label className="field">
                <span className="label">{t('auth.email')}</span>
                {/* Read-only on purpose: changing an email is an identity
                    change, not a profile edit, and needs re-verification. */}
                <input className="input" value={selected.email} disabled />
              </label>

              <label className="field">
                <span className="label">{t('common.none')} · {t('auth.email')}</span>
                <input
                  className="input"
                  placeholder="+1 555 0100"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>

              <label className="field">
                <span className="label">Locale</span>
                <input
                  className="input"
                  value={form.locale}
                  onChange={(e) => setForm({ ...form, locale: e.target.value })}
                />
              </label>

              <label className="field">
                <span className="label">{t('support.loyaltyTier')}</span>
                <select
                  className="select"
                  value={form.loyaltyTier}
                  onChange={(e) => setForm({ ...form, loyaltyTier: e.target.value })}
                >
                  {TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="label">{t('account.pointsBalance')}</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={form.loyaltyPoints}
                  onChange={(e) => setForm({ ...form, loyaltyPoints: Number(e.target.value) })}
                />
              </label>

              <div className="field">
                <span className="label">{t('support.profile')}</span>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.marketingOptIn}
                    onChange={(e) => setForm({ ...form, marketingOptIn: e.target.checked })}
                  />
                  <span className="small">Marketing opt-in</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.walletEnabled}
                    onChange={(e) => setForm({ ...form, walletEnabled: e.target.checked })}
                  />
                  <span className="small">{t('account.walletBalance')}</span>
                </label>
              </div>
            </div>

            <div className="row" style={{ gap: 'var(--sp-2)' }}>
              <button className="btn btn-primary" onClick={saveProfile} disabled={busy}>
                {busy ? t('common.loading') : t('support.saveChanges')}
              </button>
            </div>
          </section>

          {/* Balances ---------------------------------------------------- */}
          <section className="card card-pad stack">
            <h2 style={{ fontSize: 17 }}>{t('support.balances')}</h2>

            <div className="grid grid-2">
              <div className="panel">
                <div className="tiny subtle">{t('account.walletBalance')}</div>
                <div className="bold" style={{ fontSize: 24 }}>
                  {formatMoney(selected.walletCents, 'USD')}
                </div>
                <div className="tiny subtle">{t('account.walletHint')}</div>
              </div>

              <div className="panel">
                <div className="tiny subtle">{t('account.pointsBalance')}</div>
                <div className="bold" style={{ fontSize: 24 }}>
                  {selected.loyaltyPoints.toLocaleString()}
                </div>
                <div className="tiny subtle">
                  {t('support.lifetimePoints')}: {selected.lifetimePoints.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="row wrap" style={{ gap: 'var(--sp-2)', alignItems: 'flex-end' }}>
              <label className="field" style={{ width: 130 }}>
                <span className="label">USD {t('common.yes')} / −</span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  placeholder="25.00"
                  value={walletDraft.amount}
                  onChange={(e) => setWalletDraft({ ...walletDraft, amount: e.target.value })}
                />
              </label>

              <label className="field grow" style={{ minWidth: 200 }}>
                <span className="label">{t('support.reason')}</span>
                <input
                  className="input"
                  value={walletDraft.note}
                  onChange={(e) => setWalletDraft({ ...walletDraft, note: e.target.value })}
                />
              </label>

              <button
                className="btn btn-secondary"
                onClick={adjustWallet}
                disabled={busy || !walletDraft.amount}
              >
                {t('support.adjustBalance')}
              </button>
            </div>

            <p className="tiny subtle" style={{ margin: 0 }}>
              {t('support.adjustHint')}
            </p>
          </section>

          {/* Wallet ledger ---------------------------------------------- */}
          <section className="card card-pad stack">
            <h2 style={{ fontSize: 17 }}>{t('support.walletHistory')}</h2>

            {selected.walletTransactions.length === 0 ? (
              <p className="muted small">{t('support.noWalletActivity')}</p>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('support.action')}</th>
                      <th>{t('support.reason')}</th>
                      <th>{t('support.actor')}</th>
                      <th>{t('staff.date')}</th>
                      <th className="right">{t('account.walletBalance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.walletTransactions.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <span
                            className={`badge badge-${entry.amountCents >= 0 ? 'positive' : 'critical'} small`}
                          >
                            {entry.amountCents >= 0 ? '+' : '−'}
                            {formatMoney(Math.abs(entry.amountCents), entry.currency)}
                          </span>
                        </td>
                        <td className="tiny subtle truncate" style={{ maxWidth: 220 }}>
                          {entry.note ?? entry.kind}
                        </td>
                        <td className="tiny subtle">{entry.actorEmail ?? 'system'}</td>
                        <td className="tiny subtle">{formatDate(entry.createdAt, locale)}</td>
                        <td className="right small">{formatMoney(entry.balanceAfterCents, entry.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Orders ------------------------------------------------------ */}
          <section className="card card-pad stack">
            <h2 style={{ fontSize: 17 }}>{t('support.recentOrders')}</h2>

            {selected.orders.length === 0 ? (
              <p className="muted small">{t('support.noOrders')}</p>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('staff.order')}</th>
                      <th>{t('staff.placed')}</th>
                      <th>{t('staff.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/orders/${order.id}`} className="mono small">
                            {order.orderNumber}
                          </Link>
                          <div className="tiny subtle">{order.status}</div>
                        </td>
                        <td className="tiny subtle">{formatDate(order.placedAt, locale)}</td>
                        <td className="right small bold">{formatMoney(order.totalCents, order.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}