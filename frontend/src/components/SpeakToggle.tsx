import { useAppStore } from '../store/appStore';
import { t } from '../lib/i18n';
import { stopSpeaking } from '../lib/tts';

/** Mute or unmute read-aloud. Turning it off also stops anything being spoken. */
export function SpeakToggle() {
  const { lang, ttsMuted, setTtsMuted } = useAppStore();

  return (
    <button
      type="button"
      aria-pressed={!ttsMuted}
      onClick={() => {
        if (!ttsMuted) stopSpeaking();
        setTtsMuted(!ttsMuted);
      }}
      className={[
        'touch-target rounded-full px-3 text-xs font-semibold border transition-colors',
        ttsMuted
          ? 'bg-white border-stone-300 text-[#5a6475]'
          : 'bg-[#e6f4f4] border-[#0d6e6e] text-[#0d6e6e]',
      ].join(' ')}
    >
      <span aria-hidden="true">{ttsMuted ? '🔇 ' : '🔊 '}</span>
      {t(lang, ttsMuted ? 'readAloudOff' : 'readAloudOn')}
    </button>
  );
}
