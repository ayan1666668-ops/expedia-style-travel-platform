import type { Metadata } from 'next';
import { LoginForm } from '@/components/AuthForms';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <div className="container" style={{ paddingTop: 'var(--sp-7)', paddingBottom: 'var(--sp-7)' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 'var(--sp-2)' }}>Welcome back</h1>
        <p className="muted" style={{ marginBottom: 'var(--sp-5)' }}>
          Sign in to see your bookings, e-tickets and rewards.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}