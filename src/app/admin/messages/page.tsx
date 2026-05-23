"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '../layout';
import styles from './Messages.module.css';

interface FlaggedMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  recipient_name: string;
  content: string;
  flag_reason: string;
  created_at: string;
  is_removed: boolean;
  status: 'pending' | 'dismissed' | 'resolved';
}

interface ContextMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

export default function FlaggedMessages() {
  const { admin, addAuditLog } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [flaggedMsgs, setFlaggedMsgs] = useState<FlaggedMessage[]>([]);
  const [filteredMsgs, setFilteredUsers] = useState<FlaggedMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');

  // Preview Drawer
  const [selectedMsg, setSelectedMsg] = useState<FlaggedMessage | null>(null);
  const [context, setContext] = useState<ContextMessage[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [actionNotes, setActionNotes] = useState('');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const scanMessagesForFlags = async () => {
    setLoading(true);
    try {
      // 1. Fetch blocklist from settings or fall back to default
      const { data: psData } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('key', 'moderation')
        .maybeSingle();

      const blocklist: string[] = psData?.value?.keyword_blocklist || 
        ["scam", "money", "paytm", "gpay", "whatsapp", "sugar", "hookup"];

      // 2. Fetch recent messages
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          is_deleted,
          created_at,
          conversations:conversation_id (
            user_1:user_1_id(id, full_name),
            user_2:user_2_id(id, full_name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // 3. Regex checkers
      const phoneRegex = /(\+?\d{1,4}[-.\s]??)?(\d{10}|\d{3}[-.\s]??\d{3}[-.\s]??\d{4})/;
      const urlRegex = /(https?:\/\/[^\s]+)/;

      // 4. Scan and filter messages client-side
      const flagged: FlaggedMessage[] = [];

      (messages || []).forEach((m: any) => {
        if (m.is_deleted || m.content.startsWith('[This message')) return;

        let flagReason = '';
        const text = m.content.toLowerCase();

        // Check keyword blocklist
        const matchedKeyword = blocklist.find(kw => text.includes(kw.toLowerCase()));
        
        if (matchedKeyword) {
          flagReason = `Keyword blocklist: "${matchedKeyword}"`;
        } else if (phoneRegex.test(m.content)) {
          flagReason = 'Contains Phone Number';
        } else if (urlRegex.test(m.content)) {
          flagReason = 'Contains External Link';
        }

        if (flagReason) {
          const conv = m.conversations || {};
          const u1 = conv.user_1 || {};
          const u2 = conv.user_2 || {};
          
          const senderName = m.sender_id === u1.id ? u1.full_name : u2.full_name;
          const recipientName = m.sender_id === u1.id ? u2.full_name : u1.full_name;

          flagged.push({
            id: m.id,
            conversation_id: m.conversation_id,
            sender_id: m.sender_id,
            sender_name: senderName || 'Sender',
            recipient_name: recipientName || 'Recipient',
            content: m.content,
            flag_reason: flagReason,
            created_at: m.created_at,
            is_removed: false,
            status: 'pending' // managed client side for session / could read database audit to sync
          });
        }
      });

      setFlaggedMsgs(flagged);
    } catch (e) {
      console.error('Error scanning flagged messages:', e);
      triggerToast('Error loading flagged messages.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scanMessagesForFlags();
  }, []);

  // Filter messages
  useEffect(() => {
    let result = [...flaggedMsgs];

    // Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => 
        m.sender_name.toLowerCase().includes(q) ||
        m.recipient_name.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q)
      );
    }

    // Reason filter
    if (reasonFilter !== 'all') {
      if (reasonFilter === 'phone') {
        result = result.filter(m => m.flag_reason === 'Contains Phone Number');
      } else if (reasonFilter === 'url') {
        result = result.filter(m => m.flag_reason === 'Contains External Link');
      } else if (reasonFilter === 'keyword') {
        result = result.filter(m => m.flag_reason.startsWith('Keyword blocklist'));
      }
    }

    setFilteredUsers(result);
  }, [flaggedMsgs, searchQuery, reasonFilter]);

  // Open inspection preview (fetches only immediate surrounding messages)
  const handleInspectMessage = async (msg: FlaggedMessage) => {
    setSelectedMsg(msg);
    setActionNotes('');
    setLoadingContext(true);
    setShowDrawer(true);

    try {
      // Fetch immediate surrounding messages for context
      // Fetch 3 messages before and 3 messages after by creation time
      const { data: messages } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          content,
          created_at,
          conversations:conversation_id (
            user_1:user_1_id(id, full_name),
            user_2:user_2_id(id, full_name)
          )
        `)
        .eq('conversation_id', msg.conversation_id)
        .order('created_at', { ascending: true });

      const formatted: ContextMessage[] = (messages || []).map((m: any) => {
        const u1 = m.conversations?.user_1 || {};
        const u2 = m.conversations?.user_2 || {};
        const senderName = m.sender_id === u1.id ? u1.full_name : u2.full_name;

        return {
          id: m.id,
          sender_id: m.sender_id,
          sender_name: senderName || 'User',
          content: m.content,
          created_at: m.created_at
        };
      });

      // Filter context to only show flagged message and 2 before, 2 after
      const index = formatted.findIndex(x => x.id === msg.id);
      if (index !== -1) {
        const start = Math.max(0, index - 2);
        const end = Math.min(formatted.length, index + 3);
        setContext(formatted.slice(start, end));
      } else {
        setContext([
          { id: msg.id, sender_id: msg.sender_id, sender_name: msg.sender_name, content: msg.content, created_at: msg.created_at }
        ]);
      }
    } catch (e) {
      console.error('Error fetching message context:', e);
    } finally {
      setLoadingContext(false);
    }
  };

  // Dismiss Flag
  const handleDismissFlag = async () => {
    if (!selectedMsg) return;
    try {
      // For this session, mark resolved local state
      setFlaggedMsgs(prev => prev.filter(x => x.id !== selectedMsg.id));
      await addAuditLog('DISMISS_FLAGGED_MESSAGE', selectedMsg.sender_id, selectedMsg.sender_name, `Dismissed flagged message violation: "${selectedMsg.content}"`);
      triggerToast('Flag dismissed successfully.', 'success');
      setShowDrawer(false);
      setSelectedMsg(null);
    } catch (e) {}
  };

  // Remove the specific message content
  const handleRemoveMessage = async () => {
    if (!selectedMsg || !admin) return;

    if (actionNotes.trim().length < 10) {
      triggerToast('Please provide a reason note (min 10 characters).', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('messages')
        .update({
          content: '[This message was removed by the administrator due to community guideline violations]',
          is_deleted: true
        })
        .eq('id', selectedMsg.id);

      if (error) throw error;

      await addAuditLog(
        'REMOVE_FLAGGED_MESSAGE',
        selectedMsg.sender_id,
        selectedMsg.sender_name,
        `Removed message content due to guideline violation. Reason: ${actionNotes}`
      );

      triggerToast('Message removed successfully.', 'success');
      setShowDrawer(false);
      setSelectedMsg(null);
      scanMessagesForFlags(); // refresh
    } catch (e) {
      console.error('Failed to remove message:', e);
      triggerToast('Failed to remove message.', 'error');
    }
  };

  // Warn Sender
  const handleWarnSender = async () => {
    if (!selectedMsg || !admin) return;

    if (actionNotes.trim().length < 10) {
      triggerToast('Please provide a warning description note (min 10 characters).', 'error');
      return;
    }

    try {
      // Send warning notification
      await supabase.from('notifications').insert({
        user_id: selectedMsg.sender_id,
        type: 'system',
        title: 'Community Warning ⚠️',
        body: `Your message was flagged: "${actionNotes}". Please refrain from violating rules.`
      });

      await addAuditLog(
        'WARN_MESSAGE_SENDER',
        selectedMsg.sender_id,
        selectedMsg.sender_name,
        `Issued warning to sender due to flagged message content. Notes: ${actionNotes}`
      );

      triggerToast('Warning notification sent to sender.', 'success');
      setShowDrawer(false);
      setSelectedMsg(null);
    } catch (e) {
      console.error('Failed to warn sender:', e);
    }
  };

  // Suspend Sender
  const handleSuspendSender = async () => {
    if (!selectedMsg || !admin) return;

    if (actionNotes.trim().length < 10) {
      triggerToast('Please write a suspension reason note.', 'error');
      return;
    }

    try {
      // Suspend profile
      await supabase.from('profiles').update({
        is_active: false,
        rejection_reason: `Suspended for message violation. Detail: ${actionNotes}`
      }).eq('id', selectedMsg.sender_id);

      // Notification
      await supabase.from('notifications').insert({
        user_id: selectedMsg.sender_id,
        type: 'system',
        title: 'Account Suspended ✗',
        body: `Your account is temporarily suspended due to chat violations: "${actionNotes}"`
      });

      await addAuditLog(
        'SUSPEND_MESSAGE_SENDER',
        selectedMsg.sender_id,
        selectedMsg.sender_name,
        `Suspended account for message guideline violation. Reason: ${actionNotes}`
      );

      triggerToast('User suspended successfully.', 'success');
      setShowDrawer(false);
      setSelectedMsg(null);
      scanMessagesForFlags();
    } catch (e) {
      console.error('Suspension failed:', e);
    }
  };

  return (
    <div className={styles.container}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          {toast.message}
        </div>
      )}

      <header className={styles.header}>
        <h1 className="headline-lg">Flagged Messages</h1>
        <p className="body-md">Review chat messages flagged by automatic moderation triggers.</p>
      </header>

      {/* Filter and Search Bar */}
      <div className={styles.filterBar}>
        <div className={styles.tabs}>
          {[
            { id: 'all', label: 'All Flagged' },
            { id: 'phone', label: 'Phone Numbers' },
            { id: 'url', label: 'External URLs' },
            { id: 'keyword', label: 'Keyword Blocklist' }
          ].map(tab => (
            <button
              key={tab.id}
              className={`${styles.tabBtn} ${reasonFilter === tab.id ? styles.activeTab : ''}`}
              onClick={() => setReasonFilter(tab.id as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          className={styles.searchBar}
          placeholder="Search by sender, recipient, message..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Table grid listing flagged messages */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>Scanning messages for triggers...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Sender</th>
                <th>Recipient</th>
                <th>Message Content</th>
                <th>Trigger Reason</th>
                <th>Timestamp</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredMsgs.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyTable}>No flagged messages found.</td>
                </tr>
              ) : (
                filteredMsgs.map((msg) => (
                  <tr key={msg.id} className={styles.tableRow} onClick={() => handleInspectMessage(msg)}>
                    <td><b>{msg.sender_name}</b></td>
                    <td>{msg.recipient_name}</td>
                    <td className={styles.messageCell}>"{msg.content}"</td>
                    <td>
                      <span className={styles.reasonBadge}>{msg.flag_reason}</span>
                    </td>
                    <td>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <button className={styles.inspectBtn} onClick={() => handleInspectMessage(msg)}>
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Inspection Context Drawer */}
      {showDrawer && selectedMsg && (
        <div className={styles.drawerOverlay}>
          <div className={styles.drawer}>
            <header className={styles.drawerHeader}>
              <div className={styles.drawerTitleRow}>
                <h2>Flagged Message Context Previews</h2>
                <span className={styles.reasonBadge}>{selectedMsg.flag_reason}</span>
              </div>
              <button className={styles.closeDrawerBtn} onClick={() => setShowDrawer(false)}>✕</button>
            </header>

            <div className={styles.drawerContent}>
              {/* Context Preview bubble lists */}
              <div className={styles.contextArea}>
                <h4>Conversation Excerpt</h4>
                <p className={styles.contextHint}>Only showing the flagged message and 2 immediate messages before/after for privacy.</p>
                
                <div className={styles.chatBubbles}>
                  {loadingContext ? (
                    <div className={styles.loading}>Fetching surrounding messages...</div>
                  ) : (
                    context.map(c => {
                      const isFlagged = c.id === selectedMsg.id;
                      const isSender = c.sender_id === selectedMsg.sender_id;
                      return (
                        <div key={c.id} className={`${styles.bubbleWrapper} ${isSender ? styles.senderSide : styles.recipientSide}`}>
                          <div className={styles.bubbleAuthor}>{c.sender_name}</div>
                          <div className={`${styles.bubble} ${isFlagged ? styles.flaggedBubble : ''}`}>
                            {c.content}
                          </div>
                          <div className={styles.bubbleTime}>{new Date(c.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Action sidebar controls */}
              <div className={styles.moderationArea}>
                <h4>Moderation Panel</h4>
                
                <div className={styles.formGroup}>
                  <label className={styles.label}>Audit notes / warning text (Min 10 characters) *</label>
                  <textarea
                    placeholder="Provide details on warning triggers or reasons for removing this message..."
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    className={styles.textarea}
                    rows={4}
                    required
                  />
                </div>

                <div className={styles.buttonsList}>
                  <button className={styles.btnDismiss} onClick={handleDismissFlag}>
                    Dismiss Flag (No violation)
                  </button>
                  <button className={styles.btnWarn} onClick={handleWarnSender} disabled={actionNotes.trim().length < 10}>
                    Warn Message Sender
                  </button>
                  <button className={styles.btnRemove} onClick={handleRemoveMessage} disabled={actionNotes.trim().length < 10}>
                    Delete Specific Message
                  </button>
                  <button className={styles.btnSuspend} onClick={handleSuspendSender} disabled={actionNotes.trim().length < 10}>
                    Suspend Sender Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
