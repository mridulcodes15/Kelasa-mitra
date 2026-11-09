import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { t } from '../lib/i18n';
import { suggestedLanguage } from '../lib/scriptLanguage';
import type { LangCode } from '../lib/types';

/**
 * "Looks like Kannada. Switch?" when the worker's words are clearly in another picker
 * language. The picker changes only if the worker taps; nothing is switched automatically
 * and nothing is translated. The prompt is written in the suggested language.
 */
export function LanguageNudge({ text }: { text: string }) {
  const { lang, setLang } = useAppStore();
  const [dismissed, setDismissed] = useState<LangCode[]>([]);
  const suggestion = suggestedLanguage(text, lang);

  if (!suggestion || dismissed.includes(suggestion)) return null;

  return (
    <div
      lang={suggestion}
      data-language-nudge
      className="mt-3 w-full max-w-sm flex items-stretch gap-2 rounded-2xl border-2 border-[#f59e0b] bg-amber-50 p-1.5"
    >
      <button
        type="button"
        onClick={() => setLang(suggestion)}
        className="touch-target flex-1 rounded-xl px-3 text-left text-sm font-semibold text-[#1a1a2e] hover:bg-amber-100"
      >
        🌐 {t(suggestion, 'switchLangPrompt')}
      </button>
      <button
        type="button"
        onClick={() => setDismissed((d) => [...d, suggestion])}
        aria-label={t(suggestion, 'notNow')}
        className="touch-target rounded-xl px-3 text-lg text-[#5a6475] hover:bg-amber-100"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}
