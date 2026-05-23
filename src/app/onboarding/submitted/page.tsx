"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from '../Onboarding.module.css';

export default function OnboardingSubmittedPage() {
  const router = useRouter();
  const [refNumber, setRefNumber] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/signup');
        return;
      }
      // Reference Number derived from user.id UUID prefix
      const shortId = user.id.slice(0, 8).toUpperCase();
      setRefNumber(`SNK-${shortId}`);
      setLoading(false);
    };

    fetchUser();
  }, [router]);

  if (loading) {
    return <div className={styles.loading}>Generating your reference number...</div>;
  }

  return (
    <div className={styles.container} style={{ textAlign: 'center', maxWidth: '550px' }}>
      <div 
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '1.5px solid var(--glass-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-2xl) var(--space-xl)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-md)'
        }}
      >
        {/* Animated Love Letter / Envelope */}
        <div style={{ fontSize: '4.5rem', filter: 'drop-shadow(0 4px 10px rgba(184, 134, 11, 0.15))' }}>
          💌
        </div>

        <h1 
          className="display-md" 
          style={{ 
            fontFamily: 'var(--font-playfair)', 
            fontWeight: 800,
            color: 'var(--on-background)',
            marginTop: 'var(--space-sm)'
          }}
        >
          Details Submitted!
        </h1>
        
        <p className="body-md" style={{ color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
          Thank you for joining Sinaki. We verify every single profile on our platform to ensure a safe, respectful, and genuine campus community.
        </p>

        {/* Reference Number Box */}
        <div 
          style={{
            background: 'var(--surface-variant)',
            border: '1px dashed var(--secondary)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md) var(--space-lg)',
            width: '100%',
            margin: 'var(--space-md) 0',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.01)'
          }}
        >
          <span className="label-md" style={{ color: 'var(--secondary)', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
            Your Reference Number
          </span>
          <div 
            style={{ 
              fontFamily: 'monospace', 
              fontSize: '1.75rem', 
              fontWeight: 700, 
              color: 'var(--primary)', 
              marginTop: '4px',
              letterSpacing: '0.05em'
            }}
          >
            {refNumber}
          </div>
          <span className="body-sm" style={{ color: 'var(--on-surface-variant)', fontSize: '0.75rem', display: 'block', marginTop: '6px', fontStyle: 'italic' }}>
            Please write down or screenshot this number to check your account status.
          </span>
        </div>

        <p className="body-md" style={{ color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>
          Our moderation team will manually review your document and photo within 24 hours. Go make some hot Lal Chai while you wait! ☕
        </p>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
          <button 
            onClick={() => router.push('/check-status')}
            className={styles.primaryBtn}
            style={{ width: '100%', cursor: 'pointer', transition: 'all 0.3s ease' }}
          >
            Check Account Status ⏳
          </button>
          
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/');
            }}
            className={styles.secondaryBtn}
            style={{ width: '100%', border: 'none', background: 'transparent', color: 'var(--primary)', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Log Out & Return Home
          </button>
        </div>
      </div>
    </div>
  );
}
