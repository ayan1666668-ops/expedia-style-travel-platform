'use client';

import { useState } from 'react';
import { useRealtime, useRealtimeEvent } from '@/components/RealtimeProvider';
import type { LocaleCode } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

/**
 * Live stock alerts for the operations console.
 *
 * The dashboard already renders a `criticalInventory` snapshot from
 * `/admin/dashboard`, but a snapshot is stale the moment a booking lands. These
 * alerts are pushed instead: every threshold crossing the API publishes arrives
 * here immediately, so an operator watching the console sees a departure sell
 * out while it happens rather than on the next page load.
 *
 * Keyed by (ticket type, date, slot) so repeated alerts for the same departure
 * update in place instead of stacking up.
 */

type AlertLevel = 'LOW' | 'CRITICAL' | 'SOLD_OUT';

type StockAlert = {
  key: string;
  level: AlertLevel;
  ticketTypeId: string;
  productName: string | null;
  serviceDate: string;
  timeSlot: string | null;
  remaining: number;
  capacityTotal: number;
};

const MAX_ALERTS = 8;

const TONE: Record<AlertLevel, string> = {
  LOW: 'badge-warning',
  CRITICAL: 'badge-critical',
  SOLD_OUT: 'badge-critical',
};

export function LiveInventoryAlerts({ locale }: { locale: LocaleCode }) {
  const t = createTranslator(locale);
  const { status } = useRealtime();
  const [alerts, setAlerts] = useState<StockAlert[]>([]);

  useRealtimeEvent((event) => {
    if (event.type !== 'inventory.alert') return;

    const payload = event.payload as Partial<StockAlert> & { level?: string };
    if (!payload.ticketTypeId || !payload.level || !payload.serviceDate) return;

    const key = `${payload.ticketTypeId}-${payload.serviceDate}-${payload.timeSlot ?? ''}`;
    const alert: StockAlert = {
      key,
      level: payload.level as AlertLevel,
      ticketTypeId: payload.ticketTypeId,
      productName: payload.productName ?? null,
      serviceDate: payload.serviceDate,
      timeSlot: payload.timeSlot ?? null,
      remaining: payload.remaining ?? 0,
      capacityTotal: payload.capacityTotal ?? 0,
    };

    setAlerts((current) => [alert, ...current.filter((item) => item.key !== key)].slice(0, MAX_ALERTS));
  });

  const live = status === 'open';

  return (
    <section className="card card-pad stack">
      <div className="row-between wrap">
        <h2 style={{ fontSize: 17 }}>{t('staff.liveStockAlerts')}</h2>
        <span className="tiny subtle row" style={{ gap: 6 }}>
          <span className={`notification-live-dot ${live ? 'is-live' : ''}`} style={{ position: 'static' }} aria-hidden />
          {live ? t('notifications.live') : t('notifications.offline')}
        </span>
      </div>

      {alerts.length === 0 ? (
        <p className="muted small">{t('staff.noLiveAlerts')}</p>
      ) : (
        <ul className="stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {alerts.map((alert) => (
            <li key={alert.key} className="row" style={{ gap: 'var(--sp-3)', alignItems: 'center' }}>
              <span className={`badge ${TONE[alert.level]}`}>{t(`staff.alertLevel${alert.level}`)}</span>
              <span className="grow small truncate">{alert.productName ?? alert.ticketTypeId}</span>
              <span className="tiny subtle nowrap">
                {alert.serviceDate}
                {alert.timeSlot ? ` · ${alert.timeSlot}` : ''}
              </span>
              <span className="small bold nowrap">
                {alert.remaining}/{alert.capacityTotal}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
