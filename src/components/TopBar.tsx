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

  useEffect(() => {
    let active = true;
    let globalCallChannel: any = null;

    const fetchUserAndSetupCallListener = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;

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
    };

    fetchUserAndSetupCallListener();

    return () => {
      active = false;
      if (globalCallChannel) {
        supabase.removeChannel(globalCallChannel);
      }
      if (ringtoneCleanupRef.current) {
        ringtoneCleanupRef.current();
        ringtoneCleanupRef.current = null;
      }
    };
  }, []);

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

  return (
    <>
      <div className={styles.topBar}>
        <div className={styles.container}>
          <Link href="/discover" className={styles.logo}>Sinaki</Link>
          <div className={styles.actions}>
            <Link href="/chat" className={styles.iconLink} title="Matches & Chats">
              <span className={styles.icon}>💌</span>
            </Link>
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
    </>
  );
}
