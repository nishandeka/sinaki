"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      // Exchange the code in the URL for a session
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        // If something went wrong, send back to login
        router.replace('/login');
        return;
      }

      const user = session.user;

      // Check if this user already has a profile (returning user)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        // Existing user — go to the app
        router.replace('/discover');
      } else {
        // New user — start onboarding
        router.replace('/onboarding/basics');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top right, var(--secondary) 0%, transparent 50%), radial-gradient(circle at bottom left, #fff0f0 0%, transparent 50%)',
      gap: '1rem',
    }}>
      <div style={{
        width: 48,
        height: 48,
        border: '4px solid var(--outline-variant)',
        borderTopColor: 'var(--primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p className="body-md" style={{ color: 'var(--on-surface-variant)' }}>
        Signing you in…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
