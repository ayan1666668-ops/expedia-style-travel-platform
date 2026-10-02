import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { tryVerifyToken } from '../utils/jwt';
import {
  grantedTopics,
  subscribeEvents,
  topicsFor,
  type RealtimeEvent,
} from '../modules/realtime/bus';

/**
 * ---------------------------------------------------------------------------
 * Realtime WebSocket gateway
 * ---------------------------------------------------------------------------
 *
 * `GET /api/v1/realtime?token=<jwt>` upgrades to a WebSocket. The token is
 * supplied as a query parameter because browsers cannot attach an Authorization
 * header to a WebSocket handshake — the same constraint every browser-facing
 * realtime API works around.
 *
 * Authorization happens once, at connect time:
 *
 *   - anonymous  → `public` (broadcast stock alerts, catalogue-wide signals)
 *   - customer   → `public` + `user:<id>`
 *   - staff      → `public` + `user:<id>` + `role:<ROLE>`
 *
 * A client may *narrow* what it receives (event-type filters) but can never
 * widen it: the topic set is fixed by the server, so a crafted `subscribe`
 * message cannot reach another shopper's order stream.
 *
 * Protocol
 *   server → { type: 'connected',  userId, topics, serverTime }
 *   server → { type: 'event',      event: { id, type, at, payload } }
 *   server → { type: 'subscribed', types }
 *   server → { type: 'pong' | 'error' }
 *   client → { action: 'subscribe' | 'unsubscribe' | 'ping', types?: string[] }
 *
 * `types` supports a one-level wildcard, e.g. `order.*` for every order event.
 */

/** `ws` readyState for an open socket. */
const WS_OPEN = 1;

/** Keeps idle sockets alive through proxies and load balancers. */
const HEARTBEAT_MS = 30_000;

const clientMessage = z.object({
  action: z.enum(['subscribe', 'unsubscribe', 'ping']),
  types: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
});

let liveConnections = 0;

/** Connection gauge, surfaced on `/ready` so realtime can be observed. */
export function realtimeStats(): { connections: number } {
  return { connections: liveConnections };
}

function matchesFilter(filter: Set<string> | null, eventType: string): boolean {
  // No filter (or an emptied one) means "everything I am allowed to receive".
  if (!filter || filter.size === 0) return true;
  if (filter.has(eventType)) return true;

  // One-level wildcard: `order.*` covers `order.status_changed`, and so on.
  const namespace = `${eventType.split('.')[0]}.*`;
  return filter.has(namespace);
}

export async function realtimeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/realtime', { websocket: true }, (socket, request) => {
    const token = (request.query as { token?: string } | undefined)?.token;
    const payload = tryVerifyToken(token);
    const user = payload ? { id: payload.sub, role: payload.role } : null;

    // Fixed at connect time — see the authorization note above.
    const topics = new Set(grantedTopics(user));

    /** Event types this socket actually cares about; `null` = all allowed. */
    let typeFilter: Set<string> | null = null;
    let closed = false;

    liveConnections += 1;

    const send = (message: unknown): void => {
      if (closed || socket.readyState !== WS_OPEN) return;
      try {
        socket.send(JSON.stringify(message));
      } catch (error) {
        logger.warn('realtime.send_failed', { reason: (error as Error).message });
      }
    };

    const stop = (): void => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
      liveConnections = Math.max(0, liveConnections - 1);
    };

    const unsubscribe = subscribeEvents((event: RealtimeEvent) => {
      // Topic check first: this is the security boundary, and it is cheap.
      if (!topicsFor(event).some((topic) => topics.has(topic))) return;
      if (!matchesFilter(typeFilter, event.type)) return;

      send({
        type: 'event',
        // `audience` is delivery metadata and is intentionally stripped: the
        // client must not learn who else received the event.
        event: { id: event.id, type: event.type, at: event.at, payload: event.payload },
      });
    });

    const heartbeat = setInterval(() => {
      if (closed) return;
      if (socket.readyState !== WS_OPEN) {
        stop();
        return;
      }
      try {
        // The browser replies with a protocol-level pong automatically; this
        // exists to keep NAT/proxy idle timers from dropping the connection.
        socket.ping();
      } catch {
        stop();
      }
    }, HEARTBEAT_MS);

    socket.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      let parsed: unknown;
      try {
        const text = Array.isArray(raw) ? Buffer.concat(raw).toString('utf8') : raw.toString();
        parsed = JSON.parse(text);
      } catch {
        send({ type: 'error', message: 'invalid_json' });
        return;
      }

      const result = clientMessage.safeParse(parsed);
      if (!result.success) {
        send({ type: 'error', message: 'unknown_action' });
        return;
      }

      if (result.data.action === 'ping') {
        send({ type: 'pong', at: new Date().toISOString() });
        return;
      }

      const requested = result.data.types ?? [];

      // `subscribe` with an empty list means "clear the filter, send me
      // everything I am allowed" — that is the only way back to the wide view,
      // since a filter can never widen what the connection is authorized for.
      if (result.data.action === 'subscribe' && requested.length === 0) {
        typeFilter = null;
        send({ type: 'subscribed', types: [] });
        return;
      }

      const next = new Set(typeFilter ?? []);
      for (const type of requested) {
        if (result.data.action === 'subscribe') next.add(type);
        else next.delete(type);
      }
      typeFilter = next.size > 0 ? next : null;

      send({ type: 'subscribed', types: [...next] });
    });

    socket.on('close', stop);
    socket.on('error', (error: Error) => {
      logger.warn('realtime.socket_error', { reason: error.message });
      stop();
    });

    send({
      type: 'connected',
      userId: user?.id ?? null,
      role: user?.role ?? null,
      topics: [...topics],
      serverTime: new Date().toISOString(),
    });
  });
}
