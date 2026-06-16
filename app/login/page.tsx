'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/home');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-logo animate-bounce-in">🍹</div>
      <h1 className="auth-title">Drinkometro</h1>
      <p className="auth-subtitle">Traccia le tue bevute, condividi con gli amici</p>

      <form className="auth-form animate-fade-in-up" onSubmit={handleLogin}>
        <div className="glass-input-wrapper">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            className="glass-input"
            placeholder="la-tua@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="glass-input-wrapper">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            className="glass-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div style={{ color: 'var(--accent-danger)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-md)', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button type="submit" className="glass-btn glass-btn-primary glass-btn-full" disabled={loading}>
          {loading ? '⏳ Accesso...' : '🚀 Accedi'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
          <Link href="/reset-password" className="auth-link">
            Password dimenticata?
          </Link>
        </div>

        <div className="auth-divider">oppure</div>

        <div style={{ textAlign: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
            Non hai un account?{' '}
          </span>
          <Link href="/signup" className="auth-link">
            Registrati
          </Link>
        </div>
      </form>
    </div>
  );
}
