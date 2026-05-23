"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '../layout';
import styles from './Reports.module.css';

interface ReportItem {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reporter_district: string;
  reported_id: string;
  reported_name: string;
  reported_district: string;
  reported_bio: string;
  reported_photos: string[];
  reported_gender: string;
  reported_age: number;
  reported_created_at: string;
  reason: 'fake_profile' | 'inappropriate_content' | 'harassment' | 'underage_suspicion' | 'spam' | 'other';
  description: string;
  evidence_urls: string[];
  is_reviewed: boolean;
  reviewed_by: string | null;
  action_taken: string | null;
  created_at: string;
  reviewed_at: string | null;
  severity: 'low' | 'medium' | 'high';
  reportCountAgainstUser: number;
  reported_dob: string;
  reported_is_active: boolean;
}

export default function ReportsModule() {
  const { admin, addAuditLog } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [filteredReports, setFilteredReports] = useState<ReportItem[]>([]);

  // Filter and Search tabs
  const [activeTab, setActiveTab] = useState<'all' | 'unreviewed' | 'help_tickets' | 'investigating' | 'resolved' | 'dismissed'>('unreviewed');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'severity' | 'status'>('newest');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Detail Drawer state
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [suspensionDays, setSuspensionDays] = useState('7');
  
  // Edit Help details
  const [editName, setEditName] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editDOB, setEditDOB] = useState('');

  // History lists
  const [prevReportsAgainstAccused, setPrevReportsAgainstAccused] = useState<any[]>([]);
  const [prevReportsByReporter, setPrevReportsByReporter] = useState<any[]>([]);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      // 1. Fetch reports joined with profiles
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          reporter:reporter_id (full_name, district),
          reported:reported_id (full_name, district, bio, photos, gender, date_of_birth, created_at, is_active)
        `);

      if (error) throw error;

      // 2. Count reports per reported user id to compute severity
      const reportedCounts: { [key: string]: number } = {};
      (data || []).forEach((r: any) => {
        reportedCounts[r.reported_id] = (reportedCounts[r.reported_id] || 0) + 1;
      });

      // 3. Format and compute severity
      const formatted: ReportItem[] = (data || []).map((r: any) => {
        const reporter = r.reporter || {};
        const reported = r.reported || {};
        const count = reportedCounts[r.reported_id] || 1;

        // Age calculation
        let age = 18;
        if (reported.date_of_birth) {
          const dobDate = new Date(reported.date_of_birth);
          const ageDiffMs = Date.now() - dobDate.getTime();
          const ageDate = new Date(ageDiffMs);
          age = Math.abs(ageDate.getUTCFullYear() - 1970);
        }

        // Severity calculation
        let severity: 'low' | 'medium' | 'high' = 'low';
        if (r.reason === 'harassment' || r.reason === 'underage_suspicion' || count >= 4) {
          severity = 'high';
        } else if (count >= 2) {
          severity = 'medium';
        }

        return {
          id: r.id,
          reporter_id: r.reporter_id,
          reporter_name: reporter.full_name || 'Reporter',
          reporter_district: reporter.district || 'Assam',
          reported_id: r.reported_id,
          reported_name: reported.full_name || 'Reported User',
          reported_district: reported.district || 'Assam',
          reported_bio: reported.bio || '',
          reported_photos: reported.photos || [],
          reported_gender: reported.gender || 'male',
          reported_age: age,
          reported_created_at: reported.created_at || r.created_at,
          reason: r.reason,
          description: r.description || '',
          evidence_urls: r.evidence_urls || [],
          is_reviewed: r.is_reviewed || false,
          reviewed_by: r.reviewed_by || null,
          action_taken: r.action_taken || null,
          created_at: r.created_at,
          reviewed_at: r.reviewed_at || null,
          severity,
          reportCountAgainstUser: count,
          reported_dob: reported.date_of_birth || '',
          reported_is_active: reported.is_active !== false
        };
      });

      setReports(formatted);
    } catch (e) {
      console.error('Error loading reports:', e);
      triggerToast('Failed to load reports queue.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Read search parameters for initial tab
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['all', 'unreviewed', 'help_tickets', 'investigating', 'resolved', 'dismissed'].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }
  }, []);

  // Filter search and sort
  useEffect(() => {
    let result = [...reports];

    // Filter tabs
    if (activeTab === 'unreviewed') {
      result = result.filter(r => !r.is_reviewed);
    } else if (activeTab === 'help_tickets') {
      result = result.filter(r => r.reporter_id === r.reported_id);
    } else if (activeTab === 'investigating') {
      result = result.filter(r => r.is_reviewed && r.action_taken === 'investigating');
    } else if (activeTab === 'resolved') {
      result = result.filter(r => r.is_reviewed && r.action_taken !== 'dismissed' && r.action_taken !== 'investigating');
    } else if (activeTab === 'dismissed') {
      result = result.filter(r => r.is_reviewed && r.action_taken === 'dismissed');
    }

    // Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.reporter_name.toLowerCase().includes(q) ||
        r.reported_name.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'severity') {
        const severityWeight = { high: 3, medium: 2, low: 1 };
        return severityWeight[b.severity] - severityWeight[a.severity];
      }
      if (sortBy === 'status') {
        return (a.is_reviewed ? 1 : 0) - (b.is_reviewed ? 1 : 0);
      }
      return 0;
    });

    setFilteredReports(result);
    setSelectedIds([]); // reset selection
  }, [reports, activeTab, searchQuery, sortBy]);

  // Open Detail Drawer
  const handleOpenReport = async (report: ReportItem) => {
    setSelectedReport(report);
    setActionNotes('');
    setEditName(report.reported_name || '');
    setEditDistrict(report.reported_district || '');
    setEditDOB(report.reported_dob || '');
    setShowDrawer(true);

    // Fetch Accused History
    try {
      const { data: accusedHist } = await supabase
        .from('reports')
        .select('created_at, reason, action_taken, is_reviewed')
        .eq('reported_id', report.reported_id)
        .neq('id', report.id);

      setPrevReportsAgainstAccused(accusedHist || []);

      // Fetch Reporter History
      const { data: reporterHist } = await supabase
        .from('reports')
        .select('created_at, reason, action_taken')
        .eq('reporter_id', report.reporter_id)
        .neq('id', report.id);

      setPrevReportsByReporter(reporterHist || []);
    } catch (e) {
      console.error('Error fetching history:', e);
    }
  };

  // Checkbox bulk selections
  const handleSelectToggle = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredReports.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  // Perform report moderation action
  const handleModerationAction = async (action: 'dismiss' | 'warn' | 'suspend' | 'ban' | 'investigate') => {
    if (!selectedReport || !admin) return;

    if (actionNotes.trim().length < 10) {
      triggerToast('Please write a detailed explanation (minimum 10 characters).', 'warning');
      return;
    }

    try {
      const now = new Date().toISOString();
      let actionLabel = '';
      
      // Update Database transactionally
      if (action === 'dismiss') {
        actionLabel = 'dismissed';
        await supabase.from('reports').update({
          is_reviewed: true,
          reviewed_by: admin.email,
          action_taken: 'dismissed',
          reviewed_at: now
        }).eq('id', selectedReport.id);

      } else if (action === 'warn') {
        actionLabel = 'warned';
        // Send notification warning
        await supabase.from('notifications').insert({
          user_id: selectedReport.reported_id,
          type: 'system',
          title: 'Account Warning ⚠️',
          body: `Your account has received a formal warning: "${actionNotes}". Please review our community guidelines.`
        });
        
        await supabase.from('reports').update({
          is_reviewed: true,
          reviewed_by: admin.email,
          action_taken: 'warning_sent',
          reviewed_at: now
        }).eq('id', selectedReport.id);

      } else if (action === 'suspend') {
        actionLabel = `suspended_${suspensionDays}_days`;
        
        // Deactivate profile
        await supabase.from('profiles').update({
          is_active: false,
          rejection_reason: `Suspended for ${suspensionDays} days. Reason: ${actionNotes}`
        }).eq('id', selectedReport.reported_id);

        // Notify user
        await supabase.from('notifications').insert({
          user_id: selectedReport.reported_id,
          type: 'system',
          title: 'Account Suspended ✗',
          body: `Your account has been temporarily suspended for ${suspensionDays} days. Details: ${actionNotes}`
        });

        await supabase.from('reports').update({
          is_reviewed: true,
          reviewed_by: admin.email,
          action_taken: `suspended_${suspensionDays}_days`,
          reviewed_at: now
        }).eq('id', selectedReport.id);

      } else if (action === 'ban') {
        actionLabel = 'permanently_banned';

        // Deactivate permanently
        await supabase.from('profiles').update({
          is_active: false,
          rejection_reason: `Permanently banned. Reason: ${actionNotes}`
        }).eq('id', selectedReport.reported_id);

        // Notify user
        await supabase.from('notifications').insert({
          user_id: selectedReport.reported_id,
          type: 'system',
          title: 'Account Banned Permanently',
          body: 'Your account has been permanently disabled due to severe violations of community guidelines.'
        });

        await supabase.from('reports').update({
          is_reviewed: true,
          reviewed_by: admin.email,
          action_taken: 'banned',
          reviewed_at: now
        }).eq('id', selectedReport.id);

      } else if (action === 'investigate') {
        actionLabel = 'investigating';
        await supabase.from('reports').update({
          is_reviewed: true,
          reviewed_by: admin.email,
          action_taken: 'investigating',
          reviewed_at: now
        }).eq('id', selectedReport.id);
      }

      // Log in Audit Logs
      await addAuditLog(
        `REPORT_ACTION_${action.toUpperCase()}`,
        selectedReport.reported_id,
        selectedReport.reported_name,
        `Resolved report ID ${selectedReport.id}. Action: ${actionLabel}. Details: ${actionNotes}`
      );

      triggerToast(`Report resolved successfully. Action: ${action.toUpperCase()}`, 'success');
      setShowDrawer(false);
      setSelectedReport(null);
      fetchReports();
    } catch (e) {
      console.error('Moderation action failed:', e);
      triggerToast('Moderation action failed. Please try again.', 'error');
    }
  };

  // Bulk Actions
  const handleBulkAction = async (action: 'dismiss' | 'review') => {
    if (selectedIds.length === 0 || !admin) return;
    try {
      const now = new Date().toISOString();
      const actionLabel = action === 'dismiss' ? 'dismissed' : 'reviewed';
      
      const { error } = await supabase
        .from('reports')
        .update({
          is_reviewed: true,
          reviewed_by: admin.email,
          action_taken: actionLabel,
          reviewed_at: now
        })
        .in('id', selectedIds);

      if (error) throw error;

      await addAuditLog(
        'REPORT_BULK_ACTION',
        undefined,
        undefined,
        `Bulk updated ${selectedIds.length} reports to: ${actionLabel}`
      );

      triggerToast(`Successfully processed ${selectedIds.length} reports.`, 'success');
      setSelectedIds([]);
      fetchReports();
    } catch (e) {
      console.error('Bulk action failed:', e);
      triggerToast('Failed to apply bulk changes.', 'error');
    }
  };

  const handleUpdateName = async () => {
    if (!selectedReport || !editName.trim()) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editName.trim() })
        .eq('id', selectedReport.reported_id);

      if (error) throw error;
      
      triggerToast('User legal name updated successfully!', 'success');
      
      // Update local report display state
      setSelectedReport(prev => prev ? { ...prev, reported_name: editName.trim() } : null);
      setReports(prev => prev.map(r => r.reported_id === selectedReport.reported_id ? { ...r, reported_name: editName.trim() } : r));
      
      await addAuditLog('ADMIN_EDIT_NAME', selectedReport.reported_id, editName.trim(), `Corrected spelling/name from Help Ticket to: ${editName.trim()}`);
    } catch (e: any) {
      console.error(e);
      triggerToast(e.message || 'Failed to update name.', 'error');
    }
  };

  const handleUpdateDistrict = async () => {
    if (!selectedReport || !editDistrict.trim()) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ district: editDistrict.trim() })
        .eq('id', selectedReport.reported_id);

      if (error) throw error;
      
      triggerToast('User district updated successfully!', 'success');
      
      // Update local state
      setSelectedReport(prev => prev ? { ...prev, reported_district: editDistrict.trim() } : null);
      setReports(prev => prev.map(r => r.reported_id === selectedReport.reported_id ? { ...r, reported_district: editDistrict.trim() } : r));

      await addAuditLog('ADMIN_EDIT_DISTRICT', selectedReport.reported_id, selectedReport.reported_name, `Updated district from Help Ticket to: ${editDistrict.trim()}`);
    } catch (e: any) {
      console.error(e);
      triggerToast(e.message || 'Failed to update district.', 'error');
    }
  };

  const handleUpdateDOB = async () => {
    if (!selectedReport || !editDOB.trim()) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ date_of_birth: editDOB.trim() })
        .eq('id', selectedReport.reported_id);

      if (error) throw error;
      
      triggerToast('User Date of Birth updated successfully!', 'success');
      
      // Update local state
      setSelectedReport(prev => prev ? { ...prev, reported_dob: editDOB.trim() } : null);
      setReports(prev => prev.map(r => r.reported_id === selectedReport.reported_id ? { ...r, reported_dob: editDOB.trim() } : r));

      await addAuditLog('ADMIN_EDIT_DOB', selectedReport.reported_id, selectedReport.reported_name, `Corrected Date of Birth from Help Ticket to: ${editDOB.trim()}`);
    } catch (e: any) {
      console.error(e);
      triggerToast(e.message || 'Failed to update Date of Birth.', 'error');
    }
  };

  const handleToggleActiveStatus = async () => {
    if (!selectedReport) return;
    const newActiveState = !selectedReport.reported_is_active;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newActiveState })
        .eq('id', selectedReport.reported_id);

      if (error) throw error;
      
      triggerToast(`Account status set to ${newActiveState ? 'Active' : 'Inactive'}!`, 'success');
      
      // Update local state
      setSelectedReport(prev => prev ? { ...prev, reported_is_active: newActiveState } : null);
      setReports(prev => prev.map(r => r.reported_id === selectedReport.reported_id ? { ...r, reported_is_active: newActiveState } : r));

      await addAuditLog('ADMIN_TOGGLE_ACTIVE', selectedReport.reported_id, selectedReport.reported_name, `Toggled account is_active to: ${newActiveState}`);
    } catch (e: any) {
      console.error(e);
      triggerToast(e.message || 'Failed to toggle active status.', 'error');
    }
  };

  const handleRejectOrResetVerification = async () => {
    if (!selectedReport) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          verification_status: 'rejected', 
          rejection_reason: 'Verification reset by admin via Help Desk. Please resubmit valid identity documents.' 
        })
        .eq('id', selectedReport.reported_id);

      if (error) throw error;
      
      triggerToast('Verification reset to Rejected. User can now resubmit documents.', 'success');
      
      await addAuditLog('ADMIN_RESET_VERIFICATION', selectedReport.reported_id, selectedReport.reported_name, `Reset verification status to rejected/resubmit via Help Ticket.`);
      fetchReports();
    } catch (e: any) {
      console.error(e);
      triggerToast(e.message || 'Failed to reset verification status.', 'error');
    }
  };

  const handleForceVerify = async () => {
    if (!selectedReport) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ verification_status: 'verified', verified_at: new Date().toISOString() })
        .eq('id', selectedReport.reported_id);

      if (error) throw error;
      
      triggerToast('User account verified successfully!', 'success');
      
      // Update local state
      setSelectedReport(prev => prev ? { ...prev, severity: 'low' } : null);
      
      await addAuditLog('ADMIN_FORCE_VERIFY', selectedReport.reported_id, selectedReport.reported_name, `Force-verified user account verification status from Help Ticket.`);
      fetchReports();
    } catch (e: any) {
      console.error(e);
      triggerToast(e.message || 'Failed to verify account.', 'error');
    }
  };

  const handleForceReVerify = async () => {
    if (!selectedReport || !admin) return;
    if (actionNotes.trim().length < 10) {
      triggerToast('Please write a detailed explanation (minimum 10 characters).', 'warning');
      return;
    }
    try {
      const now = new Date().toISOString();
      const reason = `Re-verification requested by administrator: ${actionNotes.trim()}`;

      // Update profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          verification_status: 'rejected',
          rejection_reason: reason
        })
        .eq('id', selectedReport.reported_id);

      if (profileError) throw profileError;

      // Update report status
      await supabase
        .from('reports')
        .update({
          is_reviewed: true,
          reviewed_by: admin.email,
          action_taken: 'force_reverify',
          reviewed_at: now
        })
        .eq('id', selectedReport.id);

      // Create notification
      await supabase.from('notifications').insert({
        user_id: selectedReport.reported_id,
        type: 'verification_rejected',
        title: 'ID Re-verification Required ⚠️',
        body: `An administrator has requested that you re-verify your identity: ${actionNotes.trim()}`
      });

      await addAuditLog('ADMIN_FORCE_REVERIFY', selectedReport.reported_id, selectedReport.reported_name, `Forced identity re-verification. Notes: ${actionNotes.trim()}`);
      triggerToast('Account locked for identity re-verification.', 'success');
      setShowDrawer(false);
      setSelectedReport(null);
      fetchReports();
    } catch (e: any) {
      console.error(e);
      triggerToast(e.message || 'Action failed.', 'error');
    }
  };

  const handleRestoreAccess = async () => {
    if (!selectedReport || !admin) return;
    if (actionNotes.trim().length < 10) {
      triggerToast('Please write a detailed explanation (minimum 10 characters).', 'warning');
      return;
    }
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({
          is_active: true,
          verification_status: 'verified',
          rejection_reason: null
        })
        .eq('id', selectedReport.reported_id);

      if (error) throw error;

      await supabase
        .from('reports')
        .update({
          is_reviewed: true,
          reviewed_by: admin.email,
          action_taken: 'access_restored',
          reviewed_at: now
        })
        .eq('id', selectedReport.id);

      await supabase.from('notifications').insert({
        user_id: selectedReport.reported_id,
        type: 'system',
        title: 'Account Access Restored',
        body: 'Your account access has been fully restored by an administrator.'
      });

      await addAuditLog('ADMIN_RESTORE_ACCESS', selectedReport.reported_id, selectedReport.reported_name, `Restored account access. Notes: ${actionNotes.trim()}`);
      triggerToast('User account access restored successfully!', 'success');
      setShowDrawer(false);
      setSelectedReport(null);
      fetchReports();
    } catch (e: any) {
      console.error(e);
      triggerToast(e.message || 'Action failed.', 'error');
    }
  };

  const handlePermanentlyDeleteUser = async () => {
    if (!selectedReport || !admin) return;
    if (admin.role !== 'super_admin') {
      triggerToast('Unauthorized: Only Super Admins can permanently delete accounts.', 'error');
      return;
    }
    if (actionNotes.trim().length < 10) {
      triggerToast('Please write a detailed explanation (minimum 10 characters).', 'warning');
      return;
    }
    const confirmDelete = window.confirm(`Are you absolutely sure you want to permanently delete profile for ${selectedReport.reported_name}? This cannot be undone.`);
    if (!confirmDelete) return;

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedReport.reported_id);

      if (error) throw error;

      await supabase
        .from('reports')
        .update({
          is_reviewed: true,
          reviewed_by: admin.email,
          action_taken: 'permanently_deleted',
          reviewed_at: now
        })
        .eq('id', selectedReport.id);

      await addAuditLog('ADMIN_DELETE_USER', selectedReport.reported_id, selectedReport.reported_name, `Permanently deleted user account. Notes: ${actionNotes.trim()}`);
      triggerToast('Profile permanently deleted from platform.', 'success');
      setShowDrawer(false);
      setSelectedReport(null);
      fetchReports();
    } catch (e: any) {
      console.error(e);
      triggerToast(e.message || 'Failed to delete profile.', 'error');
    }
  };

  const handleDeleteProfile = async () => {
    if (!selectedReport) return;
    const confirmDelete = window.confirm(`Are you absolutely sure you want to permanently delete profile for ${selectedReport.reported_name}? This cannot be undone.`);
    if (!confirmDelete) return;

    try {
      // First delete profile in public.profiles. Row cascade deletes matches/likes/messages.
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedReport.reported_id);

      if (error) throw error;
      
      triggerToast('Profile permanently deleted from platform.', 'success');
      setShowDrawer(false);
      setSelectedReport(null);
      
      await addAuditLog('ADMIN_DELETE_USER', selectedReport.reported_id, selectedReport.reported_name, `Permanently deleted user profile and data upon Help Ticket request.`);
      fetchReports();
    } catch (e: any) {
      console.error(e);
      triggerToast(e.message || 'Failed to delete profile.', 'error');
    }
  };

  const handleResolveHelpTicket = async () => {
    if (!selectedReport || !admin) return;
    try {
      const now = new Date().toISOString();
      const resolution = actionNotes.trim() || 'Help ticket resolved and closed by moderator.';

      const { error } = await supabase
        .from('reports')
        .update({
          is_reviewed: true,
          reviewed_by: admin.email,
          action_taken: 'resolved_help_ticket',
          reviewed_at: now,
          description: selectedReport.description + `\n\n[RESOLUTION BY ${admin.email}]: ${resolution}`
        })
        .eq('id', selectedReport.id);

      if (error) throw error;

      await addAuditLog(
        'HELP_TICKET_RESOLVED',
        selectedReport.reported_id,
        selectedReport.reported_name,
        `Resolved support ticket ID ${selectedReport.id}. Resolution: ${resolution}`
      );

      triggerToast('Help ticket resolved and closed!', 'success');
      setShowDrawer(false);
      setSelectedReport(null);
      fetchReports();
    } catch (e) {
      console.error(e);
      triggerToast('Failed to close help ticket.', 'error');
    }
  };

  return (
    <div className={styles.container}>
      {toast && (
        <div className={`${styles.toast} ${
          toast.type === 'success' ? styles.toastSuccess :
          toast.type === 'error' ? styles.toastError : styles.toastWarning
        }`}>
          {toast.message}
        </div>
      )}

      <header className={styles.header}>
        <h1 className="headline-lg">User Reports Queue</h1>
        <p className="body-md">Manage platform reports, review evidence, and take disciplinary actions.</p>
      </header>

      {/* Filters and Tabs */}
      <div className={styles.filterBar}>
        <div className={styles.tabs}>
          {[
            { id: 'all', label: 'All Reports', count: reports.length },
            { id: 'unreviewed', label: 'Unreviewed', count: reports.filter(r => !r.is_reviewed).length },
            { id: 'help_tickets', label: 'Help Tickets ✉️', count: reports.filter(r => r.reporter_id === r.reported_id && !r.is_reviewed).length },
            { id: 'investigating', label: 'Under Investigation', count: reports.filter(r => r.is_reviewed && r.action_taken === 'investigating').length },
            { id: 'resolved', label: 'Resolved Actions', count: reports.filter(r => r.is_reviewed && r.action_taken !== 'dismissed' && r.action_taken !== 'investigating').length },
            { id: 'dismissed', label: 'Dismissed', count: reports.filter(r => r.is_reviewed && r.action_taken === 'dismissed').length }
          ].map(tab => (
            <button
              key={tab.id}
              className={`${styles.tabBtn} ${activeTab === tab.id ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.label} <span className={styles.tabCount}>{tab.count}</span>
            </button>
          ))}
        </div>

        <div className={styles.controls}>
          <input
            type="text"
            className={styles.searchBar}
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className={styles.selectSort}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="newest">Date (Newest First)</option>
            <option value="severity">Severity (High First)</option>
            <option value="status">Status</option>
          </select>
        </div>
      </div>

      {/* Bulk action buttons indicator */}
      {selectedIds.length > 0 && (
        <div className={styles.bulkActionBar}>
          <span><b>{selectedIds.length}</b> reports selected</span>
          <div className={styles.bulkButtons}>
            <button className={styles.bulkReviewBtn} onClick={() => handleBulkAction('review')}>Mark Reviewed</button>
            <button className={styles.bulkDismissBtn} onClick={() => handleBulkAction('dismiss')}>Dismiss All</button>
          </div>
        </div>
      )}

      {/* Reports Table list */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loadingReports}>Loading reports list...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={filteredReports.length > 0 && selectedIds.length === filteredReports.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Reporter</th>
                <th>Reported User</th>
                <th>Reason</th>
                <th>Date Filed</th>
                <th>Severity</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyTable}>No reports match selected filters.</td>
                </tr>
              ) : (
                filteredReports.map((report) => (
                  <tr key={report.id} className={styles.tableRow} onClick={() => handleOpenReport(report)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(report.id)}
                        onChange={() => handleSelectToggle(report.id)}
                      />
                    </td>
                    <td>{report.reporter_id === report.reported_id ? 'Self (Help Desk)' : report.reporter_name}</td>
                    <td><b>{report.reported_name}</b></td>
                    <td>
                      {report.reporter_id === report.reported_id ? (
                        <span className={styles.reasonBadge} style={{ 
                          backgroundColor: 'rgba(184, 134, 11, 0.15)', 
                          color: '#B8860B', 
                          borderColor: 'rgba(184, 134, 11, 0.3)' 
                        }}>
                          SUPPORT TICKET
                        </span>
                      ) : (
                        <span className={styles.reasonBadge}>{report.reason.replace('_', ' ').toUpperCase()}</span>
                      )}
                    </td>
                    <td>{new Date(report.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`${styles.severityBadge} ${
                        report.severity === 'high' ? styles.badgeHigh :
                        report.severity === 'medium' ? styles.badgeMedium : styles.badgeLow
                      }`}>
                        {report.severity.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${report.is_reviewed ? styles.statusReviewed : styles.statusUnreviewed}`}>
                        {report.is_reviewed ? 'Reviewed' : 'Unreviewed'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <button className={styles.viewBtn} onClick={() => handleOpenReport(report)}>
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Reports Drawer Slide panel */}
      {showDrawer && selectedReport && (
        <div className={styles.drawerOverlay}>
          <div className={styles.drawer}>
            <header className={styles.drawerHeader}>
              <div className={styles.drawerTitleRow}>
                <h2>Report Resolution Panel</h2>
                <span className={`${styles.severityBadge} ${
                  selectedReport.severity === 'high' ? styles.badgeHigh :
                  selectedReport.severity === 'medium' ? styles.badgeMedium : styles.badgeLow
                }`}>
                  {selectedReport.severity.toUpperCase()} SEVERITY
                </span>
              </div>
              <button className={styles.closeDrawerBtn} onClick={() => setShowDrawer(false)}>✕</button>
            </header>

            <div className={styles.drawerContent}>
              {/* Left Column: Reporter detail & Statement */}
              <div className={styles.drawerLeft}>
                <div className={styles.reporterDetailsCard}>
                  <h4>Reporter Context</h4>
                  <div className={styles.reporterName}>Filed by: <b>{selectedReport.reporter_name}</b></div>
                  <div className={styles.reporterLocation}>District: {selectedReport.reporter_district}</div>
                  <div className={styles.dateLabel}>Date: {new Date(selectedReport.created_at).toLocaleString()}</div>
                </div>

                <div className={styles.statementCard}>
                  <h4>Violation Details</h4>
                  <div className={styles.reasonTag}>{selectedReport.reason.replace('_', ' ').toUpperCase()}</div>
                  <p className={styles.description}>"{selectedReport.description || 'No description provided.'}"</p>
                </div>

                {/* Evidence Screenshot attachments */}
                <div className={styles.evidenceCard}>
                  <h4>Evidence Uploads</h4>
                  {selectedReport.evidence_urls.length === 0 ? (
                    <p className={styles.noEvidence}>No screenshot evidence uploaded.</p>
                  ) : (
                    <div className={styles.evidenceGrid}>
                      {selectedReport.evidence_urls.map((url, index) => (
                        <a key={index} href={url} target="_blank" rel="noopener noreferrer" className={styles.evidenceThumb}>
                          <img src={url} alt={`Evidence ${index + 1}`} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* History summary logs */}
                <div className={styles.historyCard}>
                  <h4>Accused Violations History</h4>
                  <div className={styles.historyStats}>
                    <span>Total previous reports: <b>{prevReportsAgainstAccused.length}</b></span>
                  </div>
                  <div className={styles.historyList}>
                    {prevReportsAgainstAccused.length === 0 ? (
                      <div className={styles.emptyHistory}>Clean record (no previous reports against this user).</div>
                    ) : (
                      prevReportsAgainstAccused.map((h, i) => (
                        <div key={i} className={styles.historyItem}>
                          <span className={styles.histReason}>{h.reason.replace('_', ' ')}</span>
                          <span className={styles.histAction}>Action: {h.action_taken || 'Pending'}</span>
                          <span className={styles.histDate}>{new Date(h.created_at).toLocaleDateString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Accused User profile context & Action controls */}
              <div className={styles.drawerRight}>
                <div className={styles.accusedProfileCard}>
                  <h4>Reported User Profile Settings</h4>
                  <div className={styles.profileBox}>
                    <img
                      src={selectedReport.reported_photos[0] || '/logo.png'}
                      alt={selectedReport.reported_name}
                      className={styles.accusedAvatar}
                      onError={(e) => { (e.target as any).src = '/logo.png'; }}
                    />
                    <div className={styles.accusedMeta}>
                      <h3>{selectedReport.reported_name}</h3>
                      <div>{selectedReport.reported_age} yrs • {selectedReport.reported_gender.toUpperCase()}</div>
                      <div>District: {selectedReport.reported_district}</div>
                      <div className={styles.accountAge}>Created: {new Date(selectedReport.reported_created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  {selectedReport.reported_bio && (
                    <div className={styles.bioContainer}>
                      <h5>Biography</h5>
                      <p>"{selectedReport.reported_bio}"</p>
                    </div>
                  )}

                  {/* Accused Photo Grid */}
                  <div className={styles.photoGridHeader}>All Photos ({selectedReport.reported_photos.length})</div>
                  <div className={styles.photoGrid}>
                    {selectedReport.reported_photos.map((photo, idx) => (
                      <div key={idx} className={styles.photoBox}>
                        <img src={photo} alt={`Upload ${idx + 1}`} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Moderation actions input forms */}
                <div className={styles.actionsCard}>
                  <h4>Disciplinary Actions & Moderation</h4>
                  <p style={{ fontSize: '0.8rem', color: '#888888', marginBottom: '16px', lineHeight: '1.4' }}>
                    Select an action below to apply safety measures. All actions require notes.
                  </p>
                  
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Audit Resolution Note (Min 10 chars) *</label>
                    <textarea
                      placeholder="Detail why you are taking this action. This note is permanently saved to the audit log."
                      className={styles.actionTextarea}
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      rows={3}
                      required
                    />
                  </div>

                  <div className={styles.disciplinaryControls} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Dismiss / Investigate */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderBottom: '1px solid #2A2A2A', paddingBottom: '16px' }}>
                      <button type="button" className={styles.btnActionDismiss} onClick={() => handleModerationAction('dismiss')} style={{ fontSize: '0.8rem', padding: '10px' }}>
                        Dismiss Report
                      </button>
                      <button type="button" className={styles.btnActionInvestigate} onClick={() => handleModerationAction('investigate')} style={{ fontSize: '0.8rem', padding: '10px' }}>
                        Investigate
                      </button>
                    </div>

                    {/* Send Warning Alert */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <b style={{ fontSize: '0.85rem', color: '#FFF' }}>Send Warning Alert</b>
                      <span style={{ fontSize: '0.75rem', color: '#888' }}>Send an in-app system message cautioning the user against bad behaviors.</span>
                      <button type="button" className={styles.btnActionWarn} onClick={() => handleModerationAction('warn')} style={{ width: '100%', marginTop: '6px', fontSize: '0.85rem', padding: '10px' }}>
                        Send Warning
                      </button>
                    </div>

                    {/* Force ID Re-verification */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #2A2A2A', paddingTop: '16px' }}>
                      <b style={{ fontSize: '0.85rem', color: '#FFF' }}>Force ID Re-verification</b>
                      <span style={{ fontSize: '0.75rem', color: '#888' }}>Lock account capabilities and request they re-upload verification documents.</span>
                      <button 
                        type="button" 
                        className={styles.btnActionWarn} 
                        onClick={handleForceReVerify} 
                        style={{ width: '100%', marginTop: '6px', fontSize: '0.85rem', padding: '10px', borderColor: '#B8860B', color: '#B8860B', background: 'transparent' }}
                      >
                        Force Re-verify
                      </button>
                    </div>

                    {/* Temporarily Suspend */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #2A2A2A', paddingTop: '16px' }}>
                      <b style={{ fontSize: '0.85rem', color: '#FFF' }}>Temporarily Suspend</b>
                      <span style={{ fontSize: '0.75rem', color: '#888' }}>Deactivate account and block login sessions for a specific time range.</span>
                      <div className={styles.suspendPanel} style={{ marginTop: '6px' }}>
                        <select
                          className={styles.selectDays}
                          value={suspensionDays}
                          onChange={(e) => setSuspensionDays(e.target.value)}
                          style={{ background: '#0F0F0F', border: '1px solid #2A2A2A', color: '#FFF', borderRadius: '6px', padding: '10px' }}
                        >
                          <option value="1">1 Day</option>
                          <option value="3">3 Days</option>
                          <option value="7">7 Days</option>
                          <option value="30">30 Days</option>
                        </select>
                        <button type="button" className={styles.btnActionSuspend} onClick={() => handleModerationAction('suspend')} style={{ fontSize: '0.85rem', padding: '10px' }}>
                          Suspend
                        </button>
                      </div>
                    </div>

                    {/* Permanently Ban */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #2A2A2A', paddingTop: '16px' }}>
                      <b style={{ fontSize: '0.85rem', color: '#FFF' }}>Permanently Ban</b>
                      <span style={{ fontSize: '0.75rem', color: '#888' }}>Disable account permanently. Profile vanishes from discovery feeds instantly.</span>
                      <button type="button" className={styles.btnActionBan} onClick={() => handleModerationAction('ban')} style={{ width: '100%', marginTop: '6px', fontSize: '0.85rem', padding: '10px' }}>
                        Ban Account
                      </button>
                    </div>

                    {/* Restore Access */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #2A2A2A', paddingTop: '16px' }}>
                      <b style={{ fontSize: '0.85rem', color: '#FFF' }}>Restore Access</b>
                      <span style={{ fontSize: '0.75rem', color: '#888' }}>Restore login capabilities and remove rejection warning blocks.</span>
                      <button 
                        type="button" 
                        className={styles.btnActionWarn} 
                        onClick={handleRestoreAccess} 
                        style={{ width: '100%', marginTop: '6px', fontSize: '0.85rem', padding: '10px', borderColor: '#4A7C59', color: '#4A7C59', background: 'transparent' }}
                      >
                        Restore Profile
                      </button>
                    </div>

                    {/* Permanently Delete Account */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #2A2A2A', paddingTop: '16px' }}>
                      <b style={{ fontSize: '0.85rem', color: '#FFF' }}>Permanently Delete Account</b>
                      <span style={{ fontSize: '0.75rem', color: '#888' }}>Irreversibly delete profile records and references. (Super Admin Only)</span>
                      <button 
                        type="button" 
                        className={styles.btnActionBan} 
                        onClick={handlePermanentlyDeleteUser} 
                        disabled={!admin || admin.role !== 'super_admin'}
                        style={{ 
                          width: '100%', 
                          marginTop: '6px', 
                          fontSize: '0.85rem', 
                          padding: '10px', 
                          backgroundColor: admin?.role === 'super_admin' ? '#C0392B' : '#333', 
                          cursor: admin?.role === 'super_admin' ? 'pointer' : 'not-allowed',
                          opacity: admin?.role === 'super_admin' ? 1 : 0.5 
                        }}
                      >
                        Delete User {(!admin || admin.role !== 'super_admin') && '(Disabled)'}
                      </button>
                    </div>

                  </div>
                </div>

                {selectedReport.reporter_id === selectedReport.reported_id && (
                  <div className={styles.actionsCard} style={{ marginTop: '20px', borderTop: '4px solid var(--secondary, #B8860B)' }}>
                    <h4 style={{ color: '#B8860B', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      ⚙️ Help Desk Ticket Actions
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: '#888888', marginBottom: '16px', lineHeight: '1.4' }}>
                      This request was submitted via Help & Support. Use these controls to directly update this user's account details.
                    </p>

                    <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                      <label className={styles.label} style={{ fontSize: '0.75rem', fontWeight: 700 }}>Correct Legal Full Name</label>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        <input
                          type="text"
                          className={styles.actionTextarea}
                          style={{ height: '36px', padding: '0 12px', background: '#0F0F0F', border: '1px solid #2A2A2A', borderRadius: '4px', color: '#FFF', flex: 1 }}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                        <button
                          type="button"
                          className={styles.btnActionInvestigate}
                          style={{ padding: '0 14px', borderRadius: '4px', cursor: 'pointer', height: '36px' }}
                          onClick={handleUpdateName}
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                      <label className={styles.label} style={{ fontSize: '0.75rem', fontWeight: 700 }}>Change Home District</label>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        <input
                          type="text"
                          className={styles.actionTextarea}
                          style={{ height: '36px', padding: '0 12px', background: '#0F0F0F', border: '1px solid #2A2A2A', borderRadius: '4px', color: '#FFF', flex: 1 }}
                          value={editDistrict}
                          onChange={(e) => setEditDistrict(e.target.value)}
                        />
                        <button
                          type="button"
                          className={styles.btnActionInvestigate}
                          style={{ padding: '0 14px', borderRadius: '4px', cursor: 'pointer', height: '36px' }}
                          onClick={handleUpdateDistrict}
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                      <label className={styles.label} style={{ fontSize: '0.75rem', fontWeight: 700 }}>Correct Legal Date of Birth</label>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        <input
                          type="date"
                          className={styles.actionTextarea}
                          style={{ height: '36px', padding: '0 12px', background: '#0F0F0F', border: '1px solid #2A2A2A', borderRadius: '4px', color: '#FFF', flex: 1 }}
                          value={editDOB}
                          onChange={(e) => setEditDOB(e.target.value)}
                        />
                        <button
                          type="button"
                          className={styles.btnActionInvestigate}
                          style={{ padding: '0 14px', borderRadius: '4px', cursor: 'pointer', height: '36px' }}
                          onClick={handleUpdateDOB}
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                      <button
                        type="button"
                        className={styles.btnActionWarn}
                        style={{ background: '#4A7C59', color: '#FFF', padding: '12px', borderRadius: '6px', cursor: 'pointer', border: 'none', fontWeight: 600 }}
                        onClick={handleForceVerify}
                      >
                        ✓ Force-Verify Account Status
                      </button>

                      <button
                        type="button"
                        className={styles.btnActionWarn}
                        style={{ background: '#D35400', color: '#FFF', padding: '12px', borderRadius: '6px', cursor: 'pointer', border: 'none', fontWeight: 600 }}
                        onClick={handleRejectOrResetVerification}
                      >
                        ↻ Reset Verification (Allow Resubmit ID)
                      </button>

                      <button
                        type="button"
                        className={styles.btnActionInvestigate}
                        style={{ padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                        onClick={handleToggleActiveStatus}
                      >
                        {selectedReport.reported_is_active ? '⏸ Pause Profile (Set Inactive)' : '▶ Resume Profile (Set Active)'}
                      </button>
                      
                      <button
                        type="button"
                        className={styles.btnActionBan}
                        style={{ padding: '12px', borderRadius: '6px', cursor: 'pointer' }}
                        onClick={handleDeleteProfile}
                      >
                        ✗ Permanently Delete Profile & Data
                      </button>

                      <button
                        type="button"
                        className={styles.btnActionDismiss}
                        style={{ background: '#B8860B', color: '#0F0F0F', padding: '14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, border: 'none', marginTop: '6px' }}
                        onClick={handleResolveHelpTicket}
                      >
                        Resolve & Close Help Ticket 🏁
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
