import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard';
import { Breadcrumbs, EmptyState } from '@/components/PageShell';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await api.collection(slug).catch(() => null);
  return { title: collection?.title ?? 'Collection', description: `Curated ${slug} picks.` };
}

export async function generateStaticParams() {
  return ['city-tours', 'skip-the-line', 'top-rated', 'family-friendly', 'food-and-drink'].map((slug) => ({ slug }));
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;

  const collection = await api.collection(slug).catch(() => null);
  if (!collection) notFound();

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-7)' }}>
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: collection.title }]} />

      <header style={{ marginBottom: 'var(--sp-5)' }}>
        <h1 style={{ marginBottom: 'var(--sp-2)' }}>{collection.title}</h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          {collection.total} hand-picked experiences, updated daily with availability and live pricing.
        </p>
      </header>

      {collection.items.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="This collection is still being curated. Try browsing everything instead."
          action={{ label: 'Browse all', href: '/search' }}
        />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {collection.items.map((hit) => (
            <ProductCard key={hit.productId} hit={hit} />
          ))}
          {!collection.items.length && <ProductCardSkeleton />}
        </div>
      )}

      <p className="tiny subtle" style={{ marginTop: 'var(--sp-5)' }}>
        Showing page {query.page ?? '1'} of results.
      </p>
    </div>
  );
}