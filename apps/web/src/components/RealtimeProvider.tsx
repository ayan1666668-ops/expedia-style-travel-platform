'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createRealtimeClient, type RealtimeEvent, type RealtimeStatus } from '@/lib/realtime';
import { onSessionChange, readToken } from '@/lib/session';

/**
 * Single realtime connection for the whole app.
 *
 * One socket per tab, fanned out to any number of consumers. Opening a socket
 * per component would multiply connections, handshakes and reconnects by the
 * number of widgets on the page — and the server's per-connection authorization
 * means they would all carry identical privileges anyway.
 */

type Listener = (event: RealtimeEvent) => void;

type RealtimeContextValue = {
  status: RealtimeStatus;
  /** Registers a handler for every event this session is authorised to receive. */
  subscribe: (listener: Listener) => () => void;
  /** Tears the socket down and connects again (e.g. after a failed deploy). */
  reconnect: () => void;
};

/** Rendering outside the provider degrades to a permanently-idle channel. */
const IDLE_CONTEXT: RealtimeContextValue = {
  status: 'idle',
  subscribe: () => () => undefined,
  reconnect: () => undefined,
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RealtimeStatus>('idle');
  // Bumped to force a fresh connection: on login/logout, and on manual retry.
  const [generation, setGeneration] = useState(0);
  const listenersRef = useRef(new Set<Listener>());

  useEffect(() => {
    const connection = createRealtimeClient({
      token: readToken(),
      onStatus: setStatus,
      onEvent: (event) => {
        for (const listener of listenersRef.current) {
          // One broken consumer must not swallow the event for the others.
          try {
            listener(event);
          } catch {
            /* consumer error */
          }
        }
      },
    });

    // A login/logout swaps the token, which changes the topics the server will
    // grant. Reusing the socket would silently keep the old privileges.
    const stopListening = onSessionChange(() => setGeneration((value) => value + 1));

    return () => {
      stopListening();
      connection.close();
    };
  }, [generation]);

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value = useMemo<RealtimeContextValue>(
    () => ({ status, subscribe, reconnect: () => setGeneration((current) => current + 1) }),
    [status, subscribe],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext) ?? IDLE_CONTEXT;
}

/**
 * Runs `handler` for every realtime event while the component is mounted.
 *
 * The handler is kept in a ref so callers can pass an inline closure without
 * re-subscribing on every render.
 */
export function useRealtimeEvent(handler: (event: RealtimeEvent) => void): void {
  const { subscribe } = useRealtime();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => subscribe((event) => handlerRef.current(event)), [subscribe]);
}
