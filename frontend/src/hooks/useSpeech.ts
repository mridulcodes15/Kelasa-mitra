import { useCallback, useRef, useState } from 'react';
import type { LangCode } from '../lib/types';

type SpeechStatus = 'idle' | 'listening' | 'error';

const LANG_TAG: Record<LangCode, string> = {
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

  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? window.SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
      : undefined;

  const isSupported = Boolean(SpeechRecognitionCtor);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionCtor) {
      setError('mic_not_supported');
      return;
    }
    if (status === 'listening') return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = LANG_TAG[lang];
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setStatus('listening');
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
        onFinalResult(final);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        setError('no_mic_permission');
      } else {
        setError(event.error);
      }
      setStatus('error');
    };

    recognition.onend = () => {
      setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
      setInterimText('');
    };

    recognition.start();
  }, [SpeechRecognitionCtor, lang, onFinalResult, status]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setStatus('idle');
  }, []);

  return { status, interimText, error, isSupported, startListening, stopListening };
}
