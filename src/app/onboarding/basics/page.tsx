"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from '../Onboarding.module.css';

export default function BasicsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [underage, setUnderage] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    displayName: '',
    phone: '',
    dob: '',
    gender: '', // 'male' or 'female'
    religion: '',
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/signup');
        return;
      }
      setUserEmail(user.email || '');
      
      // Try to pre-fill from Google/signup metadata if present
      const googleName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      const initialReligion = user.user_metadata?.religion || '';
      
      setFormData(prev => ({
        ...prev,
        fullName: googleName || prev.fullName,
        displayName: googleName ? googleName.split(' ')[0] : prev.displayName,
        religion: initialReligion || prev.religion,
      }));
    };
    checkAuth();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));

    if (id === 'dob') {
      if (!value) {
        setUnderage(false);
        return;
      }
      const dobDate = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - dobDate.getFullYear();
      const m = today.getMonth() - dobDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
        age--;
      }
      setUnderage(age < 18);
    }
  };

  const handleGenderSelect = (gender: 'male' | 'female') => {
    setFormData(prev => ({ ...prev, gender }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (underage) return;
    if (!formData.gender) {
      setError('Please select your gender.');
      return;
    }
    if (!formData.religion) {
      setError('Please select your religion.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired. Please sign in again.');

      // Update auth metadata
      await supabase.auth.updateUser({
        data: { full_name: formData.fullName },
      });

      // Insert or update profile details
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: formData.fullName,
          display_name: formData.displayName,
          phone: formData.phone,
          gender: formData.gender,
          interested_in: formData.gender === 'male' ? 'female' : 'male',
          date_of_birth: formData.dob,
          district: 'Kamrup Metropolitan', // temporary placeholder, updated in verify step
          is_profile_complete: false,
          religion: formData.religion || 'prefer_not_to_say',
        }, { onConflict: 'id' });

      if (profileError) throw profileError;

      router.push('/onboarding/profile');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className="headline-lg" style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700 }}>Hello there</h1>
      <p className="body-md">
        Let’s start with the basics. {userEmail && <>Logged in as <strong>{userEmail}</strong></>}
      </p>

      {error && <div className={styles.error}>{error}</div>}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.grid}>
          <div className={styles.inputGroup}>
            <label htmlFor="fullName" className="label-md">Real / Legal Name</label>
            <input
              type="text"
              id="fullName"
              className={styles.input}
              placeholder="e.g. Priyom Hazarika"
              value={formData.fullName}
              onChange={handleChange}
              required
              minLength={2}
            />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="displayName" className="label-md">Nickname / Display Name</label>
            <input
              type="text"
              id="displayName"
              className={styles.input}
              placeholder="e.g. Priyom"
              value={formData.displayName}
              onChange={handleChange}
              required
              minLength={2}
            />
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.inputGroup}>
            <label htmlFor="phone" className="label-md">Phone Number</label>
            <input
              type="tel"
              id="phone"
              className={styles.input}
              placeholder="e.g. +91 98765 43210"
              value={formData.phone}
              onChange={handleChange}
              required
            />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="dob" className="label-md">Date of Birth</label>
            <input
              type="date"
              id="dob"
              className={styles.input}
              value={formData.dob}
              onChange={handleChange}
              required
            />
            {underage && (
              <div className={styles.underageWarning}>
                Sinaki is only for people 18 and above. Come back when you&apos;re ready.
              </div>
            )}
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.inputGroup}>
            <label htmlFor="religion" className="label-md">Religion</label>
            <select
              id="religion"
              className={styles.input}
              value={formData.religion}
              onChange={(e) => setFormData(prev => ({ ...prev, religion: e.target.value }))}
              required
              style={{ width: '100%' }}
            >
              <option value="">Select your religion</option>
              <option value="hindu">Hindu</option>
              <option value="muslim">Muslim</option>
              <option value="christian">Christian</option>
              <option value="buddhist">Buddhist</option>
              <option value="sikh">Sikh</option>
              <option value="jain">Jain</option>
              <option value="tribal_religion">Tribal Religion</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className={styles.inputGroup} />
        </div>

        <div className={styles.inputGroup}>
          <label className="label-md">Gender</label>
          <div className={styles.genderCardGrid}>
            <div
              className={`${styles.genderCard} ${formData.gender === 'male' ? styles.genderCardActive : ''}`}
              onClick={() => handleGenderSelect('male')}
            >
              <svg className={styles.genderCardIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className={styles.genderCardTitle}>Boy</span>
            </div>
            <div
              className={`${styles.genderCard} ${formData.gender === 'female' ? styles.genderCardActive : ''}`}
              onClick={() => handleGenderSelect('female')}
            >
              <svg className={styles.genderCardIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className={styles.genderCardTitle}>Girl</span>
            </div>
          </div>
          <span className={styles.helperText} style={{ fontFamily: 'var(--font-handwritten)', fontSize: '0.95rem', color: 'var(--secondary)' }}>
            * Sinaki supports heterosexual matching.
          </span>
        </div>

        <button
          type="submit"
          className={styles.primaryBtn}
          style={{ transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          disabled={loading || underage || !formData.gender}
        >
          {loading ? 'Saving...' : 'Next: Romantic Profile'}
        </button>
      </form>
    </div>
  );
}
