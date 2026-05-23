"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '../layout';
import styles from './Users.module.css';

interface UserItem {
  id: string;
  full_name: string;
  display_name: string;
  email: string;
  phone: string;
  age: number;
  gender: string;
  district: string;
  verification_status: string;
  is_active: boolean;
  created_at: string;
  last_seen: string;
}

export default function UserManagement() {
  const router = useRouter();
  const { admin, addAuditLog } = useAdminAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter values
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(70);
  const [districtsList, setDistrictsList] = useState<string[]>([]);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // 1. Fetch profiles and join auth users emails
      // In Supabase client, reading from profiles table is allowed.
      // But wait! Auth.users email is not directly readable via standard client profile SELECT due to schema isolation.
      // Let's check how the profiles table is structured. The profiles table has phone, and it has an association.
      // Let's query profiles and get all the fields.
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) throw error;

      // 2. Format profiles, calculate ages
      const formatted: UserItem[] = (profiles || []).map((p: any) => {
        let age = 18;
        if (p.date_of_birth) {
          const dobDate = new Date(p.date_of_birth);
          const ageDiffMs = Date.now() - dobDate.getTime();
          const ageDate = new Date(ageDiffMs);
          age = Math.abs(ageDate.getUTCFullYear() - 1970);
        }

        return {
          id: p.id,
          full_name: p.full_name || 'No Name',
          display_name: p.display_name || 'No Name',
          email: p.phone ? `${p.phone}@sinaki.in` : 'no-email@sinaki.in', // Mocking email if missing or fetch via client
          phone: p.phone || 'N/A',
          age,
          gender: p.gender || 'male',
          district: p.district || 'Assam',
          verification_status: p.verification_status || 'pending',
          is_active: p.is_active !== undefined ? p.is_active : true,
          created_at: p.created_at,
          last_seen: p.last_seen || p.created_at
        };
      });

      setUsers(formatted);

      // Extract unique districts
      const districts = Array.from(new Set(formatted.map(u => u.district))).filter(Boolean).sort();
      setDistrictsList(districts);
    } catch (e) {
      console.error('Error loading users:', e);
      triggerToast('Failed to load user list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter application
  useEffect(() => {
    let result = [...users];

    // Search query: name, phone, district
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => 
        u.full_name.toLowerCase().includes(q) ||
        u.display_name.toLowerCase().includes(q) ||
        u.phone.includes(q) ||
        u.district.toLowerCase().includes(q)
      );
    }

    // Gender filter
    if (genderFilter !== 'all') {
      result = result.filter(u => u.gender === genderFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        result = result.filter(u => u.is_active);
      } else if (statusFilter === 'suspended_banned') {
        result = result.filter(u => !u.is_active);
      }
    }

    // Verification filter
    if (verificationFilter !== 'all') {
      result = result.filter(u => u.verification_status === verificationFilter);
    }

    // District filter
    if (districtFilter !== 'all') {
      result = result.filter(u => u.district === districtFilter);
    }

    // Age Filter
    result = result.filter(u => u.age >= minAge && u.age <= maxAge);

    setFilteredUsers(result);
  }, [users, searchQuery, genderFilter, statusFilter, verificationFilter, districtFilter, minAge, maxAge]);

  // Export CSV
  const handleExportCSV = async () => {
    if (admin?.role !== 'super_admin') {
      triggerToast('Export permission denied. Super Admin role required.', 'error');
      return;
    }

    try {
      const headers = ['ID', 'Full Name', 'Display Name', 'Gender', 'Age', 'District', 'Phone', 'Verification Status', 'Active Status', 'Created At'];
      const csvRows = [headers.join(',')];

      filteredUsers.forEach(u => {
        const row = [
          u.id,
          `"${u.full_name.replace(/"/g, '""')}"`,
          `"${u.display_name.replace(/"/g, '""')}"`,
          u.gender,
          u.age,
          `"${u.district.replace(/"/g, '""')}"`,
          u.phone,
          u.verification_status,
          u.is_active ? 'Active' : 'Suspended/Banned',
          u.created_at
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `sinaki_users_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await addAuditLog('EXPORT_USERS_CSV', undefined, undefined, `Exported ${filteredUsers.length} user records as CSV`);
      triggerToast('CSV Export completed successfully.', 'success');
    } catch (e) {
      console.error('Export CSV failed:', e);
      triggerToast('Export failed.', 'error');
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
        <div className={styles.titleRow}>
          <h1 className="headline-lg">User Management</h1>
          {admin?.role === 'super_admin' && (
            <button className={styles.exportBtn} onClick={handleExportCSV}>
              📥 Export CSV
            </button>
          )}
        </div>
        <p className="body-md">Search, filter, and view detailed user activity records.</p>
      </header>

      {/* Filters Area */}
      <div className={styles.filterSection}>
        <div className={styles.filterGrid}>
          {/* Search */}
          <div className={styles.filterBox}>
            <label>Search Users</label>
            <input
              type="text"
              placeholder="Search by name, phone, district..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.input}
            />
          </div>

          {/* Gender */}
          <div className={styles.filterBox}>
            <label>Gender</label>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className={styles.select}
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          {/* Status */}
          <div className={styles.filterBox}>
            <label>Account Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.select}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended_banned">Suspended / Banned</option>
            </select>
          </div>

          {/* Verification */}
          <div className={styles.filterBox}>
            <label>Verification</label>
            <select
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
              className={styles.select}
            >
              <option value="all">All Verification Statuses</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* District */}
          <div className={styles.filterBox}>
            <label>District</label>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className={styles.select}
            >
              <option value="all">All Assam Districts</option>
              {districtsList.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Age range */}
          <div className={styles.filterBox}>
            <label>Age Range: {minAge} - {maxAge}</label>
            <div className={styles.ageSliderGroup}>
              <input
                type="range"
                min={18}
                max={70}
                value={minAge}
                onChange={(e) => setMinAge(Math.min(parseInt(e.target.value), maxAge))}
                className={styles.slider}
              />
              <input
                type="range"
                min={18}
                max={70}
                value={maxAge}
                onChange={(e) => setMaxAge(Math.max(parseInt(e.target.value), minAge))}
                className={styles.slider}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Users List Table */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loadingUsers}>Loading user accounts...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Age / Gender</th>
                <th>District</th>
                <th>Phone</th>
                <th>Verification</th>
                <th>Status</th>
                <th>Joined</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyTable}>No users found matching your filters.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className={styles.tableRow} onClick={() => router.push(`/admin/users/${user.id}`)}>
                    <td>
                      <div className={styles.nameCell}>
                        <div className={styles.avatarMini}>{user.full_name.substring(0, 2).toUpperCase()}</div>
                        <b>{user.full_name}</b>
                      </div>
                    </td>
                    <td>{user.age} yrs / <span className={styles.capitalize}>{user.gender}</span></td>
                    <td>{user.district}</td>
                    <td>{user.phone}</td>
                    <td>
                      <span className={`${styles.badge} ${
                        user.verification_status === 'verified' ? styles.badgeGreen :
                        user.verification_status === 'rejected' ? styles.badgeRed : styles.badgeAmber
                      }`}>
                        {user.verification_status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.statusLabel} ${user.is_active ? styles.statusActive : styles.statusSuspended}`}>
                        {user.is_active ? 'Active' : 'Suspended/Banned'}
                      </span>
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <Link href={`/admin/users/${user.id}`} className={styles.viewBtn}>
                        Manage
                      </Link>
                    </td>
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
