import type { Metadata } from 'next';
import { ConsoleShell } from '@/components/ConsoleShell';
import { SupportOrders } from '@/components/SupportOrders';
import { resolveServerLocale } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

export const metadata: Metadata = {
  title: 'Support · Orders',
  robots: { index: false, follow: false },
};

export default async function SupportOrdersPage() {
  const locale = await resolveServerLocale();
  const t = createTranslator(locale);

  return (
    <ConsoleShell surface="support" locale={locale} title={t('support.orders')} subtitle={t('support.lookupOrder')}>
      <SupportOrders locale={locale} />
    </ConsoleShell>
  );
}