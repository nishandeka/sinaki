"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from '../Onboarding.module.css';

const COMMUNITIES = [
  { value: 'assamese', label: 'Assamese' },
  { value: 'bodo', label: 'Bodo' },
  { value: 'mising', label: 'Mising' },
  { value: 'karbi', label: 'Karbi' },
  { value: 'dimasa', label: 'Dimasa' },
  { value: 'rabha', label: 'Rabha' },
  { value: 'tiwa', label: 'Tiwa' },
  { value: 'deori', label: 'Deori' },
  { value: 'sonowal_kachari', label: 'Sonowal Kachari' },
  { value: 'tai_ahom', label: 'Tai Ahom' },
  { value: 'koch_rajbongshi', label: 'Koch Rajbongshi' },
  { value: 'bengali', label: 'Bengali' },
  { value: 'nepali', label: 'Nepali' },
  { value: 'tea_tribe', label: 'Tea Tribe' },
  { value: 'marwari', label: 'Marwari' },
  { value: 'bihari', label: 'Bihari' }
];

const POPULAR_DISTRICTS = [
  'Kamrup Metropolitan', 'Kamrup', 'Jorhat', 'Dibrugarh', 'Sivasagar', 
  'Golaghat', 'Nagaon', 'Sonitpur', 'Tinsukia', 'Cachar'
];

export default function PreferencesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Form State
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(35);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [interestedIn, setInterestedIn] = useState<'male' | 'female'>('female');

  useEffect(() => {
    const fetchProfileData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/onboarding/basics');
        return;
      }
      setUserId(user.id);

      // Fetch user's own district and gender to set defaults
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('district, gender, interested_in, preferred_age_min, preferred_age_max, preferred_districts, preferred_communities')
        .eq('id', user.id)
        .single();

      if (data) {
        // Set interested_in (locked based on gender)
        const targetInterest = data.gender === 'male' ? 'female' : 'male';
        setInterestedIn(targetInterest);

        // Pre-fill district preference with their own district if empty
        if (data.preferred_districts && data.preferred_districts.length > 0) {
          setSelectedDistricts(data.preferred_districts);
        } else if (data.district) {
          setSelectedDistricts([data.district]);
        }

        // Pre-fill age preferences
        if (data.preferred_age_min) setAgeMin(data.preferred_age_min);
        if (data.preferred_age_max) setAgeMax(data.preferred_age_max);

        // Pre-fill community preferences
        if (data.preferred_communities && data.preferred_communities.length > 0) {
          setSelectedCommunities(data.preferred_communities);
        }
      }
    };
    fetchProfileData();
  }, [router]);

  const toggleDistrict = (dist: string) => {
    setSelectedDistricts(prev => 
      prev.includes(dist) ? prev.filter(d => d !== dist) : [...prev, dist]
    );
  };

  const toggleCommunity = (comm: string) => {
    setSelectedCommunities(prev => 
      prev.includes(comm) ? prev.filter(c => c !== comm) : [...prev, comm]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          preferred_age_min: ageMin,
          preferred_age_max: ageMax,
          preferred_districts: selectedDistricts.length > 0 ? selectedDistricts : null,
          preferred_communities: selectedCommunities.length > 0 ? selectedCommunities : null,
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      router.push('/onboarding/review');
    } catch (err: any) {
      setError(err.message || 'Failed to save preferences.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className="headline-lg" style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700 }}>Who are you looking for?</h1>
      <p className="body-md">Tell us who you&apos;d love to meet. We will use this to find your matches.</p>

      {error && <div className={styles.error}>{error}</div>}

      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Gender - Locked */}
        <div className={styles.inputGroup}>
          <label className="label-md">Interested in</label>
          <div className={styles.input} style={{ background: '#FFF3E4', color: 'var(--primary)', fontWeight: 700, border: '1px solid var(--outline-variant)' }}>
            {interestedIn === 'female' ? 'Girls' : 'Boys'} (Locked)
          </div>
          <p className={styles.helperText} style={{ fontFamily: 'var(--font-handwritten)', fontSize: '0.95rem', color: 'var(--secondary)' }}>
            * Sinaki supports heterosexual matching.
          </p>
        </div>

        {/* Age Range */}
        <div className={styles.inputGroup}>
          <label className="label-md">Preferred Age Range ({ageMin} – {ageMax})</label>
          <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <span className="body-sm" style={{ color: 'var(--outline)' }}>Min Age</span>
              <input
                type="number"
                min="18"
                max="70"
                value={ageMin}
                onChange={(e) => setAgeMin(parseInt(e.target.value) || 18)}
                className={styles.input}
                style={{ width: '100%' }}
              />
            </div>
            <span style={{ fontSize: '1.25rem', marginTop: '16px' }}>to</span>
            <div style={{ flex: 1 }}>
              <span className="body-sm" style={{ color: 'var(--outline)' }}>Max Age</span>
              <input
                type="number"
                min="18"
                max="70"
                value={ageMax}
                onChange={(e) => setAgeMax(parseInt(e.target.value) || 35)}
                className={styles.input}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* District Preference */}
        <div className={styles.inputGroup}>
          <label className="label-md">Preferred Districts</label>
          <p className="body-sm" style={{ marginTop: '-4px' }}>Select districts you are willing to match in (leave empty for all of Assam)</p>
          <div className={styles.chipGrid} style={{ marginTop: 'var(--space-xs)' }}>
            {POPULAR_DISTRICTS.map(d => (
              <div 
                key={d} 
                className={`${styles.chip} ${selectedDistricts.includes(d) ? styles.chipActive : ''}`}
                onClick={() => toggleDistrict(d)}
                style={{ transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              >
                {d}
              </div>
            ))}
          </div>
        </div>

        {/* Community Preference */}
        <div className={styles.inputGroup}>
          <label className="label-md">Preferred Cultural Communities</label>
          <p className="body-sm" style={{ marginTop: '-4px' }}>Select communities you are interested in (leave empty for any)</p>
          <div className={styles.chipGrid} style={{ marginTop: 'var(--space-xs)' }}>
            {COMMUNITIES.map(c => (
              <div 
                key={c.value} 
                className={`${styles.chip} ${selectedCommunities.includes(c.value) ? styles.chipActive : ''}`}
                onClick={() => toggleCommunity(c.value)}
                style={{ transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              >
                {c.label}
              </div>
            ))}
          </div>
        </div>

        <button 
          type="submit" 
          className={styles.primaryBtn}
          style={{ transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Next: Review & Consent'}
        </button>
      </form>
    </div>
  );
}
