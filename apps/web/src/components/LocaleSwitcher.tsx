'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALES, LOCALE_COOKIE, type LocaleCode } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

/**
 * Language switcher.
 *
 * Writes a cookie (readable by server components on the next render) and then
 * forces a full navigation. A client-side locale context would be faster, but
 * server components would keep rendering in the old language until the next
 * navigation — and most of this site is server-rendered, so that would be the
 * common case, not the edge case.
 */
export function LocaleSwitcher({ locale }: { locale: LocaleCode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(next: LocaleCode) {
    if (next === locale) return;

    // One year, no `SameSite` needed — the value is not a credential.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
    startTransition(() => router.refresh());
  }

  const t = createTranslator(locale);

  return (
    <div
      className="locale-switcher"
      role="group"
      aria-label={t('nav.menu')}
      data-pending={pending ? 'true' : undefined}
    >
      {LOCALES.map((option) => (
        <button
          key={option.code}
          type="button"
          className={`locale-option ${option.code === locale ? 'active' : ''}`}
          onClick={() => pick(option.code)}
          // aria-current tells assistive tech which one is live, without
          // stealing focus to an unrelated element.
          aria-current={option.code === locale ? 'true' : undefined}
          lang={option.code}
        >
          {option.short}
        </button>
      ))}
    </div>
  );
}