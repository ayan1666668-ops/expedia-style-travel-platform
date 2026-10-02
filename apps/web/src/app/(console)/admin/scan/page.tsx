import type { Metadata } from 'next';
import { ConsoleShell } from '@/components/ConsoleShell';
import { GateScanner } from '@/components/GateScanner';
import { resolveServerLocale } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

export const metadata: Metadata = {
  title: 'Gate scanner',
  robots: { index: false, follow: false },
};

export default async function AdminScanPage() {
  const locale = await resolveServerLocale();
  const t = createTranslator(locale);

  return (
    <ConsoleShell
      surface="admin"
      locale={locale}
      title={t('staff.gateScanner')}
      subtitle={t('nav.myTickets')}
    >
      <GateScanner locale={locale} />
    </ConsoleShell>
  );
}