/** Formatting helpers shared by server and client components. */

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'HUF', 'TWD']);

/** Money is always integer minor units; this is the only place it becomes text. */
export function formatMoney(cents: number, currency = 'USD', locale = 'en-US'): string {
  const exponent = ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
  const amount = cents / Math.pow(10, exponent);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: exponent === 0 ? 'code' : 'symbol',
      maximumFractionDigits: exponent === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(exponent)}`;
  }
}

export function formatDate(date: string | Date, locale = 'en-US'): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(value);
}

export function formatDateTime(date: string | Date, locale = 'en-US'): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

/** "in 3 days" / "tomorrow" / "2 months ago" - used on tickets and itineraries. */
export function relativeDay(date: string | Date, now = new Date()): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '';

  const target = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days < 7) return `In ${days} days`;
  if (days < -1 && days > -7) return `${Math.abs(days)} days ago`;
  if (days > 0) return `In ${Math.round(days / 30)} month${days > 60 ? 's' : ''}`;
  return `${Math.abs(Math.round(days / 30))} month${days < -60 ? 's' : ''} ago`;
}

export function discountPercent(currentCents: number, compareCents: number | null): number | null {
  if (!compareCents || compareCents <= currentCents) return null;
  return Math.round(((compareCents - currentCents) / compareCents) * 100);
}

/** Turns a ProductType enum value into shopper-facing copy. */
export const TYPE_LABELS: Record<string, string> = {
  ATTRACTION_TICKET: 'Attraction tickets',
  ACTIVITY: 'Activities',
  TOUR: 'Tours',
  DAY_TRIP: 'Day trips',
  PACKAGE: 'Packages',
  HOTEL_ROOM: 'Hotels',
  TRANSFER: 'Transfers',
  VEHICLE_RENTAL: 'Car rental',
  GUIDED_TOUR: 'Guided tours',
  RESTAURANT: 'Restaurants',
  CRUISE: 'Cruises',
  RENTAL_CAR: 'Car rental',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_PAYMENT: 'Awaiting payment',
  PAID: 'Paid',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partly refunded',
  EXPIRED: 'Expired',
  FAILED: 'Failed',
};

/** Maps an order status to shopper-facing copy. */
export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

/** Maps an order status to the badge tone used across the UI. */
export function orderStatusTone(status: string): 'positive' | 'warning' | 'critical' | 'neutral' {
  switch (status) {
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'positive';
    case 'PENDING_PAYMENT':
    case 'IN_PROGRESS':
      return 'warning';
    case 'CANCELLED':
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED':
    case 'EXPIRED':
    case 'FAILED':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function ticketStatusTone(status: string): 'positive' | 'warning' | 'critical' | 'neutral' {
  switch (status) {
    case 'ISSUED':
      return 'positive';
    case 'PARTIALLY_REDEEMED':
      return 'warning';
    case 'REDEEMED':
    case 'VOID':
    case 'EXPIRED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** Builds an ISO `YYYY-MM-DD` date string `days` from today. */
export function isoDateOffset(days: number, from = new Date()): string {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function stars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return `${'★'.repeat(full)}${half ? '⯨' : ''}${'☆'.repeat(Math.max(0, 5 - full - (half ? 1 : 0)))}`;
}