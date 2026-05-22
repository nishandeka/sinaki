import Link from 'next/link';
import styles from './Navbar.module.css';

export default function Navbar() {
  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link href="/" className={`${styles.logo} text-gradient`}>
          Sinaki.
        </Link>
        <div className={styles.links}>
          <Link href="/login" className={styles.loginLink}>
            Sign In
          </Link>
          <Link href="/signup" className={styles.cta}>
            Start your story
          </Link>
        </div>
      </div>
    </nav>
  );
}
