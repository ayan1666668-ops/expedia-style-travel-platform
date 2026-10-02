import type { Metadata } from 'next';
import { OrdersList } from '@/components/OrdersList';
import { resolveServerLocale } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

export const metadata: Metadata = {
  robots: { index: false },
};

export default async function OrdersPage() {
  const locale = await resolveServerLocale();
  const t = createTranslator(locale);

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-7)' }}>
      <h1 style={{ marginBottom: 'var(--sp-4)' }}>{t('account.myBookings')}</h1>
      <OrdersList locale={locale} />
    </div>
  );
}