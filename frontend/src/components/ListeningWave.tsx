/**
 * Decorative bars shown while the mic is recording. They move in a fixed rhythm and are
 * hidden from screen readers. Under prefers-reduced-motion the bars stand still.
 */
export const WAVE_BARS = 7;

// Fixed bars with stable ids and staggered delays, computed once.
const BARS = Array.from({ length: WAVE_BARS }, (_, i) => ({
  id: `bar-${i}`,
  delay: `${(i % 4) * 0.12 + (i > 3 ? 0.06 : 0)}s`,
}));

export function ListeningWave() {
  return (
    <div aria-hidden="true" data-listening-wave data-decorative="true" className="flex items-center justify-center gap-1.5 h-10 mt-3">
      {BARS.map((bar) => (
        <span
          key={bar.id}
          className="listening-bar block w-1.5 h-full rounded-full bg-[#0d6e6e]"
          style={{ animationDelay: bar.delay }}
        />
      ))}
    </div>
  );
}
