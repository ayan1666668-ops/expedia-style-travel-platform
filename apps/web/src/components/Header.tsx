'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, readToken } from '@/lib/session';

const NAV = [
  { href: '/search', label: 'All experiences' },
  { href: '/collections/trending', label: 'Trending' },
  { href: '/collections/free-cancellation', label: 'Free cancellation' },
];

export function Header() {
  const pathname = usePathname();
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Read the session token after hydration. The header is a client component so
  // the shop can switch instantly between signed-in and signed-out states
  // without a full page load.
  useEffect(() => {
    const stored = readToken();
    if (!stored) return;
    setToken(stored);

    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((profile) => {
        if (profile) setName(profile.firstName);
      })
      .catch(() => undefined);
  }, []);

  function signOut() {
    clearSession();
    setToken(null);
    setName(null);
    window.location.href = '/';
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="logo" aria-label="Voyahub home">
          <span className="logo-mark" aria-hidden>
            V
          </span>
          <span>Voyahub</span>
        </Link>

        <nav className="nav" aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} style={{ color: isActive(item.href) ? 'var(--brand-700)' : undefined }}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          {token ? (
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-haspopup="menu"
              >
                <span
                  aria-hidden
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'var(--brand-600)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {(name ?? 'Y').charAt(0).toUpperCase()}
                </span>
                <span className="nowrap">{name ?? 'Account'}</span>
              </button>

              {open && (
                <div
                  role="menu"
                  className="card"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    minWidth: 200,
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 60,
                  }}
                >
                  <div className="stack-sm" style={{ padding: 'var(--sp-2)' }}>
                    {[
                      { href: '/orders', label: 'My orders' },
                      { href: '/tickets', label: 'My tickets' },
                      { href: '/loyalty', label: 'Rewards programme' },
                      { href: '/admin', label: 'Operator console' },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="small"
                        style={{ padding: '8px 10px', borderRadius: 'var(--r-sm)' }}
                        onClick={() => setOpen(false)}
                        role="menuitem"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <hr className="divider" style={{ margin: '4px 0' }} />
                    <button
                      className="small"
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        border: 'none',
                        background: 'none',
                        color: 'var(--critical-600)',
                        fontWeight: 600,
                      }}
                      onClick={signOut}
                      role="menuitem"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Join free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}