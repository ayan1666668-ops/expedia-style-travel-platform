import type { Metadata } from 'next';
import { AdminDashboardBody, AdminShell } from '@/components/AdminShell';

export const metadata: Metadata = {
  title: 'Operations dashboard',
  robots: { index: false },
};

export default function AdminPage() {
  return (
    <AdminShell
      active="dashboard"
      title="Operations dashboard"
      subtitle="Revenue, demand and inventory health across the marketplace."
    >
      <AdminDashboardBody />
    </AdminShell>
  );
}