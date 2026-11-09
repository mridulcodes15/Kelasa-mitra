import { useCallback, useEffect, useRef, useState } from 'react';
import type { LangCode } from '../lib/types';

type SpeechStatus = 'idle' | 'listening' | 'error';

/** BCP 47 tag given to the browser's speech recognition for each picker option. */
export const LANG_TAG: Record<LangCode, string> = {
  en: 'en-IN',
  kn: 'kn-IN',
  hi: 'hi-IN',
};

interface UseSpeechReturn {
  status: SpeechStatus;
  interimText: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
}

export function useSpeech(
  lang: LangCode,
  onFinalResult: (text: string) => void,
): UseSpeechReturn {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const statusRef = useRef<SpeechStatus>('idle');
  const onFinalRef = useRef(onFinalResult);
  onFinalRef.current = onFinalResult;

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
  const begin = useCallback((code: LangCode) => {
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = LANG_TAG[code];
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      updateStatus('listening');
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          final += r[0].transcript;
        } else {
          interim += r[0].transcript;
        }
      }
      setInterimText(interim);
      if (final) {
        onFinalRef.current(final);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        setError('no_mic_permission');
      } else {
        setError(event.error);
      }
      updateStatus('error');
    };

    recognition.onend = () => {
      updateStatus((prev) => (prev === 'listening' ? 'idle' : prev));
      setInterimText('');
    };

    recognition.start();
  }, [SpeechRecognitionCtor, updateStatus]);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionCtor) {
      setError('mic_not_supported');
      return;
    }
    if (statusRef.current === 'listening') return;
    begin(lang);
  }, [SpeechRecognitionCtor, begin, lang]);

  // The language is fixed when a recognition session starts. If the picker changes while
  // listening, end that session quietly and start a new one in the new language; words
  // already heard stay in the transcript.
  const langRef = useRef(lang);
  useEffect(() => {
    if (langRef.current === lang) return;
    langRef.current = lang;
    const old = recognitionRef.current;
    if (!old || statusRef.current !== 'listening') return;
    old.onend = null;
    old.onresult = null;
    old.onerror = null;
    old.stop();
    setInterimText('');
    begin(lang);
  }, [lang, begin]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    updateStatus('idle');
  }, [updateStatus]);

  return { status, interimText, error, isSupported, startListening, stopListening };
}
