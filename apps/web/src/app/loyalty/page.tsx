import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { LoyaltyDashboard } from '@/components/LoyaltyDashboard';
import { resolveServerLocale } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const t = createTranslator(locale);
  return { title: t('loyalty.title'), description: t('loyalty.metaDescription') };
}

export default async function LoyaltyPage() {
  const locale = await resolveServerLocale();
  const program = await api.loyaltyProgram().catch(() => null);

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-7)' }}>
      <LoyaltyDashboard program={program} locale={locale} />
    </div>
  );
}