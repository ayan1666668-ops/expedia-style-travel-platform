import type { Metadata } from 'next';
import { OrdersList } from '@/components/OrdersList';

export const metadata: Metadata = {
  title: 'My bookings',
  robots: { index: false },
};

export default function OrdersPage() {
  return (
    <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-7)' }}>
      <h1 style={{ marginBottom: 'var(--sp-4)' }}>My bookings</h1>
      <OrdersList />
    </div>
  );
}