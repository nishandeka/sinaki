"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { supabase } from '@/lib/supabase';
import styles from './Chat.module.css';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  message_type?: string;
  media_url?: string;
  status?: 'sent' | 'delivered' | 'read';
}

interface Partner {
  id: string;
  full_name: string;
  avatar_url: string;
  photos?: string[];
}

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

const startOutgoingRingback = () => {
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
      
      gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
      
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
    console.error("Failed to play outgoing ringback:", err);
    return () => {};
  }
};

const playDeclineTone = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = 480;
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.05);
    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime + 0.2);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.25);
    
    gainNode.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.35);
    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime + 0.5);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.55);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.8);
    setTimeout(() => {
      audioCtx.close().catch(() => {});
    }, 1000);
  } catch (e) {}
};

const playChimeSound = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime + start);
      gainNode.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + start + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + start + duration);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start(audioCtx.currentTime + start);
      osc.stop(audioCtx.currentTime + start + duration);
    };
    
    // Play sweet "ding-dong" chime
    playTone(880, 0, 0.3); // A5
    playTone(1320, 0.1, 0.4); // E6
    
    setTimeout(() => {
      audioCtx.close().catch(() => {});
    }, 1200);
  } catch (e) {
    console.error("Failed to play chime sound:", e);
  }
};

const getUserMediaWithTimeout = async (constraints: MediaStreamConstraints, timeoutMs = 8000): Promise<MediaStream> => {
  if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new DOMException("Media devices not supported", "NotSupportedError");
  }
  
  return new Promise<MediaStream>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new DOMException("Timeout starting video source", "AbortError"));
    }, timeoutMs);

    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        clearTimeout(timer);
        resolve(stream);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

