import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface MatchRingProps {
  score: number;   // 0-100
  size?: number;   // diameter in px (default 80)
}

export function MatchRing({ score, size = 80 }: MatchRingProps) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  const color =
    score >= 80 ? '#16a34a' :   // green-600
    score >= 60 ? '#d97706' :   // amber-600
    '#dc2626';                   // red-600

  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    // Start fully hidden
    el.style.strokeDashoffset = String(circumference);
    // Animate to target (respects prefers-reduced-motion via CSS)
    const animation = el.animate(
      [{ strokeDashoffset: circumference }, { strokeDashoffset: offset }],
      { duration: 700, easing: 'cubic-bezier(0.4,0,0.2,1)', fill: 'forwards' },
    );
    return () => animation.cancel();
  }, [score, circumference, offset]);

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={`Match score: ${score}%`}
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
        style={{ color }}
      >
        {score}%
      </span>
    </motion.div>
  );
}
