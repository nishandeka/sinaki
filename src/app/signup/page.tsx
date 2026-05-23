"use client";

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from '../login/Login.module.css';

const ALLOWED_DOMAINS = ['gmail.com', 'flash.co'];

function isEmailAllowed(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Email domain check
    if (!isEmailAllowed(email)) {
      setError('Only @gmail.com and @flash.co email addresses are accepted.');
      return;
    }

    // Password match check
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please try again.');
      return;
    }

    // Password length check
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined,
      },
    });

    if (authError) {
      if (authError.message.toLowerCase().includes('already registered') ||
          authError.message.toLowerCase().includes('user already exists')) {
        setError('An account with this email already exists. Please sign in instead.');
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    // Auto sign-in or handle immediate session
    if (data.session) {
      router.replace('/onboarding/basics');
    } else {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInError && signInData.session) {
        router.replace('/onboarding/basics');
      } else {
        setError(signInError?.message || 'Account created, but automatic sign-in failed. Please try signing in.');
        setLoading(false);
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
          <h1 className="headline-lg" style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700 }}>Join Sinaki</h1>
          <p className="body-md">Find your someone, the warm Assamese way.</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form className={styles.form} onSubmit={handleSignUp}>
          <div className={styles.inputGroup}>
            <label htmlFor="signup-email" className="label-md">Email Address</label>
            <input
              id="signup-email"
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
            <label htmlFor="signup-password" className="label-md">Password</label>
            <input
              id="signup-password"
              type="password"
              className={styles.input}
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="signup-confirm" className="label-md">Confirm Password</label>
            <input
              id="signup-confirm"
              type="password"
              className={styles.input}
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <button
            id="signup-submit-btn"
            type="submit"
            className={styles.submitBtn}
            style={{ transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            disabled={loading}
          >
            {loading ? 'Creating Account…' : 'Create Account'}
          </button>
        </form>

        <div className={styles.footer}>
          <p className="body-md">
            Already have an account?{' '}
            <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
