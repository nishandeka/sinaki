import Link from 'next/link';
import styles from './Hero.module.css';

export default function Hero() {
  return (
    <section className={styles.hero}>
      {/* Background Image of Brahmaputra */}
      <div className={styles.backgroundImage}></div>
      <div className={styles.overlay}></div>
      
      <div className={styles.container}>
        <div className={styles.content}>
          <h1 className={styles.brandTitle}>Sinaki</h1>
          <p className={styles.whisper}>Find your someone, the Assamese way.</p>
          <div className={styles.actions}>
            <Link href="/signup" className={styles.ctaButton}>
              Start your story
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

