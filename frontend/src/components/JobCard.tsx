import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import type { JobMatch } from '../lib/types';
import { useAppStore } from '../store/appStore';
import { t } from '../lib/i18n';
import { MatchRing } from './MatchRing';
import { SWIPE_THRESHOLD, peekStyle, tiltFor } from '../lib/deck';
import { DragFeedback } from './DragFeedback';
import { DemoNote } from './DemoNote';
import { jobIcon, skillName } from '../lib/skills';
import { prefersReducedMotion, staggerDelay } from '../lib/motion';

interface JobCardProps {
  match: JobMatch;
  onSave: () => void;
  onSkip: () => void;
  isTop: boolean;
  /** Place in the stack: 0 is the top card, 1 and 2 peek behind it. */
  depth?: number;
}

function SkillChips({ label, kind, names }: { label: string; kind: 'matched' | 'missing'; names: string[] }) {
  const style = kind === 'matched'
    ? 'bg-green-50 text-green-800 border-green-200'
    : 'bg-stone-100 text-stone-600 border-stone-200';
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-skills={kind}>
      <span className="text-xs font-semibold text-[#5a6475] mr-0.5">{label}:</span>
      {names.map((name) => (
        <span key={name} className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}>
          <span aria-hidden="true">{kind === 'matched' ? '✓ ' : '+ '}</span>
          {name}
        </span>
      ))}
    </div>
  );
}

function fmt(n: number) {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

export function JobCard({ match, onSave, onSkip, isTop, depth = isTop ? 0 : 1 }: JobCardProps) {
  const lang = useAppStore((s) => s.lang);
  const reduced = prefersReducedMotion();
  const { job, score, distance_km, reason } = match;
  const x = useMotionValue(0);
  // The top card tilts while dragged, and tints green (save) or grey (skip) up to the threshold.
  const rotate = useTransform(x, (v) => tiltFor(v, reduced));
  const peek = peekStyle(depth);

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x >= SWIPE_THRESHOLD) {
      onSave();
    } else if (info.offset.x <= -SWIPE_THRESHOLD) {
      onSkip();
    } else {
      // snap back
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
    }
  }

  const typeLabel = t(lang, job.type === 'apprenticeship' ? 'typeApprenticeship' : 'typeJob');
  // Coordinates are approximate, so distances are shown as estimates, never as exact figures.
  const distanceLabel = distance_km < 1
    ? t(lang, 'inYourArea')
    : t(lang, 'aboutKm', { km: distance_km.toFixed(1) });

  return (
    <motion.div
      // Scale from the bottom edge so each card behind shows a strip of exactly peek.y px.
      style={{ x, rotate, transformOrigin: 'center bottom' }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: -300, right: 300 }}
      onDragEnd={handleDragEnd}
      // Cards fade up into place, a little after one another (skipped under reduced motion).
      initial={{ ...peek, opacity: 0, y: peek.y + 16 }}
      animate={{ ...peek, opacity: 1 }}
      transition={{ duration: 0.25, delay: staggerDelay(depth) }}
      data-depth={depth}
      className={[
        'absolute inset-x-0 top-0 bottom-7 bg-white rounded-3xl shadow-lg p-5 flex flex-col gap-3 overflow-hidden',
        isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none',
      ].join(' ')}
      aria-label={t(lang, 'jobCardAria', { title: job.title, employer: job.employer })}
      // The card peeking behind is decoration: keep its buttons out of the tab order and screen readers.
      inert={!isTop}
      aria-hidden={!isTop || undefined}
    >
      {isTop && <DragFeedback x={x} />}

      {/* Top row: icon, title, match ring */}
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          data-job-icon
          className="flex-shrink-0 grid place-items-center w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 text-4xl leading-none"
        >
          {jobIcon(job.skills_required)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#5a6475] font-medium">{typeLabel}</p>
          <h3 className="text-lg font-bold text-[#1a1a2e] leading-tight break-words">{job.title}</h3>
          <p className="text-sm text-[#5a6475] break-words">{job.employer}</p>
        </div>
        <MatchRing score={score} size={64} />
      </div>

      {/* Distance and pay chips */}
      <div className="flex flex-wrap gap-2 text-sm font-semibold">
        <span data-chip="distance" className="rounded-full bg-[#e6f4f4] text-[#0d6e6e] px-3 py-1">
          📍 {job.area} · {distanceLabel}
        </span>
        <span data-chip="pay" className="rounded-full bg-amber-100 text-amber-900 px-3 py-1">
          💰 ₹{fmt(job.pay_min)}–{fmt(job.pay_max)}{t(lang, 'perMonth')}
        </span>
      </div>

      {/* Skills: matched in green, missing in grey; marked with ✓ / + so colour is not the only cue */}
      <div className="flex flex-col gap-1.5">
        {match.matched_skills.length > 0 && (
          <SkillChips label={t(lang, 'skillsYouHave')} kind="matched"
            names={match.matched_skills.map((id) => skillName(id, lang))} />
        )}
        {match.missing_skills.length > 0 && (
          <SkillChips label={t(lang, 'skillsToLearn')} kind="missing"
            names={match.missing_skills.map((id) => skillName(id, lang))} />
        )}
      </div>

      {/* Reason */}
      <p className="text-sm text-[#1a1a2e] bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">
        {reason}
      </p>

      {/* Sample data tag */}
      {job.is_synthetic && (
        <div>
          <p className="text-xs text-[#5a6475] italic">{t(lang, 'sampleData')}</p>
          <DemoNote className="mt-0.5" />
        </div>
      )}

      {/* Action buttons (accessibility) */}
      <div className="flex gap-3 mt-auto">
        <button
          onClick={onSkip}
          aria-label={t(lang, 'skipAria')}
          className="flex-1 border border-stone-200 rounded-2xl py-3 text-sm font-semibold text-[#5a6475] hover:bg-stone-50 touch-target"
        >
          {t(lang, 'skip')}
        </button>
        <button
          onClick={onSave}
          aria-label={t(lang, 'saveAria')}
          className="flex-1 bg-[#0d6e6e] rounded-2xl py-3 text-sm font-semibold text-white hover:bg-[#0f9d9d] touch-target"
        >
          {t(lang, 'save')}
        </button>
      </div>
    </motion.div>
  );
}
