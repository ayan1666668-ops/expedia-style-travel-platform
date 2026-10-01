import { PrismaClient } from '@prisma/client';
import { config } from '../config/env';

/**
 * A single Prisma client for the whole process. `globalThis` caching keeps the
 * connection pool intact across tsx watch reloads in development.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      config.env === 'development'
        ? [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }]
        : [{ emit: 'event', level: 'error' }],
  });

if (config.env !== 'production') globalForPrisma.prisma = prisma;

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Postgres trigram/full-text index search, used when OpenSearch is disabled.
 * Kept next to the client so both search backends share one contract.
 */
export async function rawSql<T = unknown>(query: string, ...values: unknown[]): Promise<T[]> {
  const rows = await prisma.$queryRawUnsafe<T[]>(query, ...values);
  return rows;
}