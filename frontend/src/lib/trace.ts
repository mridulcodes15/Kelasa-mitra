import { useEffect, useState } from 'react';

/**
 * The "trace" pattern of the language cards (pages/Welcome.tsx), shared: the item under a
 * mouse, a finger or a pen turns green, and keyboard focus gives the same state.
 */

/** Spring for the small lift of a lit item, and for the green fill gliding between items. */
export const LIFT_SPRING = { type: 'spring', stiffness: 380, damping: 28 } as const;
export const HIGHLIGHT_SPRING = { type: 'spring', stiffness: 420, damping: 34 } as const;

/** Classes for the smooth colour change; none under reduced motion. */
export const COLOUR_TRANSITION = 'transition-colors duration-200 motion-reduce:transition-none';

type PointLike = { clientX: number; clientY: number; target: EventTarget | null };

/**
 * The value of `attr` on the item under a pointer. While the pointer is captured the event
 * target is not the element under it, so the position is used; tests (no layout) fall back to
 * the event target.
 */
export function itemAt(e: PointLike, attr: string): string | null {
  let el: Element | null = null;
  if (typeof document.elementFromPoint === 'function' && Number.isFinite(e.clientX)) {
    el = document.elementFromPoint(e.clientX, e.clientY);
  }
  const target = (el ?? e.target) as Element | null;
  return target?.closest?.(`[${attr}]`)?.getAttribute(attr) ?? null;
}

/**
 * The id (value of `attr`) of the item a mouse is over, or a finger or pen is pressing or
 * dragging across, anywhere on the page. A finger lifting, or the browser taking over to
 * scroll (pointercancel), clears it. Listening on the document means a finger that starts
 * elsewhere still lights the item it moves onto, without capturing the pointer, so vertical
 * scrolling is never blocked.
 */
export function usePointerTrace(attr: string): string | null {
  const [lit, setLit] = useState<string | null>(null);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.buttons !== 0) setLit(itemAt(e, attr));
    };
    const onDown = (e: PointerEvent) => setLit(itemAt(e, attr));
    const onEnd = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.type === 'pointercancel') setLit(null);
    };
    const onLeave = () => setLit(null);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', onEnd);
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onEnd);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [attr]);
  return lit;
}
