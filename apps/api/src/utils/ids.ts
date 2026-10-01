import { randomBytes, randomUUID } from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 — avoids read-aloud errors

function randomFrom(alphabet: string, length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/** Human-facing order number, e.g. `VY-8H3K2M-4T7P`. */
export function generateOrderNumber(): string {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `VY-${stamp}-${randomFrom(ALPHABET, 4)}`;
}

/** Ticket number, e.g. `TKT-9F3A-22KD-7BQ1`. */
export function generateTicketNumber(): string {
  return `TKT-${randomFrom(ALPHABET, 4)}-${randomFrom(ALPHABET, 4)}-${randomFrom(ALPHABET, 4)}`;
}

/** Barcode / QR payload key: dense, unambiguous, URL-safe. */
export function generateBarcode(): string {
  return randomFrom(ALPHABET, 12);
}

export function generateToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

export function generateIdempotencyKey(prefix = 'idem'): string {
  return `${prefix}_${randomUUID()}`;
}

export function generateShareToken(): string {
  return randomFrom('abcdefghijkmnopqrstuvwxyz23456789', 22);
}