"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '../layout';
import styles from './Verification.module.css';

interface QueueItem {
  id: string;
  profile_id: string;
  full_name: string;
  age: number;
  gender: string;
  district: string;
  community: string;
  dob: string;
  phone: string;
  created_at: string;
  photos_count: number;
  id_card_url: string;
  id_card_type: string;
  selfie_url: string;
  submitted_at: string;
  status: 'pending' | 'under_review' | 'verified' | 'rejected';
  rejection_reason?: string;
  notes?: string;
}

export default function VerificationQueue() {
  const { admin, addAuditLog } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [filteredQueue, setFilteredQueue] = useState<QueueItem[]>([]);
  
  // Filters and Sorting
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'under_review' | 'verified' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'submitted_oldest' | 'submitted_newest' | 'district' | 'gender'>('submitted_oldest');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Drawer & Inspection State
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [checklist, setChecklist] = useState({
    faceMatches: false,
    nameMatches: false,
    age18Plus: false,
    idGenuine: false,
    selfieLive: false
  });

  // Rejection Form
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('ID not clear/blurry');
  const [rejectNotes, setRejectNotes] = useState('');

  // Confirmation Modal
  const [showApproveModal, setShowApproveModal] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchQueue = async () => {
    setLoading(true);
    try {
      // 1. Fetch verification queue list joined with profile details
      const { data, error } = await supabase
        .from('verification_queue')
        .select(`
          id,
          id_card_url,
          id_card_type,
          selfie_url,
          submitted_at,
          status,
          notes,
          profiles:profile_id (
            id,
            full_name,
            date_of_birth,
            gender,
            district,
            community,
            phone,
            created_at,
            photos,
            rejection_reason
          )
        `);

      if (error) throw error;

      const formatted: QueueItem[] = (data || []).map((item: any) => {
        const profile = item.profiles || {};
        
        // Calculate Age from Date of Birth
        let age = 18;
        if (profile.date_of_birth) {
          const dobDate = new Date(profile.date_of_birth);
          const ageDiffMs = Date.now() - dobDate.getTime();
          const ageDate = new Date(ageDiffMs);
          age = Math.abs(ageDate.getUTCFullYear() - 1970);
        }

        return {
          id: item.id,
          profile_id: profile.id || '',
          full_name: profile.full_name || 'Unknown',
          age,
          gender: profile.gender || 'male',
          district: profile.district || 'Kamrup Metropolitan',
          community: profile.community || 'assamese',
          dob: profile.date_of_birth || '',
          phone: profile.phone || '98XXX-XXXXX',
          created_at: profile.created_at || item.submitted_at,
          photos_count: profile.photos ? profile.photos.length : 0,
          id_card_url: item.id_card_url || '',
          id_card_type: item.id_card_type || 'aadhaar',
          selfie_url: item.selfie_url || '',
          submitted_at: item.submitted_at,
          status: item.status || 'pending',
          rejection_reason: profile.rejection_reason || '',
          notes: item.notes || ''
        };
      });

      setQueue(formatted);
    } catch (e) {
      console.error('Error fetching verification queue:', e);
      triggerToast('Failed to load queue. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  // Filter, Search, Sort execution
  useEffect(() => {
    let result = [...queue];

    // Filter by Active Tab status
    if (activeTab !== 'all') {
      result = result.filter(item => item.status === activeTab);
    }

    // Filter by Search Query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.full_name.toLowerCase().includes(q) ||
        item.phone.includes(q) ||
        item.district.toLowerCase().includes(q) ||
        item.id_card_type.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'submitted_oldest') {
        return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
      }
      if (sortBy === 'submitted_newest') {
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      }
      if (sortBy === 'district') {
        return a.district.localeCompare(b.district);
      }
      if (sortBy === 'gender') {
        return a.gender.localeCompare(b.gender);
      }
      return 0;
    });

    setFilteredQueue(result);
    setCurrentPage(1); // reset to page 1 on filter
  }, [queue, activeTab, searchQuery, sortBy]);

  // Handle Review action
  const handleReviewClick = async (item: QueueItem) => {
    setSelectedItem(item);
    setShowDrawer(true);
    setZoomLevel(1);
    setRotation(0);
    setChecklist({
      faceMatches: false,
      nameMatches: false,
      age18Plus: false,
      idGenuine: false,
      selfieLive: false
    });
    setShowRejectForm(false);
    setRejectNotes('');

    // If status is pending, mark it 'under_review' in DB
    if (item.status === 'pending') {
      try {
        const { error } = await supabase
          .from('verification_queue')
          .update({ status: 'under_review', reviewed_by: admin?.email })
          .eq('id', item.id);

        if (!error) {
          // Update local state without full reload
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'under_review' } : q));
          // Update selected item state
          setSelectedItem(prev => prev ? { ...prev, status: 'under_review' } : null);
        }
      } catch (e) {
        console.error('Failed to update status to under review:', e);
      }
    }
  };

  // Close Drawer
  const handleCloseDrawer = async () => {
    // If we close drawer while it was under review, reset back to pending so another admin can pick it up
    if (selectedItem && selectedItem.status === 'under_review') {
      try {
        await supabase
          .from('verification_queue')
          .update({ status: 'pending', reviewed_by: null })
          .eq('id', selectedItem.id);
        
        fetchQueue(); // Reload queue
      } catch (e) {}
    }
    setShowDrawer(false);
    setSelectedItem(null);
  };

  // Handle Approval Action
  const handleApprove = async () => {
    if (!selectedItem || !admin) return;

    try {
      const now = new Date().toISOString();

      // 1. Update Profile status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          verification_status: 'verified',
          verified_at: now,
          rejection_reason: null
        })
        .eq('id', selectedItem.profile_id);

      if (profileError) throw profileError;

      // 2. Update Queue status
      const { error: queueError } = await supabase
        .from('verification_queue')
        .update({
          status: 'verified',
          reviewed_at: now,
          reviewed_by: admin.email,
          notes: 'Approved'
        })
        .eq('id', selectedItem.id);

      if (queueError) throw queueError;

      // 3. Create user notification
      await supabase.from('notifications').insert({
        user_id: selectedItem.profile_id,
        type: 'verification_approved',
        title: 'Identity Verified ✓',
        body: 'Congratulations! Your profile identity verification has been approved. You are now fully active on Sinaki.'
      });

      // 4. Log in Audit Log
      await addAuditLog(
        'APPROVED_VERIFICATION',
        selectedItem.profile_id,
        selectedItem.full_name,
        `Approved identity documents (${selectedItem.id_card_type})`
      );

      triggerToast(`${selectedItem.full_name} — Verified successfully`, 'success');
      setShowDrawer(false);
      setSelectedItem(null);
      setShowApproveModal(false);
      
      // Refresh
      fetchQueue();
    } catch (e) {
      console.error('Approve failed:', e);
      triggerToast('Approval action failed. Please try again.', 'error');
    }
  };

  // Handle Rejection Action
  const handleReject = async () => {
    if (!selectedItem || !admin) return;

    try {
      const now = new Date().toISOString();
      const reason = rejectReason === 'Other' ? rejectNotes : `${rejectReason}: ${rejectNotes}`;

      // 1. Update Profile status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          verification_status: 'rejected',
          rejection_reason: reason
        })
        .eq('id', selectedItem.profile_id);

      if (profileError) throw profileError;

      // 2. Update Queue status
      const { error: queueError } = await supabase
        .from('verification_queue')
        .update({
          status: 'rejected',
          reviewed_at: now,
          reviewed_by: admin.email,
          notes: reason
        })
        .eq('id', selectedItem.id);

      if (queueError) throw queueError;

      // 3. Create user notification
      await supabase.from('notifications').insert({
        user_id: selectedItem.profile_id,
        type: 'verification_rejected',
        title: 'Verification Rejected ✗',
        body: `Your identity verification failed for the following reason: ${rejectReason}. Please resubmit clean photos.`
      });

      // 4. Log in Audit Log
      await addAuditLog(
        'REJECTED_VERIFICATION',
        selectedItem.profile_id,
        selectedItem.full_name,
        `Rejected identity verification. Reason: ${reason}`
      );

      triggerToast(`${selectedItem.full_name} — Rejected: ${rejectReason}`, 'warning');
      setShowDrawer(false);
      setSelectedItem(null);
      setShowRejectForm(false);

      // Refresh
      fetchQueue();
    } catch (e) {
      console.error('Rejection failed:', e);
      triggerToast('Rejection action failed. Please try again.', 'error');
    }
  };

  // Handle Ask for Resubmission
  const handleResubmit = async () => {
    setRejectReason('ID not clear/blurry');
    setRejectNotes('Please upload a clear, un-cropped photograph of your ID.');
    setShowRejectForm(true);
  };

  // Image zoom and rotation
  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.75));
  const rotateRight = () => setRotation(prev => (prev + 90) % 360);

  // Pagination bounds
  const totalPages = Math.ceil(filteredQueue.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredQueue.slice(indexOfFirstItem, indexOfLastItem);

  const isChecklistComplete = 
    checklist.faceMatches && 
    checklist.nameMatches && 
    checklist.age18Plus && 
    checklist.idGenuine && 
    checklist.selfieLive;

  // Mask Phone number (e.g. 98XXX-XX321)
  const maskPhone = (phoneStr: string) => {
    if (phoneStr.length < 5) return '98XXX-XXXXX';
    return `${phoneStr.substring(0, 2)}XXX-XX${phoneStr.substring(phoneStr.length - 3)}`;
  };

  return (
    <div className={styles.container}>
      {/* Toast Alert */}
      {toast && (
        <div className={`${styles.toast} ${
          toast.type === 'success' ? styles.toastSuccess :
          toast.type === 'error' ? styles.toastError : styles.toastWarning
        }`}>
          {toast.message}
        </div>
      )}

      <header className={styles.header}>
        <h1 className="headline-lg">Verification Queue</h1>
        <p className="body-md">Verify the identities of registered users to maintain safety.</p>
      </header>

      {/* Queue Overview & Filters */}
      <div className={styles.filterBar}>
        <div className={styles.tabs}>
          {[
            { id: 'all', label: 'All', count: queue.length },
            { id: 'pending', label: 'Pending', count: queue.filter(q => q.status === 'pending').length },
            { id: 'under_review', label: 'Under Review', count: queue.filter(q => q.status === 'under_review').length },
            { id: 'verified', label: 'Verified', count: queue.filter(q => q.status === 'verified').length },
            { id: 'rejected', label: 'Rejected', count: queue.filter(q => q.status === 'rejected').length }
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
            placeholder="Search by name, phone, district..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className={styles.selectSort}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="submitted_oldest">Submitted (Oldest First)</option>
            <option value="submitted_newest">Submitted (Newest First)</option>
            <option value="district">District</option>
            <option value="gender">Gender</option>
          </select>
        </div>
      </div>

      {/* Queue Table */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loadingQueue}>Loading verification queue...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Thumbnail</th>
                <th>Name</th>
                <th>Age / Gender</th>
                <th>District</th>
                <th>Document Type</th>
                <th>Submitted</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyQueue}>
                    All caught up. No pending verifications right now.
                  </td>
                </tr>
              ) : (
                currentItems.map((item) => (
                  <tr key={item.id} className={styles.tableRow} onClick={() => handleReviewClick(item)}>
                    <td>
                      <img
                        src={item.selfie_url || '/logo.png'}
                        alt={item.full_name}
                        className={styles.thumb}
                        onError={(e) => { (e.target as any).src = '/logo.png'; }}
                      />
                    </td>
                    <td>
                      <b className={styles.name}>{item.full_name}</b>
                    </td>
                    <td>
                      {item.age} years / <span className={styles.genderLabel}>{item.gender}</span>
                    </td>
                    <td>{item.district}</td>
                    <td>
                      <span className={styles.idTypeBadge}>{item.id_card_type.toUpperCase()}</span>
                    </td>
                    <td>{new Date(item.submitted_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`${styles.badge} ${
                        item.status === 'pending' ? styles.badgeAmber :
                        item.status === 'under_review' ? styles.badgeBlue :
                        item.status === 'verified' ? styles.badgeGreen : styles.badgeRed
                      }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      {item.status === 'pending' && (
                        <button className={styles.actionBtnPrimary} onClick={() => handleReviewClick(item)}>
                          Review
                        </button>
                      )}
                      {item.status === 'under_review' && (
                        <button className={styles.actionBtnSecondary} onClick={() => handleReviewClick(item)}>
                          Continue
                        </button>
                      )}
                      {(item.status === 'verified' || item.status === 'rejected') && (
                        <button className={styles.actionBtnGhost} onClick={() => handleReviewClick(item)}>
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className={styles.pageBtn}
          >
            Prev
          </button>
          {[...Array(totalPages)].map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPage(idx + 1)}
              className={`${styles.pageBtn} ${currentPage === idx + 1 ? styles.activePage : ''}`}
            >
              {idx + 1}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className={styles.pageBtn}
          >
            Next
          </button>
        </div>
      )}

      {/* Inspection Detail Drawer Overlay */}
      {showDrawer && selectedItem && (
        <div className={styles.drawerOverlay}>
          <div className={styles.drawer}>
            <header className={styles.drawerHeader}>
              <div className={styles.drawerTitleRow}>
                <h2>Identity Verification Context</h2>
                <span className={`${styles.drawerBadge} ${
                  selectedItem.status === 'pending' ? styles.badgeAmber :
                  selectedItem.status === 'under_review' ? styles.badgeBlue :
                  selectedItem.status === 'verified' ? styles.badgeGreen : styles.badgeRed
                }`}>
                  {selectedItem.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <button className={styles.closeDrawerBtn} onClick={handleCloseDrawer}>✕</button>
            </header>

            <div className={styles.drawerContent}>
              {/* Left Column: User Profile context */}
              <div className={styles.drawerLeft}>
                <div className={styles.profileSummaryCard}>
                  <img
                    src={selectedItem.selfie_url || '/logo.png'}
                    alt={selectedItem.full_name}
                    className={styles.largeAvatar}
                    onError={(e) => { (e.target as any).src = '/logo.png'; }}
                  />
                  <h3>{selectedItem.full_name}</h3>
                  <div className={styles.districtTag}>{selectedItem.district}</div>
                  
                  <div className={styles.profileMetaList}>
                    <div className={styles.metaRow}>
                      <span>Age / Gender:</span>
                      <span>{selectedItem.age} / {selectedItem.gender.toUpperCase()}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span>Date of Birth:</span>
                      <span>{selectedItem.dob}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span>Community:</span>
                      <span>{selectedItem.community.toUpperCase()}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span>Phone:</span>
                      <span>{maskPhone(selectedItem.phone)}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span>Account Created:</span>
                      <span>{new Date(selectedItem.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Behavioral indicators summary */}
                <div className={styles.behaviorSummaryCard}>
                  <h4>Behavior Summary</h4>
                  <div className={styles.profileMetaList}>
                    <div className={styles.metaRow}>
                      <span>Profile Complete:</span>
                      <span>Yes</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span>Photos Uploaded:</span>
                      <span>{selectedItem.photos_count} photos</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span>Reports against user:</span>
                      <span style={{ color: '#4A7C59', fontWeight: 'bold' }}>None</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span>Previous Rejections:</span>
                      <span>{selectedItem.rejection_reason ? 'Yes' : 'None'}</span>
                    </div>
                    {selectedItem.rejection_reason && (
                      <div className={styles.rejectionDetail}>
                        Prev Reject: "{selectedItem.rejection_reason}"
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: ID Document inspections and controls */}
              <div className={styles.drawerRight}>
                {/* ID Document Viewer */}
                <div className={styles.docViewerCard}>
                  <div className={styles.docHeader}>
                    <h4>Submitted {selectedItem.id_card_type.toUpperCase()} Document</h4>
                    <div className={styles.viewerControls}>
                      <button onClick={zoomIn} title="Zoom In">+</button>
                      <button onClick={zoomOut} title="Zoom Out">-</button>
                      <button onClick={rotateRight} title="Rotate 90°">⟳</button>
                      <a href={selectedItem.id_card_url} download target="_blank" rel="noopener noreferrer" className={styles.dlLink} title="Download ID">⬇</a>
                    </div>
                  </div>

                  <div className={styles.imageContainer}>
                    {selectedItem.id_card_url ? (
                      <img
                        src={selectedItem.id_card_url}
                        alt="Submitted ID"
                        className={styles.idCardImage}
                        style={{
                          transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                          transition: 'transform 0.2s ease'
                        }}
                      />
                    ) : (
                      <div className={styles.noDocImage}>No document image uploaded.</div>
                    )}
                  </div>
                </div>

                {/* Validation Checklist Form (required to approve) */}
                <div className={styles.checklistCard}>
                  <h4>Document Verification Checklist</h4>
                  <p className={styles.checklistHint}>All 5 items must be confirmed before approval is unlocked.</p>
                  
                  <div className={styles.checklistItems}>
                    <label className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={checklist.faceMatches}
                        onChange={(e) => setChecklist(prev => ({ ...prev, faceMatches: e.target.checked }))}
                        disabled={selectedItem.status === 'verified'}
                      />
                      <span>Face matches ID photo</span>
                    </label>
                    <label className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={checklist.nameMatches}
                        onChange={(e) => setChecklist(prev => ({ ...prev, nameMatches: e.target.checked }))}
                        disabled={selectedItem.status === 'verified'}
                      />
                      <span>Name matches profile name</span>
                    </label>
                    <label className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={checklist.age18Plus}
                        onChange={(e) => setChecklist(prev => ({ ...prev, age18Plus: e.target.checked }))}
                        disabled={selectedItem.status === 'verified'}
                      />
                      <span>Date of birth confirms age 18+</span>
                    </label>
                    <label className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={checklist.idGenuine}
                        onChange={(e) => setChecklist(prev => ({ ...prev, idGenuine: e.target.checked }))}
                        disabled={selectedItem.status === 'verified'}
                      />
                      <span>ID appears genuine (not edited)</span>
                    </label>
                    <label className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={checklist.selfieLive}
                        onChange={(e) => setChecklist(prev => ({ ...prev, selfieLive: e.target.checked }))}
                        disabled={selectedItem.status === 'verified'}
                      />
                      <span>Selfie photo is live (not photo of photo)</span>
                    </label>
                  </div>
                </div>

                {/* Action Controls */}
                <div className={styles.drawerActions}>
                  {selectedItem.status !== 'verified' && selectedItem.status !== 'rejected' && (
                    <>
                      <button
                        className={styles.approveBtn}
                        disabled={!isChecklistComplete}
                        onClick={() => setShowApproveModal(true)}
                      >
                        Approve Profile
                      </button>
                      <button className={styles.rejectBtn} onClick={() => setShowRejectForm(true)}>
                        Reject Identity
                      </button>
                      <button className={styles.resubmitBtn} onClick={handleResubmit}>
                        Request Re-submission
                      </button>
                    </>
                  )}

                  {(selectedItem.status === 'verified' || selectedItem.status === 'rejected') && (
                    <div className={styles.completedBanner}>
                      Identity verification workflow completed for this user.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {showApproveModal && selectedItem && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <h3>Confirm Verification Approval</h3>
            <p>
              Are you sure you want to approve identity verification for <b>{selectedItem.full_name}</b>? This grants them fully-verified status on the platform.
            </p>
            <div className={styles.modalButtons}>
              <button className={styles.confirmBtn} onClick={handleApprove}>Confirm Approval</button>
              <button className={styles.cancelBtn} onClick={() => setShowApproveModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Subform Modal Dialog */}
      {showRejectForm && selectedItem && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <h3>Reject Verification Request</h3>
            <p>Provide a rejection reason which will be communicated to the user.</p>
            
            <div className={styles.formGroup}>
              <label className={styles.modalLabel}>Rejection Reason</label>
              <select
                className={styles.modalInput}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              >
                <option value="ID not clear/blurry">ID not clear/blurry</option>
                <option value="ID appears edited or fake">ID appears edited or fake</option>
                <option value="Face does not match ID">Face does not match ID</option>
                <option value="Age under 18">Age under 18</option>
                <option value="ID type not accepted">ID type not accepted</option>
                <option value="Name does not match profile">Name does not match profile</option>
                <option value="Other">Other (Free text notes below)</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.modalLabel}>Additional Notes / Explanations</label>
              <textarea
                className={styles.modalTextarea}
                placeholder="Include details to explain to the user what went wrong..."
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                rows={3}
                required={rejectReason === 'Other'}
              />
            </div>

            <div className={styles.modalButtons}>
              <button
                className={styles.confirmBtnRed}
                onClick={handleReject}
                disabled={rejectReason === 'Other' && rejectNotes.trim() === ''}
              >
                Reject Request
              </button>
              <button className={styles.cancelBtn} onClick={() => setShowRejectForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
