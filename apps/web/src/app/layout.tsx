import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { resolveServerLocale } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

export const metadata: Metadata = {
  title: {
    default: 'Voyahub — Book tickets, tours and experiences worldwide',
    template: '%s | Voyahub',
  },
  description:
    'Skip-the-line tickets, guided tours, river cruises and day trips in over 20 cities across Europe and North America. Instant confirmation and free cancellation on most bookings.',
  keywords: ['tickets', 'tours', 'experiences', 'attractions', 'things to do', 'travel'],
  openGraph: {
    type: 'website',
    siteName: 'Voyahub',
    locale: 'en_US',
  },
  formatDetection: { telephone: false },
};

/**
 * `viewport-fit=cover` lets the sticky CTA and safe-area padding work on
 * notched devices; `viewport-fit` alone is not enough without a
 * `padding-bottom: env(safe-area-inset-bottom)` on the fixed bar.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom is left enabled on purpose — pinching to read a booking reference or
  // a QR code is a real need. We prevent *accidental* zoom instead, via
  // touch-action on interactive controls, rather than capping the scale.
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolved per-request on the server so the first paint is already in the
  // right language — no flash of English before hydration swaps it.
  const locale = await resolveServerLocale();
  const t = createTranslator(locale);

  return (
    <html lang={locale === 'zh' ? 'zh-CN' : 'en'}>
      <body>
        <a className="skip-link" href="#main">
          {t('nav.skipToContent')}
        </a>
        <div className="locale-bar">
          <div className="container locale-bar-inner">
            <span className="locale-bar-text">{t('nav.priceNotice')}</span>
            <LocaleSwitcher locale={locale} />
          </div>
        </div>
        <Header locale={locale} />
        <main id="main">{children}</main>
        <Footer locale={locale} />
      </body>
    </html>
  );
}