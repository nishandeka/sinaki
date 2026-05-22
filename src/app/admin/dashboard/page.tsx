import styles from './Dashboard.module.css';

export default function AdminDashboard() {
  const stats = [
    { label: 'New Signups (24h)', value: '124', trend: '+12%', icon: '👤' },
    { label: 'Verification Pending', value: '45', trend: '-5%', icon: '🛡️' },
    { label: 'Active Users', value: '1,204', trend: '+8%', icon: '🔥' },
    { label: 'Open Reports', value: '12', trend: '+2', icon: '🚩' },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className="headline-lg">Admin Dashboard</h1>
        <p className="body-md">Overview of BSSRV campus activity.</p>
      </header>

      <div className={styles.statsGrid}>
        {stats.map((s, i) => (
          <div key={i} className={styles.statCard}>
            <div className={styles.statIcon}>{s.icon}</div>
            <div className={styles.statInfo}>
              <p className="label-sm">{s.label}</p>
              <h3 className="headline-md">{s.value}</h3>
              <span className={styles.trend}>{s.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.contentGrid}>
        <div className={styles.sectionCard}>
          <h2 className="headline-sm">Quick Actions</h2>
          <div className={styles.actionButtons}>
            <button className={styles.actionBtn}>Review Verifications</button>
            <button className={styles.actionBtn}>Moderation Queue</button>
            <button className={styles.actionBtn}>Open Reports</button>
            <button className={styles.actionBtn}>Send Announcement</button>
          </div>
        </div>

        <div className={styles.sectionCard}>
          <h2 className="headline-sm">Recent Activity</h2>
          <div className={styles.activityList}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={styles.activityItem}>
                <div className={styles.dot}></div>
                <p className="body-md">User <b>Alex J.</b> was verified by Staff <b>Sarah</b>.</p>
                <span className={styles.time}>2m ago</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
