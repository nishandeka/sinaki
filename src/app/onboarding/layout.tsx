"use client";

import { usePathname } from 'next/navigation';
import styles from './OnboardingLayout.module.css';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  const steps = [
    { id: 1, path: '/onboarding/basics', label: 'Basics' },
    { id: 2, path: '/onboarding/profile', label: 'Profile' },
    { id: 3, path: '/onboarding/verify', label: 'Verify' },
    { id: 4, path: '/onboarding/preferences', label: 'Preferences' },
    { id: 5, path: '/onboarding/review', label: 'Review' },
  ];

  const currentStep = steps.find(s => pathname.includes(s.path))?.id || 1;
  const progress = (currentStep / steps.length) * 100;

  return (
    <div className={styles.wrapper}>
      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill} 
            style={{ width: `${progress}%` }}
          />
          {/* Rose Petal Indicator */}
          <div 
            className={styles.petal} 
            style={{ left: `${progress}%` }}
          >
            🌸
          </div>
        </div>
      </div>
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}
