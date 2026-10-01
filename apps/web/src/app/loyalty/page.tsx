import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { LoyaltyDashboard } from '@/components/LoyaltyDashboard';

export const metadata: Metadata = {
  title: 'Voyahub Rewards',
  description: 'Earn points on every booking, redeem them for cash back and perks.',
};

export default async function LoyaltyPage() {
  const program = await api.loyaltyProgram().catch(() => null);

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-7)' }}>
      <LoyaltyDashboard program={program} />
    </div>
  );
}