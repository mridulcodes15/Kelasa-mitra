import { useCallback, useEffect, useRef, useState } from 'react';
import type { LangCode } from '../lib/types';
import { joinText, sessionText, type Segment } from '../lib/speechText';

type SpeechStatus = 'idle' | 'listening' | 'error';

/** BCP 47 tag given to the browser's speech recognition for each picker option. */
export const LANG_TAG: Record<LangCode, string> = {
  en: 'en-IN',
  kn: 'kn-IN',
  hi: 'hi-IN',
};

interface UseSpeechReturn {
  status: SpeechStatus;
  /** Words heard but not yet confirmed; replaced (never appended) on every result. */
  interimText: string;
  error: string | null;
  isSupported: boolean;
  /** True when the last session ended without any words (no-speech, empty or stopped). */
  noSpeech: boolean;
  dismissNoSpeech: () => void;
  /** Start listening, optionally in a language just picked (before the store re-renders). */
  startListening: (code?: LangCode) => void;
  /**
   * Stop listening. Resolves with the run's final text once the browser has ended the session:
   * words still being confirmed when the worker tapped stop are included.
   */
  stopListening: () => Promise<string>;
}

/** If the browser never ends the session after stop(), finish anyway after this long. */
export const STOP_GRACE_MS = 1500;

/**
 * Browser speech recognition. `onFinalText` receives the WHOLE confirmed text of this listening
 * run each time it changes (not a piece to append), so a result the browser re-sends can never
 * be added twice. A language switch while listening carries the words heard so far into the
 * new session.
 */
export function useSpeech(
  lang: LangCode,
  onFinalText: (text: string) => void,
): UseSpeechReturn {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [noSpeech, setNoSpeech] = useState(false);
  const heardRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const statusRef = useRef<SpeechStatus>('idle');
  const onFinalRef = useRef(onFinalText);
  useEffect(() => {
    onFinalRef.current = onFinalText;
  }, [onFinalText]);
  // This session's results by index; text carried over from earlier sessions of this run
  // (language switch); and the last confirmed text reported, to report only changes.
  const segmentsRef = useRef<(Segment | undefined)[]>([]);
  const carriedRef = useRef('');
  const reportedRef = useRef('');
  // Set while waiting for the session to end after stop(); called with the final text.
  const finishRef = useRef<(() => void) | null>(null);

  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? window.SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
      : undefined;

  const isSupported = Boolean(SpeechRecognitionCtor);

  const updateStatus = useCallback((next: SpeechStatus | ((prev: SpeechStatus) => SpeechStatus)) => {
    setStatus((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      statusRef.current = value;
      return value;
    });
  }, []);

  /** Start a recognition session in the given language. */
  const begin = useCallback((code: LangCode, carryOn = false) => {
    if (!SpeechRecognitionCtor) return;
    segmentsRef.current = [];
    if (!carryOn) carriedRef.current = '';
    reportedRef.current = carriedRef.current;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = LANG_TAG[code];
    recognitionRef.current = recognition;
    heardRef.current = false;
    setNoSpeech(false);

    recognition.onstart = () => {
      updateStatus('listening');
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const segments = segmentsRef.current;
      // A list re-sent from the start that is shorter than before replaces it.
      if (event.resultIndex === 0 && event.results.length < segments.length) segments.length = event.results.length;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        segments[i] = { text: r[0]?.transcript ?? '', final: r.isFinal }; // overwrite, never append
      }
      const { final, interim } = sessionText(segments);
      if (final || interim) heardRef.current = true;
      setInterimText(interim);
      const confirmed = joinText(carriedRef.current, final);
      if (confirmed !== reportedRef.current) {
        reportedRef.current = confirmed;
        onFinalRef.current(confirmed);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        setError('no_mic_permission');
      } else {
        setError(event.error);
      }
      if (event.error === 'no-speech') setNoSpeech(true);
      updateStatus('error');
    };

    recognition.onend = () => {
      updateStatus((prev) => (prev === 'listening' ? 'idle' : prev));
      finishRef.current?.();
      setInterimText('');
      if (!heardRef.current) setNoSpeech(true);
    };

    recognition.start();
  }, [SpeechRecognitionCtor, updateStatus]);

  // The language is fixed when a recognition session starts. If the picker changes while
  // listening, end that session quietly and start a new one in the new language; words
  // already heard stay in the transcript.
  const langRef = useRef(lang);

  const startListening = useCallback((code?: LangCode) => {
    if (!SpeechRecognitionCtor) {
      setError('mic_not_supported');
      return;
    }
    if (statusRef.current === 'listening') return;
    const chosen = code ?? lang;
    langRef.current = chosen; // a language just picked must not trigger a second restart
    begin(chosen);
  }, [SpeechRecognitionCtor, begin, lang]);
  useEffect(() => {
    if (langRef.current === lang) return;
    langRef.current = lang;
    const old = recognitionRef.current;
    if (!old || statusRef.current !== 'listening') return;
    old.onend = null;
    old.onresult = null;
    old.onerror = null;
    old.stop();
    // Keep everything heard so far, confirmed or not, and continue in the new language.
    const { final, interim } = sessionText(segmentsRef.current);
    carriedRef.current = joinText(carriedRef.current, final, interim);
    if (carriedRef.current !== reportedRef.current) onFinalRef.current(carriedRef.current);
    setInterimText('');
    begin(lang, true);
  }, [lang, begin]);

  const stopListening = useCallback(() => new Promise<string>((resolve) => {
    const recognition = recognitionRef.current;
    if (!recognition || statusRef.current !== 'listening') {
      resolve(reportedRef.current);
      return;
    }
    finishRef.current?.(); // an earlier stop still waiting: settle it first
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (finishRef.current !== finish) return;
      finishRef.current = null;
      clearTimeout(timer);
      // Words the browser never confirmed are still on screen; they belong to the answer.
      const { final, interim } = sessionText(segmentsRef.current);
      const text = joinText(carriedRef.current, final, interim);
      if (text !== reportedRef.current) {
        reportedRef.current = text;
        onFinalRef.current(text);
      }
      resolve(text);
    };
    finishRef.current = finish;
    timer = setTimeout(finish, STOP_GRACE_MS);
    updateStatus('idle');
    recognition.stop(); // results confirmed after this still arrive, then onend calls finish
  }), [updateStatus]);

  const dismissNoSpeech = useCallback(() => setNoSpeech(false), []);

  return { status, interimText, error, isSupported, noSpeech, dismissNoSpeech, startListening, stopListening };
}
