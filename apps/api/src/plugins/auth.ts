import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { config } from '../config/env';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';
import { tryVerifyToken, verifyToken } from '../utils/jwt';

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: string;
  locale: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? value : undefined;
}

/** Attaches `request.user` when a valid token is present, but never rejects. */
export const optionalAuth = fp(async (app: FastifyInstance) => {
  app.decorateRequest('user', undefined);

  app.addHook('onRequest', async (request: FastifyRequest) => {
    const token = bearerToken(request);
    const payload = tryVerifyToken(token);
    if (payload) {
      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        locale: payload.locale,
      };
    }
  });
});

export function requireAuth(request: FastifyRequest): AuthenticatedUser {
  if (!request.user) throw AppError.unauthenticated();
  return request.user;
}

/**
 * Role gate for operator/merchant/admin surfaces. Returns a plain preHandler
 * hook (not a plugin) so it can be used inside `preHandler` arrays.
 */
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = requireAuth(request);
    if (!roles.includes(user.role)) throw AppError.forbidden();
    void reply;
  };
}

/**
 * Standalone hook for routes that only need an authenticated user.
 *
 * Must be `async`. A plain synchronous hook that returns `undefined` is treated
 * by Fastify as callback-style, so it waits for a `done` callback that never
 * arrives — the request then hangs forever with no log line. Throwing is the
 * only case that still works, which is what makes the mistake so easy to miss:
 * unauthenticated calls fail fast with a 401, and authenticated ones hang.
 * `requireRole` avoided this only because it happens to be `async`.
 */
export async function authenticated(request: FastifyRequest): Promise<void> {
  requireAuth(request);
}

/** Resolves a customer-facing locale from Accept-Language, defaulting to en-US. */
export function resolveLocale(request: FastifyRequest): string {
  const supported = config.site.supportedLocales as readonly string[];
  const explicit = (request.query as Record<string, string> | undefined)?.locale;
  if (explicit && supported.includes(explicit)) return explicit;

  // The storefront speaks bare language tags ("en", "zh") while the API stores
  // full tags ("en-US", "zh-CN"). Match on the language subtag rather than
  // rejecting the request and silently serving English.
  if (explicit) {
    const language = explicit.split('-')[0]!.toLowerCase();
    const regional = supported.find((code) => code.split('-')[0]!.toLowerCase() === language);
    if (regional) return regional;
  }

  if (request.user?.locale && supported.includes(request.user.locale)) {
    return request.user.locale;
  }
  return config.site.defaultLocale;
}

export function requireFreshCsrf(_request: FastifyRequest): void {
  // Placeholder for environments that add cookie-based auth; the JWT in the
  // Authorization header is not vulnerable to CSRF.
}

export async function userExists(userId: string): Promise<boolean> {
  const count = await prisma.user.count({ where: { id: userId } });
  return count > 0;
}

export { verifyToken };