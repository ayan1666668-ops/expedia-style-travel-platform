'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { saveSession } from '@/lib/session';
import type { LocaleCode } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n/dictionaries';

/** Email is the identity; the label is resolved per locale. */
const DEMO_ACCOUNTS = [
  { email: 'traveler@easytrip.test', key: 'auth.demoTraveller' },
  { email: 'admin@easytrip.test', key: 'auth.demoAdmin' },
  { email: 'operator@easytrip.test', key: 'auth.demoOperator' },
  { email: 'merchant@easytrip.test', key: 'auth.demoMerchant' },
] as const;

function nextPath(raw: string | null): string {
  // Only allow same-origin relative paths so `?next=` can't become an open redirect.
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/orders';
  return raw;
}

export function LoginForm({ locale }: { locale: LocaleCode }) {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 320 }} />}>
      <LoginFormInner locale={locale} />
    </Suspense>
  );
}

function LoginFormInner({ locale }: { locale: LocaleCode }) {
  const t = createTranslator(locale);
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await api.login({ email: email.trim(), password });
      saveSession(result.token, result.user);
      router.push(nextPath(params.get('next')));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('auth.couldNotSignIn'));
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <form className="card card-pad stack" onSubmit={submit}>
        <label className="field">
          <span className="label">{t('auth.email')}</span>
          <input
            type="email"
            className="input"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label className="field">
          <span className="label">{t('auth.password')}</span>
          <input
            type="password"
            className="input"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? t('auth.signingIn') : t('common.signIn')}
        </button>

        <p className="small muted center" style={{ margin: 0 }}>
          {t('auth.noAccount')} <Link href="/register">{t('auth.createAccount')}</Link>
        </p>
      </form>

      <details className="card card-pad">
        <summary className="small bold" style={{ cursor: 'pointer' }}>
          {t('auth.demoAccounts')} ({t('auth.demoPassword')} <code className="mono">Password123!</code>)
        </summary>
        <div className="stack-sm" style={{ marginTop: 'var(--sp-3)' }}>
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className="demo-account"
              onClick={() => {
                setEmail(account.email);
                setPassword('Password123!');
              }}
            >
              <span className="mono small bold">{account.email}</span>
              <span className="tiny subtle">{t(account.key)}</span>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

export function RegisterForm({ locale }: { locale: LocaleCode }) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await api.register({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim() || 'Traveller',
        lastName: form.lastName.trim() || '',
      });
      saveSession(result.token, result.user);
      router.push('/orders');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('auth.couldNotRegister'));
      setBusy(false);
    }
  }

  return (
    <form className="card card-pad stack" onSubmit={submit}>
      <div className="row" style={{ gap: 'var(--sp-3)' }}>
        <label className="field grow">
          <span className="label">{t('auth.firstName')}</span>
          <input
            className="input"
            autoComplete="given-name"
            value={form.firstName}
            onChange={(event) => update('firstName', event.target.value)}
          />
        </label>
        <label className="field grow">
          <span className="label">{t('auth.lastName')}</span>
          <input
            className="input"
            autoComplete="family-name"
            value={form.lastName}
            onChange={(event) => update('lastName', event.target.value)}
          />
        </label>
      </div>

      <label className="field">
        <span className="label">{t('auth.email')}</span>
        <input
          type="email"
          className="input"
          required
          autoComplete="email"
          value={form.email}
          onChange={(event) => update('email', event.target.value)}
          placeholder="you@example.com"
        />
      </label>

      <label className="field">
        <span className="label">{t('auth.password')}</span>
        <input
          type="password"
          className="input"
          required
          minLength={8}
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => update('password', event.target.value)}
        />
        <span className="tiny subtle">{t('auth.passwordHint')}</span>
      </label>

      {error && <p className="form-error">{error}</p>}

      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? t('auth.creatingAccount') : t('auth.createAccount')}
      </button>

      <p className="small muted center" style={{ margin: 0 }}>
        {t('auth.haveAccount')} <Link href="/login">{t('common.signIn')}</Link>
      </p>
    </form>
  );
}