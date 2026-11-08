import { motion } from 'framer-motion';

/** Small shapes that fly out once when a job is saved. Pure decoration: no library, no text. */
export const BURST_SHAPES = 10;
const COLOURS = ['#0d6e6e', '#f59e0b', '#16a34a', '#0f9d9d', '#fbbf24'];
const DISTANCE_PX = 70;

interface SaveBurstProps {
  onDone: () => void;
}

export function SaveBurst({ onDone }: SaveBurstProps) {
  return (
    <div
      aria-hidden="true"
      data-save-burst
      className="pointer-events-none absolute left-1/2 top-1/3 z-20 h-0 w-0"
    >
      {Array.from({ length: BURST_SHAPES }, (_, i) => {
        const angle = (i / BURST_SHAPES) * Math.PI * 2;
        const distance = DISTANCE_PX * (i % 2 ? 0.75 : 1);
        return (
          <motion.span
            key={i}
            data-burst-shape
            initial={{ x: 0, y: 0, scale: 0.6, opacity: 1 }}
            animate={{ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, scale: 1, opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            onAnimationComplete={i === 0 ? onDone : undefined}
            className={`absolute -ml-1.5 -mt-1.5 h-3 w-3 ${i % 3 === 0 ? 'rotate-45' : 'rounded-full'}`}
            style={{ backgroundColor: COLOURS[i % COLOURS.length] }}
          />
        );
      })}
    </div>
  );
}
