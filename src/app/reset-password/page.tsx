"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from '../login/Login.module.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // No active recovery session — redirect to login
        router.replace('/login');
      }
    };
    checkSession();
  }, [router]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    // Redirect to discover after a brief moment so they can see success state
    setTimeout(() => {
      router.replace('/discover');
    }, 2000);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo}>Sinaki</Link>
          <h1 className="headline-lg">Choose New Password</h1>
          <p className="body-md">Create a secure new password for your account.</p>
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
            Password updated successfully! Redirecting you to home...
          </div>
        )}

        <form className={styles.form} onSubmit={handleUpdatePassword}>
          <div className={styles.inputGroup}>
            <label htmlFor="password" className="label-md">New Password</label>
            <input
              id="password"
              type="password"
              className={styles.input}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={success || loading}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword" className="label-md">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              className={styles.input}
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              disabled={success || loading}
            />
          </div>

          <button
            id="reset-password-btn"
            type="submit"
            className={styles.submitBtn}
            disabled={loading || success}
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
