import type { Metadata } from 'next';
import { ConsoleShell } from '@/components/ConsoleShell';
import { PromoManager } from '@/components/PromoManager';
import { resolveServerLocale } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

export const metadata: Metadata = {
  title: 'Promotional banners',
  robots: { index: false, follow: false },
};

export default async function AdminPromoPage() {
  const locale = await resolveServerLocale();
  const t = createTranslator(locale);

  return (
    <ConsoleShell
      surface="admin"
      locale={locale}
      title={t('promo.adminTitle')}
      subtitle={t('promo.adminSubtitle')}
    >
      <PromoManager locale={locale} />
    </ConsoleShell>
  );
}