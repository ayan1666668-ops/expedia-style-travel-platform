'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { LocaleCode } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

/**
 * Collapsible wrapper for the search filter rail.
 *
 * On desktop the CSS keeps `.filter-rail-body` visible and hides the toggle, so
 * this component is effectively a pass-through. On mobile it hides the body
 * behind a disclosure button — a 244px sidebar of checkbox groups otherwise
 * pushes every result off-screen.
 *
 * The filter form itself is a plain server-rendered `<form method="get">`, so
 * filters still submit correctly with JavaScript disabled; only the collapse
 * behaviour needs the client.
 */
export function FilterRail({
  activeCount,
  locale,
  children,
}: {
  activeCount: number;
  locale: LocaleCode;
  children: ReactNode;
}) {
  const t = createTranslator(locale);

  // Default to expanded on desktop so the first paint isn't missing filters for
  // anyone who resizes from a wide window down to a phone.
  const [expanded, setExpanded] = useState(false);

  // On desktop (where the toggle is hidden) force the body open regardless of
  // state, otherwise a stale `false` would blank the rail after a resize.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 861px)');
    const sync = (event: MediaQueryList | MediaQueryListEvent) => {
      if (event.matches) setExpanded(true);
    };

    sync(desktop);
    desktop.addEventListener('change', sync);
    return () => desktop.removeEventListener('change', sync);
  }, []);

  return (
    <div className={`filter-rail ${expanded ? 'expanded' : ''}`}>
      <button
        type="button"
        className="filter-rail-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="filter-rail-body"
      >
        <span>
          {t('search.filters')}
          {activeCount > 0 && (
            <span className="badge badge-brand" style={{ marginLeft: 8 }}>
              {activeCount}
            </span>
          )}
        </span>
      </button>

      <div id="filter-rail-body" className="filter-rail-body">
        {children}
      </div>
    </div>
  );
}