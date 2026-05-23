"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { supabase } from '@/lib/supabase';
import styles from './Profile.module.css';

export default function MyProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [editedProfile, setEditedProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (data) {
        if (data.verification_status !== 'verified') {
          router.replace('/check-status');
          return;
        }
        setProfile(data);
        setEditedProfile(data);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleInputChange = (field: string, value: any) => {
    setEditedProfile((prev: any) => ({
      ...prev,
      [field]: value
    }));
    setIsDirty(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed.');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB.');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      const currentPhotos = editedProfile?.photos || [];
      if (currentPhotos.length >= 6) {
        alert('Maximum of 6 photos allowed.');
        return;
      }

      handleInputChange('photos', [...currentPhotos, publicUrl]);
    } catch (err: any) {
      alert(err.message || 'Failed to upload photo.');
    }
  };

  const removePhoto = (idxToRemove: number) => {
    const currentPhotos = editedProfile?.photos || [];
    const updatedPhotos = currentPhotos.filter((_: any, idx: number) => idx !== idxToRemove);
    handleInputChange('photos', updatedPhotos);
  };

  const handleSaveChanges = async () => {
    if (!editedProfile.display_name?.trim()) {
      setError('Nickname/Display Name is required.');
      return;
    }
    if ((editedProfile.photos || []).length < 2) {
      setError('Please upload at least 2 photos.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: editedProfile.display_name,
          bio: editedProfile.bio,
          looking_for: editedProfile.looking_for,
          department: editedProfile.department,
          year_of_study: editedProfile.year_of_study,
          district: editedProfile.district,
          photos: editedProfile.photos,
          religion: editedProfile.religion,
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile(editedProfile);
      setIsDirty(false);
      alert('Changes saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setIsDirty(false);
    setError(null);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic', color: 'var(--primary)' }}>
          Opening your diary...
        </p>
      </div>
    );
  }

  const photosArray = editedProfile?.photos || [];

  return (
    <div className={styles.page}>
      <TopBar />
      <main className={styles.main}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.profileHeader}>
          {/* Asymmetrical Photo Collage Wall */}
          <div className={styles.photoWall}>
            {photosArray.map((url: string, idx: number) => (
              <div key={url} className={styles.polaroid}>
                <img src={url} alt={`Photo ${idx + 1}`} className={styles.polaroidImg} />
                <div className={styles.polaroidCaption}>
                  {idx === 0 ? "Bhal Laga" : `Mur Chobi #${idx + 1}`}
                </div>
                <button 
                  type="button" 
                  className={styles.removePhotoBtn}
                  onClick={() => removePhoto(idx)}
                  title="Remove Photo"
                >
                  ✕
                </button>
              </div>
            ))}
            {photosArray.length < 6 && (
              <div 
                className={`${styles.polaroid} ${styles.uploadPolaroid}`}
                onClick={() => document.getElementById('profile-photo-upload')?.click()}
              >
                <span className={styles.uploadIcon}>+</span>
                <span className={styles.uploadText}>Add Polaroid</span>
              </div>
            )}
          </div>

          <input 
            id="profile-photo-upload"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoUpload}
          />

          <div className={styles.nameContainer}>
            <input 
              type="text" 
              className={styles.displayNameInput}
              value={editedProfile?.display_name || ''}
              onChange={(e) => handleInputChange('display_name', e.target.value)}
              placeholder="Your Nickname"
              title="Click to edit nickname"
            />
            <div className={styles.legalName}>
              <span>👤 {editedProfile?.full_name}</span>
              {editedProfile?.verification_status === 'verified' && (
                <span style={{ color: '#10b981' }}>✓ Verified Identity</span>
              )}
            </div>
          </div>
        </div>

        {/* Details Form Card */}
        <div className={styles.profileCard}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Love Letter Bio</label>
            <textarea
              className={styles.inlineTextarea}
              value={editedProfile?.bio || ''}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              placeholder="Tell Guwahati your story..."
              maxLength={240}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Relationship Goal</label>
            <select
              className={styles.inlineSelect}
              value={editedProfile?.looking_for || 'serious'}
              onChange={(e) => handleInputChange('looking_for', e.target.value)}
            >
              <option value="casual">Casual dating</option>
              <option value="serious">Serious relationship</option>
              <option value="friendship">Friendship-first</option>
              <option value="not_sure">Not sure yet</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Year of Study</label>
              <input
                type="text"
                className={styles.inlineInput}
                value={editedProfile?.year_of_study || ''}
                onChange={(e) => handleInputChange('year_of_study', e.target.value)}
                placeholder="e.g. 3rd Year"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Department</label>
              <input
                type="text"
                className={styles.inlineInput}
                value={editedProfile?.department || ''}
                onChange={(e) => handleInputChange('department', e.target.value)}
                placeholder="e.g. Computer Science"
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Home District</label>
            <input
              type="text"
              className={styles.inlineInput}
              value={editedProfile?.district || ''}
              onChange={(e) => handleInputChange('district', e.target.value)}
              placeholder="e.g. Jorhat"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Religion</label>
            <select
              className={styles.inlineSelect}
              value={editedProfile?.religion || ''}
              onChange={(e) => handleInputChange('religion', e.target.value)}
              required
            >
              <option value="" disabled>Select your religion</option>
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
        </div>

        {/* Floating Save Changes Bar */}
        {isDirty && (
          <div className={styles.saveBar}>
            <span className={styles.saveBarText}>You have unsaved changes</span>
            <button className={styles.saveBtn} onClick={handleSaveChanges} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button className={styles.cancelBtn} onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
          </div>
        )}

        <div className={styles.actions}>
          <Link href="/me/help" className={styles.helpBtn}>
            ❓ Help & Support
          </Link>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Logout from Sinaki
          </button>
        </div>
      </main>
    </div>
  );
}
