import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import { t } from '../lib/i18n';
import { useCountUp } from '../lib/motion';

interface MatchRingProps {
  score: number;   // 0-100
  size?: number;   // diameter in px (default 80)
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

const FILL_MS = 700;

export function MatchRing({ score, size = 80 }: MatchRingProps) {
  const lang = useAppStore((s) => s.lang);
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  // Ring stroke (graphic, needs 3:1) and score text (14px bold, needs 4.5:1 on white).
  const color =
    score >= 80 ? '#16a34a' :   // green-600
    score >= 60 ? '#d97706' :   // amber-600
    '#dc2626';                   // red-600
  const textColor =
    score >= 80 ? '#15803d' :   // green-700
    score >= 60 ? '#b45309' :   // amber-700
    '#b91c1c';                   // red-700

  const circleRef = useRef<SVGCircleElement>(null);
  // The number counts up with the ring fill; the real score is in aria-label from the start.
  const shownScore = useCountUp(score, FILL_MS);

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    // CSS media queries cannot stop el.animate(), so check here and show the final value.
    if (prefersReducedMotion()) {
      el.setAttribute('stroke-dashoffset', String(offset));
      return;
    }
    // Start fully hidden
    el.style.strokeDashoffset = String(circumference);
    const animation = el.animate(
      [{ strokeDashoffset: circumference }, { strokeDashoffset: offset }],
      { duration: FILL_MS, easing: 'cubic-bezier(0.4,0,0.2,1)', fill: 'forwards' },
    );
    return () => animation.cancel();
  }, [circumference, offset]);

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={t(lang, 'matchScoreAria', { score })}
    >
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* Background ring */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#e5e7eb" strokeWidth={8}
        />
        {/* Score ring */}
        <circle
          ref={circleRef}
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          className="score-ring"
        />
      </svg>
      {/* Score label */}
      <span
        className="absolute text-sm font-bold"
        style={{ color: textColor }}
      >
        {shownScore}%
      </span>
    </motion.div>
  );
}
