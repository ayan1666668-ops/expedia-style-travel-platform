import Link from 'next/link';

const LINKS = [
  {
    title: 'Explore',
    items: [
      { label: 'All experiences', href: '/search' },
      { label: 'Trending now', href: '/collections/trending' },
      { label: 'Skip the line', href: '/collections/skip-the-line' },
      { label: 'Free cancellation', href: '/collections/free-cancellation' },
      { label: 'Destinations', href: '/search' },
    ],
  },
  {
    title: 'Your trips',
    items: [
      { label: 'My orders', href: '/orders' },
      { label: 'My tickets', href: '/tickets' },
      { label: 'Wishlist', href: '/wishlist' },
      { label: 'Loyalty programme', href: '/loyalty' },
    ],
  },
  {
    title: 'Partners',
    items: [
      { label: 'Operator console', href: '/admin' },
      { label: 'Gate scanner', href: '/admin/scan' },
      { label: 'Finance ledger', href: '/admin/finance' },
      { label: 'Sign in', href: '/login' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="stack-sm">
            <div className="row" style={{ gap: 'var(--sp-2)' }}>
              <span className="logo-mark" aria-hidden>
                V
              </span>
              <span className="bold" style={{ fontSize: 17 }}>
                Voyahub
              </span>
            </div>
            <p style={{ maxWidth: 340 }}>
              Skip-the-line tickets, guided tours and day trips across Europe and North America. Book direct,
              pay securely and get your e-ticket instantly.
            </p>
            <p className="tiny subtle">
              Demo platform. Payments run against a built-in mock gateway — no real charges are made.
            </p>
          </div>

          {LINKS.map((group) => (
            <div key={group.title} className="stack-sm">
              <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {group.title}
              </h4>
              {group.items.map((item) => (
                <Link key={item.label} href={item.href} className="small">
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <hr className="divider" />

        <div className="row-between wrap small subtle">
          <span>© {new Date().getFullYear()} Voyahub. All rights reserved.</span>
          <div className="row wrap" style={{ gap: 'var(--sp-4)' }}>
            <span>Privacy</span>
            <span>Terms</span>
            <span>Cookie settings</span>
            <span>Prices include taxes &amp; fees</span>
          </div>
        </div>
      </div>
    </footer>
  );
}