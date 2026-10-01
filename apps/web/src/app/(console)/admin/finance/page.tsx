import type { Metadata } from 'next';
import { ConsoleShell } from '@/components/ConsoleShell';
import { FinanceConsole } from '@/components/FinanceConsole';
import { resolveServerLocale } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

export const metadata: Metadata = {
  title: 'Finance',
  robots: { index: false, follow: false },
};

export default async function AdminFinancePage() {
  const locale = await resolveServerLocale();
  const t = createTranslator(locale);

  return (
    <ConsoleShell surface="admin" locale={locale} title={t('staff.finance')} subtitle={t('staff.topProducts')}>
      <FinanceConsole locale={locale} />
    </ConsoleShell>
  );
}