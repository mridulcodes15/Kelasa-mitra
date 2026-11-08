/** How far (px) the top card must be dragged to count as save (right) or skip (left). */
export const SWIPE_THRESHOLD = 100;

/** Height of one job card in px; the stack adds room for the cards peeking below it. */
export const CARD_HEIGHT = 470;

/** Cards visible at once: the top card plus two peeking behind it. */
export const VISIBLE_CARDS = 3;

const MAX_TILT_DEG = 12;
const TILT_RANGE_PX = 200;
export const MAX_TINT = 0.28;

/** Tilt for a horizontal drag offset; none under prefers-reduced-motion. */
export function tiltFor(x: number, reduced: boolean): number {
  if (reduced) return 0;
  const clamped = Math.max(-TILT_RANGE_PX, Math.min(TILT_RANGE_PX, x));
  return (clamped / TILT_RANGE_PX) * MAX_TILT_DEG;
}

export interface DragFeedback {
  /** 0..MAX_TINT: green tint for save, grows until the threshold. */
  save: number;
  /** 0..MAX_TINT: grey tint for skip. */
  skip: number;
  /** Which action a release here would take. */
  decision: 'save' | 'skip' | null;
}

export function dragFeedback(x: number): DragFeedback {
  const ratio = Math.max(-1, Math.min(1, x / SWIPE_THRESHOLD));
  return {
    save: ratio > 0 ? ratio * MAX_TINT : 0,
    skip: ratio < 0 ? -ratio * MAX_TINT : 0,
    decision: x >= SWIPE_THRESHOLD ? 'save' : x <= -SWIPE_THRESHOLD ? 'skip' : null,
  };
}

/** Scale and drop for a card's place in the stack (0 = top). */
export function peekStyle(depth: number): { scale: number; y: number } {
  return { scale: 1 - depth * 0.05, y: depth * 14 };
}
