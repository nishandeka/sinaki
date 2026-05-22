"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from '../Onboarding.module.css';

export default function ReviewPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/onboarding/basics');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setProfile(data);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitLoading(true);

    try {
      // Mark profile as complete and active
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          is_profile_complete: true,
          is_active: true,
          profile_completion_pct: 100
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      router.push('/discover');
    } catch (err: any) {
      setError(err.message || 'Failed to complete profile registration.');
      setSubmitLoading(false);
    }
  };

  const getAge = (dobString: string) => {
    if (!dobString) return '';
    const dob = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) return <div className={styles.loading}>Loading summary...</div>;

  return (
    <div className={styles.container}>
      <h1 className="headline-lg" style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700 }}>Review &amp; Consent</h1>
      <p className="body-md">Final step! Review your details and agree to our guidelines.</p>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.form}>
        <div 
          className={styles.inputGroup} 
          style={{ 
            background: '#FFF8F0', 
            padding: 'var(--space-lg)', 
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--outline-variant)',
            boxShadow: '0 4px 12px rgba(184, 134, 11, 0.05)'
          }}
        >
          <div className={styles.labelRow}>
            <h3 className="label-md" style={{ fontFamily: 'var(--font-playfair)', color: 'var(--primary)', fontSize: '1.2rem' }}>Your Profile Card</h3>
            <button 
              className={styles.forgotPass} 
              onClick={() => router.push('/onboarding/basics')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Edit basics
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
            {profile?.photos && profile.photos[0] && (
              <img 
                src={profile.photos[0]} 
                alt="Main profile" 
                style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-md)', objectFit: 'cover', border: '2px solid var(--outline-variant)' }} 
              />
            )}
            <div>
              <p className="body-md" style={{ margin: '0', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--on-background)' }}>
                {profile?.display_name}, {getAge(profile?.date_of_birth)}
              </p>
              <p className="body-sm" style={{ margin: '2px 0 0 0', color: 'var(--on-surface-variant)' }}>
                📍 {profile?.city_town ? `${profile.city_town}, ` : ''}{profile?.district}
              </p>
              <p className="body-sm" style={{ margin: '2px 0 0 0', color: 'var(--on-surface-variant)', textTransform: 'capitalize' }}>
                👤 {profile?.gender === 'male' ? 'Boy' : 'Girl'} looking for {profile?.gender === 'male' ? 'Girl' : 'Boy'}
              </p>
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-sm)', borderTop: '1px dashed var(--outline-variant)' }}>
            <p className="label-sm" style={{ margin: '0', color: 'var(--outline)' }}>BIO / LOVE LETTER</p>
            <p className="body-md" style={{ margin: '4px 0 0 0', fontStyle: 'italic', color: 'var(--on-background)' }}>
              &quot;{profile?.bio || 'No bio yet'}&quot;
            </p>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup} style={{ gap: '12px' }}>
            <label className={styles.labelRow} style={{ alignItems: 'flex-start', gap: '10px' }}>
              <input type="checkbox" required style={{ marginTop: '4px', cursor: 'pointer' }} />
              <span className="body-md">I confirm that all information provided is accurate and authentic.</span>
            </label>
            <label className={styles.labelRow} style={{ alignItems: 'flex-start', gap: '10px' }}>
              <input type="checkbox" required style={{ marginTop: '4px', cursor: 'pointer' }} />
              <span className="body-md">I agree to Sinaki&apos;s Terms, Privacy Policy, and Community Guidelines.</span>
            </label>
            <label className={styles.labelRow} style={{ alignItems: 'flex-start', gap: '10px' }}>
              <input type="checkbox" required style={{ marginTop: '4px', cursor: 'pointer' }} />
              <span className="body-md">I understand Sinaki is exclusively for Boy–Girl matchmaking.</span>
            </label>
          </div>

          <button 
            type="submit" 
            className={styles.primaryBtn}
            style={{ transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            disabled={submitLoading}
          >
            {submitLoading ? 'Creating Profile...' : 'Create My Sinaki Profile 💌'}
          </button>
        </form>
      </div>
    </div>
  );
}
