import type { LangCode } from './types';

/**
 * Which picker language a piece of text looks like, from its script. Uses the same Unicode
 * ranges as backend/tools/fallback.py (Kannada U+0C80–U+0CFF, Devanagari U+0900–U+097F).
 * Only used to suggest switching the picker; nothing is ever switched or translated by it.
 */
export const MIN_LETTERS = 12;
export const MIN_SHARE = 0.6;

// Latin text is called English only when it has common English words, so romanised
// Kannada or Hindi ("naanu adige maadtini", "main cook hoon") is not mistaken for English.
const ENGLISH_WORDS = new Set([
  'am', 'is', 'the', 'and', 'in', 'at', 'of', 'for', 'have', 'has', 'was', 'my', 'live', 'living',
  'work', 'worked', 'working', 'years', 'year', 'near', 'job', 'jobs', 'experience', 'can', 'want',
]);
export const MIN_ENGLISH_WORDS = 2;

export function detectScriptLanguage(text: string): LangCode | null {
  let kn = 0;
  let hi = 0;
  let latin = 0;
  for (const ch of text) {
    if (ch >= 'ಀ' && ch <= '೿') kn++;
    else if (ch >= 'ऀ' && ch <= 'ॿ') hi++;
    else if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) latin++;
  }
  const total = kn + hi + latin;
  if (total < MIN_LETTERS) return null;
  if (kn / total >= MIN_SHARE) return 'kn';
  if (hi / total >= MIN_SHARE) return 'hi';
  if (latin / total >= MIN_SHARE) {
    const words = new Set(text.toLowerCase().match(/[a-z]+/g) ?? []);
    const english = [...words].filter((w) => ENGLISH_WORDS.has(w)).length;
    return english >= MIN_ENGLISH_WORDS ? 'en' : null;
  }
  return null;
}

/** The language to suggest, or null when the text matches the picker or is not clear enough. */
export function suggestedLanguage(text: string, picker: LangCode): LangCode | null {
  const detected = detectScriptLanguage(text);
  return detected && detected !== picker ? detected : null;
}
