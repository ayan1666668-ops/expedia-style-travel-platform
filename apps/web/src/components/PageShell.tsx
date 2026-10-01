import Link from 'next/link';

/**
 * Marketing / SEO shell for pages that are mostly content rather than an
 * interactive booking flow. The header is rendered by the root layout.
 */
export function PageShell({
  children,
  maxWidth = 760,
}: {
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-7)' }}>
      <div style={{ maxWidth, margin: '0 auto' }}>{children}</div>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="small muted" style={{ marginBottom: 'var(--sp-3)' }}>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 && <span className="subtle" style={{ margin: '0 6px' }}>/</span>}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="empty-state">
      <div style={{ fontSize: 40 }} aria-hidden>
        🧭
      </div>
      <h3>{title}</h3>
      {description && <p className="muted" style={{ maxWidth: 420 }}>{description}</p>}
      {action && (
        <Link className="btn btn-primary" href={action.href}>
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function TrustBar({ items }: { items: string[] }) {
  return (
    <div className="trust-bar">
      {items.map((item) => (
        <span className="trust-chip" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}