"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './AdminLayout.module.css';

interface AdminInfo {
  id: string;
  email: string;
  role: 'super_admin' | 'verification_admin' | 'moderation_admin' | 'support_admin' | 'analyst';
  is_active: boolean;
}

interface AdminAuthContextType {
  admin: AdminInfo | null;
  loading: boolean;
  logout: () => Promise<void>;
  notifications: any[];
  addAuditLog: (action: string, targetId?: string, targetName?: string, details?: string) => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(900); // 15 mins in seconds

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check login and fetch admin status
  useEffect(() => {
    if (pathname === '/admin/login') {
      setLoading(false);
      return;
    }

    const checkAdminSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/admin/login');
          return;
        }

        const { data: adminData, error } = await supabase
          .from('admins')
          .select('*')
          .eq('id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (error || !adminData) {
          // Logged in but not an authorized admin, sign out and redirect
          await supabase.auth.signOut();
          router.replace('/admin/login');
          return;
        }

        setAdmin(adminData);
        setLoading(false);
        
        // Setup inactivity timer and realtime subscriptions
        resetInactivityTimer();
        fetchNotifications();
        subscribeRealtimeEvents();
      } catch (err) {
        console.error('Session verification error:', err);
        router.replace('/admin/login');
      }
    };

    checkAdminSession();

    // Listen to mouse, keyboard, scroll, click actions to reset inactivity
    const events = ['mousedown', 'keydown', 'scroll', 'click', 'touchstart'];
    const handleActivity = () => resetInactivityTimer();
    events.forEach(e => window.addEventListener(e, handleActivity));

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [pathname]);

  // Fetch pending notifications (verifications and reports)
  const fetchNotifications = async () => {
    try {
      const { data: verifCount } = await supabase
        .from('verification_queue')
        .select('id')
        .eq('status', 'pending');

      const { data: reportsCount } = await supabase
        .from('reports')
        .select('id')
        .eq('is_reviewed', false);

      const items = [];
      if (verifCount && verifCount.length > 0) {
        items.push({
          id: 'verif-alert',
          type: 'verification',
          title: 'Pending Verifications',
          body: `${verifCount.length} identity verification requests in queue.`,
          count: verifCount.length,
          link: '/admin/verification',
          color: '#E67E22'
        });
      }
      if (reportsCount && reportsCount.length > 0) {
        items.push({
          id: 'report-alert',
          type: 'report',
          title: 'Unreviewed Reports',
          body: `${reportsCount.length} reports require moderator action.`,
          count: reportsCount.length,
          link: '/admin/reports',
          color: '#E74C3C'
        });
      }

      setNotifications(items);
    } catch (e) {
      console.error('Error fetching admin notifications:', e);
    }
  };

  const subscribeRealtimeEvents = () => {
    // Realtime channel for verifications
    const verifSub = supabase
      .channel('admin-verif-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verification_queue' }, () => {
        fetchNotifications();
      })
      .subscribe();

    // Realtime channel for reports
    const reportSub = supabase
      .channel('admin-report-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(verifSub);
      supabase.removeChannel(reportSub);
    };
  };

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    
    setShowWarningModal(false);
    setWarningCountdown(900); // 15 mins

    // Set timer for 7 hours and 45 minutes (27900 seconds)
    inactivityTimerRef.current = setTimeout(() => {
      setShowWarningModal(true);
      startWarningCountdown();
    }, 27900 * 1000); 
  };

  const startWarningCountdown = () => {
    countdownTimerRef.current = setInterval(() => {
      setWarningCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current!);
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const addAuditLog = async (action: string, targetId?: string, targetName?: string, details?: string) => {
    if (!admin) return;
    try {
      // Fetch current IP address
      let ipAddress = 'unknown';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ipAddress = ipData.ip;
      } catch (e) {}

      await supabase.from('audit_logs').insert({
        admin_id: admin.id,
        admin_email: admin.email,
        admin_role: admin.role,
        action_type: action,
        target_id: targetId || null,
        target_name: targetName || null,
        details: details || null,
        ip_address: ipAddress
      });
    } catch (e) {
      console.error('Audit log insertion failed:', e);
    }
  };

  const handleLogout = async () => {
    await addAuditLog('ADMIN_LOGOUT', undefined, undefined, 'Admin logged out manually or by session inactivity');
    await supabase.auth.signOut();
    setAdmin(null);
    setShowWarningModal(false);
    router.replace('/admin/login');
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.skeletonContainer}>
          <div className={styles.skeletonSidebar}></div>
          <div className={styles.skeletonMain}>
            <div className={styles.skeletonHeader}></div>
            <div className={styles.skeletonCards}>
              <div className={styles.skeletonCard}></div>
              <div className={styles.skeletonCard}></div>
              <div className={styles.skeletonCard}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If path is login page, render child component directly without sidebar/nav
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Nav configuration
  const navItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: '🏠', roles: ['super_admin', 'verification_admin', 'moderation_admin', 'support_admin', 'analyst'] },
    { label: 'Verification Queue', path: '/admin/verification', icon: '📋', roles: ['super_admin', 'verification_admin'] },
    { label: 'Reports', path: '/admin/reports', icon: '🚩', roles: ['super_admin', 'moderation_admin', 'support_admin'] },
    { label: 'Users', path: '/admin/users', icon: '👥', roles: ['super_admin', 'verification_admin', 'moderation_admin', 'support_admin', 'analyst'] },
    { label: 'Flagged Messages', path: '/admin/messages', icon: '💬', roles: ['super_admin', 'moderation_admin'] },
    { label: 'Analytics', path: '/admin/analytics', icon: '📊', roles: ['super_admin', 'analyst'] },
    { label: 'Settings', path: '/admin/settings', icon: '⚙️', roles: ['super_admin'] },
    { label: 'Admin Management', path: '/admin/management', icon: '👤', roles: ['super_admin'] },
    { label: 'Audit Log', path: '/admin/audit-log', icon: '📁', roles: ['super_admin'] },
  ];

  const filteredNavItems = navItems.filter(item => admin && item.roles.includes(admin.role));

  return (
    <AdminAuthContext.Provider value={{ admin, loading, logout: handleLogout, notifications, addAuditLog }}>
      <div className={`${styles.wrapper} ${sidebarCollapsed ? styles.collapsed : ''}`}>
        {/* Sidebar Navigation */}
        <aside className={styles.sidebar}>
          <div className={styles.logoContainer}>
            <img src="/logo.png" alt="Sinaki" className={styles.logoImage} />
            {!sidebarCollapsed && <span className={styles.logoText}>Admin</span>}
          </div>

          <nav className={styles.nav}>
            {filteredNavItems.map((item, idx) => {
              const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
              return (
                <Link
                  key={idx}
                  href={item.path}
                  className={`${styles.navLink} ${isActive ? styles.active : ''}`}
                  title={sidebarCollapsed ? item.label : ''}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {!sidebarCollapsed && <span className={styles.navLabel}>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <button
            className={styles.collapseToggle}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? '👉' : '👈'}
          </button>
        </aside>

        {/* Main Content Area */}
        <div className={styles.contentWrapper}>
          {/* Top Bar Header */}
          <header className={styles.topbar}>
            <div className={styles.breadcrumb}>
              <span className={styles.breadcrumbMain}>Sinaki Admin</span>
              <span className={styles.breadcrumbSeparator}>/</span>
              <span className={styles.breadcrumbActive}>
                {navItems.find(n => pathname.startsWith(n.path))?.label || 'Dashboard'}
              </span>
            </div>

            <div className={styles.headerRight}>
              {/* Notifications Bell */}
              <div className={styles.notificationsContainer}>
                <button
                  className={styles.bellBtn}
                  onClick={() => setShowNotifications(!showNotifications)}
                  title="Notifications"
                >
                  🔔
                  {notifications.length > 0 && (
                    <span className={styles.bellBadge}>
                      {notifications.reduce((acc, curr) => acc + (curr.count || 0), 0)}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className={styles.notificationsDropdown}>
                    <div className={styles.notificationsHeader}>
                      <h4>System Alerts</h4>
                      <button onClick={() => setShowNotifications(false)}>✕</button>
                    </div>
                    <div className={styles.notificationsList}>
                      {notifications.length === 0 ? (
                        <div className={styles.emptyNotifications}>All caught up. No new system alerts.</div>
                      ) : (
                        notifications.map((notif) => (
                          <Link
                            key={notif.id}
                            href={notif.link}
                            className={styles.notificationItem}
                            onClick={() => setShowNotifications(false)}
                          >
                            <div
                              className={styles.notificationColorBar}
                              style={{ backgroundColor: notif.color }}
                            ></div>
                            <div className={styles.notificationContent}>
                              <h5>{notif.title}</h5>
                              <p>{notif.body}</p>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Profile Info */}
              {admin && (
                <div className={styles.adminProfile}>
                  <div className={styles.avatar}>
                    {admin.email.substring(0, 2).toUpperCase()}
                  </div>
                  <div className={styles.adminInfo}>
                    <span className={styles.adminEmail}>{admin.email}</span>
                    <span className={styles.adminRole}>
                      {admin.role.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <button
                    className={styles.logoutBtn}
                    onClick={handleLogout}
                    title="Sign Out"
                  >
                    🚪
                  </button>
                </div>
              )}
            </div>
          </header>

          <main className={styles.main}>
            {children}
          </main>
        </div>

        {/* 15-Minute Inactivity warning overlay */}
        {showWarningModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.warningCard}>
              <h3>⚠️ Inactivity Session Warning</h3>
              <p>
                Your admin session has been inactive. For security reasons, you will be automatically logged out in:
              </p>
              <div className={styles.countdown}>{formatCountdown(warningCountdown)}</div>
              <div className={styles.modalActions}>
                <button
                  className={styles.confirmBtn}
                  onClick={resetInactivityTimer}
                >
                  Stay Logged In
                </button>
                <button
                  className={styles.cancelBtn}
                  onClick={handleLogout}
                >
                  Logout Now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminAuthContext.Provider>
  );
}
