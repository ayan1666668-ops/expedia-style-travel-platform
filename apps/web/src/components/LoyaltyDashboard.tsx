'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { readToken } from '@/lib/session';
import { formatMoney } from '@/lib/format';

type Program = Awaited<ReturnType<typeof api.loyaltyProgram>> | null;

const TIER_STYLES: Record<string, { gradient: string; label: string }> = {
  SILVER: { gradient: 'linear-gradient(135deg, #6b7280, #9ca3af)', label: 'Silver' },
  GOLD: { gradient: 'linear-gradient(135deg, #b45309, #f59e0b)', label: 'Gold' },
  PLATINUM: { gradient: 'linear-gradient(135deg, #4c1d95, #8b5cf6)', label: 'Platinum' },
  BLUE: { gradient: 'linear-gradient(135deg, #1e40af, #3b82f6)', label: 'Explorer' },
};

export function LoyaltyDashboard({ program }: { program: Program }) {
  const [account, setAccount] = useState<Awaited<ReturnType<typeof api.loyaltyAccount>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = readToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .loyaltyAccount(token)
      .then(setAccount)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const tierStyle = TIER_STYLES[account?.tier ?? 'BLUE'] ?? TIER_STYLES.BLUE;

  return (
    <div className="stack-lg">
      <header>
        <h1 style={{ marginBottom: 'var(--sp-2)' }}>Voyahub Rewards</h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          Every booking earns points, every point is worth money back. No expiry while you stay active.
        </p>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Account card (only when signed in)                                */}
      {/* ------------------------------------------------------------------ */}
      {loading ? (
        <div className="skeleton" style={{ height: 160 }} />
      ) : account ? (
        <section className="card card-pad" style={{ background: tierStyle.gradient, color: '#fff', border: 'none' }}>
          <div className="row-between wrap">
            <div>
              <div className="tiny" style={{ opacity: 0.85 }}>
                {tierStyle.label} member
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}>
                {account.points.toLocaleString()}
                <span className="tiny" style={{ marginLeft: 8, opacity: 0.85 }}>
                  pts
                </span>
              </div>
              <div className="small" style={{ opacity: 0.9 }}>
                Worth {formatMoney(account.balanceValueCents, 'USD')} in rewards
              </div>
            </div>

            {account.nextTier && (
              <div style={{ minWidth: 240 }}>
                <div className="tiny" style={{ opacity: 0.85, marginBottom: 6 }}>
                  {account.nextTier.pointsNeeded.toLocaleString()} pts to {account.nextTier.tier}
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: 'rgba(255,255,255,0.3)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.round(account.nextTier.progress * 100)}%`,
                      height: '100%',
                      background: '#fff',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="card card-pad row-between wrap">
          <div>
            <h3 style={{ marginBottom: 4 }}>Sign in to see your points</h3>
            <p className="small muted" style={{ margin: 0 }}>
              We&rsquo;ll tally your balance, tier and progress to the next one.
            </p>
          </div>
          <Link href="/login?next=/loyalty" className="btn btn-primary">
            Sign in
          </Link>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tiers                                                              */}
      {/* ------------------------------------------------------------------ */}
      {program && (
        <section className="stack">
          <h2 style={{ fontSize: 20 }}>Tiers &amp; perks</h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {program.tiers.map((tier) => (
              <article key={tier.tier} className="card card-pad stack-sm">
                <div className="row-between">
                  <h3 style={{ fontSize: 16, margin: 0 }}>{tier.tier}</h3>
                  <span className="badge badge-neutral">
                    {tier.threshold.toLocaleString()}+ pts
                  </span>
                </div>
                <ul className="stack-sm small" style={{ margin: 0, paddingLeft: 'var(--sp-4)' }}>
                  {tier.perks.map((perk) => (
                    <li key={perk} className="muted">
                      {perk}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="trust-bar">
            <div>
              <strong>Earn</strong> {program.earnRate}
            </div>
            <div>
              <strong>Redeem</strong> {program.redeemRate}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}