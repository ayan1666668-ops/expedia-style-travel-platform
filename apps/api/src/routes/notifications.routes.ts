import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../plugins/auth';
import { publishEvent } from '../modules/realtime/bus';
import { shapeNotification } from '../modules/realtime/notify';
import { AppError } from '../utils/errors';

/**
 * ---------------------------------------------------------------------------
 * Notification centre
 * ---------------------------------------------------------------------------
 *
 * The durable half of realtime: WebSocket events are ephemeral (a shopper who
 * reloads the page has nothing left), so every meaningful transition also lands
 * in `Notification`. This endpoint is what the bell in the header renders on a
 * cold load; the socket then keeps it live.
 *
 * Reads are always scoped to `request.user` — there is no way to address
 * another shopper's notifications from the client.
 */

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

const NOTIFICATION_SELECT = {
  id: true,
  channel: true,
  status: true,
  template: true,
  subject: true,
  locale: true,
  payload: true,
  orderId: true,
  createdAt: true,
  readAt: true,
  order: { select: { orderNumber: true } },
} as const;

async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null, channel: 'IN_APP' },
  });
}

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/notifications', async (request) => {
    const user = requireAuth(request);
    const query = listQuery.parse(request.query ?? {});

    const rows = await prisma.notification.findMany({
      where: {
        userId: user.id,
        // Only in-app rows belong in the bell: EMAIL/SMS/PUSH rows describe
        // transport deliveries the shopper cannot act on here.
        channel: 'IN_APP',
        ...(query.unreadOnly ? { readAt: null } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      select: NOTIFICATION_SELECT,
    });

    return {
      items: rows.map(shapeNotification),
      unread: await unreadCount(user.id),
      nextCursor: rows.length === query.limit ? rows[rows.length - 1]!.id : null,
    };
  });

  app.post('/notifications/:id/read', async (request) => {
    const user = requireAuth(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);

    // `updateMany` keeps the ownership check inside the write: a notification
    // belonging to someone else simply matches zero rows.
    const result = await prisma.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date(), status: 'READ' },
    });
    if (result.count === 0) {
      const exists = await prisma.notification.count({ where: { id, userId: user.id } });
      if (exists === 0) throw AppError.notFound('Notification');
    }

    const unread = await unreadCount(user.id);
    // Broadcast the new badge count so other open tabs stay in sync.
    publishEvent({ type: 'notification.read', audience: { userId: user.id }, payload: { unread } });

    return { ok: true, unread };
  });

  app.post('/notifications/read-all', async (request) => {
    const user = requireAuth(request);

    await prisma.notification.updateMany({
      where: { userId: user.id, channel: 'IN_APP', readAt: null },
      data: { readAt: new Date(), status: 'READ' },
    });

    publishEvent({ type: 'notification.read', audience: { userId: user.id }, payload: { unread: 0 } });

    return { ok: true, unread: 0 };
  });
}
