'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-logo animate-bounce-in">📧</div>
        <h1 className="auth-title">Email inviata!</h1>
        <p className="auth-subtitle">
          Controlla la tua casella di posta per il link di reset.
        </p>
        <Link href="/login" className="glass-btn glass-btn-primary" style={{ marginTop: 'var(--space-lg)' }}>
          Torna al login
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-logo animate-bounce-in">🔐</div>
      <h1 className="auth-title">Reset Password</h1>
      <p className="auth-subtitle">
        Inserisci la tua email per ricevere il link di reset
      </p>

      <form className="auth-form animate-fade-in-up" onSubmit={handleReset}>
        <div className="glass-input-wrapper">
          <label htmlFor="reset-email">Email</label>
          <input
            id="reset-email"
            type="email"
            className="glass-input"
            placeholder="la-tua@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        {error && (
          <div style={{ color: 'var(--accent-danger)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-md)', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button type="submit" className="glass-btn glass-btn-primary glass-btn-full" disabled={loading}>
          {loading ? '⏳ Invio...' : '📧 Invia link di reset'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
          <Link href="/login" className="auth-link">
            ← Torna al login
          </Link>
        </div>
      </form>
    </div>
  );
}
