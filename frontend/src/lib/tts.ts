import type { LangCode } from './types';

/**
 * Read text aloud with the browser's own speech synthesis (SpeechSynthesisUtterance).
 * Nothing is sent to our server. If the browser has no voice for the language, this does
 * nothing at all: no fallback to another language, and the text stays on screen.
 */

const LANG_TAG: Record<LangCode, string> = { en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN' };

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

/** The best installed voice for the language, or null. Prefers the Indian variant. */
export function findVoice(voices: SpeechSynthesisVoice[], lang: LangCode): SpeechSynthesisVoice | null {
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();
  const exact = voices.find((v) => norm(v) === LANG_TAG[lang].toLowerCase());
  return exact ?? voices.find((v) => norm(v).split('-')[0] === lang) ?? null;
}

function voicesNow(s: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const list = s.getVoices();
  if (list.length > 0) return Promise.resolve(list);
  // Chrome loads voices asynchronously; wait briefly for them, then give up quietly.
  return new Promise((resolve) => {
    const done = () => {
      s.removeEventListener?.('voiceschanged', done);
      resolve(s.getVoices());
    };
    s.addEventListener?.('voiceschanged', done);
    setTimeout(done, 1500);
  });
}

export function stopSpeaking(): void {
  synth()?.cancel();
}

/** Speak `text` in `lang` if a matching voice exists. Resolves true if it started speaking. */
export async function speak(text: string, lang: LangCode): Promise<boolean> {
  const s = synth();
  const clean = text.trim();
  if (!s || !clean || typeof SpeechSynthesisUtterance === 'undefined') return false;
  const voice = findVoice(await voicesNow(s), lang);
  if (!voice) return false;
  s.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  s.speak(utterance);
  return true;
}
