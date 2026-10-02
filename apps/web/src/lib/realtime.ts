/**
 * Realtime client.
 *
 * A single WebSocket per browser tab, shared by every consumer, with automatic
 * reconnect and a subscription protocol that lets each consumer ask for only the
 * event types it cares about:
 *
 *   const connection = createRealtimeClient({
 *     token,
 *     types: ['order.*'],            // one-level wildcard
 *     onEvent: (event) => { ... },
 *   });
 *   connection.close();
 *
 * The server decides *what a connection is allowed to receive* (see the API's
 * realtime gateway) — the `types` list only narrows that further, so a client
 * cannot subscribe itself into another shopper's events.
 */

export type RealtimeEvent = {
  id: string;
  type: string;
  at: string;
  payload: Record<string, unknown>;
};

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export type RealtimeConnection = {
  close: () => void;
  /** Send a new type filter without dropping the socket. */
  setTypes: (types: string[]) => void;
  status: () => RealtimeStatus;
};

/** First retry delay; doubles up to MAX_BACKOFF_MS. */
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Resolves the WebSocket endpoint.
 *
 * Three cases, mirroring how `lib/api.ts` resolves the HTTP base:
 *
 *  1. `NEXT_PUBLIC_REALTIME_URL` — fully explicit endpoint.
 *  2. `NEXT_PUBLIC_API_BASE_URL` — derive `ws(s)://` from the API origin.
 *  3. Same origin — the default. Next.js rewrites `/api/v1/*` (including the
 *     upgrade) to the API, so the browser stays on one origin and CORS never
 *     enters the picture.
 */
export function resolveRealtimeUrl(token: string | null): string | null {
  if (typeof window === 'undefined') return null;

  const explicit = process.env.NEXT_PUBLIC_REALTIME_URL;
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  let url: URL;
  if (explicit) {
    url = new URL(explicit);
  } else if (apiBase) {
    const origin = apiBase.replace(/^http/, 'ws').replace(/\/$/, '');
    url = new URL(`${origin}/api/v1/realtime`);
  } else {
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    url = new URL(`${scheme}//${window.location.host}/api/v1/realtime`);
  }

  if (token) url.searchParams.set('token', token);
  return url.toString();
}

export function createRealtimeClient(config: {
  token: string | null;
  types?: string[];
  onEvent: (event: RealtimeEvent) => void;
  onStatus?: (status: RealtimeStatus) => void;
}): RealtimeConnection {
  let socket: WebSocket | null = null;
  let status: RealtimeStatus = 'idle';
  let attempts = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let types = config.types ?? [];

  const setStatus = (next: RealtimeStatus) => {
    if (status === next) return;
    status = next;
    config.onStatus?.(next);
  };

  const send = (message: unknown) => {
    if (socket?.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(message));
    } catch {
      /* the socket is about to close; the reconnect path handles it */
    }
  };

  const scheduleReconnect = () => {
    if (disposed || retryTimer) return;

    // Exponential backoff, capped. Jitter avoids every open tab in a fleet
    // reconnecting on the same tick after an API restart.
    const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempts);
    const jittered = delay * (0.5 + Math.random() / 2);
    attempts += 1;

    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, jittered);
  };

  function connect(): void {
    if (disposed) return;

    const url = resolveRealtimeUrl(config.token);
    if (!url) {
      setStatus('closed');
      return;
    }

    setStatus(attempts === 0 ? 'connecting' : 'reconnecting');

    try {
      socket = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      attempts = 0;
      setStatus('open');
      // The server resets the filter on every new connection, so re-assert it.
      if (types.length > 0) send({ action: 'subscribe', types });
    };

    socket.onmessage = (message: MessageEvent<string>) => {
      if (typeof message.data !== 'string') return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(message.data);
      } catch {
        return;
      }
      if (typeof parsed !== 'object' || parsed === null) return;

      const frame = parsed as { type?: string; event?: RealtimeEvent };
      if (frame.type === 'event' && frame.event) config.onEvent(frame.event);
    };

    socket.onerror = () => {
      // `onclose` always follows, so reconnection is handled there only.
    };

    socket.onclose = () => {
      socket = null;
      if (disposed) {
        setStatus('closed');
        return;
      }
      setStatus('reconnecting');
      scheduleReconnect();
    };
  }

  connect();

  return {
    close: () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      // `onclose` will fire; `disposed` keeps it from scheduling a reconnect.
      socket?.close();
      socket = null;
      setStatus('closed');
    },
    setTypes: (next: string[]) => {
      types = next;
      // An empty list is the protocol's "clear the filter" signal — it restores
      // the full set of events this connection is authorized for.
      send(next.length === 0 ? { action: 'subscribe', types: [] } : { action: 'subscribe', types: next });
    },
    status: () => status,
  };
}
