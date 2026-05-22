"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './TopBar.module.css';

const startRingtone = () => {
  if (typeof window === 'undefined') return () => {};
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return () => {};
    const audioCtx = new AudioContextClass();
    
    let osc1: OscillatorNode | null = null;
    let osc2: OscillatorNode | null = null;
    let gainNode: GainNode | null = null;
    
    const playTone = () => {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      osc1 = audioCtx.createOscillator();
      osc2 = audioCtx.createOscillator();
      gainNode = audioCtx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.value = 440;
      osc2.type = 'sine';
      osc2.frequency.value = 480;
      
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc1.start();
      osc2.start();
    };
    
    const stopTone = () => {
      try {
        if (osc1) osc1.stop();
        if (osc2) osc2.stop();
        if (gainNode) gainNode.disconnect();
      } catch (e) {}
      osc1 = null;
      osc2 = null;
      gainNode = null;
    };
    
    playTone();
    
    let isPlaying = true;
    const interval = setInterval(() => {
      if (isPlaying) {
        stopTone();
        isPlaying = false;
      } else {
        playTone();
        isPlaying = true;
      }
    }, 2000);
    
    return () => {
      clearInterval(interval);
      stopTone();
      audioCtx.close().catch(() => {});
    };
  } catch (err) {
    console.error("Failed to play ringtone:", err);
    return () => {};
  }
};

