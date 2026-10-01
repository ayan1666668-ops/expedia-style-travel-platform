import type { Metadata } from 'next';
import { RegisterForm } from '@/components/AuthForms';

export const metadata: Metadata = {
  title: 'Create an account',
  robots: { index: false },
};

export default function RegisterPage() {
  return (
    <div className="container" style={{ paddingTop: 'var(--sp-7)', paddingBottom: 'var(--sp-7)' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 'var(--sp-2)' }}>Create your account</h1>
        <p className="muted" style={{ marginBottom: 'var(--sp-5)' }}>
          Join free and start earning a point for every dollar you spend.
        </p>
        <RegisterForm />
      </div>
    </div>
  );
}