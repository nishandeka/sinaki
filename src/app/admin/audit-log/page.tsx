"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '../layout';
import styles from './AuditLog.module.css';

interface AuditItem {
  id: string;
  created_at: string;
  admin_id: string;
  admin_email: string;
  admin_role: string;
  action_type: string;
  target_id: string | null;
  target_name: string | null;
  details: string | null;
  ip_address: string | null;
}

export default function AuditLog() {
  const { admin } = useAdminAuth();
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [emailQuery, setEmailQuery] = useState('');
  const [actionQuery, setActionQuery] = useState('all');
  const [actionTypes, setActionTypes] = useState<string[]>([]);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const items: AuditItem[] = data || [];
      setLogs(items);

      // Extract unique action types for filter dropdown
      const types = Array.from(new Set(items.map(l => l.action_type))).filter(Boolean).sort();
      setActionTypes(types);
    } catch (e) {
      console.error('Error fetching audit logs:', e);
      triggerToast('Failed to load audit logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter logs
  useEffect(() => {
    let result = [...logs];

    // Filter by admin email query
    if (emailQuery.trim() !== '') {
      const q = emailQuery.toLowerCase();
      result = result.filter(l => 
        l.admin_email.toLowerCase().includes(q) ||
        (l.target_name && l.target_name.toLowerCase().includes(q))
      );
    }

    // Filter by action type
    if (actionQuery !== 'all') {
      result = result.filter(l => l.action_type === actionQuery);
    }

    setFilteredLogs(result);
  }, [logs, emailQuery, actionQuery]);

  const handleExportCSV = () => {
    try {
      const headers = ['Timestamp', 'Admin Email', 'Admin Role', 'Action Type', 'Target ID', 'Target Name', 'Details', 'IP Address'];
      const csvRows = [headers.join(',')];

      filteredLogs.forEach(l => {
        const row = [
          new Date(l.created_at).toLocaleString(),
          l.admin_email,
          l.admin_role,
          l.action_type,
          l.target_id || '',
          l.target_name ? `"${l.target_name.replace(/"/g, '""')}"` : '',
          l.details ? `"${l.details.replace(/"/g, '""')}"` : '',
          l.ip_address || 'unknown'
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `sinaki_audit_log_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      triggerToast('Audit log export completed successfully.', 'success');
    } catch (e) {
      console.error('CSV Export failed:', e);
      triggerToast('Export failed.', 'error');
    }
  };

  if (admin?.role !== 'super_admin') {
    return (
      <div className={styles.accessDenied}>
        <h2>🔒 Access Denied</h2>
        <p>You do not have the Super Administrator privileges required to view the system audit logs.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          {toast.message}
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className="headline-lg">System Audit Log</h1>
          <button className={styles.exportBtn} onClick={handleExportCSV}>
            📥 Export Audit CSV
          </button>
        </div>
        <p className="body-md">Append-only administrative logs tracking moderator actions. Entries cannot be edited or deleted.</p>
      </header>

      {/* Filter Options */}
      <div className={styles.filterSection}>
        <div className={styles.filterGrid}>
          <div className={styles.filterBox}>
            <label>Search Admin or Target</label>
            <input
              type="text"
              placeholder="Search email, name..."
              value={emailQuery}
              onChange={(e) => setEmailQuery(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.filterBox}>
            <label>Action Category</label>
            <select
              value={actionQuery}
              onChange={(e) => setActionQuery(e.target.value)}
              className={styles.select}
            >
              <option value="all">All Action Types</option>
              {actionTypes.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>Loading audit entries...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Administrator</th>
                <th>Access Role</th>
                <th>Action Type</th>
                <th>Target Person</th>
                <th>Audit Details</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyTable}>No actions recorded matching your filters.</td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className={styles.row}>
                    <td className={styles.timeCell}>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.admin_email}</td>
                    <td className={styles.roleBadge}>{log.admin_role.replace('_', ' ').toUpperCase()}</td>
                    <td>
                      <span className={styles.actionBadge}>{log.action_type}</span>
                    </td>
                    <td><b>{log.target_name || 'System / None'}</b></td>
                    <td className={styles.detailsCell}>{log.details || 'N/A'}</td>
                    <td><span className={styles.ipText}>{log.ip_address || '127.0.0.1'}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