export default function ChatPage() {
  const { id: matchId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  // Call states
  const [callState, setCallState] = useState<'idle' | 'outgoing' | 'connecting' | 'active' | 'ended'>('idle');
  const [callType, setCallType] = useState<'voice' | 'video' | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  const ringbackCleanupRef = useRef<(() => void) | null>(null);
  const callTimeoutRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Real-time Chat Refs
  const chatChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const localTypingRef = useRef<boolean>(false);

  const markMessagesAsRead = async (convId: string, userId: string, partnerId: string) => {
    try {
      const { error: msgError } = await supabase
        .from('messages')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .eq('conversation_id', convId)
        .eq('sender_id', partnerId)
        .neq('status', 'read');

      if (msgError) console.error("Error marking messages as read:", msgError);

      const { data: convData } = await supabase
        .from('conversations')
        .select('user_1_id, user_2_id')
        .eq('id', convId)
        .single();
        
      if (convData) {
        const updateField = convData.user_1_id === userId ? { user_1_unread_count: 0 } : { user_2_unread_count: 0 };
        const { error: convError } = await supabase
          .from('conversations')
          .update(updateField)
          .eq('id', convId);
        if (convError) console.error("Error clearing conversation unread count:", convError);
      }
    } catch (err) {
      console.error("Failed to mark messages as read:", err);
    }
  };

  const handleTyping = () => {
    if (!chatChannelRef.current || !currentUser || !partner) return;
    
    if (!localTypingRef.current) {
      localTypingRef.current = true;
      chatChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUser.id, isTyping: true }
      });
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      localTypingRef.current = false;
      if (chatChannelRef.current) {
        chatChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: currentUser.id, isTyping: false }
        });
      }
    }, 2000);
  };

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Handle URL call parameters on load/change
  useEffect(() => {
    if (currentUser && partner && matchId && callState === 'idle') {
      const callActive = searchParams.get('callActive') === 'true';
      const cType = searchParams.get('callType') as 'voice' | 'video' | null;
      const isReceiver = searchParams.get('isReceiver') === 'true';
      
      if (callActive && isReceiver) {
        console.log("Receiver auto-joining incoming call via searchParams");
        joinCallAsReceiver(cType || 'voice');
      }
    }
  }, [currentUser, partner, callState, matchId, searchParams]);

  // Track call duration timer
  useEffect(() => {
    let interval: any = null;
    if (callState === 'active') {
      setCallDuration(0);
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState]);

  // Set up local and remote stream bindings to HTML elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, cameraOff]); // Trigger on stream or camera toggling

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && callType === 'video') {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callType]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream && callType === 'voice') {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callType]);

  // Helper to remove any existing Supabase channels to avoid "after subscribe" exceptions
  const removeExistingChannel = async (name: string) => {
    try {
      const existing = supabase.getChannels();
      const match = existing.find((c: any) => c.name === name || c.topic === `realtime:${name}`);
      if (match) {
        await supabase.removeChannel(match);
      }
    } catch (err) {
      console.error("Error cleaning up channel:", err);
    }
  };

  useEffect(() => {
    let active = true;

    const setupChat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      setCurrentUser(user);

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, photos, verification_status')
          .eq('id', user.id)
          .single();
        
        if (active && profileData) {
          if (profileData.verification_status !== 'verified') {
            router.replace('/check-status');
            return;
          }
          setCurrentUserProfile(profileData);
        }
      }

      if (user && matchId) {
        // Fetch match details to get partner
        const { data: matchData } = await supabase
          .from('matches')
          .select(`
            *,
            user1:profiles!matches_user_1_id_fkey(*),
            user2:profiles!matches_user_2_id_fkey(*)
          `)
          .eq('id', matchId)
          .single();

        if (!active) return;

        let partnerId = '';
        if (matchData) {
          const p = matchData.user_1_id === user.id ? matchData.user2 : matchData.user1;
          setPartner(p);
          partnerId = p.id;
        }

        // Fetch corresponding conversation
        const { data: conversationData } = await supabase
          .from('conversations')
          .select('id')
          .eq('match_id', matchId)
          .single();

        if (!active) return;

        if (conversationData) {
          const convId = conversationData.id;
          setConversationId(convId);

          // Fetch messages for this conversation
          const { data: messageData } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true });
          
          if (!active) return;
          setMessages(messageData || []);

          // Subscribe to message changes (INSERT & UPDATE) & typing broadcast events
          const chatChannelName = `chat_room_${convId}`;
          await removeExistingChannel(chatChannelName);

          if (!active) return;

          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          localTypingRef.current = false;
          setIsPartnerTyping(false);

          const channelInstance = supabase
            .channel(chatChannelName)
            .on('postgres_changes', { 
              event: 'INSERT', 
              schema: 'public', 
              table: 'messages',
              filter: `conversation_id=eq.${convId}`
            }, (payload) => {
              const newMsg = payload.new as Message;
              
              setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });

              if (newMsg.sender_id !== user.id) {
                playChimeSound();
                markMessagesAsRead(convId, user.id, newMsg.sender_id);
              }
            })
            .on('postgres_changes', {
              event: 'UPDATE',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${convId}`
            }, (payload) => {
              const updatedMsg = payload.new as Message;
              setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m));
            })
            .on('broadcast', { event: 'typing' }, ({ payload }) => {
              if (payload.userId === partnerId) {
                setIsPartnerTyping(payload.isTyping);
              }
            });

          chatChannelRef.current = channelInstance;
          await channelInstance.subscribe();

          // Mark messages as read upon opening the chat
          markMessagesAsRead(convId, user.id, partnerId);
        }
      }
    };

    setupChat();

    return () => {
      active = false;
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
        chatChannelRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [matchId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Clean up calling on unmount
  useEffect(() => {
    return () => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
      if (ringbackCleanupRef.current) {
        ringbackCleanupRef.current();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  const initiateCall = async (type: 'voice' | 'video') => {
    if (!partner || !currentUser) return;
    
    setCallType(type);
    setCallState('outgoing');
    
    // Play outgoing ringback tone
    if (ringbackCleanupRef.current) ringbackCleanupRef.current();
    ringbackCleanupRef.current = startOutgoingRingback();
    
    // Set up local media stream
    let stream: MediaStream;
    try {
      stream = await getUserMediaWithTimeout({
        audio: true,
        video: type === 'video'
      }, 8000);
      setLocalStream(stream);
    } catch (err: any) {
      console.warn("Media devices access warning:", err.name || err.message || err);
      alert("Could not access camera or microphone. Please check system permissions.");
      handleHangup();
      return;
    }
    
    // Join room call channel
    const channelName = `room_call_${matchId}`;
    await removeExistingChannel(channelName);
    const roomChannel = supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });
    channelRef.current = roomChannel;
    
    setupRoomSignaling(roomChannel, stream, true);
    
    // Notify the partner globally via their user channel
    const userCallChannel = supabase.channel(`user_calls_${partner.id}`, {
      config: { broadcast: { self: false } }
    });
    userCallChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const callerName = currentUserProfile?.full_name || currentUser.user_metadata?.full_name || currentUser.email || 'Someone';
        const callerAvatar = currentUserProfile?.avatar_url || (currentUserProfile?.photos?.[0] || null);
        
        await userCallChannel.send({
          type: 'broadcast',
          event: 'incoming-call',
          payload: {
            matchId,
            callType: type,
            callerId: currentUser.id,
            callerName,
            callerAvatar
          }
        });
        supabase.removeChannel(userCallChannel);
      }
    });

    // Timeout if receiver does not answer
    callTimeoutRef.current = setTimeout(() => {
      alert("No answer from partner");
      handleHangup();
    }, 45000);
  };

  const joinCallAsReceiver = async (type: 'voice' | 'video') => {
    setCallType(type);
    setCallState('connecting');
    
    // Set up local media stream
    let stream: MediaStream;
    try {
      stream = await getUserMediaWithTimeout({
        audio: true,
        video: type === 'video'
      }, 8000);
      setLocalStream(stream);
    } catch (err: any) {
      console.warn("Media devices access warning:", err.name || err.message || err);
      alert("Could not access camera or microphone. Please check system permissions.");
      // Notify caller of hangup due to media permissions failure
      const channelName = `room_call_${matchId}`;
      const tempChannel = supabase.channel(channelName, {
        config: { broadcast: { self: false } }
      });
      tempChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await tempChannel.send({
            type: 'broadcast',
            event: 'hangup',
            payload: {}
          });
          supabase.removeChannel(tempChannel);
        }
      });
      handleHangup();
      return;
    }
    
    // Join room call channel
    const channelName = `room_call_${matchId}`;
    await removeExistingChannel(channelName);
    const roomChannel = supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });
    channelRef.current = roomChannel;
    
    setupRoomSignaling(roomChannel, stream, false);
  };

  const setupRoomSignaling = (roomChannel: any, localMediaStream: MediaStream, isCaller: boolean) => {
    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;
    (pc as any).candidateQueue = [];

    // Add local tracks to WebRTC connection
    localMediaStream.getTracks().forEach((track) => {
      pc.addTrack(track, localMediaStream);
    });

    // Send generated ICE candidates to peer
    pc.onicecandidate = (event) => {
      if (event.candidate && roomChannel) {
        roomChannel.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            candidate: event.candidate,
            isCaller
          }
        });
      }
    };

    // Receive remote tracks
    pc.ontrack = (event) => {
      console.log("WebRTC received track:", event.track.kind);
      setRemoteStream(prev => {
        if (prev) {
          if (prev.getTracks().find(t => t.id === event.track.id)) return prev;
          const newStream = new MediaStream(prev.getTracks());
          newStream.addTrack(event.track);
          return newStream;
        } else {
          return new MediaStream([event.track]);
        }
      });
      setCallState('active');
    };

    pc.onconnectionstatechange = () => {
      console.log("WebRTC Connection State changed to:", pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallState('active');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        handleHangup();
      }
    };

    // Subscribing to room events
    roomChannel
      .on('broadcast', { event: 'peer-joined' }, async () => {
        console.log("Callee accepted and joined the channel");
        if (isCaller) {
          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
          }
          if (ringbackCleanupRef.current) {
            ringbackCleanupRef.current();
            ringbackCleanupRef.current = null;
          }
          setCallState('connecting');

          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            roomChannel.send({
              type: 'broadcast',
              event: 'sdp-offer',
              payload: { offer }
            });
          } catch (err) {
            console.error("Failed to create offer:", err);
            handleHangup();
          }
        }
      })
      .on('broadcast', { event: 'sdp-offer' }, async ({ payload }: any) => {
        console.log("Received SDP Offer from Caller");
        if (!isCaller) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
            
            // Apply any candidate that arrived early
            const queue = (pc as any).candidateQueue;
            if (queue && queue.length > 0) {
              for (const candidate of queue) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error setting early candidate:", e));
              }
              (pc as any).candidateQueue = [];
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            roomChannel.send({
              type: 'broadcast',
              event: 'sdp-answer',
              payload: { answer }
            });
          } catch (err) {
            console.error("Failed to handle offer or create answer:", err);
            handleHangup();
          }
        }
      })
      .on('broadcast', { event: 'sdp-answer' }, async ({ payload }: any) => {
        console.log("Received SDP Answer from Callee");
        if (isCaller) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
            
            // Apply any candidate that arrived early
            const queue = (pc as any).candidateQueue;
            if (queue && queue.length > 0) {
              for (const candidate of queue) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error setting early candidate:", e));
              }
              (pc as any).candidateQueue = [];
            }
          } catch (err) {
            console.error("Failed to set remote description for answer:", err);
            handleHangup();
          }
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }: any) => {
        if (payload.isCaller !== isCaller) {
          const candidate = payload.candidate;
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding candidate:", e));
          } else {
            (pc as any).candidateQueue.push(candidate);
          }
        }
      })
      .on('broadcast', { event: 'call-declined' }, () => {
        console.log("Caller channel received declination");
        if (ringbackCleanupRef.current) {
          ringbackCleanupRef.current();
          ringbackCleanupRef.current = null;
        }
        playDeclineTone();
        handleHangup();
      })
      .on('broadcast', { event: 'hangup' }, () => {
        console.log("Received hangup request from peer");
        handleHangup();
      });

    roomChannel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        if (!isCaller) {
          console.log("Callee subscribed, sending peer-joined signal");
          // Small delay to make sure caller is ready to receive
          setTimeout(async () => {
            try {
              await roomChannel.send({
                type: 'broadcast',
                event: 'peer-joined',
                payload: {}
              });
            } catch (err) {
              console.error("Error sending peer-joined signal:", err);
            }
          }, 500);
        } else {
          console.log("Caller subscribed. Awaiting peer-joined signal...");
        }
      }
    });
  };

  const handleHangup = () => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    if (ringbackCleanupRef.current) {
      ringbackCleanupRef.current();
      ringbackCleanupRef.current = null;
    }

    // Send hangup event in room calling channel if active
    if (channelRef.current) {
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'hangup',
          payload: {}
        });
      } catch (e) {}
    }

    if (partner && currentUser && callState === 'outgoing') {
      // Notify partner's global channel to hide their incoming call modal
      const globalCallChannel = supabase.channel(`user_calls_${partner.id}`, {
        config: { broadcast: { self: false } }
      });
      globalCallChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await globalCallChannel.send({
            type: 'broadcast',
            event: 'call-ended',
            payload: {}
          });
          supabase.removeChannel(globalCallChannel);
        }
      });
    }

    // Close and stop everything
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setRemoteStream(null);
    setCallState('ended');
    setMicMuted(false);
    setCameraOff(false);

    setTimeout(() => {
      setCallState('idle');
      setCallType(null);
      router.replace(`/chat/${matchId}`);
    }, 1500);
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = micMuted;
        setMicMuted(!micMuted);
      }
    }
  };

  const toggleCamera = () => {
    if (localStream && callType === 'video') {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = cameraOff;
        setCameraOff(!cameraOff);
      }
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !currentUser || !conversationId) return;
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
      setUploadingPhoto(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `chats/${conversationId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
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

      const newMessage = {
        conversation_id: conversationId,
        sender_id: currentUser.id,
        content: "📷 Sent a photo",
        message_type: "image",
        media_url: publicUrl
      };

      const { error } = await supabase.from('messages').insert(newMessage);
      if (error) throw error;
      
    } catch (err: any) {
      console.error("Error uploading photo:", err);
      alert(err.message || 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentUser || !conversationId) return;

    // Reset local typing indicator immediately upon sending
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (localTypingRef.current && chatChannelRef.current) {
      localTypingRef.current = false;
      chatChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUser.id, isTyping: false }
      });
    }

    const newMessage = {
      conversation_id: conversationId,
      sender_id: currentUser.id,
      content: input,
    };

    const { error } = await supabase.from('messages').insert(newMessage);

    if (error) {
      console.error("Error sending message:", error);
    } else {
      setInput('');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const partnerPhoto = partner?.photos?.[0] || partner?.avatar_url;

  return (
    <div className={styles.page}>
      <TopBar />
      <main className={styles.main}>
        <div className={styles.chatContainer}>
          <header className={styles.chatHeader}>
            <div className={styles.userInfo}>
              <Link href="/chat" className={styles.backBtn} title="Back to matches">
                ←
              </Link>
              <div className={styles.avatar}>
                {partnerPhoto ? (
                  <img src={partnerPhoto} alt={partner?.full_name} />
                ) : (
                  partner?.full_name?.[0] || '?'
                )}
              </div>
              <div className={styles.headerText}>
                <h3 className={styles.partnerName}>{partner?.full_name || 'Loading...'}</h3>
                {isPartnerTyping ? (
                  <span className={styles.typingStatus}>typing...</span>
                ) : (
                  <span className={styles.status}>
                    <span className={styles.statusDot}></span>
                    Online
                  </span>
                )}
              </div>
            </div>
            <div className={styles.headerActions}>
              <button title="Voice Call" onClick={() => initiateCall('voice')}>📞</button>
              <button title="Video Call" onClick={() => initiateCall('video')}>🎥</button>
              <button title="Menu">⋮</button>
            </div>
          </header>

          <div className={styles.messageList} ref={scrollRef}>
            {messages.map((m) => (
              <div key={m.id} className={`${styles.message} ${m.sender_id === currentUser?.id ? styles.sent : styles.received}`}>
                <div className={`${styles.bubble} ${m.message_type === 'image' ? styles.imageBubble : ''}`}>
                  {m.message_type === 'image' ? (
                    <div className={styles.imageWrapper}>
                      <img 
                        src={m.media_url} 
                        alt="Shared Polaroid" 
                        className={styles.sharedImage} 
                        onClick={() => window.open(m.media_url, '_blank')}
                      />
                    </div>
                  ) : (
                    m.content
                  )}
                  <span className={styles.time}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {m.sender_id === currentUser?.id && (
                      <span 
                        className={styles.ticks} 
                        data-status={m.status || 'sent'}
                      >
                        {m.status === 'read' ? ' ✓✓' : ' ✓'}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <form className={styles.composer} onSubmit={sendMessage}>
            <button 
              type="button" 
              className={styles.composerBtn} 
              onClick={() => document.getElementById('chat-photo-upload')?.click()}
              disabled={uploadingPhoto}
              title="Share photo"
            >
              {uploadingPhoto ? '⏳' : '📷'}
            </button>
            <input 
              id="chat-photo-upload"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoUpload}
            />
            <input 
              type="text" 
              placeholder="Type a romantic message..." 
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                handleTyping();
              }}
              className={styles.composerInput}
              disabled={uploadingPhoto}
            />
            <button type="submit" className={styles.sendBtn} disabled={uploadingPhoto}>Send</button>
          </form>
        </div>
      </main>

      {/* Fullscreen Call Interface Overlay */}
      {callState !== 'idle' && (
        <div className={styles.callContainer}>
          {callType === 'video' ? (
            <div className={styles.videoCallGrid}>
              {/* Remote Video (Fullscreen) */}
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className={styles.remoteVideo}
              />
              
              {/* Local Video PIP Overlay */}
              <div className={styles.localVideoContainer}>
                {cameraOff ? (
                  <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', background: '#333', fontSize: '1.5rem' }}>
                    🚫
                  </div>
                ) : (
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className={styles.localVideo}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className={styles.voiceCallInterface}>
              <div className={styles.voiceAvatarContainer}>
                {callState === 'active' && <div className={styles.voiceAvatarPulse} />}
                <div className={styles.voiceAvatar}>
                  {partnerPhoto ? (
                    <img src={partnerPhoto} alt={partner?.full_name} />
                  ) : (
                    partner?.full_name?.[0] || '?'
                  )}
                </div>
              </div>
              <div className={styles.callInfoText}>
                <h2>{partner?.full_name}</h2>
                <p className={styles.callStatusLabel}>
                  {callState === 'outgoing' && 'Calling...'}
                  {callState === 'connecting' && 'Connecting...'}
                  {callState === 'active' && `Active: ${formatDuration(callDuration)}`}
                  {callState === 'ended' && 'Call Ended'}
                </p>
              </div>
              <audio ref={remoteAudioRef} autoPlay />
            </div>
          )}

          {/* Media Control Bar */}
          {callState !== 'ended' && (
            <div className={styles.callControls}>
              <button 
                onClick={toggleMute} 
                className={`${styles.controlBtn} ${micMuted ? styles.controlBtnActive : ''}`}
                title={micMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {micMuted ? '🔇' : '🎙️'}
              </button>
              
              {callType === 'video' && (
                <button 
                  onClick={toggleCamera} 
                  className={`${styles.controlBtn} ${cameraOff ? styles.controlBtnActive : ''}`}
                  title={cameraOff ? "Turn Camera On" : "Turn Camera Off"}
                >
                  {cameraOff ? '🚫' : '📹'}
                </button>
              )}
              
              <button 
                onClick={handleHangup} 
                className={`${styles.controlBtn} ${styles.hangupBtn}`}
                title="Hang Up"
              >
                📞
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

