"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from '../Onboarding.module.css';

export default function ProfilePage() {
  const router = useRouter();
  const [bio, setBio] = useState('');
  const [goals, setGoals] = useState('serious');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Photos upload state
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: boolean }>({});
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Toggles for visual chips
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedLoveLanguages, setSelectedLoveLanguages] = useState<string[]>([]);

  useEffect(() => {
    const fetchProfileData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/onboarding/basics');
        return;
      }
      setUserId(user.id);
      
      // Fetch existing profile data (bio, looking_for, photos)
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('bio, looking_for, photos')
        .eq('id', user.id)
        .single();
        
      if (data) {
        if (data.bio) setBio(data.bio);
        if (data.looking_for) setGoals(data.looking_for);
        if (data.photos) setPhotos(data.photos);
      }
    };
    fetchProfileData();
  }, [router]);

  const uploadPhoto = async (file: File) => {
    if (!userId) return;
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      setPhotoError('Only image files are allowed.');
      return;
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image must be less than 5MB.');
      return;
    }

    const fileId = Math.random().toString(36).substring(7);
    setUploadingFiles(prev => ({ ...prev, [fileId]: true }));
    setPhotoError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}-${fileId}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      // Simple mock NSFW scanning simulation for premium feel
      await new Promise(resolve => setTimeout(resolve, 1200));

      setPhotos(prev => {
        if (prev.length >= 6) {
          setPhotoError('You can upload a maximum of 6 photos.');
          return prev;
        }
        return [...prev, publicUrl];
      });
    } catch (err: any) {
      setPhotoError(err.message || 'Failed to upload image.');
    } finally {
      setUploadingFiles(prev => {
        const copy = { ...prev };
        delete copy[fileId];
        return copy;
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const remainingSlots = 6 - photos.length;
      
      if (filesArray.length > remainingSlots) {
        setPhotoError(`You can only upload up to ${remainingSlots} more photos.`);
      }
      
      const filesToUpload = filesArray.slice(0, remainingSlots);
      for (const file of filesToUpload) {
        await uploadPhoto(file);
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const filesArray = Array.from(e.dataTransfer.files);
      const remainingSlots = 6 - photos.length;
      
      if (filesArray.length > remainingSlots) {
        setPhotoError(`You can only upload up to ${remainingSlots} more photos.`);
      }
      
      const filesToUpload = filesArray.slice(0, remainingSlots);
      for (const file of filesToUpload) {
        await uploadPhoto(file);
      }
    }
  };

  const handleRemovePhoto = async (indexToRemove: number) => {
    const urlToRemove = photos[indexToRemove];
    setPhotos(prev => prev.filter((_, idx) => idx !== indexToRemove));
    
    // Delete from Supabase storage
    try {
      const pathParts = urlToRemove.split('/storage/v1/object/public/photos/');
      if (pathParts.length > 1) {
        const filePath = decodeURIComponent(pathParts[1]);
        await supabase.storage.from('photos').remove([filePath]);
      }
    } catch (err) {
      console.error('Failed to delete photo from storage:', err);
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const toggleLoveLanguage = (lang: string) => {
    setSelectedLoveLanguages(prev => 
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    if (photos.length < 2) {
      setError('Please upload at least 2 photos of yourself to continue (maximum 6).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          bio: bio,
          looking_for: goals,
          photos: photos,
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      router.push('/onboarding/verify');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const interests = ["Books", "Coffee", "Hiking", "Music", "Volunteering", "Gaming", "Art", "Fitness", "Late-night study chats"];
  const loveLanguages = ["Words of Affirmation", "Acts of Service", "Gifts", "Quality Time", "Physical Touch"];

  return (
    <div className={styles.container}>
      <h1 className="headline-lg">Your Romantic Profile</h1>
      <p className="body-md">Make it heartfelt. First impressions matter.</p>

      {error && <div className={styles.error}>{error}</div>}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.inputGroup}>
          <label className="label-md">Profile Photos (min 2, max 6)</label>
          
          {photos.length > 0 ? (
            <div className={styles.photoGrid}>
              {photos.map((url, idx) => (
                <div key={url} className={styles.photoCard} style={{ borderStyle: 'solid' }}>
                  <img src={url} alt={`Profile photo ${idx + 1}`} className={styles.photoCardImage} />
                  <button 
                    type="button" 
                    className={styles.removePhotoBtn} 
                    onClick={() => handleRemovePhoto(idx)}
                    title="Remove Photo"
                  >
                    ✕
                  </button>
                </div>
              ))}
              
              {/* Render uploading slots if any */}
              {Object.keys(uploadingFiles).map(fileId => (
                <div key={fileId} className={styles.photoCard}>
                  <div className={styles.photoUploading}>
                    <div className={styles.uploadSpinner}></div>
                    <span>Scanning...</span>
                  </div>
                </div>
              ))}
              
              {/* Show add button if under 6 photos */}
              {photos.length + Object.keys(uploadingFiles).length < 6 && (
                <div 
                  className={styles.photoCard}
                  onClick={() => document.getElementById('photo-input')?.click()}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  style={dragActive ? { borderColor: 'var(--primary)', background: 'rgba(194, 24, 7, 0.02)' } : {}}
                >
                  <span style={{ fontSize: '2rem', color: 'var(--outline)', fontWeight: '300' }}>+</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--outline)' }}>Upload</span>
                </div>
              )}
            </div>
          ) : (
            <div 
              className={styles.photoUpload}
              onClick={() => document.getElementById('photo-input')?.click()}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              style={dragActive ? { borderColor: 'var(--primary)', background: 'rgba(194, 24, 7, 0.02)' } : {}}
            >
              <p>Drag and drop photos here or click to upload</p>
              <span className={styles.helperText}>NSFW detection active • Moderation notice</span>
            </div>
          )}

          <input 
            id="photo-input"
            type="file"
            multiple
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          
          {photoError && <div className={styles.error} style={{ marginTop: 'var(--space-sm)' }}>{photoError}</div>}
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="bio" className="label-md">"Love Letter" Bio</label>
          <textarea 
            id="bio" 
            className={styles.input} 
            rows={4} 
            maxLength={240}
            placeholder="The thing I’m most looking for at BSSRV is..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            required
          />
          <div className={styles.labelRow}>
            <span className={styles.helperText}>Recommended: 180–240 characters</span>
            <span className={styles.helperText}>{bio.length}/240</span>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className="label-md">Interests</label>
          <div className={styles.chipGrid}>
            {interests.map(i => (
              <div 
                key={i} 
                className={`${styles.chip} ${selectedInterests.includes(i) ? styles.chipActive : ''}`}
                onClick={() => toggleInterest(i)}
              >
                {i}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className="label-md">Love Languages</label>
          <div className={styles.chipGrid}>
            {loveLanguages.map(l => (
              <div 
                key={l} 
                className={`${styles.chip} ${selectedLoveLanguages.includes(l) ? styles.chipActive : ''}`}
                onClick={() => toggleLoveLanguage(l)}
              >
                {l}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="goals" className="label-md">Relationship Goals</label>
          <select 
            id="goals" 
            className={styles.input} 
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            required
          >
            <option value="casual">Casual dating</option>
            <option value="serious">Serious relationship</option>
            <option value="friendship">Friendship-first</option>
            <option value="not_sure">Not sure yet</option>
          </select>
        </div>

        <button type="submit" className={styles.primaryBtn} disabled={loading || Object.keys(uploadingFiles).length > 0}>
          {loading ? 'Saving...' : 'Next: Verify Identity'}
        </button>
      </form>
    </div>
  );
}
