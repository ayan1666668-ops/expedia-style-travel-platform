'use client';

import { useEffect, useState } from 'react';
import { api, type DashboardData } from '@/lib/api';
import { LiveInventoryAlerts } from '@/components/LiveInventoryAlerts';
import { readToken } from '@/lib/session';
import { formatDate, formatMoney } from '@/lib/format';
import type { LocaleCode } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

/**
 * Dashboard content for the operations console.
 *
 * The chrome (sidebar, role gate) lives in `ConsoleShell`; this file is only
 * the data view. Keeping them apart means the admin and support consoles can
 * share one shell without this file having to know which surface it is on.
 */

export function KpiCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'warn' }) {
  return (
    <div className="card card-pad stack-sm">
      <span className="tiny subtle">{label}</span>
      <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>{value}</span>
      {hint && (
        <span className={`tiny ${tone === 'good' ? 'good-text' : tone === 'warn' ? 'warn-text' : 'subtle'}`}>{hint}</span>
      )}
    </div>
  );
}

export function AdminDashboardBody({ locale }: { locale: LocaleCode }) {
  const t = createTranslator(locale);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = readToken();
    if (!token) return;
    api
      .adminDashboard(token)
      .then(setData)
      .catch(() => setError(t('staff.noDashboardAccess')));
  }, [t]);

  if (error) return <p className="muted">{error}</p>;
  if (!data) return <div className="skeleton" style={{ height: 300 }} />;

  return (
    <div className="stack-lg">
      {/* Pushed over the WebSocket — surfaced above the snapshot KPIs because a
          departure selling out right now is the most actionable thing here. */}
      <LiveInventoryAlerts locale={locale} />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <KpiCard
          label={t('staff.grossRevenue')}
          value={formatMoney(data.kpis.grossRevenueCents, 'USD', locale)}
          hint={`${formatMoney(data.kpis.netRevenueCents, 'USD', locale)} ${t('staff.netOfRefunds')}`}
        />
        <KpiCard
          label={t('staff.orders30d')}
          value={String(data.kpis.orders30d)}
          hint={t('staff.refundRate', data.kpis.refundRate)}
          tone={data.kpis.refundRate > 8 ? 'warn' : undefined}
        />
        <KpiCard
          label={t('staff.averageOrder')}
          value={formatMoney(data.kpis.averageOrderValueCents, 'USD', locale)}
        />
        <KpiCard
          label={t('staff.pendingOps')}
          value={String(data.kpis.pendingOperations)}
          hint={data.kpis.pendingOperations > 0 ? t('staff.needsHuman') : t('staff.allClear')}
          tone={data.kpis.pendingOperations > 0 ? 'warn' : 'good'}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <section className="card card-pad stack">
          <h2 style={{ fontSize: 17 }}>{t('staff.recentOrders')}</h2>
          {data.recentOrders.length === 0 ? (
            <p className="muted small">{t('staff.noOrdersYet')}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('staff.order')}</th>
                  <th>{t('staff.customer')}</th>
                  <th>{t('staff.placed')}</th>
                  <th className="right">{t('staff.total')}</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="mono small">{order.orderNumber}</td>
                    <td className="small truncate">{order.customer}</td>
                    <td className="tiny subtle">{formatDate(order.placedAt, locale)}</td>
                    <td className="right bold small">
                      {formatMoney(order.totalCents, order.currency, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card card-pad stack">
          <h2 style={{ fontSize: 17 }}>{t('staff.topProducts')}</h2>
          {data.topProducts.length === 0 ? (
            <p className="muted small">{t('staff.noSalesYet')}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('staff.product')}</th>
                  <th className="right">{t('staff.units')}</th>
                  <th className="right">{t('staff.revenue')}</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((product) => (
                  <tr key={product.productId}>
                    <td className="small truncate">{product.productName}</td>
                    <td className="right small">{product.units}</td>
                    <td className="right bold small">
                      {formatMoney(product.revenueCents, 'USD', locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="card card-pad stack">
        <h2 style={{ fontSize: 17 }}>{t('staff.lowInventory')}</h2>
        {data.criticalInventory.length === 0 ? (
          <p className="muted small">{t('staff.nothingCritical')}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('staff.product')}</th>
                <th>{t('staff.date')}</th>
                <th className="right">{t('staff.remaining')}</th>
                <th className="right">{t('staff.capacity')}</th>
              </tr>
            </thead>
            <tbody>
              {data.criticalInventory.map((row) => (
                <tr key={`${row.ticketTypeId}-${row.serviceDate}-${row.timeSlot ?? ''}`}>
                  <td className="small truncate">{row.productName}</td>
                  <td className="tiny">
                    {formatDate(row.serviceDate, locale)}
                    {row.timeSlot ? ` · ${row.timeSlot}` : ''}
                  </td>
                  <td className="right">
                    <span className={`badge badge-${row.remaining <= 0 ? 'danger' : row.remaining <= 5 ? 'warn' : 'neutral'}`}>
                      {row.remaining}
                    </span>
                  </td>
                  <td className="right small subtle">{row.capacityTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}