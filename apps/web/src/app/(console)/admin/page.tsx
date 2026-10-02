import type { Metadata } from 'next';
import { AdminDashboardBody } from '@/components/AdminShell';
import { ConsoleShell } from '@/components/ConsoleShell';
import { resolveServerLocale } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

export const metadata: Metadata = {
  title: 'Operations dashboard',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const locale = await resolveServerLocale();
  const t = createTranslator(locale);

  return (
    <ConsoleShell
      surface="admin"
      locale={locale}
      title={t('staff.overview')}
      subtitle={t('staff.recentOrders')}
    >
      <AdminDashboardBody locale={locale} />
    </ConsoleShell>
  );
}