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
}

export default function ReportsModule() {
  const { admin, addAuditLog } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [filteredReports, setFilteredReports] = useState<ReportItem[]>([]);

  // Filter and Search tabs
  const [activeTab, setActiveTab] = useState<'all' | 'unreviewed' | 'investigating' | 'resolved' | 'dismissed'>('unreviewed');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'severity' | 'status'>('newest');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Detail Drawer state
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [suspensionDays, setSuspensionDays] = useState('7');

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
          reported:reported_id (full_name, district, bio, photos, gender, date_of_birth, created_at)
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
          reportCountAgainstUser: count
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

  // Filter search and sort
  useEffect(() => {
    let result = [...reports];

    // Filter tabs
    if (activeTab === 'unreviewed') {
      result = result.filter(r => !r.is_reviewed);
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
                    <td>{report.reporter_name}</td>
                    <td><b>{report.reported_name}</b></td>
                    <td className={styles.reasonBadge}>{report.reason.replace('_', ' ').toUpperCase()}</td>
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
                  <h4>Moderator Actions</h4>
                  
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Audit Resolution Note (Min 10 chars) *</label>
                    <textarea
                      placeholder="Detail why you are taking this action. This note is permanently saved to the audit log."
                      className={styles.actionTextarea}
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      rows={4}
                      required
                    />
                  </div>

                  <div className={styles.disciplinaryControls}>
                    <div className={styles.dismissRow}>
                      <button className={styles.btnActionDismiss} onClick={() => handleModerationAction('dismiss')}>
                        No Action — Dismiss Report
                      </button>
                      <button className={styles.btnActionInvestigate} onClick={() => handleModerationAction('investigate')}>
                        Under Investigation
                      </button>
                    </div>
                    
                    <button className={styles.btnActionWarn} onClick={() => handleModerationAction('warn')}>
                      Send Formal Warning to User
                    </button>

                    <div className={styles.suspendPanel}>
                      <select
                        className={styles.selectDays}
                        value={suspensionDays}
                        onChange={(e) => setSuspensionDays(e.target.value)}
                      >
                        <option value="1">1 Day Suspension</option>
                        <option value="3">3 Days Suspension</option>
                        <option value="7">7 Days Suspension</option>
                        <option value="30">30 Days Suspension</option>
                      </select>
                      <button className={styles.btnActionSuspend} onClick={() => handleModerationAction('suspend')}>
                        Temporarily Suspend Account
                      </button>
                    </div>

                    <button className={styles.btnActionBan} onClick={() => handleModerationAction('ban')}>
                      Permanently Ban Accused User
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
