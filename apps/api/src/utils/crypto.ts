import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Hashes a password with scrypt. Format: `scrypt$N$r$p$salt$hash`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, nRaw, rRaw, pRaw, salt, expected] = parts;
  const derived = scryptSync(password, salt, KEY_LENGTH, {
    N: Number(nRaw),
    r: Number(rRaw),
    p: Number(pRaw),
    maxmem: SCRYPT_PARAMS.maxmem,
  });
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (expectedBuffer.length !== derived.length) return false;
  return timingSafeEqual(derived, expectedBuffer);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}