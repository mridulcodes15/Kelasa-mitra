import { useEffect, useState } from 'react';
import { MotionGlobalConfig } from 'framer-motion';

const QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.(QUERY).matches ?? false;
  } catch {
    return false;
  }
}

/**
 * MotionConfig reducedMotion="user" only switches off transforms; opacity fades would still
 * run. skipAnimations makes every Framer Motion animation jump to its end state, so under
 * prefers-reduced-motion nothing moves and nothing waits. Call once, in App.
 */
export function useSkipAnimationsWhenReduced(): boolean {
  // Set before the first paint too, so no entrance animation starts.
  const [reduced, setReduced] = useState(() => {
    const value = prefersReducedMotion();
    MotionGlobalConfig.skipAnimations = value;
    return value;
  });
  useEffect(() => {
    let mq: MediaQueryList | undefined;
    try {
      mq = window.matchMedia?.(QUERY);
    } catch {
      mq = undefined;
    }
    const apply = () => {
      const value = mq?.matches ?? false;
      MotionGlobalConfig.skipAnimations = value;
      setReduced(value);
    };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, []);
  return reduced;
}

/**
 * A number that counts up to `target` for show. The final value is returned at once under
 * prefers-reduced-motion; callers keep the real value in the accessibility tree either way.
 */
export function useCountUp(target: number, durationMs = 600): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (prefersReducedMotion() || typeof window.requestAnimationFrame !== 'function') {
      setShown(target);
      return;
    }
    let frame = 0;
    // Time from the first frame's own timestamp: frame clocks need not match performance.now().
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const progress = Math.max(0, Math.min(1, (now - start) / durationMs));
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(target * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    setShown(0);
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return shown;
}

/** Delay (s) for the i-th card of a list entering; capped so content never waits long. */
export const STAGGER_STEP_S = 0.06;
export const STAGGER_MAX_S = 0.18;

export function staggerDelay(index: number): number {
  return Math.min(index * STAGGER_STEP_S, STAGGER_MAX_S);
}
