"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './Login.module.css';

const LOCKOUT_KEY = 'sinaki_admin_lockout_time';
const ATTEMPTS_KEY = 'sinaki_admin_login_attempts';
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState('');

  // Check lockout on mount & redirect if already authenticated admin
  useEffect(() => {
    checkLockoutStatus();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('admins')
          .select('id, is_active')
          .eq('id', user.id)
          .eq('is_active', true)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              router.replace('/admin/dashboard');
            }
          });
      }
    });
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (!locked) return;

    const interval = setInterval(() => {
      const isStillLocked = checkLockoutStatus();
      if (!isStillLocked) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [locked]);

  const checkLockoutStatus = (): boolean => {
    const lockoutTimeStr = localStorage.getItem(LOCKOUT_KEY);
    if (!lockoutTimeStr) {
      setLocked(false);
      return false;
    }

    const lockoutTime = parseInt(lockoutTimeStr, 10);
    const now = Date.now();
    const diff = lockoutTime + LOCKOUT_DURATION_MS - now;

    if (diff <= 0) {
      localStorage.removeItem(LOCKOUT_KEY);
      localStorage.removeItem(ATTEMPTS_KEY);
      setLocked(false);
      setError(null);
      return false;
    }

    setLocked(true);
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    setLockoutRemaining(`${minutes}m ${seconds}s`);
    setError(`Too many attempts. Account locked for 30 minutes for security.`);
    return true;
  };

  const handleFailedAttempt = () => {
    const attemptsStr = localStorage.getItem(ATTEMPTS_KEY) || '0';
    const attempts = parseInt(attemptsStr, 10) + 1;
    localStorage.setItem(ATTEMPTS_KEY, attempts.toString());

    if (attempts >= 5) {
      localStorage.setItem(LOCKOUT_KEY, Date.now().toString());
      setLocked(true);
      checkLockoutStatus();
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (locked) {
      checkLockoutStatus();
      return;
    }

    setLoading(true);

    try {
      // 1. Authenticate with Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        handleFailedAttempt();
        setError(
          authError.message === 'Invalid login credentials'
            ? 'Incorrect email or password. Please try again.'
            : authError.message
        );
        setLoading(false);
        return;
      }

      const user = data.user;
      if (!user) {
        setLoading(false);
        return;
      }

      // 2. Validate the user is an active admin
      const { data: adminRecord, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .eq('id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (adminError || !adminRecord) {
        await supabase.auth.signOut();
        setError('Access denied. You do not have administrator permissions.');
        setLoading(false);
        return;
      }

      // 3. Clear failed attempts
      localStorage.removeItem(ATTEMPTS_KEY);
      localStorage.removeItem(LOCKOUT_KEY);

      // 4. Write audit log entry
      try {
        let ipAddress = 'unknown';
        try {
          const ipRes = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipRes.json();
          ipAddress = ipData.ip;
        } catch (_) {}

        await supabase.from('audit_logs').insert({
          admin_id: user.id,
          admin_email: adminRecord.email,
          admin_role: adminRecord.role,
          action_type: 'ADMIN_LOGIN_SUCCESS',
          details: 'Admin signed in successfully with email and password.',
          ip_address: ipAddress,
        });
      } catch (_) {
        // Non-critical — don't block login if audit log fails
      }

      // 5. Redirect to dashboard
      router.replace('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* Subtle Gamosa Background Pattern overlay */}
      <div className={styles.gamosaBg}></div>

      <div className={styles.card}>
        <div className={styles.header}>
          <img src="/logo.png" alt="Sinaki Logo" className={styles.logoImage} />
          <h1 className={styles.title}>Sinaki Admin</h1>
          <p className={styles.subtitle}>Sign in to access your administrative tools.</p>
        </div>

        {error && (
          <div className={`${styles.alert} ${locked ? styles.alertDanger : styles.alertWarning}`}>
            {locked ? '🔒 ' : '⚠️ '}{error}
            {locked && <div className={styles.countdownTimer}>Unlocks in: {lockoutRemaining}</div>}
          </div>
        )}

        <form className={styles.form} onSubmit={handleLoginSubmit}>
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>Email Address</label>
            <input
              id="email"
              type="email"
              className={styles.input}
              placeholder="admin@sinaki.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || locked}
              autoComplete="email"
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <input
              id="password"
              type="password"
              className={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading || locked}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading || locked}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
