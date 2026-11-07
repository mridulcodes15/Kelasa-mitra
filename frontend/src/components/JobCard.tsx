import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import type { JobMatch } from '../lib/types';
import { MatchRing } from './MatchRing';

interface JobCardProps {
  match: JobMatch;
  onSave: () => void;
  onSkip: () => void;
  isTop: boolean;
}

function fmt(n: number) {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

export function JobCard({ match, onSave, onSkip, isTop }: JobCardProps) {
  const { job, score, distance_km, reason } = match;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x > 100) {
      onSave();
    } else if (info.offset.x < -100) {
      onSkip();
    } else {
      // snap back
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
    }
  }

  const typeLabel = job.type === 'apprenticeship' ? '🎓 Apprenticeship' : '💼 Job';

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: -300, right: 300 }}
      onDragEnd={handleDragEnd}
      initial={{ scale: isTop ? 1 : 0.96, y: isTop ? 0 : 8 }}
      animate={{ scale: isTop ? 1 : 0.96, y: isTop ? 0 : 8 }}
      className={[
        'absolute inset-0 bg-white rounded-3xl shadow-lg p-5 flex flex-col gap-3',
        isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none',
      ].join(' ')}
      aria-label={`Job card: ${job.title} at ${job.employer}`}
    >
      {/* Top row: title + type badge */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-[#5a6475] font-medium">{typeLabel}</p>
          <h3 className="text-lg font-bold text-[#1a1a2e] leading-tight">{job.title}</h3>
          <p className="text-sm text-[#5a6475]">{job.employer}</p>
        </div>
        <MatchRing score={score} size={72} />
      </div>

      {/* Info row */}
      <div className="flex flex-wrap gap-3 text-sm text-[#5a6475]">
        <span>📍 {job.area} · {distance_km < 1 ? 'in your area' : `~${distance_km} km`}</span>
        <span>💰 ₹{fmt(job.pay_min)}–{fmt(job.pay_max)}/mo</span>
      </div>

      {/* Reason */}
      <p className="text-sm text-[#1a1a2e] bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">
        {reason}
      </p>

      {/* Sample data tag */}
      {job.is_synthetic && (
        <p className="text-xs text-[#5a6475] italic">⚠ Sample data — for demonstration only</p>
      )}

      {/* Action buttons (accessibility) */}
      <div className="flex gap-3 mt-auto">
        <button
          onClick={onSkip}
          aria-label="Skip this job"
          className="flex-1 border border-stone-200 rounded-2xl py-3 text-sm font-semibold text-[#5a6475] hover:bg-stone-50 touch-target"
        >
          Skip ✕
        </button>
        <button
          onClick={onSave}
          aria-label="Save this job"
          className="flex-1 bg-[#0d6e6e] rounded-2xl py-3 text-sm font-semibold text-white hover:bg-[#0f9d9d] touch-target"
        >
          Save ✓
        </button>
      </div>
    </motion.div>
  );
}
