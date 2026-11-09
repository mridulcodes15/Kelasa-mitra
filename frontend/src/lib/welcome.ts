import type { LangCode } from './types';

/** Splash (logo alone), its fade-out, and the pause between choosing and the mic screen. */
export const SPLASH_MS = 1200;
export const FADE_MS = 300;
export const SELECT_MS = 400;

/** The splash fades out with one even scale (the same on both axes), never a stretch. */
export const SPLASH_EXIT = { opacity: 0, scale: 0.92 } as const;

/** Language cards on the welcome screen; the Latin name is shown under non-Latin names. */
export const LANGUAGE_CHOICES: { code: LangCode; latin?: string }[] = [
  { code: 'en' },
  { code: 'hi', latin: 'Hindi' },
  { code: 'kn', latin: 'Kannada' },
];
