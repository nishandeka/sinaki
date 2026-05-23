"use client";

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './Login.module.css';

const ALLOWED_DOMAINS = ['gmail.com', 'flash.co'];

function isEmailAllowed(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEmailAllowed(email)) {
      setError('Only @gmail.com and @flash.co email addresses are accepted.');
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'Incorrect email or password. Please try again.'
        : authError.message);
      setLoading(false);
      return;
    }

    // Check if profile exists and check verification status
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, verification_status')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        if (profile.verification_status === 'verified') {
          router.replace('/discover');
        } else {
          router.replace('/check-status');
        }
      } else {
        router.replace('/onboarding/basics');
      }
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logoLink}>
            <img src="/logo.png" alt="Sinaki Logo" className={styles.logoImage} />
          </Link>
          <h1 className="headline-lg">Welcome Back</h1>
          <p className="body-md">Sign in to find your campus match.</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form className={styles.form} onSubmit={handleLogin}>
          <div className={styles.inputGroup}>
            <label htmlFor="email" className="label-md">Email Address</label>
            <input
              id="email"
              type="email"
              className={styles.input}
              placeholder="you@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <span className={styles.hint}>Only @gmail.com and @flash.co accepted</span>
          </div>

          <div className={styles.inputGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="password" className="label-md">Password</label>
              <Link href="/forgot-password" className={styles.forgotPass}>Forgot password?</Link>
            </div>
            <input
              id="password"
              type="password"
              className={styles.input}
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              minLength={8}
            />
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className={styles.footer}>
          <p className="body-md">
            New to Sinaki?{' '}
            <Link href="/signup">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
