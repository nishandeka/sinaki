"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { supabase } from '@/lib/supabase';
import styles from './ChatList.module.css';

export default function ChatListPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: matchData } = await supabase
        .from('matches')
        .select(`
          *,
          user1:profiles!matches_user_1_id_fkey(*),
          user2:profiles!matches_user_2_id_fkey(*)
        `)
        .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`);
      
      const formattedMatches = (matchData || []).map(m => {
        const partner = m.user_1_id === user.id ? m.user2 : m.user1;
        return {
          id: m.id,
          partner: partner,
          lastMessage: "Tap to start chatting..."
        };
      });
      setMatches(formattedMatches);
      setLoading(false);
    };

    fetchMatches();
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
            const partnerPhoto = match.partner.photos?.[0] || match.partner.avatar_url;
            return (
              <div 
                key={match.id} 
                className={styles.matchItem}
                onClick={() => router.push(`/chat/${match.id}`)}
              >
                <div className={styles.avatarContainer}>
                  <div className={styles.avatar}>
                    {partnerPhoto ? (
                      <img src={partnerPhoto} alt={match.partner.full_name} />
                    ) : (
                      match.partner.full_name?.[0] || '?'
                    )}
                  </div>
                  <div className={styles.activeDot}></div>
                </div>
                <div className={styles.info}>
                  <h3 className={styles.partnerName}>{match.partner.full_name}</h3>
                  <p className={styles.lastMessage}>{match.lastMessage}</p>
                </div>
                <div className={styles.meta}>
                  <span className={styles.arrow}>→</span>
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

