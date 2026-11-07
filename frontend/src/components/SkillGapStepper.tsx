import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LangCode, SkillGapItem } from '../lib/types';
import { t } from '../lib/i18n';

interface SkillGapStepperProps {
  gap: SkillGapItem;
  lang: LangCode;
  defaultOpen?: boolean;
}

export function SkillGapStepper({ gap, lang, defaultOpen = false }: SkillGapStepperProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const stepsId = `skill-gap-steps-${gap.skill_id}`;

  return (
    <article className="bg-white rounded-3xl shadow-md p-5">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 min-w-16 rounded-2xl bg-amber-100 text-amber-800 px-2 py-2 text-center">
          <p className="text-xl font-bold leading-none">{t(lang, 'moreJobsBadge', { n: gap.jobs_unlocked })}</p>
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
            <ol className="mt-3">
              {gap.learning_path.map((step, index) => (
                <li key={step.step} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < gap.learning_path.length - 1 && (
                    <span aria-hidden="true" className="absolute left-[5px] top-4 bottom-0 w-0.5 bg-stone-200" />
                  )}
                  <span
                    aria-hidden="true"
                    className={[
                      'relative mt-1 h-3 w-3 flex-shrink-0 rounded-full',
                      index === 0 ? 'bg-[#0d6e6e]' : 'bg-stone-300',
                    ].join(' ')}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#5a6475]">{t(lang, 'stepLabel', { n: step.step })}</p>
                    <p className="text-sm text-[#1a1a2e]">{step.action}</p>
                    <p className="text-xs text-[#5a6475] mt-0.5">
                      {t(lang, 'aboutWeeks', { n: step.weeks })}
                      {step.approx_cost_inr > 0 && (
                        <> · {t(lang, 'aboutCost', { n: step.approx_cost_inr.toLocaleString('en-IN') })}</>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
