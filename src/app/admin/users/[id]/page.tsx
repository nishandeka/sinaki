"use client";

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '../../layout';
import styles from './UserDetail.module.css';

interface UserProfile {
  id: string;
  full_name: string;
  display_name: string;
  gender: string;
  date_of_birth: string;
  phone: string;
  district: string;
  city_town: string;
  pin_code: string;
  community: string;
  religion: string;
  mother_tongue: string;
  speaks_languages: string[];
  bio: string;
  height_cm: number;
  body_type: string;
  education: string;
  occupation: string;
  workplace: string;
  smoking: boolean;
  drinking: boolean;
  diet: string;
  looking_for: string;
  avatar_url: string;
  photos: string[];
  verification_status: string;
  id_card_url: string;
  id_card_type: string;
  rejection_reason: string;
  interested_in: string;
  preferred_age_min: number;
  preferred_age_max: number;
  preferred_districts: string[];
  is_active: boolean;
  is_profile_complete: boolean;
  created_at: string;
  last_seen: string;
}

interface MatchItem {
  id: string;
  matchedWithName: string;
  matchedWithAvatar: string;
  matchedAt: string;
  status: string;
  compatibilityScore: number;
}

interface SwapItem {
  id: string;
  targetName: string;
  action: 'like' | 'pass' | 'superlike';
  timestamp: string;
}

