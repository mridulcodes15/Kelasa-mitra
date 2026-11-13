import { forwardRef, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import { t } from '../lib/i18n';
import { skillName } from '../lib/skills';
import { prefersReducedMotion, staggerDelay } from '../lib/motion';
import { COLOUR_TRANSITION, HIGHLIGHT_SPRING, LIFT_SPRING, usePointerTrace } from '../lib/trace';
import { DemoNote } from './DemoNote';

const ATTR = 'data-saved-job';

function fmt(n: number) {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

/**
 * The "Saved jobs" shortlist: one rectangular card per job. The card under a mouse, or a finger
 * pressing or dragging across the list, turns green with a small lift and a fill that glides
 * between cards (as the language cards do); keyboard focus gives the same state. The list
 * scrolls normally (touch-action: pan-y). Under reduced motion nothing moves, the green stays.
 */
export const SavedJobsList = forwardRef<HTMLHeadingElement>(function SavedJobsList(_props, headingRef) {
  const { lang, savedJobs, savedJobsBlocked, removeSavedJob } = useAppStore();
  const reduced = prefersReducedMotion();
  const traced = usePointerTrace(ATTR);
  const [focused, setFocused] = useState<string | null>(null);
  // The pointer wins over focus, so only one card is green at a time.
  const active = (traced && savedJobs.some((j) => j.id === traced) ? traced : null) ?? focused;
  const localHeading = useRef<HTMLHeadingElement | null>(null);

  const remove = (id: string) => {
    removeSavedJob(id);
    setFocused(null);
    // The removed card had focus: move it to the heading, which now reads the new count.
    localHeading.current?.focus();
  };

  return (
    <section aria-labelledby="saved-jobs-heading" className="px-4" data-saved-list>
      <h2
        id="saved-jobs-heading"
        ref={(el) => {
          localHeading.current = el;
          if (typeof headingRef === 'function') headingRef(el);
          else if (headingRef) headingRef.current = el;
        }}
        tabIndex={-1}
        className="text-lg font-bold text-[#1a1a2e] outline-none"
      >
        {t(lang, 'savedJobsHeading', { n: savedJobs.length })}
      </h2>
      <p className="text-xs text-[#5a6475] mt-1" data-saved-privacy>🔒 {t(lang, 'savedJobsPrivacy')}</p>
      {savedJobsBlocked && (
        <p role="status" className="text-xs text-amber-800 mt-1" data-saved-blocked>{t(lang, 'savedJobsBlocked')}</p>
      )}

      {savedJobs.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-white border border-stone-200 p-5 text-sm text-[#1a1a2e]" data-saved-empty>
          {t(lang, 'savedJobsEmpty')}
        </p>
      ) : (
        <ul aria-labelledby="saved-jobs-heading" className="mt-4 flex flex-col gap-3 touch-pan-y">
          {savedJobs.map((job, i) => {
            const lit = active === job.id;
            const muted = lit ? 'text-white' : 'text-[#5a6475]';
            const titleId = `saved-title-${job.id}`;
            return (
              <motion.li
                key={job.id}
                {...{ [ATTR]: job.id }}
                data-lit={lit ? 'true' : 'false'}
                tabIndex={0}
                aria-labelledby={titleId}
                onFocus={() => setFocused(job.id)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setFocused((f) => (f === job.id ? null : f));
                  }
                }}
                // Cards fade in a little after one another (capped, skipped under reduced motion).
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, y: lit && !reduced ? -4 : 0 }}
                transition={{ opacity: { duration: 0.2, delay: staggerDelay(i) }, y: LIFT_SPRING }}
                className={[
                  'relative overflow-hidden rounded-2xl border-2 p-4 shadow-sm outline-none',
                  'focus-visible:ring-4 focus-visible:ring-[#f59e0b]/60',
                  COLOUR_TRANSITION,
                  lit ? 'border-[#0d6e6e] shadow-md' : 'border-stone-200',
                  // Under reduced motion the card itself turns green; otherwise the gliding fill does.
                  lit && reduced ? 'bg-[#0d6e6e]' : 'bg-white',
                ].join(' ')}
              >
                {lit && !reduced && (
                  <motion.span
                    layoutId="saved-highlight"
                    aria-hidden="true"
                    data-saved-highlight
                    className="absolute inset-0 bg-[#0d6e6e]"
                    transition={HIGHLIGHT_SPRING}
                  />
                )}
                <div className="relative flex flex-col gap-1.5">
                  <h3 id={titleId} className={`text-base font-bold leading-tight break-words ${COLOUR_TRANSITION} ${lit ? 'text-white' : 'text-[#1a1a2e]'}`}>
                    {job.title}
                  </h3>
                  <p className={`text-sm break-words ${COLOUR_TRANSITION} ${muted}`}>{job.employer}</p>
                  <p className={`text-sm font-semibold ${COLOUR_TRANSITION} ${lit ? 'text-white' : 'text-[#0d6e6e]'}`} data-saved-field="place">
                    📍 {job.area} · {job.distance_text}
                  </p>
                  <p className={`text-sm font-semibold ${COLOUR_TRANSITION} ${lit ? 'text-white' : 'text-amber-900'}`} data-saved-field="pay">
                    💰 ₹{fmt(job.pay_min)}–{fmt(job.pay_max)}{t(lang, 'perMonth')}
                  </p>
                  {job.matched_skills.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5" data-saved-field="skills">
                      <span className={`text-xs font-semibold ${muted}`}>{t(lang, 'skillsYouHave')}:</span>
                      {job.matched_skills.map((id) => (
                        <span
                          key={id}
                          className={[
                            'rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                            lit ? 'border-white text-white' : 'bg-green-50 text-green-800 border-green-200',
                          ].join(' ')}
                        >
                          <span aria-hidden="true">✓ </span>{skillName(id, lang)}
                        </span>
                      ))}
                    </div>
                  )}
                  {job.is_synthetic && (
                    <div>
                      <p className={`text-xs italic ${muted}`}>{t(lang, 'sampleData')}</p>
                      <DemoNote className="mt-0.5" inverted={lit} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(job.id)}
                    aria-label={t(lang, 'removeSavedAria', { title: job.title })}
                    data-remove={job.id}
                    className={[
                      'touch-target mt-2 self-start min-w-[120px] rounded-2xl border-2 px-4 font-semibold text-sm',
                      'bg-white text-[#0d6e6e] outline-none focus-visible:ring-4 focus-visible:ring-[#f59e0b]/60',
                      lit ? 'border-white' : 'border-[#0d6e6e]',
                    ].join(' ')}
                  >
                    {t(lang, 'removeSaved')}
                  </button>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </section>
  );
});
