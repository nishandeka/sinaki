"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '../layout';
import styles from './Management.module.css';

interface AdminUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  is_active: boolean;
}

export default function AdminManagement() {
  const { admin, addAuditLog } = useAdminAuth();
  const [adminsList, setAdminsList] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form state
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'verification_admin' | 'moderation_admin' | 'support_admin' | 'analyst'>('verification_admin');
  const [inviteSaving, setInviteSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAdminsList(data || []);
    } catch (e) {
      console.error('Error fetching admins:', e);
      triggerToast('Failed to load administrative accounts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // Handle Disable/Enable account
  const handleToggleActive = async (targetAdmin: AdminUser) => {
    if (targetAdmin.id === admin?.id) {
      triggerToast('You cannot disable your own administrator account.', 'error');
      return;
    }

    try {
      const newStatus = !targetAdmin.is_active;
      const { error } = await supabase
        .from('admins')
        .update({ is_active: newStatus })
        .eq('id', targetAdmin.id);

      if (error) throw error;

      await addAuditLog(
        newStatus ? 'ENABLE_ADMIN_ACCOUNT' : 'DISABLE_ADMIN_ACCOUNT',
        targetAdmin.id,
        targetAdmin.email,
        `Set active status of admin ${targetAdmin.email} to: ${newStatus}`
      );

      triggerToast(`Admin account ${newStatus ? 'enabled' : 'disabled'} successfully.`, 'success');
      fetchAdmins();
    } catch (e) {
      console.error('Failed to toggle status:', e);
      triggerToast('Action failed.', 'error');
    }
  };

  // Invite new admin form submit
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmail.trim() === '' || !admin) return;

    setInviteSaving(true);
    try {
      // Call secure database RPC to assign role resolving auth.users ID
      const { data, error } = await supabase.rpc('add_admin_by_email', {
        email_param: newEmail.trim(),
        role_param: newRole,
        creator_id: admin.id
      });

      if (error) throw error;

      if (data === 'USER_NOT_FOUND') {
        triggerToast('No registered user found with this email on Sinaki. They must sign up first.', 'error');
      } else if (data === 'SUCCESS') {
        triggerToast(`Assigned ${newRole.replace('_', ' ')} role to ${newEmail} successfully.`, 'success');
        setNewEmail('');
        await addAuditLog('CREATE_ADMIN_ACCOUNT', undefined, newEmail, `Assigned administrative role: ${newRole}`);
        fetchAdmins();
      } else {
        triggerToast('Invite failed. Please verify user details.', 'error');
      }
    } catch (e) {
      console.error('Invite failed:', e);
      triggerToast('Error assigning admin role.', 'error');
    } finally {
      setInviteSaving(false);
    }
  };

  if (admin?.role !== 'super_admin') {
    return (
      <div className={styles.accessDenied}>
        <h2>🔒 Access Denied</h2>
        <p>You do not have the Super Administrator privileges required to manage admin accounts.</p>
      </div>
    );
  }

  // Permissions Grid
  const permissionsMatrix = [
    { name: 'View verification queue', super: true, verif: true, mod: false, support: false, analyst: false },
    { name: 'Approve/reject IDs', super: true, verif: true, mod: false, support: false, analyst: false },
    { name: 'View reports queue', super: true, verif: false, mod: true, support: true, analyst: false },
    { name: 'Warn / Suspend users', super: true, verif: false, mod: true, support: false, analyst: false },
    { name: 'Permanently Ban users', super: true, verif: false, mod: true, support: false, analyst: false },
    { name: 'View analytics dashboards', super: true, verif: false, mod: false, support: false, analyst: true },
    { name: 'Export CSV records', super: true, verif: false, mod: false, support: false, analyst: false },
    { name: 'Manage administrative roles', super: true, verif: false, mod: false, support: false, analyst: false },
    { name: 'Permanently delete accounts', super: true, verif: false, mod: false, support: false, analyst: false },
    { name: 'Read append-only Audit Log', super: true, verif: false, mod: false, support: false, analyst: false }
  ];

  return (
    <div className={styles.container}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          {toast.message}
        </div>
      )}

      <header className={styles.header}>
        <h1 className="headline-lg">Admin Management</h1>
        <p className="body-md">Manage administrative access roles, create permissions, and inspect team members.</p>
      </header>

      <div className={styles.mainGrid}>
        {/* Left Column: Admin list & Invite */}
        <div className={styles.leftCol}>
          {/* Create Admin Form */}
          <div className={styles.card}>
            <h3>Invite New Administrator</h3>
            <p className={styles.subtitle}>Enter the email of a registered user to assign them an administrative access role.</p>
            
            <form onSubmit={handleInviteSubmit} className={styles.inviteForm}>
              <div className={styles.formGroup}>
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="name@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Administrative Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className={styles.select}
                >
                  <option value="verification_admin">Verification Admin</option>
                  <option value="moderation_admin">Moderation Admin</option>
                  <option value="support_admin">Support Admin</option>
                  <option value="analyst">Read-Only Analyst</option>
                </select>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={inviteSaving}>
                {inviteSaving ? 'Assigning...' : 'Assign Admin Role'}
              </button>
            </form>
          </div>

          {/* List of Admins */}
          <div className={styles.card}>
            <h3>Active Administrative Accounts</h3>
            <div className={styles.tableWrapper}>
              {loading ? (
                <div className={styles.loading}>Loading accounts...</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Joined</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminsList.map((usr) => (
                      <tr key={usr.id} className={styles.row}>
                        <td><b>{usr.email}</b></td>
                        <td className={styles.roleLabel}>{usr.role.replace('_', ' ').toUpperCase()}</td>
                        <td>{new Date(usr.created_at).toLocaleDateString()}</td>
                        <td>
                          <span className={`${styles.statusBadge} ${usr.is_active ? styles.statusActive : styles.statusDisabled}`}>
                            {usr.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className={usr.is_active ? styles.disableBtn : styles.enableBtn}
                            onClick={() => handleToggleActive(usr)}
                            disabled={usr.id === admin?.id}
                          >
                            {usr.is_active ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Permissions Matrix */}
        <div className={styles.rightCol}>
          <div className={styles.card}>
            <h3>Role Permissions Matrix</h3>
            <p className={styles.subtitle}>Audit access level controls programmatically enforced on pages and DB triggers.</p>
            
            <div className={styles.matrixWrapper}>
              <table className={styles.matrixTable}>
                <thead>
                  <tr>
                    <th>Permission Area</th>
                    <th>Super</th>
                    <th>Verif</th>
                    <th>Mod</th>
                    <th>Supp</th>
                    <th>Analyst</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionsMatrix.map((p, i) => (
                    <tr key={i}>
                      <td className={styles.matrixPermName}>{p.name}</td>
                      <td>{p.super ? '✓' : '✗'}</td>
                      <td>{p.verif ? '✓' : '✗'}</td>
                      <td>{p.mod ? '✓' : '✗'}</td>
                      <td>{p.support ? '✓' : '✗'}</td>
                      <td>{p.analyst ? '✓' : '✗'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
