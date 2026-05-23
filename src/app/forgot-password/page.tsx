"use client";

import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from '../login/Login.module.css';

const ALLOWED_DOMAINS = ['gmail.com', 'flash.co'];

function isEmailAllowed(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!isEmailAllowed(email)) {
      setError('Only @gmail.com and @flash.co email addresses are accepted.');
      return;
    }

    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logoLink}>
            <img src="/logo.png" alt="Sinaki Logo" className={styles.logoImage} />
          </Link>
          <h1 className="headline-lg">Reset Password</h1>
          <p className="body-md">Enter your email to receive a recovery link.</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {success && (
          <div style={{
            background: '#e8f5e9',
            border: '1px solid #2e7d32',
            color: '#2e7d32',
            padding: 'var(--space-md)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontWeight: 500,
            textAlign: 'center',
            marginBottom: 'var(--space-md)'
          }}>
            Check your email! We have sent a password reset link.
          </div>
        )}

        {!success ? (
          <form className={styles.form} onSubmit={handleReset}>
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

            <button
              id="reset-submit-btn"
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? 'Sending link…' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
            <Link href="/login" className={styles.forgotPass} style={{ fontSize: '0.875rem' }}>
              Return to Login
            </Link>
          </div>
        )}

        <div className={styles.footer}>
          <p className="body-md">
            Remember your password?{' '}
            <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
