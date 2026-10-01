import { redirect } from 'next/navigation';
import { CheckoutFlow } from '@/components/CheckoutFlow';
import { resolveServerLocale } from '@/lib/i18n/config';

/**
 * The checkout itself is a client flow (it holds payment state), but the slug
 * is read on the server so we can redirect early and keep the component clean.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  if (!slug) redirect('/search');

  const locale = await resolveServerLocale();
  return <CheckoutFlow slug={slug} locale={locale} />;
}