import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { OrderDetailView } from '@/components/OrderDetailView';
import { resolveServerLocale } from '@/lib/i18n/config';

export const metadata: Metadata = {
  robots: { index: false },
};

const COOKIE = 'voyahub_token';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await resolveServerLocale();

  // Pre-render with the cookie token so the page ships real content instead of a
  // skeleton. The client component still re-fetches on mount, which keeps this
  // safe if the cookie is stale or the browser has signed out since.
  const token = (await cookies()).get(COOKIE)?.value ?? null;
  if (!token) {
    return <OrderDetailView orderId={id} initial={null} locale={locale} />;
  }

  const order = await api.order(id, token).catch(() => null);
  if (!order) return <OrderDetailView orderId={id} initial={null} locale={locale} />;

  const quote =
    ['CONFIRMED', 'PAID'].includes(order.status)
      ? await api.cancellationQuote(id, token).catch(() => null)
      : null;

  return <OrderDetailView orderId={id} initial={order} initialQuote={quote} locale={locale} />;
}