interface AdminNote {
  id: string;
  admin_email: string;
  note: string;
  created_at: string;
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: userId } = use(params);
  const { admin, addAuditLog } = useAdminAuth();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'photos' | 'matches' | 'activity' | 'actions' | 'notes'>('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [swipes, setSwipes] = useState<SwapItem[]>([]);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [newNote, setNewNote] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [noteSaving, setNoteSaving] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [suspensionDays, setSuspensionDays] = useState('7');
  
  // Modals and Toasts
  const [showConfirmModal, setShowConfirmModal] = useState<'warn' | 'suspend' | 'ban' | 'delete' | 'restore' | 'reverify' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchProfileDetails = async () => {
    setLoading(true);
    try {
      // 1. Fetch Profile
      const { data: pData, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (pError || !pData) {
        triggerToast('Failed to load user profile.', 'error');
        setLoading(false);
        return;
      }
      setProfile(pData as UserProfile);

      // 2. Fetch Matches
      const { data: mData } = await supabase
        .from('matches')
        .select(`
          id,
          matched_at,
          status,
          compatibility_score,
          user_1:user_1_id(id, full_name, avatar_url),
          user_2:user_2_id(id, full_name, avatar_url)
        `)
        .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`);

      const formattedMatches: MatchItem[] = (mData || []).map((m: any) => {
        const otherUser = m.user_1.id === userId ? m.user_2 : m.user_1;
        return {
          id: m.id,
          matchedWithName: otherUser.full_name || 'Anonymous Match',
          matchedWithAvatar: otherUser.avatar_url || '',
          matchedAt: new Date(m.matched_at).toLocaleDateString(),
          status: m.status || 'accepted',
          compatibilityScore: Math.round(m.compatibility_score || 75)
        };
      });
      setMatches(formattedMatches);

      // 3. Fetch Swipes (Likes and Passes)
      const { data: likesData } = await supabase
        .from('likes')
        .select('id, created_at, is_super_like, liked:liked_id(full_name)')
        .eq('liker_id', userId);

      const { data: passesData } = await supabase
        .from('passes')
        .select('id, created_at, passed:passed_id(full_name)')
        .eq('passer_id', userId);

      const formattedSwipes: SwapItem[] = [];
      (likesData || []).forEach((l: any) => {
        formattedSwipes.push({
          id: l.id,
          targetName: l.liked?.full_name || 'User',
          action: l.is_super_like ? 'superlike' : 'like',
          timestamp: new Date(l.created_at).toLocaleString()
        });
      });
      (passesData || []).forEach((p: any) => {
        formattedSwipes.push({
          id: p.id,
          targetName: p.passed?.full_name || 'User',
          action: 'pass',
          timestamp: new Date(p.created_at).toLocaleString()
        });
      });
      formattedSwipes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setSwipes(formattedSwipes);

      // 4. Fetch Admin CRM Notes
      const { data: notesData } = await supabase
        .from('admin_notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      setNotes(notesData || []);

    } catch (e) {
      console.error('Error loading CRM details:', e);
      triggerToast('Error fetching details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileDetails();
  }, [userId]);

  // Add CRM note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newNote.trim() === '' || !admin) return;

    setNoteSaving(true);
    try {
      const { error } = await supabase
        .from('admin_notes')
        .insert({
          user_id: userId,
          admin_email: admin.email,
          note: newNote
        });

      if (error) throw error;

      await addAuditLog('ADD_CRM_NOTE', userId, profile?.full_name, `Added internal CRM note`);
      setNewNote('');
      fetchProfileDetails();
      triggerToast('Note added successfully.', 'success');
    } catch (e) {
      console.error('Add note failed:', e);
      triggerToast('Failed to add note.', 'error');
    } finally {
      setNoteSaving(false);
    }
  };

  // Remove specific photo from user's gallery
  const handleRemovePhoto = async (photoUrl: string) => {
    if (!profile) return;
    try {
      const updatedPhotos = profile.photos.filter(url => url !== photoUrl);
      const { error } = await supabase
        .from('profiles')
        .update({ photos: updatedPhotos })
        .eq('id', userId);

      if (error) throw error;

      await addAuditLog('REMOVE_USER_PHOTO', userId, profile.full_name, `Removed photo: ${photoUrl}`);
      triggerToast('Photo removed successfully.', 'success');
      fetchProfileDetails();
    } catch (e) {
      console.error('Remove photo failed:', e);
      triggerToast('Failed to remove photo.', 'error');
    }
  };

  // Disciplinary Actions Execution
  const handleExecuteAction = async () => {
    if (!profile || !admin || !showConfirmModal) return;

    if (actionNotes.trim().length < 10) {
      triggerToast('Action notes must be at least 10 characters.', 'error');
      return;
    }

    try {
      const action = showConfirmModal;
      let updateFields = {};
      let auditMsg = '';
      let notifTitle = '';
      let notifBody = '';

      if (action === 'warn') {
        auditMsg = `Sent account warning: ${actionNotes}`;
        notifTitle = 'Account Warning ⚠️';
        notifBody = `Your account received an administrative warning: "${actionNotes}". Please review guidelines.`;
      } else if (action === 'reverify') {
        updateFields = { verification_status: 'pending' };
        auditMsg = `Forced identity re-verification. Details: ${actionNotes}`;
        notifTitle = 'Re-verification Required';
        notifBody = `An admin has requested identity re-verification. Reason: "${actionNotes}". Please re-upload documents.`;
      } else if (action === 'suspend') {
        updateFields = { is_active: false, rejection_reason: `Suspended: ${actionNotes}` };
        auditMsg = `Suspended user for ${suspensionDays} days. Reason: ${actionNotes}`;
        notifTitle = 'Account Suspended ✗';
        notifBody = `Your account has been suspended for ${suspensionDays} days. Reason: ${actionNotes}`;
      } else if (action === 'ban') {
        updateFields = { is_active: false, rejection_reason: `Banned: ${actionNotes}` };
        auditMsg = `Permanently banned account. Reason: ${actionNotes}`;
        notifTitle = 'Account Banned Permanently';
        notifBody = 'Your account has been permanently disabled due to community guideline violations.';
      } else if (action === 'restore') {
        updateFields = { is_active: true, rejection_reason: null };
        auditMsg = `Restored suspended/banned account. Reason: ${actionNotes}`;
        notifTitle = 'Account Restored ✓';
        notifBody = 'Congratulations! Your account has been restored. You can log in normally.';
      } else if (action === 'delete') {
        if (admin.role !== 'super_admin') {
          triggerToast('Delete permission denied.', 'error');
          return;
        }

        // Delete from DB profiles
        const { error: delError } = await supabase.from('profiles').delete().eq('id', userId);
        if (delError) throw delError;

        await addAuditLog('DELETE_USER_PERMANENTLY', userId, profile.full_name, `Permanently deleted user account. Notes: ${actionNotes}`);
        triggerToast('User permanently deleted.', 'success');
        router.push('/admin/users');
        return;
      }

      // Apply changes
      if (Object.keys(updateFields).length > 0) {
        const { error } = await supabase.from('profiles').update(updateFields).eq('id', userId);
        if (error) throw error;
      }

      // Create Notification
      if (notifTitle) {
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'system',
          title: notifTitle,
          body: notifBody
        });
      }

      // Create Audit Log
      await addAuditLog(`USER_DISCIPLINE_${action.toUpperCase()}`, userId, profile.full_name, auditMsg);
      
      triggerToast('Action completed successfully.', 'success');
      setShowConfirmModal(null);
      setActionNotes('');
      fetchProfileDetails();
    } catch (e) {
      console.error('Moderation action failed:', e);
      triggerToast('Action execution failed.', 'error');
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading user CRM file...</div>;
  }

  if (!profile) {
    return <div className={styles.error}>User not found.</div>;
  }

  return (
    <div className={styles.container}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          {toast.message}
        </div>
      )}

      {/* User Header Summary Card */}
      <header className={styles.profileHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.avatarMain}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} onError={(e) => { (e.target as any).src = ''; }} />
            ) : (
              profile.full_name.substring(0, 2).toUpperCase()
            )}
          </div>
          <div className={styles.headerInfo}>
            <div className={styles.nameRow}>
              <h1>{profile.full_name}</h1>
              <span className={`${styles.badge} ${
                profile.verification_status === 'verified' ? styles.badgeGreen :
                profile.verification_status === 'rejected' ? styles.badgeRed : styles.badgeAmber
              }`}>
                {profile.verification_status.toUpperCase()}
              </span>
              <span className={`${styles.statusLabel} ${profile.is_active ? styles.statusActive : styles.statusSuspended}`}>
                {profile.is_active ? 'Active' : 'Suspended/Banned'}
              </span>
            </div>
            <p className={styles.subtitle}>
              District: <b>{profile.district}</b> • Phone: <b>{profile.phone}</b> • Joined: {new Date(profile.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <button className={styles.backBtn} onClick={() => router.push('/admin/users')}>
          ← Back to Directory
        </button>
      </header>

      {/* CRM Tabs Nav */}
      <div className={styles.tabs}>
        {[
          { id: 'profile', label: 'User Profile' },
          { id: 'photos', label: `Gallery (${profile.photos.length})` },
          { id: 'matches', label: `Matches (${matches.length})` },
          { id: 'activity', label: `Swipe Activity (${swipes.length})` },
          { id: 'actions', label: 'Disciplinary Actions' },
          { id: 'notes', label: `Internal Notes (${notes.length})` }
        ].map(t => (
          <button
            key={t.id}
            className={`${styles.tabBtn} ${activeTab === t.id ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(t.id as any)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className={styles.panelContainer}>
        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className={styles.gridProfile}>
            {/* Left Block: Demographics */}
            <div className={styles.infoCard}>
              <h3>Demographics & Details</h3>
              <div className={styles.detailsList}>
                <div className={styles.row}><span>Display Name:</span><span>{profile.display_name}</span></div>
                <div className={styles.row}><span>Gender:</span><span className={styles.capitalize}>{profile.gender}</span></div>
                <div className={styles.row}><span>Date of Birth:</span><span>{profile.date_of_birth}</span></div>
                <div className={styles.row}><span>Community:</span><span className={styles.capitalize}>{profile.community.replace('_', ' ')}</span></div>
                <div className={styles.row}><span>Religion:</span><span className={styles.capitalize}>{profile.religion.replace('_', ' ')}</span></div>
                <div className={styles.row}><span>Mother Tongue:</span><span>{profile.mother_tongue}</span></div>
                <div className={styles.row}><span>Languages Spoken:</span><span>{profile.speaks_languages.join(', ')}</span></div>
                <div className={styles.row}><span>Lifestyle Diet:</span><span className={styles.capitalize}>{profile.diet || 'N/A'}</span></div>
                <div className={styles.row}><span>Smoking / Drinking:</span><span>{profile.smoking ? 'Yes' : 'No'} / {profile.drinking ? 'Yes' : 'No'}</span></div>
              </div>
            </div>

            {/* Right Block: Professional and Preferences */}
            <div className={styles.infoCard}>
              <h3>Education & Professional Bio</h3>
              <div className={styles.detailsList}>
                <div className={styles.row}><span>Height:</span><span>{profile.height_cm ? `${profile.height_cm} cm` : 'N/A'}</span></div>
                <div className={styles.row}><span>Body Type:</span><span className={styles.capitalize}>{profile.body_type.replace('_', ' ')}</span></div>
                <div className={styles.row}><span>Education:</span><span className={styles.capitalize}>{profile.education?.replace('_', ' ') || 'N/A'}</span></div>
                <div className={styles.row}><span>Occupation:</span><span>{profile.occupation || 'N/A'}</span></div>
                <div className={styles.row}><span>Workplace:</span><span>{profile.workplace || 'N/A'}</span></div>
                <div className={styles.row}><span>Looking For:</span><span>{profile.looking_for || 'N/A'}</span></div>
              </div>
              <div className={styles.bioBlock}>
                <h5>User Bio</h5>
                <p>"{profile.bio || 'Biography not filled.'}"</p>
              </div>
            </div>

            {/* Matching Preferences */}
            <div className={`${styles.infoCard} ${styles.fullWidth}`}>
              <h3>Partner Matching Preferences</h3>
              <div className={styles.detailsGrid}>
                <div className={styles.row}><span>Interested In:</span><span className={styles.capitalize}>{profile.interested_in}</span></div>
                <div className={styles.row}><span>Preferred Age Range:</span><span>{profile.preferred_age_min} - {profile.preferred_age_max} years</span></div>
                <div className={styles.row}><span>Preferred Districts:</span><span>{profile.preferred_districts ? profile.preferred_districts.join(', ') : 'All Assam'}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* PHOTOS TAB */}
        {activeTab === 'photos' && (
          <div className={styles.photoPanel}>
            <h3>User Gallery Moderation</h3>
            {profile.photos.length === 0 ? (
              <p className={styles.emptyText}>No photos uploaded by this user.</p>
            ) : (
              <div className={styles.photosGrid}>
                {profile.photos.map((photo, index) => (
                  <div key={index} className={styles.photoCard}>
                    <div className={styles.photoWrapper}>
                      <img src={photo} alt={`User Upload ${index + 1}`} />
                    </div>
                    <div className={styles.photoActions}>
                      <button className={styles.removePhotoBtn} onClick={() => handleRemovePhoto(photo)}>
                        🗑 Remove Photo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MATCHES TAB */}
        {activeTab === 'matches' && (
          <div className={styles.listPanel}>
            <h3>Matched Relationships Archive</h3>
            <table className={styles.subtable}>
              <thead>
                <tr>
                  <th>Matched Partner</th>
                  <th>Matched Date</th>
                  <th>Compatibility</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {matches.length === 0 ? (
                  <tr><td colSpan={4} className={styles.emptyText}>No matches established yet.</td></tr>
                ) : (
                  matches.map(m => (
                    <tr key={m.id}>
                      <td>
                        <div className={styles.partnerCell}>
                          <div className={styles.avatarMicro}>
                            {m.matchedWithAvatar ? <img src={m.matchedWithAvatar} alt="" /> : m.matchedWithName.substring(0,2).toUpperCase()}
                          </div>
                          <b>{m.matchedWithName}</b>
                        </div>
                      </td>
                      <td>{m.matchedAt}</td>
                      <td>
                        <span className={styles.score}>{m.compatibilityScore}% Score</span>
                      </td>
                      <td>
                        <span className={`${styles.statusLabel} ${m.status === 'accepted' ? styles.statusActive : styles.statusSuspended}`}>
                          {m.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <div className={styles.listPanel}>
            <h3>Likes and Passes Feed</h3>
            <table className={styles.subtable}>
              <thead>
                <tr>
                  <th>Recipient Target</th>
                  <th>Action Swiped</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {swipes.length === 0 ? (
                  <tr><td colSpan={3} className={styles.emptyText}>No swipe activities recorded.</td></tr>
                ) : (
                  swipes.map(s => (
                    <tr key={s.id}>
                      <td><b>{s.targetName}</b></td>
                      <td>
                        <span className={`${styles.badge} ${
                          s.action === 'like' ? styles.badgeGreen :
                          s.action === 'superlike' ? styles.badgeBlue : styles.badgeLow
                        }`}>
                          {s.action.toUpperCase()}
                        </span>
                      </td>
                      <td>{s.timestamp}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ACTIONS TAB */}
        {activeTab === 'actions' && (
          <div className={styles.actionsPanel}>
            <h3>Disciplinary Actions & Moderation</h3>
            <p className={styles.actionHint}>Select an action below to apply safety measures. All actions require notes.</p>
            
            <div className={styles.actionGrid}>
              {/* Warn */}
              <div className={styles.actionCardControl}>
                <h4>Send Warning Alert</h4>
                <p>Send an in-app system message cautioning the user against bad behaviors.</p>
                <button className={styles.warnBtn} onClick={() => setShowConfirmModal('warn')}>
                  Send Warning
                </button>
              </div>

              {/* Re-verify */}
              <div className={styles.actionCardControl}>
                <h4>Force ID Re-verification</h4>
                <p>Lock account capabilities and request they re-upload verification documents.</p>
                <button className={styles.reverifyBtn} onClick={() => setShowConfirmModal('reverify')}>
                  Force Re-verify
                </button>
              </div>

              {/* Suspend */}
              <div className={styles.actionCardControl}>
                <h4>Temporarily Suspend</h4>
                <p>Deactivate account and block login sessions for a specific time range.</p>
                <div className={styles.inlineForm}>
                  <select
                    value={suspensionDays}
                    onChange={(e) => setSuspensionDays(e.target.value)}
                    className={styles.selectInline}
                  >
                    <option value="1">1 Day</option>
                    <option value="3">3 Days</option>
                    <option value="7">7 Days</option>
                    <option value="30">30 Days</option>
                  </select>
                  <button className={styles.suspendBtn} onClick={() => setShowConfirmModal('suspend')}>
                    Suspend
                  </button>
                </div>
              </div>

              {/* Ban */}
              <div className={styles.actionCardControl}>
                <h4>Permanently Ban</h4>
                <p>Disable account permanently. Profile vanishes from discovery feeds instantly.</p>
                <button className={styles.banBtn} onClick={() => setShowConfirmModal('ban')}>
                  Ban Account
                </button>
              </div>

              {/* Restore */}
              {!profile.is_active && (
                <div className={styles.actionCardControl}>
                  <h4>Restore Access</h4>
                  <p>Restore login capabilities and remove rejection warning blocks.</p>
                  <button className={styles.restoreBtn} onClick={() => setShowConfirmModal('restore')}>
                    Restore Profile
                  </button>
                </div>
              )}

              {/* Delete */}
              {admin?.role === 'super_admin' && (
                <div className={`${styles.actionCardControl} ${styles.dangerZone}`}>
                  <h4>Permanently Delete Account</h4>
                  <p>Irreversibly delete profile records and references. (Super Admin Only)</p>
                  <button className={styles.deleteBtn} onClick={() => setShowConfirmModal('delete')}>
                    Delete User
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === 'notes' && (
          <div className={styles.notesPanel}>
            <h3>Private Admin CRM Notes</h3>
            <form onSubmit={handleAddNote} className={styles.noteForm}>
              <textarea
                placeholder="Write a private note to coordinate review status..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className={styles.noteTextarea}
                rows={3}
                required
              />
              <button type="submit" disabled={noteSaving} className={styles.noteSubmitBtn}>
                {noteSaving ? 'Adding...' : 'Add Private Note'}
              </button>
            </form>

            <div className={styles.notesList}>
              {notes.length === 0 ? (
                <p className={styles.emptyText}>No internal notes written for this profile.</p>
              ) : (
                notes.map(n => (
                  <div key={n.id} className={styles.noteItem}>
                    <div className={styles.noteHeader}>
                      <span className={styles.noteAuthor}>{n.admin_email}</span>
                      <span className={styles.noteDate}>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p className={styles.noteText}>{n.note}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {showConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Confirm: {showConfirmModal.toUpperCase()} Action</h3>
            <p>
              Specify details for taking this disciplinary action. These notes will be logged in the system.
            </p>
            
            <div className={styles.formGroup}>
              <label>Reason Description (Min 10 characters) *</label>
              <textarea
                placeholder="Describe reason for auditing..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                className={styles.modalTextarea}
                rows={3}
                required
              />
            </div>

            <div className={styles.modalButtons}>
              <button
                className={showConfirmModal === 'delete' || showConfirmModal === 'ban' || showConfirmModal === 'suspend' ? styles.confirmBtnRed : styles.confirmBtn}
                onClick={handleExecuteAction}
                disabled={actionNotes.trim().length < 10}
              >
                Execute {showConfirmModal}
              </button>
              <button className={styles.cancelBtn} onClick={() => { setShowConfirmModal(null); setActionNotes(''); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
