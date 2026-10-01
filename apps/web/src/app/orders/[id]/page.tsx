import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { OrderDetailView } from '@/components/OrderDetailView';

export const metadata: Metadata = {
  title: 'Booking details',
  robots: { index: false },
};

const COOKIE = 'voyahub_token';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Pre-render with the cookie token so the page ships real content instead of a
  // skeleton. The client component still re-fetches on mount, which keeps this
  // safe if the cookie is stale or the browser has signed out since.
  const token = (await cookies()).get(COOKIE)?.value ?? null;
  if (!token) {
    return <OrderDetailView orderId={id} initial={null} />;
  }

  const order = await api.order(id, token).catch(() => null);
  if (!order) return <OrderDetailView orderId={id} initial={null} />;

  const quote =
    ['CONFIRMED', 'PAID'].includes(order.status)
      ? await api.cancellationQuote(id, token).catch(() => null)
      : null;

  return <OrderDetailView orderId={id} initial={order} initialQuote={quote} />;
}