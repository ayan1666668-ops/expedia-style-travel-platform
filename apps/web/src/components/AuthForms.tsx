'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { saveSession } from '@/lib/session';

const DEMO_ACCOUNTS = [
  { email: 'traveler@voyahub.test', label: 'Traveler — bookings, tickets, points' },
  { email: 'admin@voyahub.test', label: 'Admin — dashboard, ledger, staff' },
  { email: 'operator@voyahub.test', label: 'Gate operator — ticket scanning' },
  { email: 'merchant@voyahub.test', label: 'Merchant — own products & payouts' },
];

function nextPath(raw: string | null): string {
  // Only allow same-origin relative paths so `?next=` can't become an open redirect.
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/orders';
  return raw;
}

export function LoginForm() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 320 }} />}>
      <LoginFormInner />
    </Suspense>
  );
}

function LoginFormInner() {
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
      setError(caught instanceof ApiError ? caught.message : 'Could not sign in. Check your connection.');
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <form className="card card-pad stack" onSubmit={submit}>
        <label className="field">
          <span className="label">Email</span>
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
          <span className="label">Password</span>
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
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="small muted center" style={{ margin: 0 }}>
          New to Voyahub? <Link href="/register">Create an account</Link>
        </p>
      </form>

      <details className="card card-pad">
        <summary className="small bold" style={{ cursor: 'pointer' }}>
          Demo accounts (password <code className="mono">Password123!</code>)
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
              <span className="tiny subtle">{account.label}</span>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

export function RegisterForm() {
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
      setError(caught instanceof ApiError ? caught.message : 'Could not create your account.');
      setBusy(false);
    }
  }

  return (
    <form className="card card-pad stack" onSubmit={submit}>
      <div className="row" style={{ gap: 'var(--sp-3)' }}>
        <label className="field grow">
          <span className="label">First name</span>
          <input
            className="input"
            autoComplete="given-name"
            value={form.firstName}
            onChange={(event) => update('firstName', event.target.value)}
          />
        </label>
        <label className="field grow">
          <span className="label">Last name</span>
          <input
            className="input"
            autoComplete="family-name"
            value={form.lastName}
            onChange={(event) => update('lastName', event.target.value)}
          />
        </label>
      </div>

      <label className="field">
        <span className="label">Email</span>
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
        <span className="label">Password</span>
        <input
          type="password"
          className="input"
          required
          minLength={8}
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => update('password', event.target.value)}
        />
        <span className="tiny subtle">At least 8 characters.</span>
      </label>

      {error && <p className="form-error">{error}</p>}

      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? 'Creating account…' : 'Create account'}
      </button>

      <p className="small muted center" style={{ margin: 0 }}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}