import Link from 'next/link';
import styles from './AdminLayout.module.css';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.wrapper}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>Sinaki Admin</div>
        <nav className={styles.nav}>
          <Link href="/admin/dashboard">Dashboard</Link>
          <Link href="/admin/users">Users</Link>
          <Link href="/admin/verification">Verification</Link>
          <Link href="/admin/moderation">Moderation</Link>
          <Link href="/admin/reports">Reports</Link>
          <Link href="/admin/content">Content Editor</Link>
          <Link href="/admin/settings">Settings</Link>
        </nav>
        <div className={styles.footer}>
          <p>Logged in as Admin</p>
          <Link href="/logout">Logout</Link>
        </div>
      </aside>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
