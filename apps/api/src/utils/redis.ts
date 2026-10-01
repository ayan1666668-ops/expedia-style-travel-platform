import Redis from 'ioredis';
import { config } from '../config/env';

let client: Redis | MemoryRedis | null = null;

/**
 * Redis is an accelerator, never a hard dependency: it backs the inventory hot
 * path, rate limiting and short-lived idempotency locks. When it is not
 * configured or unreachable we fall back to an in-process stub so local
 * development and CI keep working.
 */
class MemoryRedis {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  private sweep() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) this.store.delete(key);
    }
  }

  async get(key: string): Promise<string | null> {
    this.sweep();
    return this.store.get(key)?.value ?? null;
  }

  async set(key: string, value: string, mode?: string, ttlSeconds?: number): Promise<'OK'> {
    const expiresAt = mode?.toUpperCase() === 'EX' && ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.store.delete(key)) removed += 1;
    }
    return removed;
  }

  async incr(key: string): Promise<number> {
    const current = Number((await this.get(key)) ?? '0');
    const next = current + 1;
    await this.set(key, String(next));
    return next;
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + ttlSeconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.ceil((entry.expiresAt - Date.now()) / 1000);
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<'OK'> {
    this.store.clear();
    return 'OK';
  }

  disconnect(): void {
    /* nothing to release */
  }
}

function createClient(): Redis | MemoryRedis {
  if (!config.redisUrl) return new MemoryRedis();

  const redis = new Redis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
  });

  // Never let a Redis outage take the process down; callers already handle
  // cache misses, and Postgres remains the source of truth.
  redis.on('error', (error) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[redis] connection error:', error.message);
    }
  });
  redis.connect().catch(() => undefined);

  return redis;
}

export function getRedis(): Redis | MemoryRedis {
  if (!client) client = createClient();
  return client;
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  await client.quit().catch(() => undefined);
  client.disconnect?.();
  client = null;
}

/** Cache helper that swallows failures and returns `null` on any problem. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await getRedis().get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  try {
    await getRedis().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    /* cache is best-effort */
  }
}

export async function cacheDelete(pattern: string): Promise<void> {
  try {
    await getRedis().del(pattern);
  } catch {
    /* cache is best-effort */
  }
}