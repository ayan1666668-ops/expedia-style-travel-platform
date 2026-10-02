import type { Metadata } from 'next';
import { ConsoleShell } from '@/components/ConsoleShell';
import { SupportCustomers } from '@/components/SupportCustomers';
import { resolveServerLocale } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

export const metadata: Metadata = {
  title: 'Support console',
  robots: { index: false, follow: false },
};

export default async function SupportPage() {
  const locale = await resolveServerLocale();
  const t = createTranslator(locale);

  return (
    <ConsoleShell
      surface="support"
      locale={locale}
      title={t('support.customers')}
      subtitle={t('support.profile')}
    >
      <SupportCustomers locale={locale} />
    </ConsoleShell>
  );
}