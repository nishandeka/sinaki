"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from '../Onboarding.module.css';

const REGIONS = [
  {
    name: 'Upper Assam',
    districts: ['Jorhat', 'Dibrugarh', 'Sivasagar', 'Tinsukia', 'Golaghat', 'Charaideo', 'Majuli']
  },
  {
    name: 'Lower Assam',
    districts: ['Kamrup Metropolitan', 'Kamrup', 'Nalbari', 'Barpeta', 'Bongaigaon', 'Goalpara', 'Dhubri', 'South Salmara-Mankachar', 'Kokrajhar', 'Chirang', 'Baksa']
  },
  {
    name: 'North Bank',
    districts: ['Sonitpur', 'Lakhimpur', 'Dhemaji', 'Darrang', 'Udalguri', 'Biswanath']
  },
  {
    name: 'Central Assam',
    districts: ['Nagaon', 'Morigaon', 'Hojai']
  },
  {
    name: 'Hills',
    districts: ['Karbi Anglong', 'West Karbi Anglong', 'Dima Hasao']
  },
  {
    name: 'Barak Valley',
    districts: ['Cachar', 'Hailakandi', 'Karimganj']
  }
];

export default function VerifyPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Verification details
  const [district, setDistrict] = useState('');
  const [cityTown, setCityTown] = useState('');
  const [idCardType, setIdCardType] = useState('aadhaar');
  const [idCardUrl, setIdCardUrl] = useState('');
  const [uploadingId, setUploadingId] = useState(false);
  const [openRegion, setOpenRegion] = useState<string | null>('Upper Assam');

  // Camera & Selfie details
  const [selfieUrl, setSelfieUrl] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRequestRef = useRef<{ id: number; canceled: boolean } | null>(null);
  const timeoutIdRef = useRef<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/signup');
        return;
      }
      setUserId(user.id);

      // Check if profile exists and get existing info
      const { data } = await supabase
        .from('profiles')
        .select('district, city_town, id_card_type, id_card_url, verification_status')
        .eq('id', user.id)
        .single();

      if (data) {
        if (data.district && data.district !== 'Kamrup Metropolitan') {
          setDistrict(data.district);
        }
        if (data.city_town) setCityTown(data.city_town);
        if (data.id_card_type) setIdCardType(data.id_card_type);
        if (data.id_card_url) setIdCardUrl(data.id_card_url);
        
        // Find region of existing district to keep it open
        const matchingRegion = REGIONS.find(r => r.districts.includes(data.district));
        if (matchingRegion) {
          setOpenRegion(matchingRegion.name);
        }
      }
    };
    checkAuth();
  }, [router]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      if (cameraRequestRef.current) {
        cameraRequestRef.current.canceled = true;
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [cameraStream]);

  // Bind camera stream to video element
  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl) {
      if (cameraStream) {
        if (videoEl.srcObject !== cameraStream) {
          videoEl.srcObject = cameraStream;
          videoEl.play().catch((err) => {
            console.warn("Error playing camera stream:", err);
          });
        }
      } else {
        videoEl.srcObject = null;
      }
    }
  }, [cameraStream, cameraActive]);



  const handleIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!userId || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    
    setUploadingId(true);
    setError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/id_card-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      setIdCardUrl(publicUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to upload ID document.');
    } finally {
      setUploadingId(false);
    }
  };

  const startCamera = async () => {
    setError(null);
    setCameraActive(true);
    setCameraLoading(true);

    // Cancel any previous pending requests
    if (cameraRequestRef.current) {
      cameraRequestRef.current.canceled = true;
    }
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    // Create a new request reference
    const requestId = Date.now();
    const currentRequest = { id: requestId, canceled: false };
    cameraRequestRef.current = currentRequest;

    const timeoutDuration = 8000; // 8 seconds timeout

    try {
      // Wrap getUserMedia with inline cancel check and error handler to prevent leaks/unhandled rejections
      const userMediaPromise = navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      }).then((stream) => {
        if (currentRequest.canceled) {
          stream.getTracks().forEach(track => track.stop());
        }
        return stream;
      }).catch((err) => {
        if (!currentRequest.canceled) {
          throw err;
        }
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutIdRef.current = setTimeout(() => {
          if (!currentRequest.canceled) {
            reject(new Error('Timeout'));
          }
        }, timeoutDuration);
      });

      // Race the getUserMedia call against our custom timeout
      const stream = await Promise.race([userMediaPromise, timeoutPromise]);

      // Double check if canceled during the race duration
      if (currentRequest.canceled || !stream) {
        if (stream) {
          (stream as MediaStream).getTracks().forEach(track => track.stop());
        }
        return;
      }

      const activeStream = stream as MediaStream;
      setCameraStream(activeStream);
      setCameraLoading(false);
    } catch (err: any) {
      setCameraLoading(false);
      if (currentRequest.canceled) {
        return;
      }

      const isExpected = err.name === 'AbortError' || 
                         err.name === 'NotAllowedError' || 
                         err.name === 'PermissionDeniedError' || 
                         err.name === 'NotFoundError' || 
                         err.name === 'DevicesNotFoundError' || 
                         err.name === 'NotReadableError' ||
                         err.name === 'TrackStartError' ||
                         err.name === 'OverconstrainedError' ||
                         err.name === 'SecurityError' ||
                         err.message === 'Timeout';

      if (isExpected) {
        console.warn('Camera initialization warning (expected fallback case):', err.message || err);
      } else {
        console.error('Camera initialization failed (unexpected error):', err);
      }
      currentRequest.canceled = true;
      setCameraActive(false);

      if (err.name === 'AbortError' || err.message === 'Timeout') {
        setError('Camera startup timed out. This can happen if another application (like Zoom or Teams) is using your camera. Please close other apps and try again, or upload a photo instead.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission was denied. Please enable camera access in your browser settings, or upload a photo instead.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera device could be found. Please upload a photo instead.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('The camera could not be accessed. It might be in use by another application (like Zoom, Teams, or another browser tab). Please close other apps and try again, or upload a photo instead.');
      } else {
        setError('Could not access camera. Please upload a selfie photo instead.');
      }
    } finally {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    }
  };

  const stopCamera = () => {
    if (cameraRequestRef.current) {
      cameraRequestRef.current.canceled = true;
      cameraRequestRef.current = null;
    }
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
    setCameraLoading(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        if (!blob || !userId) return;
        setLoading(true);
        try {
          const fileName = `${userId}/selfie-${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('photos')
            .upload(fileName, blob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('photos')
            .getPublicUrl(fileName);

          setSelfieUrl(publicUrl);
          stopCamera();
        } catch (err: any) {
          setError(err.message || 'Failed to save selfie.');
        } finally {
          setLoading(false);
        }
      }, 'image/jpeg');
    }
  };

  const handleSelfieUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!userId || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setLoading(true);
    setError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/selfie-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      setSelfieUrl(publicUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to upload selfie.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!district) {
      setError('Please select your district.');
      return;
    }
    if (!idCardUrl) {
      setError('Please upload a photo of your ID card.');
      return;
    }
    if (!selfieUrl) {
      setError('Please provide a verification selfie.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Save verification data to database
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          district,
          city_town: cityTown || null,
          id_card_type: idCardType,
          id_card_url: idCardUrl,
          verification_status: 'under_review',
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      // Create a pending record in verification_queue so it is visible in the admin portal
      const { error: queueError } = await supabase
        .from('verification_queue')
        .insert({
          profile_id: userId,
          id_card_url: idCardUrl,
          id_card_type: idCardType,
          selfie_url: selfieUrl,
          status: 'pending'
        });

      if (queueError) throw queueError;

      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to save verification details.');
    } finally {
      setLoading(false);
    }
  };

  const toggleRegion = (regionName: string) => {
    setOpenRegion(openRegion === regionName ? null : regionName);
  };

  if (isSubmitted) {
    return (
      <div className={styles.pendingContainer}>
        <div className={styles.chaiIllustration}>
          <svg viewBox="0 0 100 100" className={styles.chaiCup}>
            {/* Steaming lines */}
            <path d="M 40 25 Q 43 15 40 5" className={styles.chaiSteam} />
            <path d="M 50 22 Q 53 10 50 2" className={styles.chaiSteam} style={{ animationDelay: '0.4s' }} />
            <path d="M 60 25 Q 63 15 60 5" className={styles.chaiSteam} style={{ animationDelay: '0.8s' }} />
            
            {/* Teacup handle */}
            <path d="M 65 45 C 80 45, 80 65, 65 65" stroke="var(--primary)" strokeWidth="4" fill="none" strokeLinecap="round" />
            
            {/* Teacup body */}
            <path d="M 25 40 L 75 40 L 70 70 C 68 80, 32 80, 30 70 Z" fill="#FFF" stroke="var(--primary)" strokeWidth="4" />
            
            {/* Plate/Saucer */}
            <path d="M 15 88 L 85 88 C 80 94, 20 94, 15 88 Z" fill="var(--primary)" />
          </svg>
        </div>
        <h2 className={styles.reviewTitle}>We&apos;ve got it.</h2>
        <p className={styles.reviewSub}>
          Our team will review this within 24 hours. Go make some chai while you wait.
        </p>
        <button
          onClick={() => router.push('/onboarding/preferences')}
          className={styles.primaryBtn}
          style={{ width: '100%', maxWidth: '300px' }}
        >
          Next: Preferences
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className="headline-lg" style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700 }}>One last thing — just to be safe</h1>
      <p className="body-md">
        We verify every profile on Sinaki to keep our community safe and real. Let&apos;s get you verified.
      </p>

      {error && <div className={styles.error}>{error}</div>}

      <form className={styles.form} onSubmit={handleSubmit}>
        {/* District & Location */}
        <div className={styles.inputGroup}>
          <label className="label-md">Where in Assam are you from?</label>
          <p className="body-sm" style={{ marginTop: '-4px', marginBottom: '8px' }}>Select your home district</p>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {REGIONS.map((region) => (
              <div key={region.name} className={styles.regionGroup}>
                <button
                  type="button"
                  className={styles.regionHeader}
                  onClick={() => toggleRegion(region.name)}
                >
                  <span>{region.name}</span>
                  <span>{openRegion === region.name ? '▲' : '▼'}</span>
                </button>
                {openRegion === region.name && (
                  <div className={styles.districtGrid}>
                    {region.districts.map((d) => (
                      <div
                        key={d}
                        className={`${styles.districtItem} ${district === d ? styles.districtActive : ''}`}
                        onClick={() => setDistrict(d)}
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {district && (
            <p className="body-sm" style={{ color: 'var(--primary)', fontWeight: 600, marginTop: '4px' }}>
              Selected District: {district}
            </p>
          )}
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="cityTown" className="label-md">City / Town (Optional)</label>
          <input
            type="text"
            id="cityTown"
            placeholder="e.g. Jorhat, Nagaon, Tezpur"
            className={styles.input}
            value={cityTown}
            onChange={(e) => setCityTown(e.target.value)}
          />
        </div>

        {/* ID Document Selection & Upload */}
        <div className={styles.inputGroup} style={{ borderTop: '1px solid var(--outline-variant)', paddingTop: 'var(--space-md)' }}>
          <label className="label-md">Select Verification ID Type</label>
          <select
            value={idCardType}
            onChange={(e) => setIdCardType(e.target.value)}
            className={styles.input}
            required
          >
            <option value="aadhaar">Aadhaar Card</option>
            <option value="voter_id">Voter ID</option>
            <option value="pan_card">PAN Card</option>
            <option value="driving_license">Driving License</option>
            <option value="passport">Passport</option>
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label className="label-md">Upload {idCardType.toUpperCase()} Photo</label>
          {idCardUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-sm)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-md)', background: 'rgba(192,57,43,0.02)' }}>
              <span style={{ fontSize: '1.25rem' }}>📄</span>
              <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span className="body-sm" style={{ fontWeight: 600 }}>{idCardType.toUpperCase()} Uploaded</span>
              </div>
              <button
                type="button"
                className={styles.secondaryBtn}
                style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                onClick={() => setIdCardUrl('')}
              >
                Change
              </button>
            </div>
          ) : (
            <div 
              className={styles.photoUpload}
              onClick={() => document.getElementById('id-doc-input')?.click()}
              style={{ padding: 'var(--space-xl)' }}
            >
              <p>{uploadingId ? 'Uploading...' : 'Click to upload your ID document photo'}</p>
              <span className={styles.helperText}>Make sure details are clearly visible.</span>
            </div>
          )}
          <input
            id="id-doc-input"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleIdUpload}
            disabled={uploadingId}
          />
        </div>

        {/* Selfie Verification */}
        <div className={styles.inputGroup} style={{ borderTop: '1px solid var(--outline-variant)', paddingTop: 'var(--space-md)' }}>
          <label className="label-md">Take a Verification Selfie</label>
          <p className="body-sm" style={{ marginTop: '-4px', marginBottom: '8px' }}>We match this with your ID photo to verify you.</p>
          
          {selfieUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <img src={selfieUrl} alt="Selfie preview" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }} />
              <button
                type="button"
                className={styles.secondaryBtn}
                style={{ padding: '6px 16px', fontSize: '0.875rem' }}
                onClick={() => setSelfieUrl('')}
              >
                Retake Selfie
              </button>
            </div>
          ) : cameraActive ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '320px', aspectRatio: '4/3', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'black' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  width={320}
                  height={240}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)'
                  }}
                />
                {cameraLoading && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255, 249, 242, 0.95)',
                    color: 'var(--primary)',
                    gap: 'var(--space-sm)'
                  }}>
                    <div className={styles.uploadSpinner} />
                    <span className="body-sm" style={{ fontWeight: 600, fontFamily: 'var(--font-inter)' }}>Starting camera...</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button type="button" className={styles.primaryBtn} onClick={capturePhoto} disabled={cameraLoading}>
                  📸 Capture
                </button>
                <button type="button" className={styles.secondaryBtn} onClick={stopCamera}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={startCamera}
                style={{ background: 'var(--secondary)' }}
              >
                📸 Open Camera & Take Selfie
              </button>
              <div style={{ textAlign: 'center' }}>
                <span className="body-sm" style={{ color: 'var(--outline)' }}>or</span>
              </div>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => document.getElementById('selfie-file-input')?.click()}
              >
                📤 Upload a Selfie Photo
              </button>
              <input
                id="selfie-file-input"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleSelfieUpload}
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          className={styles.primaryBtn}
          style={{ transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', marginTop: 'var(--space-md)' }}
          disabled={loading || uploadingId || !district || !idCardUrl || !selfieUrl}
        >
          {loading ? 'Submitting...' : 'Submit Verification 💌'}
        </button>
      </form>
    </div>
  );
}
