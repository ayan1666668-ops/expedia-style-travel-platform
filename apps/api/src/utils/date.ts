/**
 * Date helpers for a travel domain.
 *
 * Service dates (`serviceDate`) are calendar days, not instants: a ticket for
 * "2026-07-04" is the same date no matter which timezone the buyer is in.
 * Postgres stores them as `@db.Date`, so we always normalise to UTC midnight
 * before persisting and strip the time component when comparing.
 */

const MS_PER_DAY = 86_400_000;

/** Parses `YYYY-MM-DD` (or any parseable value) to UTC midnight. */
export function toServiceDate(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const iso = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid service date: ${value}`);
  }
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

/** Formats a service date as `YYYY-MM-DD`. */
export function formatServiceDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
    ),
  );
}

/** Whole-day difference, ignoring DST because we operate on UTC midnights. */
export function differenceInDays(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

export function startOfDay(date: Date): Date {
  return toServiceDate(date);
}

export function isBeforeDate(a: Date, b: Date): boolean {
  return differenceInDays(a, b) < 0;
}

/** ISO weekday: 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(date: Date): number {
  return date.getUTCDay();
}

export function isWeekend(date: Date): boolean {
  const weekday = dayOfWeek(date);
  return weekday === 0 || weekday === 6;
}

/** Builds the inclusive list of service dates between two dates. */
export function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  let cursor = toServiceDate(from);
  const end = toServiceDate(to);
  // Hard cap prevents an unbounded loop if a caller passes a bad range.
  while (cursor.getTime() <= end.getTime() && days.length < 366) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

/** Combines a service date with an `HH:mm` time slot into an instant (UTC). */
export function combineDateAndSlot(serviceDate: Date, timeSlot: string | null): Date {
  if (!timeSlot) return serviceDate;
  const [hours = '0', minutes = '0'] = timeSlot.split(':');
  return new Date(
    Date.UTC(
      serviceDate.getUTCFullYear(),
      serviceDate.getUTCMonth(),
      serviceDate.getUTCDate(),
      Number(hours),
      Number(minutes),
      0,
      0,
    ),
  );
}

export function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

/**
 * Whole hours from `from` to `to`. Negative when `to` is in the past.
 * Call it as `hoursBetween(now, futureDate)` to get positive notice.
 */
export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 3_600_000;
}

export function daysSince(date: Date): number {
  return differenceInDays(new Date(), date);
}