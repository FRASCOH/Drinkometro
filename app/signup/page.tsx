'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Le password non coincidono');
      return;
    }

    if (password.length < 6) {
      setError('La password deve avere almeno 6 caratteri');
      return;
    }

    if (username.length < 3) {
      setError('Lo username deve avere almeno 3 caratteri');
      return;
    }

    setLoading(true);

    // Check username availability
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username.toLowerCase())
      .single();

    if (existingUser) {
      setError('Username già in uso');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.toLowerCase(),
          display_name: displayName || username,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-logo animate-bounce-in">🎉</div>
        <h1 className="auth-title">Registrazione completata!</h1>
        <p className="auth-subtitle">
          Controlla la tua email per confermare l&apos;account, poi accedi.
        </p>
        <Link href="/login" className="glass-btn glass-btn-primary">
          Vai al login
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-logo animate-bounce-in">🍹</div>
      <h1 className="auth-title">Registrati</h1>
      <p className="auth-subtitle">Unisciti alla community di Drinkometro</p>

      <form className="auth-form animate-fade-in-up" onSubmit={handleSignup}>
        <div className="glass-input-wrapper">
          <label htmlFor="signup-username">Username</label>
          <input
            id="signup-username"
            type="text"
            className="glass-input"
            placeholder="il_tuo_username"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
            required
            autoComplete="username"
          />
        </div>

        <div className="glass-input-wrapper">
          <label htmlFor="signup-display-name">Nome visualizzato</label>
          <input
            id="signup-display-name"
            type="text"
            className="glass-input"
            placeholder="Il tuo nome"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        </div>

        <div className="glass-input-wrapper">
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
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
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            className="glass-input"
            placeholder="Almeno 6 caratteri"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        <div className="glass-input-wrapper">
          <label htmlFor="signup-confirm-password">Conferma Password</label>
          <input
            id="signup-confirm-password"
            type="password"
            className="glass-input"
            placeholder="Ripeti la password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        {error && (
          <div style={{ color: 'var(--accent-danger)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-md)', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button type="submit" className="glass-btn glass-btn-primary glass-btn-full" disabled={loading}>
          {loading ? '⏳ Registrazione...' : '🚀 Registrati'}
        </button>

        <div className="auth-divider">oppure</div>

        <div style={{ textAlign: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
            Hai già un account?{' '}
          </span>
          <Link href="/login" className="auth-link">
            Accedi
          </Link>
        </div>
      </form>
    </div>
  );
}
