import styles from './HowItWorks.module.css';

export default function HowItWorks() {
  const steps = [
    {
      number: 1,
      title: "Create your story",
      description: "Share what makes you laugh, what your perfect Sunday looks like, and what you're looking for. Express yourself with beautiful photos and details about your roots.",
      illustration: (
        <svg className={styles.svg} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Watercolor wash (intentional offset color fill) */}
          <path d="M45 42 C70 30, 130 35, 155 50 C170 70, 150 140, 135 155 C100 170, 50 150, 40 120 C35 90, 30 50, 45 42 Z" fill="#FCF3CF" opacity="0.8" />
          
          {/* Polaroid photo frame */}
          <rect x="50" y="30" width="100" height="120" rx="4" fill="white" stroke="#1E1E1E" strokeWidth="2" transform="rotate(-3 100 90)" />
          {/* Polaroid image placeholder */}
          <rect x="58" y="38" width="84" height="84" fill="#FFF9F2" stroke="#1E1E1E" strokeWidth="1.5" transform="rotate(-3 100 90)" />
          {/* Silhouette profile inside polaroid */}
          <circle cx="100" cy="70" r="18" fill="#FFF3E4" stroke="#1E1E1E" strokeWidth="1.5" transform="rotate(-3 100 90)" />
          <path d="M75 110 C75 92, 125 92, 125 110" fill="#FFF3E4" stroke="#1E1E1E" strokeWidth="1.5" transform="rotate(-3 100 90)" />
          
          {/* Pencil drawing a flower */}
          <path d="M125 138 C115 138, 105 139, 90 142" stroke="#1E1E1E" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
          {/* Sparkles / Flowers */}
          <path d="M142 42 C148 42, 148 48, 154 48 C148 48, 148 54, 142 54 C136 54, 136 48, 130 48 C136 48, 136 42, 142 42 Z" fill="#C0392B" opacity="0.9" />
          <circle cx="142" cy="48" r="2" fill="white" />
        </svg>
      )
    },
    {
      number: 2,
      title: "Get verified, safely",
      description: "We verify every single profile with a government ID. Your details are private and secure, reviewed manually by our team in Assam. No bots. No fake profiles.",
      illustration: (
        <svg className={styles.svg} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Watercolor wash */}
          <path d="M50 50 C90 30, 140 40, 160 70 C170 100, 145 155, 120 165 C85 175, 45 150, 35 110 C30 80, 35 60, 50 50 Z" fill="#FADBD8" opacity="0.8" />
          
          {/* Shield outline */}
          <path d="M100 40 C130 40, 150 48, 150 75 C150 120, 100 160, 100 160 C100 160, 50 120, 50 75 C50 48, 70 40, 100 40 Z" fill="white" stroke="#1E1E1E" strokeWidth="2" />
          
          {/* Checkmark inside */}
          <path d="M80 95 L95 110 L125 78" stroke="#4A7C59" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          
          {/* Secure lock or organic leaves wrapped */}
          <path d="M100 25 L100 35 M40 80 C30 100, 45 130, 60 120" stroke="#1E1E1E" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M160 80 C170 100, 155 130, 140 120" stroke="#1E1E1E" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    },
    {
      number: 3,
      title: "Find your connection",
      description: "Discover verified profiles. Share a mutual connection, celebrate with 'Mili Jabo' and start talking. It's like meeting at a cozy tea shop on a rainy afternoon.",
      illustration: (
        <svg className={styles.svg} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Watercolor wash */}
          <path d="M60 45 C100 35, 150 50, 165 80 C175 110, 155 145, 130 160 C90 180, 45 155, 35 120 C30 85, 40 55, 60 45 Z" fill="#D5F5E3" opacity="0.8" />
          
          {/* Table surface line */}
          <line x1="20" y1="145" x2="180" y2="145" stroke="#1E1E1E" strokeWidth="2" strokeLinecap="round" />
          
          {/* Cup 1 */}
          <path d="M50 100 C50 135, 90 135, 90 100 Z" fill="white" stroke="#1E1E1E" strokeWidth="2" />
          <path d="M90 105 C96 105, 100 110, 100 115 C100 120, 96 125, 90 125" stroke="#1E1E1E" strokeWidth="2" />
          
          {/* Cup 2 */}
          <path d="M110 100 C110 135, 150 135, 150 100 Z" fill="white" stroke="#1E1E1E" strokeWidth="2" />
          <path d="M110 105 C104 105, 100 110, 100 115 C100 120, 104 125, 110 125" stroke="#1E1E1E" strokeWidth="2" />
          
          {/* Steam rising */}
          <path d="M65 85 Q70 75 65 65 Q70 55 65 45" stroke="#1E1E1E" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M75 90 Q80 80 75 70 Q80 60 75 50" stroke="#1E1E1E" strokeWidth="1.5" strokeLinecap="round" />
          
          <path d="M125 90 Q120 80 125 70 Q120 60 125 50" stroke="#1E1E1E" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M135 85 Q130 75 135 65 Q130 55 135 45" stroke="#1E1E1E" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    }
  ];

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.mainTitle}>How it works</h2>
        
        <div className={styles.stepsList}>
          {steps.map((step, idx) => {
            const isFlipped = idx % 2 === 1;
            return (
              <div 
                key={step.number} 
                className={`${styles.stepRow} ${isFlipped ? styles.flipped : ''}`}
              >
                <div className={styles.textContent}>
                  <div className={styles.stepNum}>Step {step.number}</div>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepDesc}>{step.description}</p>
                </div>
                <div className={styles.illustrationWrapper}>
                  {step.illustration}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

