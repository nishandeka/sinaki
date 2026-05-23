"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import styles from './CheckStatus.module.css';

export default function CheckStatusPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchRef, setSearchRef] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setRefreshing(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      if (currentUser) {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('full_name, display_name, verification_status, rejection_reason, is_active')
          .eq('id', currentUser.id)
          .single();

        if (error) throw error;
        setProfile(profileData);
      }
    } catch (err) {
      console.error("Error loading account status:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    setSearchResult(null);

    const cleanRef = searchRef.replace(/^SNK-/i, '').toLowerCase().replace(/-/g, '').trim();
    if (cleanRef.length < 8) {
      setSearchError("Reference number must be at least 8 characters.");
      return;
    }

    if (!user) {
      setSearchError("For privacy and security, you must be logged in to search account status.");
      return;
    }

    setRefreshing(true);
    try {
      // Query profiles. Since RLS allows selecting profiles, let's search
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, display_name, verification_status, rejection_reason')
        .filter('id', 'like', `${cleanRef}%`);

      if (error) throw error;

      if (!data || data.length === 0) {
        setSearchError("No account found with this Reference Number.");
      } else {
        setSearchResult(data[0]);
      }
    } catch (err: any) {
      setSearchError(err.message || "Failed to lookup reference number.");
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'verified': return { text: 'Verified Identity', class: styles.badgeVerified };
      case 'rejected': return { text: 'Application Rejected', class: styles.badgeRejected };
      case 'under_review': return { text: 'Under Review', class: styles.badgeReview };
      case 'pending':
      default:
        return { text: 'Pending Verification', class: styles.badgePending };
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic', color: 'var(--primary)' }}>
          Retrieving your verification docket...
        </p>
      </div>
    );
  }

  // Reference number for logged in user
  const loggedInRef = user ? `SNK-${user.id.slice(0, 8).toUpperCase()}` : '';

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logoLink}>
            <img src="/logo.png" alt="Sinaki Logo" className={styles.logoImage} />
          </Link>
          <h1 className="headline-lg" style={{ fontFamily: 'var(--font-playfair)', fontWeight: 800 }}>
            Account Status Tracker
          </h1>
          <p className="body-md">Verify and track your application to enter Sinaki.</p>
        </div>

        {user && profile ? (
          /* Logged In Mode: Auto display status */
          <div className={styles.statusSection}>
            <div className={styles.statusCard}>
              <span className="label-md" style={{ color: 'var(--secondary)', letterSpacing: '0.05em' }}>
                Your Reference Number
              </span>
              <div className={styles.refCode}>{loggedInRef}</div>
              <div className={styles.nameLabel}>👤 {profile.full_name || profile.display_name}</div>
              
              <div style={{ marginTop: 'var(--space-md)' }}>
                <span className={`${styles.statusBadge} ${getStatusLabel(profile.verification_status).class}`}>
                  {getStatusLabel(profile.verification_status).text.toUpperCase()}
                </span>
              </div>

              <div className={styles.statusDescription}>
                {profile.verification_status === 'verified' && (
                  <p>
                    <strong>Bhal Khobor! 🎉</strong> Your account has been reviewed and verified. You have full access to find your campus match.
                  </p>
                )}
                {(profile.verification_status === 'pending' || profile.verification_status === 'under_review') && (
                  <p>
                    Our moderators are manually reviewing your uploaded ID card and selfie. This is done to prevent fake profiles. Reviews usually complete in less than 24 hours.
                  </p>
                )}
                {profile.verification_status === 'rejected' && (
                  <div style={{ textAlign: 'left', marginTop: 'var(--space-sm)' }}>
                    <p style={{ color: '#C0392B', fontWeight: 600 }}>
                      Unfortunately, your document upload was rejected.
                    </p>
                    {profile.rejection_reason && (
                      <blockquote className={styles.rejectionReason}>
                        "{profile.rejection_reason}"
                      </blockquote>
                    )}
                    <p style={{ fontSize: '0.85rem', marginTop: 'var(--space-sm)' }}>
                      Please tap the button below to upload a clearer photo of your government ID and selfie.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.actions}>
              {profile.verification_status === 'verified' ? (
                <button
                  onClick={() => router.push('/discover')}
                  className={styles.submitBtn}
                  style={{ width: '100%' }}
                >
                  Enter Discover Dashboard 💌
                </button>
              ) : profile.verification_status === 'rejected' ? (
                <button
                  onClick={() => router.push('/onboarding/verify')}
                  className={styles.submitBtn}
                  style={{ width: '100%', background: 'var(--secondary)' }}
                >
                  Resubmit Verification ID 📤
                </button>
              ) : (
                <button
                  onClick={fetchStatus}
                  className={styles.refreshBtn}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing Status..." : "Refresh Status 🔄"}
                </button>
              )}

              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setUser(null);
                  setProfile(null);
                  router.push('/');
                }}
                className={styles.logoutLink}
              >
                Log Out Account
              </button>
            </div>
          </div>
        ) : (
          /* Guest Mode: Prompt to log in to search status */
          <div className={styles.guestSection}>
            <div 
              style={{
                background: 'rgba(184, 134, 11, 0.03)',
                border: '1px dashed var(--outline)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-lg)',
                marginBottom: 'var(--space-lg)',
                textAlign: 'left'
              }}
            >
              <h3 className="label-md" style={{ color: 'var(--secondary)', marginBottom: '4px' }}>
                Secure Access Required
              </h3>
              <p className="body-sm" style={{ color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
                To protect our community's privacy, you must sign in to view your verification status. This prevents unauthorized users from searching other students' accounts.
              </p>
            </div>

            <button
              onClick={() => router.push('/login')}
              className={styles.submitBtn}
              style={{ width: '100%', marginBottom: 'var(--space-md)' }}
            >
              Sign In with Email & Password
            </button>

            <Link href="/" className={styles.backHomeLink}>
              ← Go back to Home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
