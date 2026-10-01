'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { readToken } from '@/lib/session';
import { formatMoney } from '@/lib/format';
import type { LocaleCode } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

type Program = Awaited<ReturnType<typeof api.loyaltyProgram>> | null;

/**
 * Keyed by the API's `LoyaltyTier` enum. `MEMBER` is the entry tier; the other
 * names are the ones customers see.
 */
const TIER_STYLES: Record<string, { gradient: string; labelKey: string }> = {
  MEMBER: { gradient: 'linear-gradient(135deg, #1e40af, #3b82f6)', labelKey: 'loyalty.tierExplorer' },
  SILVER: { gradient: 'linear-gradient(135deg, #6b7280, #9ca3af)', labelKey: 'loyalty.tierSilver' },
  GOLD: { gradient: 'linear-gradient(135deg, #b45309, #f59e0b)', labelKey: 'loyalty.tierGold' },
  PLATINUM: { gradient: 'linear-gradient(135deg, #4c1d95, #8b5cf6)', labelKey: 'loyalty.tierPlatinum' },
};

export function LoyaltyDashboard({ program, locale }: { program: Program; locale: LocaleCode }) {
  const t = createTranslator(locale);
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

  const tierStyle = TIER_STYLES[account?.tier ?? 'MEMBER'] ?? TIER_STYLES.MEMBER;

  return (
    <div className="stack-lg">
      <header>
        <h1 style={{ marginBottom: 'var(--sp-2)' }}>{t('loyalty.title')}</h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          {t('loyalty.dashboardSubtitle')}
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
                {t(tierStyle.labelKey)} {t('loyalty.member')}
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}>
                {account.points.toLocaleString()}
                <span className="tiny" style={{ marginLeft: 8, opacity: 0.85 }}>
                  {t('loyalty.points')}
                </span>
              </div>
              <div className="small" style={{ opacity: 0.9 }}>
                {t('loyalty.worth', formatMoney(account.balanceValueCents, 'USD'))}
              </div>
            </div>

            {account.nextTier && (
              <div className="tier-progress">
                <div className="tiny" style={{ opacity: 0.85, marginBottom: 6 }}>
                  {t(
                    'loyalty.toTier',
                    account.nextTier.pointsNeeded.toLocaleString(),
                    t(TIER_STYLES[account.nextTier.tier]?.labelKey ?? 'loyalty.tierPlatinum'),
                  )}
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
            <h3 style={{ marginBottom: 4 }}>{t('loyalty.signInToSee')}</h3>
            <p className="small muted" style={{ margin: 0 }}>
              {t('loyalty.signInHint')}
            </p>
          </div>
          <Link href="/login?next=/loyalty" className="btn btn-primary">
            {t('common.signIn')}
          </Link>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tiers                                                              */}
      {/* ------------------------------------------------------------------ */}
      {program && (
        <section className="stack">
          <h2 style={{ fontSize: 20 }}>{t('loyalty.tiersAndPerks')}</h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {program.tiers.map((tier) => (
              <article key={tier.tier} className="card card-pad stack-sm">
                <div className="row-between">
                  <h3 style={{ fontSize: 16, margin: 0 }}>
                    {t(TIER_STYLES[tier.tier]?.labelKey ?? 'loyalty.tierExplorer')}
                  </h3>
                  <span className="badge badge-neutral">
                    {t('loyalty.pointsThreshold', tier.threshold.toLocaleString())}
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
              <strong>{t('loyalty.earn')}</strong> {program.earnRate}
            </div>
            <div>
              <strong>{t('loyalty.redeem')}</strong> {program.redeemRate}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}