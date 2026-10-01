'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api, type DashboardData } from '@/lib/api';
import { readToken } from '@/lib/session';
import { formatDate, formatMoney } from '@/lib/format';

/**
 * Shared chrome for the three operator consoles. Every screen needs the token
 * from localStorage, so the gate lives here rather than in each page.
 */
export function AdminShell({
  active,
  title,
  subtitle,
  children,
}: {
  active: 'dashboard' | 'finance' | 'scan';
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readToken();
    if (!stored) {
      router.replace('/login?next=/admin');
      return;
    }
    setToken(stored);
    setReady(true);
  }, [router]);

  const links: { key: typeof active; label: string; href: string }[] = [
    { key: 'dashboard', label: 'Overview', href: '/admin' },
    { key: 'finance', label: 'Finance', href: '/admin/finance' },
    { key: 'scan', label: 'Gate scanner', href: '/admin/scan' },
  ];

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-7)' }}>
      <div className="row-between wrap" style={{ marginBottom: 'var(--sp-4)' }}>
        <div>
          <span className="badge badge-neutral">Operations</span>
          <h1 style={{ margin: '6px 0 2px' }}>{title}</h1>
          <p className="muted small" style={{ margin: 0 }}>
            {subtitle}
          </p>
        </div>
        <nav className="tabs">
          {links.map((link) => (
            <Link key={link.key} href={link.href} className={`tab ${active === link.key ? 'active' : ''}`}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {!ready ? <div className="skeleton" style={{ height: 320 }} /> : <AdminGuard token={token}>{children}</AdminGuard>}
    </div>
  );
}

/** Distinguishes "not signed in" from "signed in but wrong role". */
function AdminGuard({ token, children }: { token: string | null; children: ReactNode }) {
  const [me, setMe] = useState<Awaited<ReturnType<typeof api.me>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .me(token)
      .then(setMe)
      .catch(() => setError('Could not verify your session.'));
  }, [token]);

  if (error) {
    return (
      <div className="card card-pad center stack">
        <p className="muted">{error}</p>
        <Link href="/login" className="btn btn-primary">
          Sign in again
        </Link>
      </div>
    );
  }

  if (!me) return <div className="skeleton" style={{ height: 240 }} />;

  if (!['ADMIN', 'MERCHANT', 'OPERATOR'].includes(me.role)) {
    return (
      <div className="empty-state">
        <h3>Staff access only</h3>
        <p className="muted" style={{ maxWidth: 380 }}>
          This console is limited to Voyahub staff. Customer accounts can manage bookings from{' '}
          <Link href="/orders">My bookings</Link>.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

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

export function AdminDashboardBody() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = readToken();
    if (!token) return;
    api
      .adminDashboard(token)
      .then(setData)
      .catch(() => setError('You do not have access to the dashboard.'));
  }, []);

  if (error) return <p className="muted">{error}</p>;
  if (!data) return <div className="skeleton" style={{ height: 300 }} />;

  return (
    <div className="stack-lg">
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <KpiCard
          label="Gross revenue (30d)"
          value={formatMoney(data.kpis.grossRevenueCents, 'USD')}
          hint={`${formatMoney(data.kpis.netRevenueCents, 'USD')} net of refunds`}
        />
        <KpiCard label="Orders (30d)" value={String(data.kpis.orders30d)} hint={`${data.kpis.refundRate}% refund rate`} tone={data.kpis.refundRate > 8 ? 'warn' : undefined} />
        <KpiCard label="Average order" value={formatMoney(data.kpis.averageOrderValueCents, 'USD')} />
        <KpiCard
          label="Pending ops"
          value={String(data.kpis.pendingOperations)}
          hint={data.kpis.pendingOperations > 0 ? 'Needs a human' : 'All clear'}
          tone={data.kpis.pendingOperations > 0 ? 'warn' : 'good'}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <section className="card card-pad stack">
          <h2 style={{ fontSize: 17 }}>Recent orders</h2>
          {data.recentOrders.length === 0 ? (
            <p className="muted small">No orders yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Placed</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="mono small">{order.orderNumber}</td>
                    <td className="small truncate">{order.customer}</td>
                    <td className="tiny subtle">{formatDate(order.placedAt)}</td>
                    <td className="right bold small">{formatMoney(order.totalCents, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card card-pad stack">
          <h2 style={{ fontSize: 17 }}>Top products</h2>
          {data.topProducts.length === 0 ? (
            <p className="muted small">No sales yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="right">Units</th>
                  <th className="right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((product) => (
                  <tr key={product.productId}>
                    <td className="small truncate">{product.productName}</td>
                    <td className="right small">{product.units}</td>
                    <td className="right bold small">{formatMoney(product.revenueCents, 'USD')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="card card-pad stack">
        <h2 style={{ fontSize: 17 }}>Inventory running low</h2>
        {data.criticalInventory.length === 0 ? (
          <p className="muted small">Nothing critical in the next 14 days.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Date</th>
                <th className="right">Remaining</th>
                <th className="right">Capacity</th>
              </tr>
            </thead>
            <tbody>
              {data.criticalInventory.map((row) => (
                <tr key={`${row.ticketTypeId}-${row.serviceDate}-${row.timeSlot ?? ''}`}>
                  <td className="small truncate">{row.productName}</td>
                  <td className="tiny">
                    {formatDate(row.serviceDate)}
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