export default function TopBar() {
  const router = useRouter();
  const [initial, setInitial] = useState('?');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const ringtoneCleanupRef = useRef<(() => void) | null>(null);

  // New notification states
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<'likes' | 'messages'>('likes');
  const [likesReceived, setLikesReceived] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  
  // Profile preview modal states
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async (userId: string) => {
    try {
      // 1. Fetch Likes
      const { data: myLikes } = await supabase
        .from('likes')
        .select('liked_id')
        .eq('liker_id', userId);
      const likedIds = new Set((myLikes || []).map(l => l.liked_id));

      const { data: myPasses } = await supabase
        .from('passes')
        .select('passed_id')
        .eq('passer_id', userId);
      const passedIds = new Set((myPasses || []).map(p => p.passed_id));

      const { data: receivedLikes } = await supabase
        .from('likes')
        .select(`
          id,
          liker_id,
          created_at,
          liker:profiles!likes_liker_id_fkey(*)
        `)
        .eq('liked_id', userId);

      const filteredLikes = (receivedLikes || [])
        .filter(item => item.liker && !likedIds.has(item.liker_id) && !passedIds.has(item.liker_id))
        .map(item => ({
          id: item.id,
          likerId: item.liker_id,
          createdAt: item.created_at,
          profile: item.liker
        }));
      setLikesReceived(filteredLikes);

      // 2. Fetch Conversations with messages
      const { data: convs } = await supabase
        .from('conversations')
        .select(`
          *,
          user1:profiles!conversations_user_1_id_fkey(*),
          user2:profiles!conversations_user_2_id_fkey(*)
        `)
        .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`);

      const formattedConvs = (convs || [])
        .filter(c => c.last_message_text !== null)
        .map(c => {
          const isUser1 = c.user_1_id === userId;
          const partner = isUser1 ? c.user2 : c.user1;
          const unreadCount = isUser1 ? c.user_1_unread_count : c.user_2_unread_count;
          return {
            id: c.id,
            matchId: c.match_id,
            lastMessageText: c.last_message_text,
            lastMessageAt: c.last_message_at,
            lastMessageBy: c.last_message_by,
            unreadCount: unreadCount || 0,
            partner: partner
          };
        })
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

      setConversations(formattedConvs);

      const totalUnread = formattedConvs.reduce((acc, c) => acc + c.unreadCount, 0);
      setUnreadMsgCount(totalUnread);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  useEffect(() => {
    let active = true;
    let globalCallChannel: any = null;
    let likesChannel: any = null;
    let convChannel: any = null;

    const fetchUserAndSetupCallListener = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;

      setCurrentUser(user);
      fetchNotifications(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, photos')
        .eq('id', user.id)
        .single();
      
      if (!active) return;

      if (profile) {
        if (profile.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        } else if (profile.photos && profile.photos.length > 0) {
          setAvatarUrl(profile.photos[0]);
        }
        if (profile.full_name) {
          setInitial(profile.full_name[0].toUpperCase());
        }
      }

      // Subscribe to user's global calling channel
      globalCallChannel = supabase.channel(`user_calls_${user.id}`, {
        config: { broadcast: { self: false } }
      });

      globalCallChannel
        .on('broadcast', { event: 'incoming-call' }, ({ payload }: any) => {
          if (!active) return;
          setIncomingCall(payload);
          // Start ringing sound
          if (ringtoneCleanupRef.current) ringtoneCleanupRef.current();
          ringtoneCleanupRef.current = startRingtone();
        })
        .on('broadcast', { event: 'call-ended' }, () => {
          if (!active) return;
          setIncomingCall(null);
          if (ringtoneCleanupRef.current) {
            ringtoneCleanupRef.current();
            ringtoneCleanupRef.current = null;
          }
        });

      globalCallChannel.subscribe();

      // Subscribe to received likes
      likesChannel = supabase
        .channel('likes-notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'likes',
          filter: `liked_id=eq.${user.id}`
        }, () => {
          fetchNotifications(user.id);
        })
        .subscribe();

      // Subscribe to conversation updates (messages)
      convChannel = supabase
        .channel('convs-notifications')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations'
        }, (payload: any) => {
          const updated = payload.new;
          if (updated.user_1_id === user.id || updated.user_2_id === user.id) {
            fetchNotifications(user.id);
          }
        })
        .subscribe();
    };

    fetchUserAndSetupCallListener();

    return () => {
      active = false;
      if (globalCallChannel) {
        supabase.removeChannel(globalCallChannel);
      }
      if (likesChannel) {
        supabase.removeChannel(likesChannel);
      }
      if (convChannel) {
        supabase.removeChannel(convChannel);
      }
      if (ringtoneCleanupRef.current) {
        ringtoneCleanupRef.current();
        ringtoneCleanupRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showDropdown]);

  const handleDeclineCall = () => {
    if (incomingCall) {
      // Send declined event to Caller's channel
      supabase.channel(`user_calls_${incomingCall.callerId}`).send({
        type: 'broadcast',
        event: 'call-declined',
        payload: { matchId: incomingCall.matchId }
      });
      // Also broadcast to the room call channel
      supabase.channel(`room_call_${incomingCall.matchId}`).send({
        type: 'broadcast',
        event: 'call-declined',
        payload: {}
      });
    }
    setIncomingCall(null);
    if (ringtoneCleanupRef.current) {
      ringtoneCleanupRef.current();
      ringtoneCleanupRef.current = null;
    }
  };

  const handleAcceptCall = () => {
    if (incomingCall) {
      if (ringtoneCleanupRef.current) {
        ringtoneCleanupRef.current();
        ringtoneCleanupRef.current = null;
      }
      const matchId = incomingCall.matchId;
      const callType = incomingCall.callType;
      setIncomingCall(null);
      
      // Redirect to the chat page with query parameters indicating active call
      router.push(`/chat/${matchId}?callActive=true&callType=${callType}&isReceiver=true`);
    }
  };

  const handleLikeBack = async (likerId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('likes')
        .insert({
          liker_id: user.id,
          liked_id: likerId
        });

      if (error) throw error;

      const { data: match } = await supabase
        .from('matches')
        .select('id')
        .or(`and(user_1_id.eq.${user.id},user_2_id.eq.${likerId}),and(user_1_id.eq.${likerId},user_2_id.eq.${user.id})`)
        .maybeSingle();

      setLikesReceived(prev => prev.filter(l => l.likerId !== likerId));
      
      if (match) {
        alert("Bohut Bhal! 🎉 It's a Match! You can now start chatting.");
        router.push(`/chat/${match.id}`);
        setShowDropdown(false);
      } else {
        fetchNotifications(user.id);
      }
    } catch (err) {
      console.error("Error liking back:", err);
    }
  };

  const handlePassLiker = async (likerId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('passes')
        .insert({
          passer_id: user.id,
          passed_id: likerId
        });

      if (error) throw error;

      setLikesReceived(prev => prev.filter(l => l.likerId !== likerId));
    } catch (err) {
      console.error("Error passing user:", err);
    }
  };

  const calculateAge = (dobString: string) => {
    if (!dobString) return '';
    const dob = new Date(dobString);
    const diffMs = Date.now() - dob.getTime();
    const ageDate = new Date(diffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <>
      <div className={styles.topBar}>
        <div className={styles.container}>
          <Link href="/discover" className={styles.logo}>Sinaki</Link>
          <div className={styles.actions}>
            <Link href="/chat" className={styles.iconLink} title="Matches & Chats">
              <span className={styles.icon}>💌</span>
            </Link>
            
            <button
              className={styles.notificationBtn}
              onClick={() => setShowDropdown(!showDropdown)}
              title="Notifications"
            >
              <span className={styles.icon}>🔔</span>
              {likesReceived.length + unreadMsgCount > 0 && (
                <span className={styles.badge}>
                  {likesReceived.length + unreadMsgCount}
                </span>
              )}
            </button>

            <Link href="/me" className={styles.avatar}>
              <div className={styles.avatarCircle}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Account" className={styles.avatarImage} />
                ) : (
                  initial
                )}
              </div>
            </Link>
          </div>

          {showDropdown && (
            <div className={styles.dropdown} ref={dropdownRef}>
              <div className={styles.dropdownHeader}>
                <span className={styles.dropdownTitle}>Notifications</span>
              </div>
              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${activeTab === 'likes' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab('likes')}
                >
                  Likes Received
                  {likesReceived.length > 0 && (
                    <span className={styles.tabBadge}>{likesReceived.length}</span>
                  )}
                </button>
                <button
                  className={`${styles.tab} ${activeTab === 'messages' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab('messages')}
                >
                  Messages
                  {unreadMsgCount > 0 && (
                    <span className={styles.tabBadge}>{unreadMsgCount}</span>
                  )}
                </button>
              </div>
              <div className={styles.dropdownList}>
                {activeTab === 'likes' ? (
                  likesReceived.length === 0 ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>💝</div>
                      <div className={styles.emptyText}>No likes yet</div>
                      <div className={styles.emptySubtext}>Keep exploring profiles!</div>
                    </div>
                  ) : (
                    likesReceived.map((item) => (
                      <div key={item.id} className={styles.likeItem}>
                        <div className={styles.likeAvatar}>
                          {item.profile.photos && item.profile.photos[0] ? (
                            <img src={item.profile.photos[0]} alt={item.profile.display_name || item.profile.full_name} />
                          ) : (
                            (item.profile.display_name || item.profile.full_name)?.[0]?.toUpperCase() || '?'
                          )}
                        </div>
                        <div className={styles.likeInfo}>
                          <div className={styles.likeName}>
                            {item.profile.display_name || item.profile.full_name}
                            {item.profile.date_of_birth && `, ${calculateAge(item.profile.date_of_birth)}`}
                          </div>
                          <div className={styles.likeMeta}>
                            {item.profile.district || 'Assam'} • {formatTime(item.createdAt)}
                          </div>
                          {item.profile.bio && (
                            <div className={styles.likeBio} title={item.profile.bio}>
                              {item.profile.bio}
                            </div>
                          )}
                        </div>
                        <div className={styles.likeActions}>
                          <button
                            className={`${styles.actionButton} ${styles.btnLikeBack}`}
                            onClick={() => handleLikeBack(item.likerId)}
                            title="Like back"
                          >
                            ❤️
                          </button>
                          <button
                            className={`${styles.actionButton} ${styles.btnPass}`}
                            onClick={() => handlePassLiker(item.likerId)}
                            title="Pass"
                          >
                            ✕
                          </button>
                          <button
                            className={`${styles.actionButton} ${styles.btnView}`}
                            onClick={() => {
                              setSelectedProfile(item.profile);
                              setActivePhotoIdx(0);
                            }}
                            title="View profile"
                          >
                            👁️
                          </button>
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  conversations.length === 0 ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>💬</div>
                      <div className={styles.emptyText}>No messages yet</div>
                      <div className={styles.emptySubtext}>Start a match to begin chatting!</div>
                    </div>
                  ) : (
                    conversations.map((conv) => {
                      const isUnread = conv.unreadCount > 0;
                      return (
                        <div
                          key={conv.id}
                          className={`${styles.msgItem} ${isUnread ? styles.msgUnread : ''}`}
                          onClick={() => {
                            router.push(`/chat/${conv.id}`);
                            setShowDropdown(false);
                          }}
                        >
                          <div className={styles.msgAvatar}>
                            {conv.partner?.photos && conv.partner.photos[0] ? (
                              <img src={conv.partner.photos[0]} alt={conv.partner.display_name || conv.partner.full_name} />
                            ) : (
                              (conv.partner?.display_name || conv.partner?.full_name)?.[0]?.toUpperCase() || '?'
                            )}
                          </div>
                          <div className={styles.msgInfo}>
                            <div className={styles.msgHeader}>
                              <span className={styles.msgName}>
                                {conv.partner?.display_name || conv.partner?.full_name}
                              </span>
                              <span className={styles.msgTime}>{formatTime(conv.lastMessageAt)}</span>
                            </div>
                            <div className={styles.msgBodyContainer}>
                              <span className={`${styles.msgBody} ${isUnread ? styles.msgUnreadText : ''}`}>
                                {conv.lastMessageBy === currentUser?.id ? 'You: ' : ''}
                                {conv.lastMessageText}
                              </span>
                              {isUnread && (
                                <span className={styles.unreadBadge}>{conv.unreadCount}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {incomingCall && (
        <div className={styles.callOverlay}>
          <div className={styles.callCard}>
            <div className={styles.callAvatarContainer}>
              <div className={styles.pulseRing}></div>
              <div className={styles.callAvatar}>
                {incomingCall.callerAvatar ? (
                  <img src={incomingCall.callerAvatar} alt={incomingCall.callerName} />
                ) : (
                  incomingCall.callerName?.[0] || '?'
                )}
              </div>
            </div>
            <h2 className={styles.callerName}>{incomingCall.callerName}</h2>
            <p className={styles.callType}>
              <span>{incomingCall.callType === 'video' ? '🎥' : '📞'}</span>
              Incoming {incomingCall.callType} call...
            </p>
            <div className={styles.callActions}>
              <button className={styles.btnDecline} onClick={handleDeclineCall}>
                Decline
              </button>
              <button className={styles.btnAccept} onClick={handleAcceptCall}>
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProfile && (
        <div className={styles.modalOverlay} onClick={() => setSelectedProfile(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalCloseBtn} onClick={() => setSelectedProfile(null)}>
              ✕
            </button>
            <div className={styles.modalGallery}>
              {selectedProfile.photos && selectedProfile.photos.length > 0 ? (
                <>
                  <img
                    src={selectedProfile.photos[activePhotoIdx]}
                    alt={selectedProfile.display_name || selectedProfile.full_name}
                    className={styles.modalGalleryImg}
                  />
                  {selectedProfile.photos.length > 1 && (
                    <>
                      <button
                        className={`${styles.galleryArrow} ${styles.galleryArrowLeft}`}
                        onClick={() =>
                          setActivePhotoIdx((prev) =>
                            prev === 0 ? selectedProfile.photos.length - 1 : prev - 1
                          )
                        }
                      >
                        ‹
                      </button>
                      <button
                        className={`${styles.galleryArrow} ${styles.galleryArrowRight}`}
                        onClick={() =>
                          setActivePhotoIdx((prev) =>
                            prev === selectedProfile.photos.length - 1 ? 0 : prev + 1
                          )
                        }
                      >
                        ›
                      </button>
                      <div className={styles.galleryDots}>
                        {selectedProfile.photos.map((_: any, idx: number) => (
                          <button
                            key={idx}
                            className={`${styles.galleryDot} ${
                              idx === activePhotoIdx ? styles.galleryDotActive : ''
                            }`}
                            onClick={() => setActivePhotoIdx(idx)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--surface-variant)',
                    color: 'var(--on-surface-variant)',
                  }}
                >
                  No Photos
                </div>
              )}
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitleRow}>
                  <span className={styles.modalName}>
                    {selectedProfile.display_name || selectedProfile.full_name}
                  </span>
                  {selectedProfile.date_of_birth && (
                    <span className={styles.modalAge}>
                      , {calculateAge(selectedProfile.date_of_birth)}
                    </span>
                  )}
                </div>
                <div className={styles.modalDistrict}>
                  📍 {selectedProfile.district || 'Assam'}
                </div>
              </div>
              {selectedProfile.bio && (
                <div className={styles.modalSection}>
                  <div className={styles.modalSectionTitle}>About Me</div>
                  <p className={styles.modalBio}>{selectedProfile.bio}</p>
                </div>
              )}
              <div className={styles.modalSection}>
                <div className={styles.modalSectionTitle}>Details</div>
                <div className={styles.modalChips}>
                  {selectedProfile.gender && (
                    <span className={styles.modalChip}>Gender: {selectedProfile.gender}</span>
                  )}
                  {selectedProfile.profession && (
                    <span className={styles.modalChip}>Profession: {selectedProfile.profession}</span>
                  )}
                  {selectedProfile.religion && (
                    <span className={styles.modalChip}>Religion: {selectedProfile.religion}</span>
                  )}
                  {selectedProfile.community && (
                    <span className={styles.modalChip}>Community: {selectedProfile.community}</span>
                  )}
                  {selectedProfile.native_place && (
                    <span className={styles.modalChip}>Native Place: {selectedProfile.native_place}</span>
                  )}
                  {selectedProfile.hobbies && Array.isArray(selectedProfile.hobbies) &&
                    selectedProfile.hobbies.map((hobby: string, i: number) => (
                      <span key={i} className={styles.modalChip}>
                        🎨 {hobby}
                      </span>
                    ))}
                </div>
              </div>
              <div className={styles.modalActionRow}>
                <button
                  className={styles.modalBtnPrimary}
                  onClick={() => {
                    handleLikeBack(selectedProfile.id);
                    setSelectedProfile(null);
                  }}
                >
                  ❤️ Like Back
                </button>
                <button
                  className={styles.modalBtnSecondary}
                  onClick={() => {
                    handlePassLiker(selectedProfile.id);
                    setSelectedProfile(null);
                  }}
                >
                  Pass
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
