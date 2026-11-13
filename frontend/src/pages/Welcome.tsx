import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import { t } from '../lib/i18n';
import { prefersReducedMotion } from '../lib/motion';
import { BrandMark } from '../components/BrandMark';
import type { LangCode } from '../lib/types';
import { FADE_MS, LANGUAGE_CHOICES, SELECT_MS, SPLASH_EXIT, SPLASH_MS } from '../lib/welcome';
import { HIGHLIGHT_SPRING, LIFT_SPRING, itemAt } from '../lib/trace';

/**
 * First screen of every visit: the worker picks the language before the mic appears,
 * because the browser's speech recognition must be told the language in advance.
 * The choice is kept in memory only (the store), never saved.
 *
 * Phases: 'splash' (logo alone) → 'fading' (logo fades out) → 'cards'. The cards are in
 * the page underneath from the start, so screen readers and keyboard users never wait;
 * a tap or any key skips to the cards. Under reduced motion, or when coming back from the
 * mic screen, it starts at the cards.
 */
type Phase = 'splash' | 'fading' | 'cards';

const HEADING_ORDER: LangCode[] = ['en', 'hi', 'kn'];

/** The language card under a pointer (shared trace pattern, lib/trace.ts). */
function cardAt(e: PointerEvent<HTMLElement>): LangCode | null {
  return itemAt(e, 'data-lang-card') as LangCode | null;
}

