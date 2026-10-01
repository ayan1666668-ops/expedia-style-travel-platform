import type { Metadata } from 'next';
import { AdminShell } from '@/components/AdminShell';
import { GateScanner } from '@/components/GateScanner';

export const metadata: Metadata = {
  title: 'Gate scanner',
  robots: { index: false },
};

export default function AdminScanPage() {
  return (
    <AdminShell
      active="scan"
      title="Gate scanner"
      subtitle="Validate and redeem e-tickets at the door."
    >
      <GateScanner />
    </AdminShell>
  );
}