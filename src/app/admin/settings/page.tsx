"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '../layout';
import styles from './Settings.module.css';

export default function PlatformSettings() {
  const { admin, addAuditLog } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings states matching DB JSON schema
  const [matching, setMatching] = useState({
    min_age: 18,
    discovery_radius: 'all',
    max_likes_free: 20,
    max_super_likes_free: 3,
    inactivity_days: 90
  });

  const [verification, setVerification] = useState({
    require_selfie: true,
    auto_remind_days: 3,
    auto_delete_docs_days: 90,
    accepted_types: ['aadhaar', 'voter_id', 'pan_card', 'driving_license', 'passport']
  });

  const [notifications, setNotifications] = useState({
    send_match: true,
    send_message: true,
    send_weekly_digest: true,
    pending_verification_threshold: 50,
    unreviewed_reports_threshold: 10
  });

  const [moderation, setModeration] = useState({
    keyword_blocklist: [] as string[],
    auto_flag_phones: true,
    auto_flag_urls: true
  });

  const [maintenance, setMaintenance] = useState({
    enabled: false,
    message: '',
    estimated_downtime: ''
  });

  // Blocklist helper
  const [blocklistInput, setBlocklistInput] = useState('');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('platform_settings').select('*');
      if (error) throw error;

      data.forEach(item => {
        if (item.key === 'matching') setMatching(item.value);
        else if (item.key === 'verification') setVerification(item.value);
        else if (item.key === 'notifications') setNotifications(item.value);
        else if (item.key === 'moderation') {
          setModeration(item.value);
          setBlocklistInput(item.value.keyword_blocklist ? item.value.keyword_blocklist.join(', ') : '');
        }
        else if (item.key === 'maintenance') setMaintenance(item.value);
      });
    } catch (e) {
      console.error('Error fetching settings:', e);
      triggerToast('Failed to load settings from server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (section: string) => {
    if (admin?.role !== 'super_admin') {
      triggerToast('Permission denied. Super Admin role required.', 'error');
      return;
    }

    setSaving(true);
    try {
      let payload = {};
      
      if (section === 'matching') payload = matching;
      else if (section === 'verification') payload = verification;
      else if (section === 'notifications') payload = notifications;
      else if (section === 'moderation') {
        const keywords = blocklistInput
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0);
        const updatedMod = { ...moderation, keyword_blocklist: keywords };
        payload = updatedMod;
        setModeration(updatedMod);
      }
      else if (section === 'maintenance') payload = maintenance;

      const { error } = await supabase
        .from('platform_settings')
        .update({
          value: payload,
          updated_at: new Date().toISOString(),
          updated_by: admin.id
        })
        .eq('key', section);

      if (error) throw error;

      await addAuditLog(
        'UPDATE_PLATFORM_SETTINGS',
        undefined,
        undefined,
        `Updated settings category: "${section}"`
      );

      triggerToast(`Settings group "${section.toUpperCase()}" saved successfully.`, 'success');
    } catch (e) {
      console.error('Error saving settings:', e);
      triggerToast('Failed to update settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (admin?.role !== 'super_admin') {
    return (
      <div className={styles.accessDenied}>
        <h2>🔒 Access Denied</h2>
        <p>You do not have the Super Administrator privileges required to manage platform settings.</p>
      </div>
    );
  }

  const handleIdTypeToggle = (type: string) => {
    setVerification(prev => {
      const current = prev.accepted_types || [];
      const updated = current.includes(type) 
        ? current.filter(t => t !== type) 
        : [...current, type];
      return { ...prev, accepted_types: updated };
    });
  };

  return (
    <div className={styles.container}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          {toast.message}
        </div>
      )}

      <header className={styles.header}>
        <h1 className="headline-lg">Platform Settings</h1>
        <p className="body-md">Configure global matchmaking configurations, verification requirements, and content blocklists.</p>
      </header>

      {loading ? (
        <div className={styles.loading}>Loading system settings...</div>
      ) : (
        <div className={styles.settingsGrid}>
          {/* Section 1: Matching Settings */}
          <div className={styles.card}>
            <h3>Matching & Swiping Configurations</h3>
            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label>Minimum Swipe Age Limit (Strictly Enforced)</label>
                <input type="number" className={styles.input} value={matching.min_age} disabled />
                <span className={styles.hint}>Enforced at PostgreSQL DB check levels.</span>
              </div>
              <div className={styles.formGroup}>
                <label>Discovery Radius Boundary</label>
                <select
                  className={styles.select}
                  value={matching.discovery_radius}
                  onChange={(e) => setMatching({ ...matching, discovery_radius: e.target.value })}
                >
                  <option value="all">All of Assam (Recommended)</option>
                  <option value="division">By Regional Division</option>
                  <option value="district">By Single District Limit</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Maximum Daily Likes (Free Tier)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={matching.max_likes_free}
                  onChange={(e) => setMatching({ ...matching, max_likes_free: parseInt(e.target.value) || 20 })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Maximum Daily Super Likes (Free Tier)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={matching.max_super_likes_free}
                  onChange={(e) => setMatching({ ...matching, max_super_likes_free: parseInt(e.target.value) || 3 })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Profile Cutoff Inactivity Limit (Days)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={matching.inactivity_days}
                  onChange={(e) => setMatching({ ...matching, inactivity_days: parseInt(e.target.value) || 90 })}
                />
              </div>
              <button className={styles.saveBtn} onClick={() => handleSaveSettings('matching')} disabled={saving}>
                Save Matching Settings
              </button>
            </div>
          </div>

          {/* Section 2: Verification Settings */}
          <div className={styles.card}>
            <h3>Identity Verification Settings</h3>
            <div className={styles.form}>
              <div className={styles.checkGroup}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={verification.require_selfie}
                    onChange={(e) => setVerification({ ...verification, require_selfie: e.target.checked })}
                  />
                  <span>Require Live Selfie Verification Check</span>
                </label>
              </div>
              <div className={styles.formGroup}>
                <label>Remind Unverified Accounts After (Days)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={verification.auto_remind_days}
                  onChange={(e) => setVerification({ ...verification, auto_remind_days: parseInt(e.target.value) || 3 })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Auto-Delete Document files after Verification (Days)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={verification.auto_delete_docs_days}
                  onChange={(e) => setVerification({ ...verification, auto_delete_docs_days: parseInt(e.target.value) || 90 })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Accepted Identity Card Formats</label>
                <div className={styles.checkboxGrid}>
                  {['aadhaar', 'voter_id', 'pan_card', 'driving_license', 'passport'].map(type => (
                    <label key={type} className={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={verification.accepted_types?.includes(type)}
                        onChange={() => handleIdTypeToggle(type)}
                      />
                      <span className={styles.capitalize}>{type.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button className={styles.saveBtn} onClick={() => handleSaveSettings('verification')} disabled={saving}>
                Save Verification Settings
              </button>
            </div>
          </div>

          {/* Section 3: Notification Thresholds */}
          <div className={styles.card}>
            <h3>Notification Alert Channels</h3>
            <div className={styles.form}>
              <div className={styles.checkGroup}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={notifications.send_match}
                    onChange={(e) => setNotifications({ ...notifications, send_match: e.target.checked })}
                  />
                  <span>Match Notifications enabled</span>
                </label>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={notifications.send_message}
                    onChange={(e) => setNotifications({ ...notifications, send_message: e.target.checked })}
                  />
                  <span>Message Alerts enabled</span>
                </label>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={notifications.send_weekly_digest}
                    onChange={(e) => setNotifications({ ...notifications, send_weekly_digest: e.target.checked })}
                  />
                  <span>Weekly Summary Digest enabled</span>
                </label>
              </div>

              <div className={styles.formGroup}>
                <label>Verification Queue Warning Threshold (Count)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={notifications.pending_verification_threshold}
                  onChange={(e) => setNotifications({ ...notifications, pending_verification_threshold: parseInt(e.target.value) || 50 })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Moderator Reports Alert Threshold (Count)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={notifications.unreviewed_reports_threshold}
                  onChange={(e) => setNotifications({ ...notifications, unreviewed_reports_threshold: parseInt(e.target.value) || 10 })}
                />
              </div>
              <button className={styles.saveBtn} onClick={() => handleSaveSettings('notifications')} disabled={saving}>
                Save Notification Settings
              </button>
            </div>
          </div>

          {/* Section 4: Content Moderation Blocklist */}
          <div className={styles.card}>
            <h3>Content Moderation Filters</h3>
            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label>Keyword Blocklist (Comma-separated words)</label>
                <textarea
                  className={styles.textarea}
                  rows={4}
                  placeholder="scam, Paytm, WhatsApp, sugar, cash"
                  value={blocklistInput}
                  onChange={(e) => setBlocklistInput(e.target.value)}
                />
                <span className={styles.hint}>Flagged messages scanner parses these keywords in chats.</span>
              </div>
              <div className={styles.checkGroup}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={moderation.auto_flag_phones}
                    onChange={(e) => setModeration({ ...moderation, auto_flag_phones: e.target.checked })}
                  />
                  <span>Auto-flag chat messages containing phone digits</span>
                </label>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={moderation.auto_flag_urls}
                    onChange={(e) => setModeration({ ...moderation, auto_flag_urls: e.target.checked })}
                  />
                  <span>Auto-flag chat messages containing URLs</span>
                </label>
              </div>
              <button className={styles.saveBtn} onClick={() => handleSaveSettings('moderation')} disabled={saving}>
                Save Moderation Settings
              </button>
            </div>
          </div>

          {/* Section 5: Maintenance Mode Toggle */}
          <div className={`${styles.card} ${styles.fullWidth} ${maintenance.enabled ? styles.dangerBorder : ''}`}>
            <h3 style={{ color: maintenance.enabled ? '#E74C3C' : '' }}>Platform Maintenance Mode</h3>
            <div className={styles.form}>
              <div className={styles.checkGroup}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={maintenance.enabled}
                    onChange={(e) => setMaintenance({ ...maintenance, enabled: e.target.checked })}
                  />
                  <span style={{ fontWeight: 'bold' }}>ENABLE MAINTENANCE LOCK</span>
                </label>
                <span className={styles.hint}>Lock login sessions on the main app and show a maintenance splash screen.</span>
              </div>
              
              <div className={styles.maintenanceFormGrid}>
                <div className={styles.formGroup}>
                  <label>estimated Downtime message</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="30 minutes / 2 hours"
                    value={maintenance.estimated_downtime}
                    onChange={(e) => setMaintenance({ ...maintenance, estimated_downtime: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Lock message shown to users</label>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    value={maintenance.message}
                    onChange={(e) => setMaintenance({ ...maintenance, message: e.target.value })}
                  />
                </div>
              </div>
              <button className={`${styles.saveBtn} ${maintenance.enabled ? styles.btnRed : ''}`} onClick={() => handleSaveSettings('maintenance')} disabled={saving}>
                {maintenance.enabled ? 'Lock Platform Now' : 'Save Maintenance Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
