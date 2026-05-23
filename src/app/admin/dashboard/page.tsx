"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '../layout';
import styles from './Dashboard.module.css';

interface DashboardStats {
  totalUsers: number;
  totalUsersToday: number;
  pendingVerifications: number;
  pendingVerificationsToday: number;
  activeReports: number;
  unreviewedReports: number;
  activeMatches: number;
  activeMatchesThisWeek: number;
}

interface RecentVerif {
  id: string;
  name: string;
  district: string;
  submittedAt: string;
  status: string;
}

interface RecentReport {
  id: string;
  reporterName: string;
  reportedName: string;
  reason: string;
  createdAt: string;
  isReviewed: boolean;
}

interface ActivityEvent {
  id: string;
  time: string;
  timestamp: Date;
  message: React.ReactNode;
  type: 'positive' | 'warning' | 'alert';
}

export default function AdminDashboard() {
  const { admin } = useAdminAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalUsersToday: 0,
    pendingVerifications: 0,
    pendingVerificationsToday: 0,
    activeReports: 0,
    unreviewedReports: 0,
    activeMatches: 0,
    activeMatchesThisWeek: 0,
  });

  const [recentVerifs, setRecentVerifs] = useState<RecentVerif[]>([]);
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<ActivityEvent[]>([]);
  
  // Chart Data
  const [growthData, setGrowthData] = useState<{ date: string; male: number; female: number }[]>([]);
  const [districtData, setDistrictData] = useState<{ district: string; count: number }[]>([]);
  const [verifPieData, setVerifPieData] = useState({ verified: 0, pending: 0, rejected: 0 });

  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const weekAgoStart = new Date();
      weekAgoStart.setDate(weekAgoStart.getDate() - 7);
      weekAgoStart.setHours(0, 0, 0, 0);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      // 1. Fetch total user metrics
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('created_at, gender, verification_status, district, full_name');

      if (pError) throw pError;

      const totalUsers = profiles.length;
      const totalUsersToday = profiles.filter(p => new Date(p.created_at) >= todayStart).length;

      // 2. Fetch pending verifications
      const { data: verifs, error: vError } = await supabase
        .from('verification_queue')
        .select('submitted_at, status');

      if (vError) throw vError;

      const pendingVerifications = verifs.filter(v => v.status === 'pending').length;
      const pendingVerificationsToday = verifs.filter(v => v.status === 'pending' && new Date(v.submitted_at) >= todayStart).length;

      // 3. Fetch reports
      const { data: reports, error: rError } = await supabase
        .from('reports')
        .select('created_at, is_reviewed');

      if (rError) throw rError;

      const activeReports = reports.length;
      const unreviewedReports = reports.filter(r => !r.is_reviewed).length;

      // 4. Fetch matches
      const { data: matches, error: mError } = await supabase
        .from('matches')
        .select('matched_at');

      if (mError) throw mError;

      const activeMatches = matches.length;
      const activeMatchesThisWeek = matches.filter(m => new Date(m.matched_at) >= weekAgoStart).length;

      setStats({
        totalUsers,
        totalUsersToday,
        pendingVerifications,
        pendingVerificationsToday,
        activeReports,
        unreviewedReports,
        activeMatches,
        activeMatchesThisWeek,
      });

      // 5. Fetch recent verifications (last 5)
      const { data: recentVData } = await supabase
        .from('verification_queue')
        .select('id, submitted_at, status, profiles:profile_id(full_name, district)')
        .order('submitted_at', { ascending: false })
        .limit(5);

      const formattedVerifs: RecentVerif[] = (recentVData || []).map((v: any) => ({
        id: v.id,
        name: v.profiles?.full_name || 'Unknown User',
        district: v.profiles?.district || 'Unknown District',
        submittedAt: new Date(v.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: v.status
      }));
      setRecentVerifs(formattedVerifs);

      // 6. Fetch recent reports (last 5)
      const { data: recentRData } = await supabase
        .from('reports')
        .select('id, created_at, reason, is_reviewed, reporter:reporter_id(full_name), reported:reported_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(5);

      const formattedReports: RecentReport[] = (recentRData || []).map((r: any) => ({
        id: r.id,
        reporterName: r.reporter?.full_name || 'Reporter',
        reportedName: r.reported?.full_name || 'Subject',
        reason: r.reason.replace('_', ' '),
        createdAt: new Date(r.created_at).toLocaleDateString(),
        isReviewed: r.is_reviewed
      }));
      setRecentReports(formattedReports);

      // 7. Aggregate User Growth Chart Data (Last 30 Days)
      const dateMap: { [key: string]: { male: number; female: number } } = {};
      // Initialize last 30 days
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        dateMap[dateStr] = { male: 0, female: 0 };
      }

      profiles.forEach(p => {
        const pDate = new Date(p.created_at);
        if (pDate >= thirtyDaysAgo) {
          const dateStr = pDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
          if (dateMap[dateStr]) {
            if (p.gender === 'male') dateMap[dateStr].male++;
            else if (p.gender === 'female') dateMap[dateStr].female++;
          }
        }
      });

      const growthChartData = Object.keys(dateMap).map(date => ({
        date,
        male: dateMap[date].male,
        female: dateMap[date].female
      }));
      setGrowthData(growthChartData);

      // 8. Aggregate District Distribution
      const districtCounts: { [key: string]: number } = {};
      profiles.forEach(p => {
        if (p.district) {
          districtCounts[p.district] = (districtCounts[p.district] || 0) + 1;
        }
      });

      const sortedDistricts = Object.keys(districtCounts)
        .map(name => ({ district: name, count: districtCounts[name] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setDistrictData(sortedDistricts);

      // 9. Aggregate Verification Rate Donut Chart
      let verified = 0, pending = 0, rejected = 0;
      profiles.forEach(p => {
        if (p.verification_status === 'verified') verified++;
        else if (p.verification_status === 'pending' || p.verification_status === 'under_review') pending++;
        else if (p.verification_status === 'rejected') rejected++;
      });
      setVerifPieData({ verified, pending, rejected });

      // 10. Generate Platform Activity Timeline
      const timelineList: ActivityEvent[] = [];

      // Add recent signups
      profiles.slice(-5).forEach(p => {
        timelineList.push({
          id: `signup-${p.created_at}`,
          time: getRelativeTime(new Date(p.created_at)),
          timestamp: new Date(p.created_at),
          message: <>New user signup: <b>{p.full_name || 'Anonymous'}</b> from <b>{p.district || 'Assam'}</b></>,
          type: 'positive'
        });
      });

      // Add recent verifications
      recentVData?.forEach((v: any) => {
        if (v.status === 'verified') {
          timelineList.push({
            id: `verif-app-${v.submitted_at}`,
            time: getRelativeTime(new Date(v.submitted_at)),
            timestamp: new Date(v.submitted_at),
            message: <><b>{v.profiles?.full_name}</b> was verified ✓</>,
            type: 'positive'
          });
        } else if (v.status === 'rejected') {
          timelineList.push({
            id: `verif-rej-${v.submitted_at}`,
            time: getRelativeTime(new Date(v.submitted_at)),
            timestamp: new Date(v.submitted_at),
            message: <>Verification request rejected for <b>{v.profiles?.full_name}</b></>,
            type: 'warning'
          });
        } else {
          timelineList.push({
            id: `verif-sub-${v.submitted_at}`,
            time: getRelativeTime(new Date(v.submitted_at)),
            timestamp: new Date(v.submitted_at),
            message: <><b>{v.profiles?.full_name}</b> from <b>{v.profiles?.district}</b> submitted ID for verification</>,
            type: 'warning'
          });
        }
      });

      // Add recent reports
      recentRData?.forEach((r: any) => {
        timelineList.push({
          id: `report-${r.created_at}`,
          time: getRelativeTime(new Date(r.created_at)),
          timestamp: new Date(r.created_at),
          message: <>Report filed against <b>{r.reported?.full_name || 'User'}</b> (reason: {r.reason.replace('_', ' ')})</>,
          type: 'alert'
        });
      });

      // Sort chronological
      timelineList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setTimelineEvents(timelineList.slice(0, 8));

      setLoading(false);
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verification_queue' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => fetchDashboardData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getRelativeTime = (date: Date) => {
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return <div className={styles.loading}>Loading dashboard statistics...</div>;
  }

  // Visual SVG sparkline helper
  const renderSparkline = (dataPoints: number[], color: string) => {
    if (dataPoints.length === 0) return null;
    const width = 100;
    const height = 30;
    const max = Math.max(...dataPoints, 1);
    const min = Math.min(...dataPoints, 0);
    const range = max - min;
    const points = dataPoints.map((val, idx) => {
      const x = (idx / (dataPoints.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className={styles.sparkline}>
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
      </svg>
    );
  };

  // Inline SVG calculations for user growth lines
  const renderGrowthChart = () => {
    const width = 600;
    const height = 200;
    const padding = 30;

    const maxVal = Math.max(...growthData.map(d => Math.max(d.male, d.female)), 1);

    const getX = (idx: number) => padding + (idx / (growthData.length - 1)) * (width - padding * 2);
    const getY = (val: number) => height - padding - (val / maxVal) * (height - padding * 2);

    const malePoints = growthData.map((d, idx) => `${getX(idx)},${getY(d.male)}`).join(' ');
    const femalePoints = growthData.map((d, idx) => `${getX(idx)},${getY(d.female)}`).join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = getY(maxVal * ratio);
          return (
            <g key={idx}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#2A2A2A" strokeWidth="1" strokeDasharray="4 4" />
              <text x={padding - 5} y={y + 4} fill="#888888" fontSize="10" textAnchor="end">{Math.round(maxVal * ratio)}</text>
            </g>
          );
        })}

        {/* Date labels on X-axis (every 6th date to keep clean) */}
        {growthData.map((d, idx) => {
          if (idx % 6 !== 0 && idx !== growthData.length - 1) return null;
          const x = getX(idx);
          return (
            <text key={idx} x={x} y={height - 10} fill="#888888" fontSize="10" textAnchor="middle">
              {d.date}
            </text>
          );
        })}

        {/* Male growth line */}
        <polyline fill="none" stroke="#2980B9" strokeWidth="2.5" points={malePoints} />
        {/* Female growth line */}
        <polyline fill="none" stroke="#C0392B" strokeWidth="2.5" points={femalePoints} />
      </svg>
    );
  };

  // Verification donut chart logic
  const renderVerificationDonut = () => {
    const total = verifPieData.verified + verifPieData.pending + verifPieData.rejected;
    if (total === 0) return <div className={styles.noData}>No verification data.</div>;

    const r = 50;
    const circ = 2 * Math.PI * r;
    
    const pctVerified = verifPieData.verified / total;
    const pctPending = verifPieData.pending / total;
    const pctRejected = verifPieData.rejected / total;

    const strokeVerified = circ * pctVerified;
    const strokePending = circ * pctPending;
    const strokeRejected = circ * pctRejected;

    const offsetVerified = 0;
    const offsetPending = strokeVerified;
    const offsetRejected = strokeVerified + strokePending;

    return (
      <div className={styles.donutContainer}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#2A2A2A" strokeWidth="16" />
          
          {/* Verified slice (green) */}
          {pctVerified > 0 && (
            <circle
              cx="70" cy="70" r={r} fill="none" stroke="#4A7C59" strokeWidth="16"
              strokeDasharray={`${strokeVerified} ${circ}`}
              strokeDashoffset={-offsetVerified}
              transform="rotate(-90 70 70)"
            />
          )}
          
          {/* Pending slice (amber) */}
          {pctPending > 0 && (
            <circle
              cx="70" cy="70" r={r} fill="none" stroke="#E67E22" strokeWidth="16"
              strokeDasharray={`${strokePending} ${circ}`}
              strokeDashoffset={-offsetPending}
              transform="rotate(-90 70 70)"
            />
          )}
          
          {/* Rejected slice (red) */}
          {pctRejected > 0 && (
            <circle
              cx="70" cy="70" r={r} fill="none" stroke="#C0392B" strokeWidth="16"
              strokeDasharray={`${strokeRejected} ${circ}`}
              strokeDashoffset={-offsetRejected}
              transform="rotate(-90 70 70)"
            />
          )}
        </svg>
        <div className={styles.donutCenter}>
          <span className={styles.donutTotal}>{total}</span>
          <span className={styles.donutLabel}>Total</span>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className="headline-lg">Welcome Back, {admin?.email.split('@')[0]}</h1>
        <p className="body-md">Sinaki Platform Administrative Controls Portal.</p>
      </header>

      {/* Top 4 Stats Row */}
      <div className={styles.statsGrid}>
        {/* Stat 1 */}
        <div className={`${styles.statCard} ${styles.borderGold}`}>
          <div className={styles.statMain}>
            <div className={styles.statVal}>{stats.totalUsers}</div>
            <div className={styles.statLabel}>Total Signed Up</div>
            <div className={styles.statSub}>+{stats.totalUsersToday} today</div>
          </div>
          <div className={styles.statRight}>
            <span className={styles.statIconBadge}>👥</span>
            {renderSparkline([stats.totalUsers - 5, stats.totalUsers - 4, stats.totalUsers - 2, stats.totalUsers], '#B8860B')}
          </div>
        </div>

        {/* Stat 2 */}
        <div className={`${styles.statCard} ${stats.pendingVerifications > 50 ? styles.borderAmberGlow : styles.borderGold}`}>
          <div className={styles.statMain}>
            <div className={`${styles.statVal} ${stats.pendingVerifications > 50 ? styles.textAmber : ''}`}>
              {stats.pendingVerifications}
            </div>
            <div className={styles.statLabel}>Pending Verifications</div>
            <div className={styles.statSub}>{stats.pendingVerificationsToday} submitted today</div>
          </div>
          <div className={styles.statRight}>
            <span className={`${styles.statIconBadge} ${stats.pendingVerifications > 50 ? styles.bgAmber : ''}`}>📋</span>
          </div>
        </div>

        {/* Stat 3 */}
        <div className={`${styles.statCard} ${stats.unreviewedReports > 10 ? styles.borderRedGlow : styles.borderGold}`}>
          <div className={styles.statMain}>
            <div className={`${styles.statVal} ${stats.unreviewedReports > 10 ? styles.textRed : ''}`}>
              {stats.unreviewedReports}
            </div>
            <div className={styles.statLabel}>Active Reports</div>
            <div className={styles.statSub}>{stats.activeReports - stats.unreviewedReports} reviewed</div>
          </div>
          <div className={styles.statRight}>
            <span className={`${styles.statIconBadge} ${stats.unreviewedReports > 10 ? styles.bgRed : ''}`}>🚩</span>
          </div>
        </div>

        {/* Stat 4 */}
        <div className={`${styles.statCard} ${styles.borderGold}`}>
          <div className={styles.statMain}>
            <div className={styles.statVal}>{stats.activeMatches}</div>
            <div className={styles.statLabel}>Total Matches Made</div>
            <div className={styles.statSub}>+{stats.activeMatchesThisWeek} this week</div>
          </div>
          <div className={styles.statRight}>
            <span className={styles.statIconBadge}>🔥</span>
            {renderSparkline([stats.activeMatches - 10, stats.activeMatches - 8, stats.activeMatches - 3, stats.activeMatches], '#4A7C59')}
          </div>
        </div>
      </div>

      {/* Main Content Area - 2 Columns */}
      <div className={styles.mainGrid}>
        {/* Left Column (Wider): Lists */}
        <div className={styles.leftCol}>
          {/* Recent Verifications */}
          <div className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <h3>Recent Identity Verification Submissions</h3>
              <Link href="/admin/verification" className={styles.viewAll}>View Queue</Link>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>District</th>
                    <th>Submitted</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVerifs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={styles.emptyTable}>No pending verifications.</td>
                    </tr>
                  ) : (
                    recentVerifs.map(v => (
                      <tr key={v.id}>
                        <td><b>{v.name}</b></td>
                        <td>{v.district}</td>
                        <td>{v.submittedAt}</td>
                        <td>
                          <span className={`${styles.badge} ${
                            v.status === 'pending' ? styles.badgeAmber :
                            v.status === 'under_review' ? styles.badgeBlue :
                            v.status === 'verified' ? styles.badgeGreen : styles.badgeRed
                          }`}>
                            {v.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Reports */}
          <div className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <h3>Recent User Reports Filed</h3>
              <Link href="/admin/reports" className={styles.viewAll}>View All Reports</Link>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Reporter</th>
                    <th>Reported User</th>
                    <th>Reason</th>
                    <th>Filed Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReports.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.emptyTable}>No reports filed.</td>
                    </tr>
                  ) : (
                    recentReports.map(r => (
                      <tr key={r.id}>
                        <td>{r.reporterName}</td>
                        <td><b>{r.reportedName}</b></td>
                        <td className={styles.reasonText}>{r.reason}</td>
                        <td>{r.createdAt}</td>
                        <td>
                          <span className={`${styles.badge} ${r.isReviewed ? styles.badgeGreen : styles.badgeRed}`}>
                            {r.isReviewed ? 'Reviewed' : 'Unreviewed'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (Narrower): Graphs */}
        <div className={styles.rightCol}>
          {/* User Signups Line Graph */}
          <div className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <h3>User Signups (Last 30 Days)</h3>
            </div>
            <div className={styles.chartArea}>
              {growthData.length > 0 ? renderGrowthChart() : <p>Loading signup growth...</p>}
            </div>
            <div className={styles.chartLegend}>
              <span className={styles.legendItem}><span className={styles.legendColor} style={{ backgroundColor: '#2980B9' }}></span>Male</span>
              <span className={styles.legendItem}><span className={styles.legendColor} style={{ backgroundColor: '#C0392B' }}></span>Female</span>
            </div>
          </div>

          {/* Verification Gauge Donut */}
          <div className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <h3>Identity Verification Status</h3>
            </div>
            <div className={styles.gaugeLayout}>
              {renderVerificationDonut()}
              <div className={styles.gaugeLegend}>
                <div className={styles.legendRow}>
                  <span className={styles.dot} style={{ backgroundColor: '#4A7C59' }}></span>
                  <span className={styles.lbl}>Verified: {verifPieData.verified}</span>
                </div>
                <div className={styles.legendRow}>
                  <span className={styles.dot} style={{ backgroundColor: '#E67E22' }}></span>
                  <span className={styles.lbl}>Pending/Review: {verifPieData.pending}</span>
                </div>
                <div className={styles.legendRow}>
                  <span className={styles.dot} style={{ backgroundColor: '#C0392B' }}></span>
                  <span className={styles.lbl}>Rejected: {verifPieData.rejected}</span>
                </div>
              </div>
            </div>
          </div>

          {/* District signup list (Top 10 Districts) */}
          <div className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <h3>Top 10 Districts</h3>
            </div>
            <div className={styles.districtList}>
              {districtData.length === 0 ? (
                <div className={styles.emptyTable}>No location data.</div>
              ) : (
                districtData.map((d, idx) => {
                  const maxCount = districtData[0]?.count || 1;
                  const percent = (d.count / maxCount) * 100;
                  return (
                    <div key={idx} className={styles.districtBarRow}>
                      <div className={styles.districtText}>
                        <span>{d.district}</span>
                        <span>{d.count} users</span>
                      </div>
                      <div className={styles.districtBarContainer}>
                        <div className={styles.districtBar} style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row - Activity Timeline */}
      <div className={styles.bottomRow}>
        <div className={styles.sectionCard}>
          <div className={styles.cardHeader}>
            <h3>Real-time Platform Activity Log</h3>
            <span className={styles.liveIndicator}>● Live Feed</span>
          </div>
          <div className={styles.timeline}>
            {timelineEvents.length === 0 ? (
              <div className={styles.emptyTimeline}>No platform activity recorded.</div>
            ) : (
              timelineEvents.map((evt) => (
                <div key={evt.id} className={styles.timelineItem}>
                  <div className={`${styles.timelineDot} ${
                    evt.type === 'positive' ? styles.timelineDotPositive :
                    evt.type === 'warning' ? styles.timelineDotWarning : styles.timelineDotAlert
                  }`}></div>
                  <div className={styles.timelineContent}>
                    <p className={styles.timelineMessage}>{evt.message}</p>
                    <span className={styles.timelineTime}>{evt.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
