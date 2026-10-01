'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { readToken } from '@/lib/session';
import { formatDate, formatMoney } from '@/lib/format';

type Order = Awaited<ReturnType<typeof api.adminOrders>>['items'][number];
type Inventory = Awaited<ReturnType<typeof api.adminInventory>>[number];

type Tab = 'orders' | 'inventory';

export function FinanceConsole() {
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = readToken();
    if (!token) return;

    Promise.all([
      api.adminOrders({ page: 1, pageSize: 50 }, token).then((r) => setOrders(r.items)),
      api.adminInventory({ days: 30 }, token).then(setInventory),
    ]).catch((caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Could not load finance data.'),
    );
  }, []);

  const totals = useMemo(() => {
    const gross = orders.reduce((sum, order) => sum + order.totalCents, 0);
    const refunded = orders.reduce((sum, order) => sum + order.refundedCents, 0);
    return {
      gross,
      refunded,
      net: gross - refunded,
      count: orders.length,
      refundRate: gross > 0 ? Math.round((refunded / gross) * 1000) / 10 : 0,
    };
  }, [orders]);

  if (error) return <p className="muted">{error}</p>;

  return (
    <div className="stack-lg">
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="card card-pad stack-sm">
          <span className="tiny subtle">Gross (latest {totals.count})</span>
          <span style={{ fontSize: 22, fontWeight: 700 }}>{formatMoney(totals.gross, 'USD')}</span>
        </div>
        <div className="card card-pad stack-sm">
          <span className="tiny subtle">Refunded</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--success-600)' }}>
            −{formatMoney(totals.refunded, 'USD')}
          </span>
        </div>
        <div className="card card-pad stack-sm">
          <span className="tiny subtle">Net</span>
          <span style={{ fontSize: 22, fontWeight: 700 }}>{formatMoney(totals.net, 'USD')}</span>
        </div>
        <div className="card card-pad stack-sm">
          <span className="tiny subtle">Refund rate</span>
          <span style={{ fontSize: 22, fontWeight: 700 }}>{totals.refundRate}%</span>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
          Orders
        </button>
        <button className={`tab ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}>
          Inventory
        </button>
      </div>

      {tab === 'orders' ? (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Placed</th>
                <th>Status</th>
                <th className="right">Units</th>
                <th className="right">Refunded</th>
                <th className="right">Net</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    Loading…
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id}>
                    <td className="mono small">{order.orderNumber}</td>
                    <td className="small truncate">{order.customer}</td>
                    <td className="tiny subtle">{formatDate(order.placedAt)}</td>
                    <td>
                      <span className="badge badge-neutral small">{order.status}</span>
                    </td>
                    <td className="right small">{order.unitCount}</td>
                    <td className="right small subtle">
                      {order.refundedCents > 0 ? `−${formatMoney(order.refundedCents, order.currency)}` : '—'}
                    </td>
                    <td className="right bold small">{formatMoney(order.totalCents - order.refundedCents, order.currency)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Product / variant</th>
                <th>Date</th>
                <th className="right">Total</th>
                <th className="right">Held</th>
                <th className="right">Sold</th>
                <th className="right">Available</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    Loading…
                  </td>
                </tr>
              ) : (
                inventory.map((row) => (
                  <tr key={row.id}>
                    <td className="small truncate">{row.productName}</td>
                    <td className="tiny subtle">
                      {formatDate(row.serviceDate)}
                      {row.timeSlot ? ` · ${row.timeSlot}` : ''}
                      <div className="tiny subtle">{row.ticketTypeName}</div>
                    </td>
                    <td className="right small">{row.total}</td>
                    <td className="right small subtle">{row.held}</td>
                    <td className="right small">{row.sold}</td>
                    <td className="right bold small">{row.available}</td>
                    <td>
                      <span className={`badge badge-${row.status === 'SOLD_OUT' ? 'danger' : row.status === 'LOW' ? 'warn' : 'success'} small`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}