import type { Metadata } from 'next';
import { AdminShell } from '@/components/AdminShell';
import { FinanceConsole } from '@/components/FinanceConsole';

export const metadata: Metadata = {
  title: 'Finance',
  robots: { index: false },
};

export default function AdminFinancePage() {
  return (
    <AdminShell
      active="finance"
      title="Finance"
      subtitle="Order-level revenue, refunds and live inventory commitments."
    >
      <FinanceConsole />
    </AdminShell>
  );
}