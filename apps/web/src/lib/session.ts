/**
 * Session token storage.
 *
 * The token lives in localStorage (fast, synchronous, readable by any client
 * component) *and* in a readable cookie. The cookie exists purely so server
 * components can pre-render authenticated pages instead of flashing skeletons —
 * without it every order/ticket page would need a client round-trip before it
 * could show anything.
 */

const TOKEN_KEY = 'voyahub_token';
const USER_KEY = 'voyahub_user';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, matches a typical refresh window

export function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function readUser<T>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: unknown): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Not httpOnly: the API is called from the browser. Scoped to this host and
  // marked SameSite=Lax so it rides along on top-level navigations but never
  // on cross-site subrequests.
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax`;
}