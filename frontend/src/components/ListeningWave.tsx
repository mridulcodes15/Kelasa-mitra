/**
 * Decorative bars shown while the mic is recording. They move in a fixed rhythm and are
 * hidden from screen readers. Under prefers-reduced-motion the bars stand still.
 */
export const WAVE_BARS = 7;

export function ListeningWave() {
  return (
    <div aria-hidden="true" data-listening-wave data-decorative="true" className="flex items-center justify-center gap-1.5 h-10 mt-3">
      {Array.from({ length: WAVE_BARS }, (_, i) => (
        <span
          key={i}
          className="listening-bar block w-1.5 h-full rounded-full bg-[#0d6e6e]"
          style={{ animationDelay: `${(i % 4) * 0.12 + (i > 3 ? 0.06 : 0)}s` }}
        />
      ))}
    </div>
  );
}
