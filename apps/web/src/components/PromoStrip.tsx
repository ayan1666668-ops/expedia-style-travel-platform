import Link from 'next/link';
import { api, type PromoBanner } from '@/lib/api';
import { createTranslator } from '@/lib/i18n/dictionaries';
import type { LocaleCode } from '@/lib/i18n/config';

/**
 * Homepage promotional strip.
 *
 * Server-rendered with a 60s revalidate: banners change when an operator edits
 * them, which is frequent enough to want a short cache and rare enough not to
 * need revalidation on write. The API decides *whether* a banner is eligible
 * (schedule, market, locale), so this component only lays it out.
 */

const THEME_CLASS: Record<PromoBanner['theme'], string> = {
  brand: 'promo-brand',
  accent: 'promo-accent',
  success: 'promo-success',
  warning: 'promo-warning',
  neutral: 'promo-neutral',
};

export async function PromoStrip({ locale }: { locale: LocaleCode }) {
  // The API localises from an `en-US`-style locale code, so pass the full tag.
  const result = await api
    .promoBanners({ slot: 'home', locale: locale === 'zh' ? 'zh-CN' : 'en-US' })
    .catch(() => null);

  const banners = result?.grouped?.home ?? [];
  if (banners.length === 0) return null;

  const t = createTranslator(locale);

  return (
    <section aria-label={t('promo.adminTitle')} className="promo-strip">
      {banners.map((banner) => (
        <PromoCard key={banner.id} banner={banner} />
      ))}
    </section>
  );
}

function PromoCard({ banner }: { banner: PromoBanner }) {
  // A banner without a link is a plain announcement, not a call to action —
  // rendering it as a Link with an undefined href would produce a dead anchor.
  const inner = (
    <>
      {banner.imageUrl && <img src={banner.imageUrl} alt="" className="promo-image" loading="lazy" />}

      <div className="promo-copy">
        <h3 className="promo-title">{banner.title}</h3>
        {banner.body && <p className="promo-body">{banner.body}</p>}
      </div>

      {banner.ctaLabel && banner.ctaHref && <span className="promo-cta">{banner.ctaLabel} →</span>}
    </>
  );

  const className = `promo-card ${THEME_CLASS[banner.theme] ?? THEME_CLASS.brand}`;

  return banner.ctaHref ? (
    <Link href={banner.ctaHref} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}