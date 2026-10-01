/**
 * Money helpers.
 *
 * Every monetary value in Voyahub is an integer amount in the minor unit of
 * an ISO-4217 currency (cents for USD/EUR, pence for GBP). Floats are never
 * used for storage or arithmetic on money - only basis points (bps) are used
 * for percentages, and rounding is always half-up on the final cent.
 */

export const BPS_DENOMINATOR = 10_000;

export function applyBps(amountCents: number, bps: number): number {
  return Math.round((amountCents * bps) / BPS_DENOMINATOR);
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

/** Rounds half away from zero, which matches what payment gateways expect. */
export function roundCents(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function clampCents(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  'JPY', 'KRW', 'VND', 'CLP', 'ISK', 'HUF', 'TWD', 'XOF', 'XAF', 'PYG', 'RWF', 'UGX',
]);

export function minorUnits(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 2;
}

export function formatMoney(amountCents: number, currency = 'USD', locale = 'en-US'): string {
  const exponent = minorUnits(currency);
  const amount = amountCents / Math.pow(10, exponent);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: exponent === 0 ? 'code' : 'symbol',
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(exponent)}`;
  }
}

/**
 * Splits an amount into per-unit values that always sum back to the total.
 * Used when splitting a line total across units so no cent is lost.
 */
export function allocate(totalCents: number, weights: number[]): number[] {
  const totalWeight = sumCents(weights);
  if (totalWeight === 0 || weights.length === 0) return weights.map(() => 0);

  const raw = weights.map((weight) => (totalCents * weight) / totalWeight);
  const floored = raw.map((value) => Math.floor(value));
  let remainder = totalCents - sumCents(floored);

  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    floored[order[cursor % order.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }

  return floored;
}