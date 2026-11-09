import { motion, useTransform, type MotionValue } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import { t } from '../lib/i18n';
import { dragFeedback } from '../lib/deck';

const KINDS = {
  save: {
    tint: 'bg-green-500',
    stamp: 'left-5 rotate-[-12deg] border-green-700 text-green-700',
  },
  skip: {
    tint: 'bg-stone-500',
    stamp: 'right-5 rotate-[12deg] border-stone-600 text-stone-700',
  },
} as const;

type Kind = keyof typeof KINDS;

/** Tint and "Save ✓" / "Skip ✕" stamp for one drag direction. */
function Feedback({ x, kind }: { x: MotionValue<number>; kind: Kind }) {
  const lang = useAppStore((s) => s.lang);
  const tint = useTransform(x, (v) => dragFeedback(v)[kind]);
  const stamp = useTransform(x, (v) => (dragFeedback(v).decision === kind ? 1 : 0));
  return (
    <>
      <motion.div aria-hidden="true" data-tint={kind} style={{ opacity: tint }}
        className={`pointer-events-none absolute inset-0 ${KINDS[kind].tint}`} />
      <motion.span aria-hidden="true" style={{ opacity: stamp }}
        className={`pointer-events-none absolute top-5 z-10 rounded-xl border-4 bg-white/90 px-3 py-1 text-lg font-extrabold ${KINDS[kind].stamp}`}>
        {t(lang, kind)}
      </motion.span>
    </>
  );
}

/** Drag feedback on the top card: decoration only; the buttons and arrow keys do the same. */
export function DragFeedback({ x }: { x: MotionValue<number> }) {
  return (
    <>
      <Feedback x={x} kind="save" />
      <Feedback x={x} kind="skip" />
    </>
  );
}
