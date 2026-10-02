'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type AppNotification } from '@/lib/api';
import { useRealtime } from '@/components/RealtimeProvider';
import { formatDateTime } from '@/lib/format';
import type { LocaleCode } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';
import { onSessionChange, readToken } from '@/lib/session';

/**
 * Notification centre.
 *
 * The bell is the visible half of the realtime work: it is hydrated from
 * `GET /notifications` on load (so a reload is not amnesia) and then kept live
 * by `notification.created` / `notification.read` events. Arrivals also raise a
 * toast, which is what makes the platform feel *active* rather than merely
 * up-to-date.
 */

const TOAST_TTL_MS = 6_000;
const MAX_ITEMS = 30;

export function NotificationCenter({ locale }: { locale: LocaleCode }) {
  const t = createTranslator(locale);
  const { subscribe, status } = useRealtime();

  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // The token is not part of the server-rendered payload, so it is read on the
  // client and re-read whenever the session changes (login/logout, other tab).
  useEffect(() => {
    const sync = () => setToken(readToken());
    sync();
    return onSessionChange(sync);
  }, []);

  useEffect(() => {
    if (!token) {
      setItems([]);
      setUnread(0);
      return;
    }

    let cancelled = false;
    api
      .notifications({ limit: 20 }, token)
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setUnread(result.unread);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Live updates: new notifications are prepended, read receipts adjust the badge.
  useEffect(() => {
    if (!token) return undefined;

    return subscribe((event) => {
      if (event.type === 'notification.created') {
        const notification = (event.payload as { notification?: AppNotification }).notification;
        if (!notification) return;

        setItems((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, MAX_ITEMS));
        setUnread((current) => current + 1);
        setToast(notification);
        return;
      }

      if (event.type === 'notification.read') {
        const next = (event.payload as { unread?: number }).unread;
        // Another tab marked everything read; mirror it instead of guessing.
        if (typeof next === 'number') setUnread(next);
      }
    });
  }, [subscribe, token]);

  useEffect(() => {
    if (!toast) return undefined;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_TTL_MS);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [toast]);

  // Dismiss the panel on an outside click or Escape.
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const markAllRead = useCallback(() => {
    if (!token) return;
    setUnread(0);
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    void api.markAllNotificationsRead(token).catch(() => undefined);
  }, [token]);

  const openNotification = useCallback(
    (notification: AppNotification) => {
      setOpen(false);
      if (!token || notification.readAt) return;

      setItems((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item)),
      );
      setUnread((current) => Math.max(0, current - 1));
      void api.markNotificationRead(notification.id, token).catch(() => undefined);
    },
    [token],
  );

  // Signed-out visitors have no notification stream at all.
  if (!token) return null;

  const live = status === 'open';

  return (
    <div className="notification-center" ref={containerRef}>
      <button
        type="button"
        className="notification-bell"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread > 0 ? t('notifications.ariaUnread', unread) : t('notifications.title')}
      >
        <span aria-hidden>{unread > 0 ? '🔔' : '🔕'}</span>
        {unread > 0 && (
          <span className="notification-badge" aria-hidden>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        <span className={`notification-live-dot ${live ? 'is-live' : ''}`} aria-hidden />
      </button>

      {open && (
        <div className="notification-panel" role="dialog" aria-label={t('notifications.title')}>
          <div className="row-between" style={{ padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--border)' }}>
            <div>
              <strong style={{ fontSize: 14 }}>{t('notifications.title')}</strong>
              <p className="tiny subtle" style={{ margin: 0 }}>
                {live ? t('notifications.live') : t('notifications.offline')}
              </p>
            </div>
            {unread > 0 && (
              <button type="button" className="tiny" onClick={markAllRead} style={{ color: 'var(--brand-600)', fontWeight: 600 }}>
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          <div className="notification-list">
            {items.length === 0 ? (
              <p className="small muted" style={{ padding: 'var(--sp-4)', margin: 0, textAlign: 'center' }}>
                {t('notifications.empty')}
              </p>
            ) : (
              items.map((notification) => {
                const href = notification.orderId ? `/orders/${notification.orderId}` : null;
                const body = (
                  <>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="small bold" style={{ display: 'block' }}>
                        {notification.subject ?? notification.template}
                      </span>
                      <span className="tiny subtle">{formatDateTime(notification.createdAt, locale)}</span>
                    </span>
                    {!notification.readAt && <span className="notification-unread-dot" aria-hidden />}
                  </>
                );

                return href ? (
                  <Link
                    key={notification.id}
                    href={href}
                    className={`notification-item ${notification.readAt ? '' : 'is-unread'}`}
                    onClick={() => openNotification(notification)}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    key={notification.id}
                    type="button"
                    className={`notification-item ${notification.readAt ? '' : 'is-unread'}`}
                    onClick={() => openNotification(notification)}
                  >
                    {body}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-stack" role="status" aria-live="polite">
          <div className="toast card">
            <span aria-hidden style={{ fontSize: 18 }}>
              🔔
            </span>
            <div className="grow" style={{ minWidth: 0 }}>
              <strong className="small" style={{ display: 'block' }}>
                {toast.subject ?? t('notifications.title')}
              </strong>
              <span className="tiny subtle">{t('notifications.toastHint')}</span>
            </div>
            {toast.orderId && (
              <Link href={`/orders/${toast.orderId}`} className="btn btn-secondary btn-sm" onClick={() => setToast(null)}>
                {t('notifications.viewOrder')}
              </Link>
            )}
            <button type="button" className="toast-dismiss" onClick={() => setToast(null)} aria-label={t('notifications.dismiss')}>
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
