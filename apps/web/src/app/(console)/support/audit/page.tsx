import type { Metadata } from 'next';
import { ConsoleShell } from '@/components/ConsoleShell';
import { SupportAudit } from '@/components/SupportAudit';
import { resolveServerLocale } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

export const metadata: Metadata = {
  title: 'Support · Audit',
  robots: { index: false, follow: false },
};

export default async function SupportAuditPage() {
  const locale = await resolveServerLocale();
  const t = createTranslator(locale);

  return (
    <ConsoleShell surface="support" locale={locale} title={t('support.audit')} subtitle={t('support.walletHistory')}>
      <SupportAudit locale={locale} />
    </ConsoleShell>
  );
}