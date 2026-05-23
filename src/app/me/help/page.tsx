"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import TopBar from '@/components/TopBar';
import styles from './Help.module.css';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  icon: string;
  items: FAQItem[];
}

export default function HelpAndSupportPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<number>(0);
  const [openFAQIdx, setOpenFAQIdx] = useState<number | null>(null);

  // Form states
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('verification');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const faqs: FAQCategory[] = [
    {
      title: "Account Verification",
      icon: "🛡️",
      items: [
        {
          question: "How do I verify my account?",
          answer: "Navigate to your Profile onboarding steps or the Verification option. Upload a clear photograph of a government-issued ID (Voter ID, Aadhaar, PAN card, Driving License, or Passport) along with a clean selfie. Our team will review and approve it manually."
        },
        {
          question: "How long does verification take?",
          answer: "Our local Assam-based moderation team reviews verification requests manually. Typically, accounts are verified within 12 to 24 hours of submission. You will receive a system notification once the status changes."
        },
        {
          question: "Why was my verification ID rejected?",
          answer: "Common reasons for rejection include: blurry photos, missing selfie, mismatch between profile details (like date of birth or name) and the ID document, or expired documentation. Check the rejection note in your system notifications, update your details, and submit a fresh request."
        }
      ]
    },
    {
      title: "Profile & Account Changes",
      icon: "👤",
      items: [
        {
          question: "How can I change my legal name or date of birth?",
          answer: "For community safety and to prevent fake accounts, you cannot directly change your legal name or date of birth once your profile is created. If there is a spelling error or correction needed, please submit a support ticket below with the correct details."
        },
        {
          question: "Why are my nickname/display name changes not saving?",
          answer: "Ensure your nickname or display name is at least 2 characters long and does not contain inappropriate words. If it is valid but still fails, verify you have uploaded at least 2 profile photos, as the profile page requires at least 2 polaroids before saving edits."
        },
        {
          question: "How do I update my location district?",
          answer: "Go to your profile page, scroll down to the 'Home District' text field, enter the name of your new district (e.g., Guwahati, Jorhat, Dibrugarh), and click 'Save Changes' on the floating bar."
        }
      ]
    },
    {
      title: "Privacy & Security",
      icon: "🔒",
      items: [
        {
          question: "How do I block someone who is harassing me?",
          answer: "You can block any user instantly. Click on their profile card to open the preview, scroll down, and select 'Block User'. Once blocked, they will no longer appear in your feed, and they will not be able to send you messages or call you."
        },
        {
          question: "What happens when I report a profile?",
          answer: "When you file a report, our moderators immediately lock the accused profile's details for review. We analyze the reason, statement, and uploaded screenshots. If guidelines are violated, they receive warnings, temporary suspension, or permanent bans."
        },
        {
          question: "Are my phone calls and video calls secure?",
          answer: "Yes, voice and video calls on Sinaki are peer-to-peer and encrypted. The server only facilitates establishing the connection. We do not record, store, or monitor any call audio or video."
        }
      ]
    },
    {
      title: "Account Termination",
      icon: "⚠️",
      items: [
        {
          question: "How do I temporarily hide or pause my profile?",
          answer: "If you want to take a break without losing your matches, you can toggle your profile's active status. Navigate to settings (or submit a support request) to set 'is_active' to false. This hides you from the discover deck but preserves your chats."
        },
        {
          question: "How do I permanently delete my account and data?",
          answer: "If you have found your someone or wish to leave permanently, you can submit an 'Account Deletion Request' using the contact form below. Our support team will process your request, deleting all matching history, profile data, and photos from our servers within 48 hours."
        }
      ]
    }
  ];

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!subject.trim()) {
      setSubmitError("Please specify a subject line.");
      return;
    }
    if (description.trim().length < 15) {
      setSubmitError("Please write a description (minimum 15 characters).");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const ticketDescription = `[HELP TICKET] Category: ${category.toUpperCase()}\nSubject: ${subject.trim()}\n\nDescription:\n${description.trim()}`;

      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          reported_id: user.id, // Self-report behaves as support ticket
          reason: 'other',
          description: ticketDescription,
          evidence_urls: []
        });

      if (error) throw error;

      setSubmitSuccess(true);
      setSubject('');
      setDescription('');
    } catch (err: any) {
      console.error("Error submitting support ticket:", err);
      setSubmitError(err.message || "Failed to submit ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic', color: 'var(--primary)' }}>
          Contacting Assam support deck...
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <TopBar />
      <main className={styles.main}>
        <div className={styles.backContainer}>
          <Link href="/me" className={styles.backBtn}>
            ← Back to Profile
          </Link>
        </div>

        <header className={styles.header}>
          <h1 className="display-md">Help & <span className="text-gradient">Support</span></h1>
          <p className="body-lg">Find answers regarding your Sinaki account or submit a ticket directly to our local support desk.</p>
        </header>

        {/* Categories Grid */}
        <div className={styles.categories}>
          {faqs.map((cat, idx) => (
            <button
              key={idx}
              className={`${styles.categoryCard} ${activeCategory === idx ? styles.activeCategory : ''}`}
              onClick={() => {
                setActiveCategory(idx);
                setOpenFAQIdx(null);
              }}
            >
              <span className={styles.categoryIcon}>{cat.icon}</span>
              <span className={styles.categoryTitle}>{cat.title}</span>
            </button>
          ))}
        </div>

        {/* FAQ Accordion container */}
        <div className={styles.faqSection}>
          <h2 className="headline-md" style={{ color: 'var(--secondary)', marginBottom: 'var(--space-md)' }}>
            {faqs[activeCategory].title} FAQs
          </h2>
          <div className={styles.faqList}>
            {faqs[activeCategory].items.map((item, idx) => {
              const isOpen = openFAQIdx === idx;
              return (
                <div key={idx} className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ''}`}>
                  <button
                    className={styles.faqQuestionBtn}
                    onClick={() => setOpenFAQIdx(isOpen ? null : idx)}
                  >
                    <span>{item.question}</span>
                    <span className={styles.accordionArrow}>{isOpen ? "▲" : "▼"}</span>
                  </button>
                  {isOpen && (
                    <div className={styles.faqAnswer}>
                      <p>{item.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="gamosa-divider" />

        {/* Contact form ticket desk */}
        <section className={styles.supportFormCard}>
          <h2 className="headline-md">Submit a Support Ticket</h2>
          <p className="body-md" style={{ marginBottom: 'var(--space-lg)' }}>
            Need direct help? Fill out this form and a moderator will review it. You will receive updates in notifications.
          </p>

          {submitSuccess && (
            <div className={styles.successBox}>
              <span className={styles.successIcon}>✓</span>
              <div>
                <strong>Ticket Submitted Successfully!</strong>
                <p>A support specialist will review your request. Look out for system notifications or alerts soon.</p>
              </div>
            </div>
          )}

          {submitError && (
            <div className={styles.errorBox}>
              <strong>Submission Failed</strong>
              <p>{submitError}</p>
            </div>
          )}

          <form onSubmit={handleSubmitTicket} className={styles.form}>
            <div className={styles.formRow}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Ticket Category</label>
                <select
                  className={styles.select}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={submitting}
                >
                  <option value="verification">Verification Issues</option>
                  <option value="profile_edit">Name / DOB Change Request</option>
                  <option value="technical_bug">App Bug / Technical Error</option>
                  <option value="safety_harassment">Safety Concern / Report User</option>
                  <option value="delete_account">Account Deletion Request</option>
                  <option value="other">Other Account Query</option>
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Subject Line</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Correction of my spelling name"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={submitting}
                  maxLength={100}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Detailed Description (Min 15 chars)</label>
              <textarea
                className={styles.textarea}
                placeholder="Describe your issue in detail. If requesting a change, state the correct details clearly so our moderators can assist you."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                rows={6}
                required
              />
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
            >
              {submitting ? "Sending Ticket..." : "Submit Support Ticket"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
