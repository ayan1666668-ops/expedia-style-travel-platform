import type { Metadata } from 'next';
import { RegisterForm } from '@/components/AuthForms';
import { resolveServerLocale } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

export const metadata: Metadata = {
  robots: { index: false },
};

export default async function RegisterPage() {
  const locale = await resolveServerLocale();
  const t = createTranslator(locale);

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-7)', paddingBottom: 'var(--sp-7)' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 'var(--sp-2)' }}>{t('auth.registerTitle')}</h1>
        <p className="muted" style={{ marginBottom: 'var(--sp-5)' }}>
          {t('auth.registerSubtitle')}
        </p>
        <RegisterForm locale={locale} />
      </div>
    </div>
  );
}