"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { supabase } from '@/lib/supabase';
import styles from './Discover.module.css';

interface Profile {
  id: string;
  full_name: string;
  display_name: string;
  district: string;
  city_town: string;
  bio: string;
  photos: string[];
  gender: string;
  interested_in: string;
  community: string;
  religion: string;
}

const ASSAMESE_DISTRICTS = [
  "Kamrup Metropolitan", "Jorhat", "Dibrugarh", "Sonitpur", "Nagaon", 
  "Cachar", "Barpeta", "Sivasagar", "Tinsukia", "Nalbari", 
  "Golaghat", "Bongaigaon", "Lakhimpur", "Darrang", "Dhubri", 
  "Goalpara", "Karimganj", "Hailakandi", "Morigaon", "Dhemaji", 
  "Karbi Anglong", "Dima Hasao", "Kokrajhar", "Chirang", "Baksa", 
  "Udalguri", "Majuli", "Charaideo", "Hojai", "South Salmara-Mankachar", 
  "Biswanath", "Bajali", "Tamulpur"
];

const ASSAMESE_COMMUNITIES = [
  "Ahom", "Bodo", "Chutia", "Dimasa", "Karbi", "Koch_Rajbongshi", 
  "Mising", "Moran", "Motok", "Rabha", "Sonowal_Kachari", "Tea_Tribe", 
  "Thengal_Kachari", "Tiwa", "Kalita", "Brahmin", "Kayastha", 
  "Nath_Yogi", "Gariya", "Maria", "Bengali", "Marwari", "Nepali"
];

