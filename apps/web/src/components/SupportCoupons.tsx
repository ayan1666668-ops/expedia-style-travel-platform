'use client';

import { useState } from 'react';
import { api, ApiError, type CouponVerification } from '@/lib/api';
import { readToken } from '@/lib/session';
import type { LocaleCode } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

/**
 * Coupon verification.
 *
 * Deliberately read-only. Support agents check codes on the phone; creating or
 * editing coupons changes revenue, so that stays in the admin console.
 */
export function SupportCoupons({ locale }: { locale: LocaleCode }) {
  const t = createTranslator(locale);

  const [token, setToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [result, setResult] = useState<CouponVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !code.trim()) return;

    setLoading(true);
    setError(null);
    try {
      setResult(await api.verifyCoupon(code.trim(), token));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('common_errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  if (!token) return <p className="muted">{t('common_errors.sessionExpired')}</p>;

  return (
    <div className="stack-lg">
      <section className="card card-pad">
        <h2 style={{ fontSize: 16, marginBottom: 'var(--sp-3)' }}>{t('support.verifyCoupon')}</h2>

        <form onSubmit={verify} className="row wrap" style={{ gap: 'var(--sp-3)' }}>
          <label className="field grow" style={{ minWidth: 200 }}>
            <span className="label">{t('support.couponCode')}</span>
            <input
              className="input mono"
              placeholder="WELCOME10"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setResult(null);
              }}
            />
          </label>

          <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} disabled={loading}>
            {loading ? t('common.loading') : t('common.search')}
          </button>
        </form>

        {error && <p className="form-error">{error}</p>}
      </section>

      {result && (
        <section
          className="card card-pad stack"
          style={{
            borderColor: result.valid ? 'var(--success-600)' : 'var(--critical-600)',
          }}
        >
          <div className="row" style={{ gap: 'var(--sp-3)' }}>
            <span style={{ fontSize: 26 }} aria-hidden>
              {result.valid ? '✓' : '✕'}
            </span>
            <div>
              <h3 style={{ margin: 0 }}>{result.code ?? code}</h3>
              <p className="small muted" style={{ margin: 0 }}>
                {result.reason}
              </p>
            </div>
            <span
              className={`badge badge-${result.valid ? 'positive' : 'critical'}`}
              style={{ marginLeft: 'auto' }}
            >
              {result.valid ? t('support.valid') : t('support.invalid')}
            </span>
          </div>

          {result.discountType && (
            <div className="grid grid-2">
              <Line label={t('promo.title')} value={String(result.discountType)} />
              <Line label="Value" value={String(result.discountValue)} />
              <Line
                label="Min order"
                value={
                  result.minOrderCents
                    ? (result.minOrderCents / 100).toFixed(2)
                    : t('common.none')
                }
              />
              <Line
                label={t('promo.clicks')}
                value={`${result.usageCount ?? 0}${result.usageLimit ? ` / ${result.usageLimit}` : ''}`}
              />
              <Line
                label={t('promo.startsAt')}
                value={result.startsAt ? new Date(result.startsAt).toLocaleDateString() : t('common.none')}
              />
              <Line
                label={t('promo.endsAt')}
                value={result.endsAt ? new Date(result.endsAt).toLocaleDateString() : t('common.none')}
              />
            </div>
          )}

          {result.description && <p className="small muted">{result.description}</p>}
        </section>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="row-between small" style={{ paddingBottom: 4 }}>
      <span className="subtle">{label}</span>
      <span className="bold">{value}</span>
    </div>
  );
}