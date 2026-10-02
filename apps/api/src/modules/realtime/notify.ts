import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { STAFF_ROLES, publishEvent } from './bus';

/**
 * ---------------------------------------------------------------------------
 * Realtime notifications
 * ---------------------------------------------------------------------------
 *
 * Two responsibilities, both deliberately side-effect-safe:
 *
 *  1. `emit*` helpers translate a domain fact into a bus event. They never
 *     throw: a broken realtime channel must not roll back a confirmed booking.
 *  2. `createInAppNotification` persists the same fact so the notification
 *     centre still has content after a page reload — realtime is the *push*,
 *     the `Notification` row is the durable record.
 */

export type ShapedNotification = {
  id: string;
  channel: string;
  status: string;
  template: string;
  subject: string | null;
  locale: string;
  payload: Record<string, unknown> | null;
  orderId: string | null;
  orderNumber: string | null;
  createdAt: string;
  readAt: string | null;
};

type NotificationRow = {
  id: string;
  channel: string;
  status: string;
  template: string;
  subject: string | null;
  locale: string;
  payload: unknown;
  orderId: string | null;
  createdAt: Date;
  readAt: Date | null;
  order?: { orderNumber: string } | null;
};

export function shapeNotification(row: NotificationRow): ShapedNotification {
  return {
    id: row.id,
    channel: row.channel,
    status: row.status,
    template: row.template,
    subject: row.subject,
    locale: row.locale,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    orderId: row.orderId,
    orderNumber: row.order?.orderNumber ?? null,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt ? row.readAt.toISOString() : null,
  };
}

/**
 * Persists an in-app notification and pushes it to the shopper's open sessions.
 *
 * Returns `null` (instead of throwing) when the write fails: a notification is
 * a consequence of a business action, never a precondition for it.
 */
export async function createInAppNotification(input: {
  userId: string;
  orderId?: string | null;
  template: string;
  subject: string;
  payload?: Record<string, unknown>;
  locale?: string;
}): Promise<ShapedNotification | null> {
  try {
    const row = await prisma.notification.create({
      data: {
        userId: input.userId,
        orderId: input.orderId ?? null,
        channel: NotificationChannel.IN_APP,
        // In-app messages are delivered the moment they exist, so they are
        // stored as SENT rather than QUEUED (which means "awaiting a transport").
        status: NotificationStatus.SENT,
        template: input.template,
        subject: input.subject,
        locale: input.locale ?? 'en',
        payload: (input.payload ?? undefined) as never,
        sentAt: new Date(),
      },
      include: { order: { select: { orderNumber: true } } },
    });

    const notification = shapeNotification(row);
    publishEvent({
      type: 'notification.created',
      audience: { userId: input.userId },
      payload: { notification },
    });

    return notification;
  } catch (error) {
    logger.warn('realtime.notification_write_failed', {
      userId: input.userId,
      template: input.template,
      reason: (error as Error).message,
    });
    return null;
  }
}

/**
 * Published the moment a checkout creates a pending order.
 *
 * Distinct from `order.status_changed` on purpose: the operator console wants
 * "a checkout just started" as a separate signal from "an order moved state",
 * and a client filtering on `order.*` still receives both.
 */
export function emitOrderCreated(input: {
  orderId: string;
  orderNumber: string;
  status: string;
  userId?: string | null;
  totalCents: number;
  currency: string;
  itemCount: number;
}): void {
  publishEvent({
    type: 'order.created',
    audience: { userId: input.userId ?? null, roles: STAFF_ROLES },
    payload: { ...input, createdAt: new Date().toISOString() },
  });
}

/**
 * Publishes an order lifecycle transition.
 *
 * Addressed to the shopper *and* to every staff role: the customer sees status
 * move on their order page, while the operator console sees the same fact
 * without polling `/admin`.
 */
export function emitOrderEvent(input: {
  orderId: string;
  orderNumber: string;
  status: string;
  fromStatus?: string | null;
  userId?: string | null;
  reason?: string | null;
  totalCents?: number;
  currency?: string;
}): void {
  publishEvent({
    type: 'order.status_changed',
    audience: { userId: input.userId ?? null, roles: STAFF_ROLES },
    payload: {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      status: input.status,
      fromStatus: input.fromStatus ?? null,
      reason: input.reason ?? null,
      totalCents: input.totalCents,
      currency: input.currency,
      changedAt: new Date().toISOString(),
    },
  });
}

export type InventoryAlertLevel = 'LOW' | 'CRITICAL' | 'SOLD_OUT';

/**
 * Publishes a stock alert.
 *
 * Broadcast rather than user-scoped on purpose: the same event powers the
 * "selling fast" badge on a product page (public) and the low-stock queue in
 * the operator console (staff), and both need it regardless of who triggered it.
 */
export function emitInventoryAlert(input: {
  level: InventoryAlertLevel;
  ticketTypeId: string;
  productId?: string | null;
  productName?: string | null;
  serviceDate: string;
  timeSlot?: string | null;
  remaining: number;
  capacityTotal: number;
}): void {
  publishEvent({
    type: 'inventory.alert',
    audience: { broadcast: true, roles: STAFF_ROLES },
    payload: { ...input, at: new Date().toISOString() },
  });
}

/** Publishes a payment attempt result so the checkout UI can stop polling. */
export function emitPaymentEvent(input: {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  status: string;
  method: string;
  amountCents: number;
  currency: string;
  userId?: string | null;
  failureMessage?: string | null;
}): void {
  publishEvent({
    type: 'payment.status_changed',
    audience: { userId: input.userId ?? null, roles: STAFF_ROLES },
    payload: {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      paymentId: input.paymentId,
      status: input.status,
      method: input.method,
      amountCents: input.amountCents,
      currency: input.currency,
      failureMessage: input.failureMessage ?? null,
      changedAt: new Date().toISOString(),
    },
  });
}
