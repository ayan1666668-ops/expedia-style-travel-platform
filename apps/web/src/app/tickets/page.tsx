import type { Metadata } from 'next';
import { TicketWallet } from '@/components/TicketWallet';
import { resolveServerLocale } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

export const metadata: Metadata = {
  robots: { index: false },
};

export default async function TicketsPage() {
  const locale = await resolveServerLocale();
  const t = createTranslator(locale);

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-7)' }}>
      <div className="row-between wrap" style={{ marginBottom: 'var(--sp-4)' }}>
        <div>
          <h1 style={{ margin: 0 }}>{t('account.walletTitle')}</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {t('account.walletSubtitle')}
          </p>
        </div>
      </div>
      <TicketWallet locale={locale} />
    </div>
  );
}