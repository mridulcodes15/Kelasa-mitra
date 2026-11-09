import { useAppStore } from '../store/appStore';
import { t } from '../lib/i18n';
import type { LangCode } from '../lib/types';

const ALL: LangCode[] = ['en', 'hi', 'kn'];

interface NoSpeechHintProps {
  /** Switch to this language and listen again. */
  onPick: (code: LangCode) => void;
  onDismiss: () => void;
}

/**
 * Shown when a listening session ended without any words. The browser's speech recognition
 * only hears the language it was told, so offer the other two languages. Nothing is detected:
 * the worker chooses.
 */
export function NoSpeechHint({ onPick, onDismiss }: NoSpeechHintProps) {
  const lang = useAppStore((s) => s.lang);
  const others = ALL.filter((code) => code !== lang);

  return (
    <div data-no-speech-hint className="mt-3 w-full max-w-sm rounded-2xl border-2 border-[#f59e0b] bg-amber-50 p-3">
      <div className="flex items-start gap-2">
        <p role="status" className="flex-1 text-sm font-semibold text-[#1a1a2e]">
          {t(lang, 'noSpeechHint')}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t(lang, 'notNow')}
          className="touch-target -mt-1 -mr-1 rounded-xl text-lg text-[#5a6475] hover:bg-amber-100"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        {others.map((code) => (
          <button
            key={code}
            type="button"
            lang={code}
            data-switch-to={code}
            onClick={() => onPick(code)}
            className="touch-target flex-1 rounded-xl border-2 border-[#0d6e6e] bg-white px-3 text-base font-bold text-[#0d6e6e] hover:bg-[#e6f4f4]"
          >
            {t(code, 'languageName')}
          </button>
        ))}
      </div>
    </div>
  );
}
