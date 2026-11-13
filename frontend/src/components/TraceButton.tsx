import { forwardRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { prefersReducedMotion } from '../lib/motion';
import { COLOUR_TRANSITION, LIFT_SPRING, usePointerTrace } from '../lib/trace';

const ATTR = 'data-trace-button';

interface TraceButtonProps {
  /** Unique on the page; also used by tests. */
  id: string;
  onClick: () => void;
  children: ReactNode;
  ariaLabel?: string;
}

/**
 * Full-width 48px+ button that turns green (teal #0d6e6e, white text, 6:1) with a small lift
 * when a mouse is over it, a finger presses or drags across it, or it has keyboard focus,
 * like the language cards. Under reduced motion it does not move but still turns green.
 */
export const TraceButton = forwardRef<HTMLButtonElement, TraceButtonProps>(function TraceButton(
  { id, onClick, children, ariaLabel }, ref,
) {
  const traced = usePointerTrace(ATTR);
  const [focused, setFocused] = useState(false);
  const lit = traced === id || focused;
  const reduced = prefersReducedMotion();
  return (
    <motion.button
      ref={ref}
      type="button"
      {...{ [ATTR]: id }}
      data-lit={lit ? 'true' : 'false'}
      aria-label={ariaLabel}
      onClick={onClick}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      animate={reduced ? undefined : { y: lit ? -2 : 0 }}
      transition={LIFT_SPRING}
      className={[
        'touch-target w-full min-h-[48px] rounded-2xl border-2 px-4 py-3 font-semibold text-base',
        'shadow-sm outline-none focus-visible:ring-4 focus-visible:ring-[#f59e0b]/60',
        COLOUR_TRANSITION,
        lit ? 'bg-[#0d6e6e] border-[#0d6e6e] text-white shadow-md' : 'bg-white border-[#0d6e6e] text-[#0d6e6e]',
      ].join(' ')}
    >
      {children}
    </motion.button>
  );
});
