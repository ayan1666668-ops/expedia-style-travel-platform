import type { Metadata } from 'next';
import { TicketWallet } from '@/components/TicketWallet';

export const metadata: Metadata = {
  title: 'Ticket wallet',
  robots: { index: false },
};

export default function TicketsPage() {
  return (
    <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-7)' }}>
      <div className="row-between wrap" style={{ marginBottom: 'var(--sp-4)' }}>
        <div>
          <h1 style={{ margin: 0 }}>Ticket wallet</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Everything you need at the gate — turn your screen brightness up.
          </p>
        </div>
      </div>
      <TicketWallet />
    </div>
  );
}