import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { speak, stopSpeaking } from '../lib/tts';

/**
 * Speak `text` once each time it changes to a new, non-empty value, unless read-aloud is
 * muted. Stops speech when the text goes away, the language changes or the screen unmounts.
 */
export function useReadAloud(text: string | null | undefined) {
  const { lang, ttsMuted } = useAppStore();

  useEffect(() => {
    if (!text || ttsMuted) return;
    void speak(text, lang);
    return () => stopSpeaking();
  }, [text, lang, ttsMuted]);
}
