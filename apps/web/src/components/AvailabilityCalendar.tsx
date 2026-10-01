'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { AvailabilityDay } from '@/lib/api';
import { formatMoney } from '@/lib/format';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

type Props = {
  slug: string;
  days: AvailabilityDay[];
  selected: string;
};

/**
 * Availability calendar.
 *
 * The API returns only bookable days (sold-out days are simply absent), so the
 * grid renders the whole month but disables anything without availability —
 * which matches how travellers read a hotel or tour calendar.
 */
export function AvailabilityCalendar({ slug, days, selected }: Props) {
  const router = useRouter();
  const [monthOffset, setMonthOffset] = useState(0);

  const availabilityByDate = useMemo(() => {
    const map = new Map<string, AvailabilityDay>();
    for (const day of days) map.set(day.date, day);
    return map;
  }, [days]);

  // Months are built from the availability window so we never render months
  // that fall outside the published inventory.
  const { monthLabel, cells } = useMemo(() => {
    const first = days[0] ? new Date(`${days[0].date}T00:00:00Z`) : new Date();
    const anchor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + monthOffset, 1));
    const year = anchor.getUTCFullYear();
    const month = anchor.getUTCMonth();

    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    // Monday-first offset.
    const leading = (anchor.getUTCDay() + 6) % 7;

    const list: (string | null)[] = Array.from({ length: leading }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      list.push(new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10));
    }

    return {
      monthLabel: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(anchor),
      cells: list,
    };
  }, [days, monthOffset]);

  const todayIso = new Date().toISOString().slice(0, 10);

  function choose(date: string) {
    router.push(`/products/${slug}?date=${date}`);
  }

  const monthHasAny = cells.some((cell) => cell && availabilityByDate.has(cell));
  const canGoBack = monthOffset < Math.floor(days.length / 28) - 1;
  const canGoForward = monthOffset < Math.ceil(days.length / 30) - 1;

  return (
    <div className="calendar">
      <div className="row-between">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setMonthOffset((v) => Math.max(0, v - 1))}
          disabled={!canGoBack}
          aria-label="Previous month"
        >
          ←
        </button>
        <strong>{monthLabel}</strong>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setMonthOffset((v) => v + 1)}
          disabled={!canGoForward}
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {!monthHasAny ? (
        <p className="small muted center" style={{ padding: 'var(--sp-5)' }}>
          No availability published for this month.
        </p>
      ) : (
        <>
          <div className="calendar-grid">
            {WEEKDAYS.map((day) => (
              <div key={day} className="calendar-head">
                {day}
              </div>
            ))}

            {cells.map((date, index) => {
              if (!date) return <div key={`empty-${index}`} />;

              const availability = availabilityByDate.get(date);
              const isPast = date < todayIso;
              const isSelected = date === selected;
              const disabled = !availability || isPast;
              const dayNumber = Number(date.slice(-2));

              return (
                <button
                  key={date}
                  type="button"
                  className={`calendar-day ${isSelected ? 'selected' : ''} ${availability?.status === 'LIMITED' ? 'limited' : ''}`}
                  disabled={disabled}
                  onClick={() => choose(date)}
                  title={
                    availability
                      ? `${availability.availableQty} spots left · from ${formatMoney(availability.minPriceCents)}`
                      : 'Not available'
                  }
                  aria-label={`${date}${availability ? `, from ${formatMoney(availability.minPriceCents)}` : ', unavailable'}`}
                >
                  <span>{dayNumber}</span>
                  {availability && !isPast && (
                    <span className="calendar-price" aria-hidden>
                      ${Math.round(availability.minPriceCents / 100)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="row wrap tiny subtle" style={{ gap: 'var(--sp-4)' }}>
            <span className="row" style={{ gap: 5 }}>
              <span
                style={{ width: 11, height: 11, borderRadius: 3, border: '1px solid var(--border-strong)', display: 'inline-block' }}
              />
              Available
            </span>
            <span className="row" style={{ gap: 5 }}>
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 3,
                  border: '1px solid var(--warning-600)',
                  display: 'inline-block',
                }}
              />
              Limited availability
            </span>
            <span className="row" style={{ gap: 5 }}>
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 3,
                  background: 'var(--brand-600)',
                  display: 'inline-block',
                }}
              />
              Selected
            </span>
          </div>
        </>
      )}
    </div>
  );
}