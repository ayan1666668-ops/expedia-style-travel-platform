import type { Metadata } from 'next';
import { ConsoleShell } from '@/components/ConsoleShell';
import { SupportCoupons } from '@/components/SupportCoupons';
import { resolveServerLocale } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

export const metadata: Metadata = {
  title: 'Support · Coupons',
  robots: { index: false, follow: false },
};

export default async function SupportCouponsPage() {
  const locale = await resolveServerLocale();
  const t = createTranslator(locale);

  return (
    <ConsoleShell surface="support" locale={locale} title={t('support.coupons')} subtitle={t('support.verifyCoupon')}>
      <SupportCoupons locale={locale} />
    </ConsoleShell>
  );
}