export default function DiscoverPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Swipe overlay feedback
  const [swipeDirection, setSwipeDirection] = useState<'like' | 'pass' | null>(null);
  const [swipeTriggered, setSwipeTriggered] = useState(false);

  // Match celebration modal
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);

  // Photo active index
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Filter selections
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedCommunity, setSelectedCommunity] = useState<string>('');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Background floating petals
  const [petals, setPetals] = useState<{ id: number; left: string; delay: string; duration: string }[]>([]);

  // Drag physics states
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Initialize petals on mount
  useEffect(() => {
    const generated = Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${-Math.random() * 20}s`, // Negative delay so particles are pre-scattered
      duration: `${12 + Math.random() * 8}s`,
    }));
    setPetals(generated);
  }, []);

  // Filter profiles client-side
  const uniqueDistricts = Array.from(new Set([
    ...ASSAMESE_DISTRICTS,
    ...profiles.map(p => p.district).filter(Boolean)
  ])).sort();

  const uniqueCommunities = Array.from(new Set([
    ...ASSAMESE_COMMUNITIES,
    ...profiles.map(p => p.community).filter(Boolean)
  ])).sort();

  const filteredProfiles = profiles.filter(p => {
    const matchDistrict = !selectedDistrict || p.district === selectedDistrict;
    const matchCommunity = !selectedCommunity || p.community === selectedCommunity;
    return matchDistrict && matchCommunity;
  });

  const currentProfile = filteredProfiles[currentIndex];

  // Reset active photo and drag offsets when profile changes
  useEffect(() => {
    setActivePhotoIdx(0);
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
    setDragStart(null);
  }, [currentProfile?.id]);

  // Card Pointer Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || swipeTriggered) return;
    
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest(`.${styles.actions}`)) {
      return;
    }
    
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragStart({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart || !isDragging) return;
    const offsetX = e.clientX - dragStart.x;
    const offsetY = e.clientY - dragStart.y;
    setDragOffset({ x: offsetX, y: offsetY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart || !isDragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
    setDragStart(null);

    const totalX = dragOffset.x;
    const threshold = 120;

    if (totalX > threshold) {
      // Swipe Right -> Like
      setDragOffset({ x: 0, y: 0 });
      handleLike(currentProfile);
    } else if (totalX < -threshold) {
      // Swipe Left -> Pass
      setDragOffset({ x: 0, y: 0 });
      handlePass(currentProfile.id);
    } else {
      // Tap or Snap Back
      const distance = Math.sqrt(dragOffset.x * dragOffset.x + dragOffset.y * dragOffset.y);
      if (distance < 5) {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const photosCount = currentProfile.photos?.length || 0;

        if (photosCount > 1) {
          if (clickX < width * 0.3) {
            setActivePhotoIdx(prev => Math.max(0, prev - 1));
          } else if (clickX > width * 0.7) {
            setActivePhotoIdx(prev => Math.min(photosCount - 1, prev + 1));
          }
        }
      }
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
    setIsDragging(false);
    setDragStart(null);
    setDragOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    const fetchUserAndData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        // Fetch current user's profile to know gender and interest
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setCurrentUserProfile(myProfile);

        if (myProfile) {
          // Fetch already liked profiles
          const { data: likedData } = await supabase
            .from('likes')
            .select('liked_id')
            .eq('liker_id', user.id);
          const likedIds = (likedData || []).map(l => l.liked_id);

          // Fetch already passed profiles
          const { data: passedData } = await supabase
            .from('passes')
            .select('passed_id')
            .eq('passer_id', user.id);
          const passedIds = (passedData || []).map(p => p.passed_id);

          // Fetch profiles matching target gender, same religion, and not yet swiped
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('gender', myProfile.interested_in)
            .eq('religion', myProfile.religion)
            .eq('is_profile_complete', true)
            .eq('is_active', true);

          const filtered = (profileData || []).filter(p => 
            p.id !== user.id && 
            !likedIds.includes(p.id) && 
            !passedIds.includes(p.id)
          );
          
          setProfiles(filtered);
        }

        // Fetch matches
        const { data: matchData } = await supabase
          .from('matches')
          .select(`
            *,
            user1:profiles!matches_user_1_id_fkey(*),
            user2:profiles!matches_user_2_id_fkey(*)
          `)
          .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`);
        
        const formattedMatches = (matchData || []).map(m => {
          return m.user_1_id === user.id ? m.user2 : m.user1;
        });
        setMatches(formattedMatches);
      }
      setLoading(false);
    };

    fetchUserAndData();
  }, []);

  const handleLike = async (targetProfile: Profile) => {
    if (!currentUser || swipeTriggered) return;

    setSwipeDirection('like');
    setSwipeTriggered(true);

    try {
      // 1. Insert into likes table
      const { error: likeError } = await supabase
        .from('likes')
        .insert({
          liker_id: currentUser.id,
          liked_id: targetProfile.id
        });

      if (likeError) throw likeError;

      // 2. Check if a mutual match exists (inserted automatically by DB trigger)
      const { data: matchData } = await supabase
        .from('matches')
        .select('*')
        .or(`and(user_1_id.eq.${currentUser.id},user_2_id.eq.${targetProfile.id}),and(user_1_id.eq.${targetProfile.id},user_2_id.eq.${currentUser.id})`)
        .maybeSingle();

      setTimeout(() => {
        if (matchData) {
          // Match made! Show mutual match takeover
          setMatchedProfile(targetProfile);
          setShowMatchModal(true);
          
          // Update matches list
          setMatches(prev => [targetProfile, ...prev]);
        }

        // Reset swipe state and increment card
        setSwipeDirection(null);
        setSwipeTriggered(false);
        setCurrentIndex(prev => prev + 1);
      }, 600); // Allow swipe animation to finish

    } catch (err) {
      console.error("Error liking profile:", err);
      setSwipeDirection(null);
      setSwipeTriggered(false);
    }
  };

  const handlePass = async (targetId: string) => {
    if (!currentUser || swipeTriggered) return;

    setSwipeDirection('pass');
    setSwipeTriggered(true);

    try {
      // Insert into passes table
      const { error: passError } = await supabase
        .from('passes')
        .insert({
          passer_id: currentUser.id,
          passed_id: targetId
        });

      if (passError) throw passError;

      setTimeout(() => {
        setSwipeDirection(null);
        setSwipeTriggered(false);
        setCurrentIndex(prev => prev + 1);
      }, 600);

    } catch (err) {
      console.error("Error passing profile:", err);
      setSwipeDirection(null);
      setSwipeTriggered(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <TopBar />
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic', color: 'var(--primary)' }}>
            Finding people around you...
          </p>
        </div>
      </div>
    );
  }

  const likeOpacity = swipeDirection === 'like' 
    ? 1 
    : (isDragging && dragOffset.x > 0 ? Math.min(1, dragOffset.x / 100) : 0);

  const passOpacity = swipeDirection === 'pass' 
    ? 1 
    : (isDragging && dragOffset.x < 0 ? Math.min(1, -dragOffset.x / 100) : 0);

  return (
    <div className={styles.page}>
      <TopBar />

      {/* Ambient Floating Petals */}
      <div className={styles.floatingContainer}>
        {petals.map(p => (
          <div 
            key={p.id}
            className={styles.floatingPetal}
            style={{
              left: p.left,
              animationDelay: p.delay,
              animationDuration: p.duration
            }}
          />
        ))}
      </div>

      <main className={styles.main}>
        {/* Collapsible District & Community Filter Tray */}
        <div className={styles.filterBar}>
          <div 
            className={styles.filterHeader} 
            onClick={() => setIsFilterExpanded(prev => !prev)}
          >
            <div className={styles.filterTitle}>
              <span>🔍 Filter Profiles</span>
              {(selectedDistrict || selectedCommunity) && (
                <span style={{ fontSize: '0.8rem', color: 'var(--secondary)', fontWeight: 500 }}>
                  ({[selectedDistrict && `District: ${selectedDistrict}`, selectedCommunity && `Community: ${selectedCommunity.replace('_', ' ')}`].filter(Boolean).join(', ')})
                </span>
              )}
            </div>
            <span className={`${styles.filterIcon} ${isFilterExpanded ? styles.filterIconExpanded : ''}`}>
              ▼
            </span>
          </div>
          
          {isFilterExpanded && (
            <div className={styles.filterBody}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>District</label>
                <select 
                  className={styles.filterSelect}
                  value={selectedDistrict}
                  onChange={(e) => {
                    setSelectedDistrict(e.target.value);
                    setCurrentIndex(0);
                  }}
                >
                  <option value="">All Districts</option>
                  {uniqueDistricts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Community</label>
                <select 
                  className={styles.filterSelect}
                  value={selectedCommunity}
                  onChange={(e) => {
                    setSelectedCommunity(e.target.value);
                    setCurrentIndex(0);
                  }}
                >
                  <option value="">All Communities</option>
                  {uniqueCommunities.map(c => (
                    <option key={c} value={c}>{c.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className={styles.cardContainer}>
          {currentProfile ? (
            <div className={styles.stackWrapper}>
              {/* Background Card 2 */}
              {filteredProfiles[currentIndex + 2] && (
                <div className={`${styles.card} ${styles.cardBack2}`}>
                  <div className={styles.imagePlaceholder}>
                    {filteredProfiles[currentIndex + 2].photos?.[0] ? (
                      <img src={filteredProfiles[currentIndex + 2].photos[0]} alt="" className={styles.profileImg} />
                    ) : (
                      <div className={styles.noPhoto}>🌸</div>
                    )}
                  </div>
                </div>
              )}

              {/* Background Card 1 */}
              {filteredProfiles[currentIndex + 1] && (
                <div className={`${styles.card} ${styles.cardBack1}`}>
                  <div className={styles.imagePlaceholder}>
                    {filteredProfiles[currentIndex + 1].photos?.[0] ? (
                      <img src={filteredProfiles[currentIndex + 1].photos[0]} alt="" className={styles.profileImg} />
                    ) : (
                      <div className={styles.noPhoto}>🌸</div>
                    )}
                  </div>
                </div>
              )}

              {/* Top Active Card */}
              <div 
                className={`${styles.card} ${styles.cardActive} ${
                  isDragging ? styles.dragging : ''
                } ${
                  swipeDirection === 'like' ? styles.swipeRight : 
                  swipeDirection === 'pass' ? styles.swipeLeft : ''
                }`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                style={isDragging ? {
                  transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${dragOffset.x * 0.05}deg)`
                } : undefined}
              >
                {/* Swipe Text Overlays */}
                {likeOpacity > 0 && (
                  <div 
                    className={`${styles.swipeOverlay} ${styles.overlayLike}`}
                    style={{ opacity: likeOpacity }}
                  >
                    Bhal Lage
                  </div>
                )}
                {passOpacity > 0 && (
                  <div 
                    className={`${styles.swipeOverlay} ${styles.overlayPass}`}
                    style={{ opacity: passOpacity }}
                  >
                    Nalagibo
                  </div>
                )}

                <div className={styles.imagePlaceholder}>
                  {/* Story Indicators */}
                  {currentProfile.photos && currentProfile.photos.length > 1 && (
                    <div className={styles.storyIndicators}>
                      {currentProfile.photos.map((_, idx) => (
                        <div 
                          key={idx} 
                          className={`${styles.storyIndicator} ${idx === activePhotoIdx ? styles.storyIndicatorActive : ''}`} 
                        />
                      ))}
                    </div>
                  )}

                  {currentProfile.photos?.[activePhotoIdx] || currentProfile.photos?.[0] ? (
                    <img 
                      src={currentProfile.photos[activePhotoIdx] || currentProfile.photos[0]} 
                      alt={currentProfile.display_name} 
                      className={styles.profileImg} 
                      draggable={false}
                    />
                  ) : (
                    <div className={styles.noPhoto}>🌸</div>
                  )}
                  
                  {/* Subtle compatibility ring */}
                  <div className={styles.compatibility}>
                    <svg className={styles.compatibilityRing} viewBox="0 0 36 36">
                      <path
                        className={styles.ringBg}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className={styles.ringFill}
                        strokeDasharray="85, 100"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className={styles.compatibilityText}>85% match</span>
                  </div>
                </div>
                
                <div className={styles.details}>
                  <div className={styles.headerInfo}>
                    <h2 className={styles.profileName}>{currentProfile.display_name}</h2>
                    <p className={styles.location}>📍 {currentProfile.city_town ? `${currentProfile.city_town}, ` : ''}{currentProfile.district}</p>
                  </div>
                  <p className={styles.bioText}>
                    &quot;{currentProfile.bio || "No bio letter written yet."}&quot;
                  </p>
                  <div className={styles.chips}>
                    <span className={styles.chip}>{currentProfile.community ? currentProfile.community.replace('_', ' ') : 'Assamese'}</span>
                    <span className={styles.chip}>{currentProfile.religion || 'spiritual'}</span>
                  </div>
                </div>

                <div className={styles.actions}>
                  {/* Pass Button */}
                  <button 
                    className={`${styles.actionBtn} ${styles.passBtn}`} 
                    onClick={() => handlePass(currentProfile.id)} 
                    title="Pass (Nalagibo)"
                    disabled={swipeTriggered}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>

                  {/* Superlike Button */}
                  <button 
                    className={`${styles.actionBtn} ${styles.superBtn}`} 
                    title="Super Like"
                    disabled={swipeTriggered}
                  >
                    ✨
                  </button>

                  {/* Like Button */}
                  <button 
                    className={`${styles.actionBtn} ${styles.likeBtn}`} 
                    onClick={() => handleLike(currentProfile)} 
                    title="Like (Bhal Lage)"
                    disabled={swipeTriggered}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State: Brahmaputra River Dock Illustration */
            <div className={styles.emptyState}>
              <svg viewBox="0 0 200 120" className={styles.dockSvg}>
                {/* Sky and stars */}
                <rect x="0" y="0" width="200" height="90" fill="none" />
                <circle cx="20" cy="15" r="0.5" fill="#B8860B" opacity="0.6"/>
                <circle cx="50" cy="25" r="0.5" fill="#B8860B" opacity="0.8"/>
                <circle cx="160" cy="20" r="0.7" fill="#B8860B" opacity="0.5"/>
                <circle cx="120" cy="10" r="0.4" fill="#B8860B" opacity="0.7"/>

                {/* Brahmaputra river waves */}
                <path d="M 0 90 Q 25 88 50 90 T 100 90 T 150 90 T 200 90 L 200 120 L 0 120 Z" fill="#FFF6EB" opacity="0.5"/>
                <path d="M 0 95 Q 25 93 50 95 T 100 95 T 150 95 T 200 95 L 200 120 L 0 120 Z" fill="#FFEFE0" opacity="0.6"/>
                <path d="M 0 102 Q 25 100 50 102 T 100 102 T 150 102 T 200 102 L 200 120 L 0 120 Z" fill="#FFE8D1" />

                {/* Wooden Dock */}
                <path d="M 85 120 L 95 75 L 105 75 L 115 120 Z" fill="#D2B48C" stroke="#A0522D" strokeWidth="1" />
                <line x1="88" y1="105" x2="112" y2="105" stroke="#A0522D" strokeWidth="1" />
                <line x1="91" y1="90" x2="109" y2="90" stroke="#A0522D" strokeWidth="1" />
                <line x1="93" y1="80" x2="107" y2="80" stroke="#A0522D" strokeWidth="1" />
                
                {/* Dock pillars */}
                <rect x="93" y="73" width="3" height="15" fill="#8B4513" />
                <rect x="104" y="73" width="3" height="15" fill="#8B4513" />
              </svg>
              <h2 className="headline-md" style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700 }}>No matches yet</h2>
              <p className="body-md" style={{ fontFamily: 'var(--font-handwritten)', fontSize: '1.25rem', color: 'var(--secondary)' }}>
                but the river keeps moving.
              </p>
            </div>
          )}
        </div>

        {/* Sidebar for matches */}
        <aside className={styles.sidebar}>
          <h3 className="label-md" style={{ fontFamily: 'var(--font-playfair)', color: 'var(--primary)', borderBottom: '1px solid var(--outline-variant)', paddingBottom: 'var(--space-sm)' }}>
            Your Stories 💌
          </h3>
          <div className={styles.matchesList}>
            {matches.length > 0 ? matches.map((match, i) => (
              <Link href={`/chat/${match.id}`} key={i} className={styles.miniMatch}>
                <div className={styles.miniAvatar}>
                  {match.photos?.[0] ? (
                    <img src={match.photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    match.display_name?.[0] || 'S'
                  )}
                </div>
                <div className={styles.miniInfo}>
                  <p className="label-md" style={{ fontWeight: 600, color: 'var(--on-background)' }}>{match.display_name}</p>
                  <p className="label-sm" style={{ color: 'var(--secondary)', fontStyle: 'italic' }}>Tap to chat</p>
                </div>
              </Link>
            )) : (
              <div style={{ textAlign: 'center', padding: 'var(--space-lg) 0' }}>
                <p className="body-sm" style={{ color: 'var(--outline)' }}>No matches yet.</p>
                <p className="body-sm" style={{ fontFamily: 'var(--font-handwritten)', fontSize: '1.05rem', color: 'var(--secondary)', marginTop: '4px' }}>
                  Keep looking! 🌸
                </p>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* "Mili Jabo" Takeover Modal */}
      {showMatchModal && matchedProfile && (
        <div className={styles.matchModalOverlay}>
          <div className={styles.matchModalContent}>
            {/* Two Kingfishers Illustration */}
            <svg viewBox="0 0 100 50" className={styles.kingfishersSvg}>
              {/* Branch */}
              <path d="M 10 35 Q 50 30 90 35" stroke="#8B4513" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M 70 32 Q 75 25 82 27" stroke="#8B4513" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              
              {/* Left Kingfisher */}
              <g transform="translate(32, 12)">
                {/* Body */}
                <ellipse cx="10" cy="15" rx="7" ry="10" fill="#008B8B" />
                {/* Belly */}
                <ellipse cx="12" cy="16" rx="5" ry="7" fill="#FF8C00" />
                {/* Head */}
                <circle cx="8" cy="6" r="5" fill="#008B8B" />
                {/* Beak */}
                <polygon points="4,5 -2,4 4,8" fill="#1E1E1E" />
                {/* Eye */}
                <circle cx="7" cy="5" r="0.8" fill="white" />
                <circle cx="7" cy="5" r="0.4" fill="black" />
                {/* Tail */}
                <polygon points="12,23 15,28 10,25" fill="#008B8B" />
              </g>

              {/* Right Kingfisher */}
              <g transform="translate(48, 12)">
                {/* Body */}
                <ellipse cx="10" cy="15" rx="7" ry="10" fill="#008B8B" />
                {/* Belly */}
                <ellipse cx="8" cy="16" rx="5" ry="7" fill="#FF8C00" />
                {/* Head */}
                <circle cx="12" cy="6" r="5" fill="#008B8B" />
                {/* Beak */}
                <polygon points="16,5 22,4 16,8" fill="#1E1E1E" />
                {/* Eye */}
                <circle cx="13" cy="5" r="0.8" fill="white" />
                <circle cx="13" cy="5" r="0.4" fill="black" />
                {/* Tail */}
                <polygon points="8,23 5,28 10,25" fill="#008B8B" />
              </g>

              {/* Gold Ring connecting them */}
              <ellipse cx="50" cy="28" rx="4" ry="4" fill="none" stroke="var(--primary)" strokeWidth="1.2" style={{ animation: 'pulse 1.5s infinite' }} />
            </svg>

            <h1 className={styles.matchTitle}>Mili Jabo</h1>
            <p className={styles.matchSubtitle}>You and {matchedProfile.display_name} liked each other!</p>

            {/* Circular Overlapping Photo Frames */}
            <div className={styles.photoFrames}>
              <div className={styles.frameLeft}>
                {currentUserProfile?.photos?.[0] ? (
                  <img src={currentUserProfile.photos[0]} alt="You" />
                ) : (
                  <div className={styles.frameEmpty}>🌸</div>
                )}
              </div>
              <div className={styles.frameRight}>
                {matchedProfile.photos?.[0] ? (
                  <img src={matchedProfile.photos[0]} alt={matchedProfile.display_name} />
                ) : (
                  <div className={styles.frameEmpty}>🌸</div>
                )}
              </div>
            </div>

            <div className={styles.modalActions}>
              <Link href={`/chat/${matchedProfile.id}`} className={styles.primaryBtn} style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                Write a message 💌
              </Link>
              <button className={styles.secondaryBtn} onClick={() => setShowMatchModal(false)} style={{ background: 'white' }}>
                Keep Swiping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
