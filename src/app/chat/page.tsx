"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { supabase } from '@/lib/supabase';
import styles from './ChatList.module.css';

export default function ChatListPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    let active = true;
    let channel: any = null;

    const fetchConversations = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      if (active) {
        setCurrentUser(user);
      }

      // Fetch conversations which holds the last message, unread status, and profile info
      const { data: convData, error } = await supabase
        .from('conversations')
        .select(`
          id,
          match_id,
          last_message_text,
          last_message_at,
          last_message_by,
          user_1_id,
          user_2_id,
          user_1_unread_count,
          user_2_unread_count,
          user1:profiles!conversations_user_1_id_fkey(*),
          user2:profiles!conversations_user_2_id_fkey(*)
        `)
        .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`);

      if (error) {
        console.error("Error fetching conversations:", error);
        if (active) setLoading(false);
        return;
      }

      const formatted = (convData || []).map((c: any) => {
        const isUser1 = c.user_1_id === user.id;
        const partner = isUser1 ? c.user2 : c.user1;
        const unreadCount = isUser1 ? c.user_1_unread_count : c.user_2_unread_count;
        return {
          id: c.match_id, // Match ID is used for routing /chat/[id]
          conversationId: c.id,
          partner: partner,
          lastMessage: c.last_message_text || "Tap to start chatting...",
          lastMessageAt: c.last_message_at,
          lastMessageBy: c.last_message_by,
          unreadCount: unreadCount || 0
        };
      });

      // Sort: conversations with messages first, ordered by newer lastMessageAt
      formatted.sort((a: any, b: any) => {
        if (!a.lastMessageAt && !b.lastMessageAt) return 0;
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });

      if (active) {
        setMatches(formatted);
        setLoading(false);
      }
    };

    fetchConversations();

    // Subscribe to updates in conversations so lists update automatically
    channel = supabase
      .channel('chat-list-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations'
      }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => {
      active = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [router]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic', color: 'var(--primary)' }}>
          Loading your conversations...
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <TopBar />
      <main className={styles.main}>
        <div className={styles.titleContainer}>
          <h1 className={styles.title}>Your Matches</h1>
          <span className={styles.annotation}>Suti suti kotha...</span>
        </div>
        <div className={styles.divider}></div>

        <div className={styles.matchList}>
          {matches.length > 0 ? matches.map((match) => {
            const partnerPhoto = match.partner?.photos?.[0] || match.partner?.avatar_url;
            return (
              <div 
                key={match.id} 
                className={styles.matchItem}
                onClick={() => router.push(`/chat/${match.id}`)}
              >
                <div className={styles.avatarContainer}>
                  <div className={styles.avatar}>
                    {partnerPhoto ? (
                      <img src={partnerPhoto} alt={match.partner?.full_name} />
                    ) : (
                      match.partner?.full_name?.[0] || '?'
                    )}
                  </div>
                  <div className={styles.activeDot}></div>
                </div>
                <div className={styles.info}>
                  <h3 className={styles.partnerName}>{match.partner?.full_name}</h3>
                  <p className={`${styles.lastMessage} ${match.unreadCount > 0 ? styles.unreadText : ''}`}>
                    {match.lastMessageBy === currentUser?.id ? 'You: ' : ''}
                    {match.lastMessage}
                  </p>
                </div>
                <div className={styles.meta}>
                  {match.lastMessageAt ? (
                    <span className={styles.time}>{formatTime(match.lastMessageAt)}</span>
                  ) : (
                    <span className={styles.time}>Match</span>
                  )}
                  {match.unreadCount > 0 ? (
                    <span className={styles.unreadBadge}>{match.unreadCount}</span>
                  ) : (
                    <span className={styles.arrow}>→</span>
                  )}
                </div>
              </div>
            );
          }) : (
            <div className={styles.empty}>
              <div className={styles.teaCup}>☕</div>
              <p className={styles.emptyText}>No matches yet</p>
              <p className={styles.emptySubtext}>
                Go to discover to find your campus love and share a cup of tea!
              </p>
              <button className={styles.discoverBtn} onClick={() => router.push('/discover')}>
                Start Discovering
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