export function Welcome() {
  const { setLang, setScreen, setFocusMicOnArrival, welcomeSeen, setWelcomeSeen } = useAppStore();
  const reduced = prefersReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduced || welcomeSeen ? 'cards' : 'splash');
  const [lit, setLit] = useState<LangCode | null>(null);
  const [focused, setFocused] = useState(0);
  const [selected, setSelected] = useState<LangCode | null>(null);
  const tracing = useRef(false);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Splash: about 1.2 s, then a short fade, then the cards. A tap or any key skips it.
  useEffect(() => {
    if (phase === 'cards') return;
    const skip = () => setPhase('cards');
    const timer = phase === 'splash'
      ? window.setTimeout(() => setPhase('fading'), SPLASH_MS)
      : window.setTimeout(skip, FADE_MS);
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [phase]);

  const choose = useCallback((code: LangCode) => {
    if (selected) return;
    setSelected(code);
    setLit(code);
    setLang(code); // the language is set before the mic screen exists
    setWelcomeSeen(true);
    setFocusMicOnArrival(true);
    if (reduced) setScreen('landing');
    else window.setTimeout(() => setScreen('landing'), SELECT_MS);
  }, [reduced, selected, setFocusMicOnArrival, setLang, setScreen, setWelcomeSeen]);

  // Mouse hover or a finger moving across the cards lights the card under it; releasing over
  // a card picks it. A plain tap is a press and release on the same card.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (selected) return;
    tracing.current = true;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId); // keep following the finger across cards
    } catch {
      // not supported (tests); the trace still works on the event target
    }
    setLit(cardAt(e));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (selected) return;
    const code = cardAt(e);
    if (code) setLit(code);
    else if (!tracing.current) setLit(null);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!tracing.current) return;
    tracing.current = false;
    const code = cardAt(e);
    if (code) choose(code);
    else setLit(null);
  };
  const onPointerLeave = () => {
    if (!tracing.current && !selected) setLit(null);
  };

  const moveFocus = (index: number) => {
    const next = (index + LANGUAGE_CHOICES.length) % LANGUAGE_CHOICES.length;
    setFocused(next);
    cardRefs.current[next]?.focus(); // onFocus lights it
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowDown: focused + 1, ArrowRight: focused + 1, ArrowUp: focused - 1, ArrowLeft: focused - 1,
      Home: 0, End: LANGUAGE_CHOICES.length - 1,
    };
    if (e.key in keys) {
      e.preventDefault();
      moveFocus(keys[e.key]);
    }
  };

  return (
    <main data-welcome data-phase={phase} className="relative page-min-h bg-[#fdf8f0]">
      {/* Splash: the mark and name alone, centred; decoration only, hidden from screen readers.
          It fades out during 'fading' and is removed as soon as the cards phase starts (no exit
          animation), so it can never sit invisibly over the cards and catch their taps. While it
          is up it takes the taps, which only skip it. */}
      {phase !== 'cards' && (
        <motion.div
          data-splash
          aria-hidden="true"
          initial={{ opacity: 0, scale: 1 }}
          animate={phase === 'fading' ? SPLASH_EXIT : { opacity: 1, scale: 1 }}
          transition={{ duration: FADE_MS / 1000, ease: 'easeOut' }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#fdf8f0]"
        >
          <BrandMark size={96} />
          <p className="mt-4 text-3xl font-extrabold text-[#0d6e6e] tracking-tight" lang="en">Kelasa Mitra</p>
        </motion.div>
      )}

      {/* Cards: in the page from the start, faded in once the splash has gone */}
      <motion.section
        data-cards
        aria-labelledby="choose-language"
        initial={false}
        animate={{ opacity: phase === 'cards' ? 1 : 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex flex-col items-center px-4 pt-8 pb-8"
      >
        <BrandMark size={40} />
        <h1 id="choose-language" className="mt-4 text-center">
          {HEADING_ORDER.map((code) => (
            <span key={code} lang={code} className="block text-lg font-bold text-[#1a1a2e] leading-snug">
              {t(code, 'chooseLanguage')}
            </span>
          ))}
        </h1>

        <div
          role="radiogroup"
          aria-labelledby="choose-language"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { tracing.current = false; setLit(null); }}
          onPointerLeave={onPointerLeave}
          onKeyDown={onKeyDown}
          // touch-none: dragging a finger across the cards must not scroll the page
          className="mt-6 w-full max-w-sm flex flex-col gap-4 touch-none select-none"
        >
          {LANGUAGE_CHOICES.map(({ code, latin }, i) => {
            const isLit = lit === code;
            const isChosen = selected === code;
            return (
              <motion.button
                key={code}
                ref={(el) => { cardRefs.current[i] = el; }}
                type="button"
                role="radio"
                aria-checked={isChosen}
                lang={code}
                data-lang-card={code}
                data-lit={isLit ? 'true' : 'false'}
                tabIndex={i === focused ? 0 : -1}
                onFocus={() => { setFocused(i); if (!selected) setLit(code); }}
                onBlur={() => { if (!tracing.current && !selected) setLit((c) => (c === code ? null : c)); }}
                // Keyboard and assistive tech (click with detail 0); a pointer chooses on release.
                onClick={(e) => { if (e.detail === 0) choose(code); }}
                animate={reduced ? undefined : {
                  y: isLit && !selected ? -4 : 0,
                  scale: isChosen ? [1, 1.05, 1] : 1,
                  opacity: selected && !isChosen ? 0.4 : 1,
                }}
                transition={isChosen
                  ? { duration: SELECT_MS / 1000, ease: 'easeInOut' }
                  : LIFT_SPRING}
                className={[
                  'relative w-full min-h-[96px] rounded-3xl border-2 shadow-sm overflow-hidden',
                  'px-6 py-4 text-left flex items-center gap-3',
                  'transition-colors duration-200 motion-reduce:transition-none',
                  // Under reduced motion the card itself turns green; otherwise the gliding fill does.
                  isLit && reduced ? 'bg-[#0d6e6e] border-[#0d6e6e]' : 'bg-white',
                  isLit ? 'border-[#0d6e6e]' : 'border-stone-200',
                ].join(' ')}
              >
                {isLit && !reduced && (
                  <motion.span
                    layoutId="lang-highlight"
                    aria-hidden="true"
                    data-lang-highlight
                    className="absolute inset-0 bg-[#0d6e6e]"
                    transition={HIGHLIGHT_SPRING}
                  />
                )}
                <span className="relative flex-1 flex flex-col">
                  <span className={['text-2xl font-bold transition-colors duration-200 motion-reduce:transition-none',
                    isLit ? 'text-white' : 'text-[#1a1a2e]'].join(' ')}>
                    {t(code, 'languageName')}
                  </span>
                  {latin && (
                    <span lang="en" className={['text-sm font-semibold mt-0.5 transition-colors duration-200 motion-reduce:transition-none',
                      isLit ? 'text-white' : 'text-[#5a6475]'].join(' ')}>
                      {latin}
                    </span>
                  )}
                </span>
                {isChosen && (
                  <span aria-hidden="true" data-check className="relative grid place-items-center h-9 w-9 rounded-full bg-white text-[#0d6e6e] text-xl font-bold">
                    ✓
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.section>
    </main>
  );
}
