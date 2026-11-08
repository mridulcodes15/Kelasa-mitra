import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LangCode, SkillGapItem } from '../lib/types';
import { t } from '../lib/i18n';
import { staggerDelay, useCountUp } from '../lib/motion';

interface SkillGapStepperProps {
  gap: SkillGapItem;
  lang: LangCode;
  defaultOpen?: boolean;
  /** Position in the list, for the staggered entrance. */
  index?: number;
}

export function SkillGapStepper({ gap, lang, defaultOpen = false, index = 0 }: SkillGapStepperProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const stepsId = `skill-gap-steps-${gap.skill_id}`;
  const progressId = `skill-gap-progress-${gap.skill_id}`;
  // Steps the worker has marked done. Kept in memory for this visit only; never saved or sent.
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const total = gap.learning_path.length;
  const doneCount = gap.learning_path.filter((s) => done.has(s.step)).length;
  const allDone = total > 0 && doneCount === total;
  const toggleStep = (step: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  const shownJobs = useCountUp(gap.jobs_unlocked);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: staggerDelay(index) }}
      className="bg-white rounded-3xl shadow-md p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 min-w-16 rounded-2xl bg-amber-100 text-amber-800 px-2 py-2 text-center">
          {/* Screen readers get the real number at once; the visible one counts up. */}
          <p className="text-xl font-bold leading-none">
            <span className="sr-only">{t(lang, 'moreJobsBadge', { n: gap.jobs_unlocked })}</span>
            <span aria-hidden="true" data-countup>{t(lang, 'moreJobsBadge', { n: shownJobs })}</span>
          </p>
          <p className="text-xs font-semibold mt-1">{t(lang, 'moreJobsUnit')}</p>
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-[#1a1a2e] leading-tight">{gap.label}</h3>
          {gap.avg_pay_uplift_inr > 0 && (
            <p className="text-sm font-semibold text-[#0d6e6e] mt-1">
              {t(lang, 'payUplift', { pay: gap.avg_pay_uplift_inr.toLocaleString('en-IN') })}
            </p>
          )}
        </div>
      </div>

      <p className="text-sm text-[#1a1a2e] mt-3">{gap.explanation}</p>

      <button
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={stepsId}
        className="touch-target w-full mt-3 rounded-2xl border border-[#0d6e6e] text-[#0d6e6e] text-sm font-semibold hover:bg-[#e6f4f4]"
      >
        {t(lang, isOpen ? 'hideSteps' : 'showSteps')}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={stepsId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {t(lang, 'stepsEnglishOnly') && (
              <p className="text-xs text-[#5a6475] italic mt-3">{t(lang, 'stepsEnglishOnly')}</p>
            )}
            {gap.learning_path.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between gap-2">
                  <p id={progressId} className="text-xs font-semibold text-[#1a1a2e]">
                    {t(lang, 'stepsProgress', { done: doneCount, total })}
                  </p>
                </div>
                <div
                  role="progressbar"
                  aria-labelledby={progressId}
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-valuenow={doneCount}
                  className="mt-1 h-2.5 w-full rounded-full bg-stone-200 overflow-hidden"
                >
                  <div
                    data-progress-fill
                    className="h-full rounded-full bg-[#0d6e6e] transition-[width] duration-300 motion-reduce:transition-none"
                    style={{ width: `${(doneCount / total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-[#5a6475] mt-1">{t(lang, 'tapStepHint')}</p>
                {allDone && (
                  <p role="status" className="mt-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-sm font-semibold text-green-800">
                    🎉 {t(lang, 'stepsComplete')}
                  </p>
                )}
              </div>
            )}
            <ol className="mt-3">
              {gap.learning_path.map((step, index) => {
                const isDone = done.has(step.step);
                return (
                  <li key={step.step} className="relative pb-2 last:pb-0">
                    {index < gap.learning_path.length - 1 && (
                      <span aria-hidden="true" className="absolute left-[23px] top-10 bottom-0 w-0.5 bg-stone-200" />
                    )}
                    {/* Tap (or Enter/Space) marks a step done; tap again to undo. Kept for this visit only. */}
                    <button
                      type="button"
                      aria-pressed={isDone}
                      onClick={() => toggleStep(step.step)}
                      className={[
                        'touch-target relative w-full flex gap-3 items-start text-left rounded-2xl px-1 py-1.5',
                        'hover:bg-[#e6f4f4] transition-colors',
                      ].join(' ')}
                    >
                      <span
                        aria-hidden="true"
                        className={[
                          'relative mt-0.5 grid place-items-center h-6 w-6 ml-2 flex-shrink-0 rounded-full border-2 text-xs font-bold',
                          isDone ? 'bg-[#0d6e6e] border-[#0d6e6e] text-white' : 'bg-white border-stone-300 text-transparent',
                        ].join(' ')}
                      >
                        ✓
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-[#5a6475]">{t(lang, 'stepLabel', { n: step.step })}</span>
                        <span className={['block text-sm text-[#1a1a2e]', isDone ? 'line-through decoration-2 decoration-[#0d6e6e]/60' : ''].join(' ')}>
                          {step.action}
                        </span>
                        <span className="block text-xs text-[#5a6475] mt-0.5">
                          {t(lang, 'aboutWeeks', { n: step.weeks })}
                          {step.approx_cost_inr > 0 && (
                            <> · {t(lang, 'aboutCost', { n: step.approx_cost_inr.toLocaleString('en-IN') })}</>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
