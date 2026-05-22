import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import TrustStrip from '@/components/TrustStrip';
import HowItWorks from '@/components/HowItWorks';
import Link from 'next/link';
import styles from './LandingPage.module.css';

export default function LandingPage() {
  return (
    <main className={styles.main}>
      <Navbar />
      <Hero />
      <TrustStrip />
      
      <div className="gamosa-divider" />
      
      <HowItWorks />
      
      <div className="gamosa-divider" />
      
      {/* Safety Section */}
      <section className={styles.safety}>
        <div className={styles.container}>
          <div className={styles.safetyCard}>
            <h2 className="display-md">Your <span className="text-gradient">safety</span> is our priority</h2>
            <p className="body-lg" style={{maxWidth: '600px', margin: '0 auto var(--space-xl) auto'}}>
              Sinaki is built to feel safe, respectful, and genuine. We verify every person to protect our community.
            </p>
            <ul className={styles.safetyList}>
              <li>A verified Assamese community</li>
              <li>No screenshot sharing allowed</li>
              <li>Dedicated local moderation team</li>
              <li>Anonymized safety reporting</li>
            </ul>
            <div className={styles.safetyLinks}>
              <Link href="/safety">Learn about Safety →</Link>
              <Link href="/privacy">Privacy Policy →</Link>
            </div>
          </div>
        </div>
      </section>

      <div className="gamosa-divider" />

      {/* Testimonials */}
      <section className={styles.testimonials}>
        <div className={styles.container}>
          <h2 className={styles.testimonialsTitle}>
            Real stories from <span className="text-gradient">Assam</span>
          </h2>
          <div className={styles.testimonialGrid}>
            
            {/* WhatsApp bubble card 1 */}
            <div className={styles.testimonialCard}>
              <p className={styles.testimonialText}>
                We connected over our shared roots in Majuli and a love for local literature. Sinaki made finding someone from my community so effortless. It really feels like meeting someone at a tea stall.
              </p>
              <div className={styles.testimonialMeta}>
                <span className={styles.author}>Anurag</span>
                <span className={styles.district}>• Majuli</span>
                <span className={styles.checkmark}>✓✓</span>
              </div>
            </div>
            
            {/* WhatsApp bubble card 2 */}
            <div className={`${styles.testimonialCard} ${styles.testimonialCardFlipped}`}>
              <p className={styles.testimonialText}>
                Our first video call felt so authentic and culturally respectful. It's much safer than other apps because everyone is verified. My family is also happy I found someone who understands our culture.
              </p>
              <div className={styles.testimonialMeta}>
                <span className={styles.author}>Priyanka</span>
                <span className={styles.district}>• Jorhat</span>
                <span className={styles.checkmark}>✓✓</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      <div className="gamosa-divider" />

      {/* FAQ */}
      <section className={styles.faq}>
        <div className={styles.container}>
          <h2 className={styles.faqTitle}>
            Frequently asked <span className="text-gradient">questions</span>
          </h2>
          <div className={styles.faqList}>
            <details className={styles.faqItem}>
              <summary>How do I verify my account?</summary>
              <p>We require a government ID upload (Aadhaar, Voter ID, driving license, etc.) and a selfie. Our local moderation team manually reviews every single profile within 24 hours.</p>
            </details>
            <details className={styles.faqItem}>
              <summary>Is my government ID safe?</summary>
              <p>Yes. Your document is stored privately and securely. Other users will never see it, and it is strictly used for one-time verification.</p>
            </details>
            <details className={styles.faqItem}>
              <summary>Can I search for profiles in other states?</summary>
              <p>Sinaki is designed specifically for people from Assam and those with roots here. You can set your preference filters to match by districts.</p>
            </details>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div>
              <h3 className={`${styles.footerLogo} text-gradient`}>Sinaki</h3>
              <p className="body-sm" style={{color: 'var(--on-surface-variant)'}}>Find your someone, the Assamese way.</p>
            </div>
            <div className={styles.footerLinks}>
              <Link href="/about">About</Link>
              <Link href="/safety">Safety</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p>© 2026 Sinaki. All rights reserved.</p>
            <div className={styles.madeWithLove}>Made with love in Assam</div>
          </div>
        </div>
      </footer>
    </main>
  );
}

