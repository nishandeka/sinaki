"use client";

import TopBar from '@/components/TopBar';
import Link from 'next/link';
import styles from './Safety.module.css';

export default function SafetyPage() {
  return (
    <div className={styles.page}>
      <TopBar />
      <main className={styles.main}>
        <h1 className="headline-lg">Safety at Sinaki</h1>
        <p className="body-lg">Your safety is our top priority. We've built Sinaki with multiple layers of protection for BSSRV students.</p>
        
        <div className={styles.section}>
          <h2 className="headline-md">Verified Community</h2>
          <p className="body-md">Every single user on Sinaki is verified using their @gmail.com email address. This ensures that you're only interacting with actual students from our community.</p>
        </div>

        <div className={styles.section}>
          <h2 className="headline-md">Private Communication</h2>
          <p className="body-md">All voice and video calls are peer-to-peer and encrypted. We do not store or monitor your private calls.</p>
        </div>

        <div className={styles.section}>
          <h2 className="headline-md">Reporting & Blocking</h2>
          <p className="body-md">If someone makes you feel uncomfortable, you can block them instantly. You can also report any profile that violates our community guidelines.</p>
        </div>

        <div className={styles.cta}>
          <Link href="/signup" className={styles.primaryBtn}>
            Join the Safe Community
          </Link>
        </div>
      </main>
    </div>
  );
}
