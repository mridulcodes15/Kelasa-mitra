import type { LangCode } from '../lib/types';
import { useAppStore } from '../store/appStore';

const LANGS: { code: LangCode; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'EN' },
  { code: 'kn', label: 'Kannada', native: 'ಕ' },
  { code: 'hi', label: 'Hindi', native: 'हि' },
];

export function LanguagePicker() {
  const { lang, setLang } = useAppStore();

  return (
    <div className="flex gap-2 justify-end" role="radiogroup" aria-label="Select language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          role="radio"
          aria-checked={lang === l.code}
          onClick={() => setLang(l.code)}
          className={[
            'touch-target flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-colors',
            lang === l.code
              ? 'bg-[#0d6e6e] text-white'
              : 'bg-white border border-[#0d6e6e] text-[#0d6e6e] hover:bg-[#e6f4f4]',
          ].join(' ')}
          aria-label={l.label}
        >
          {l.native}
        </button>
      ))}
    </div>
  );
}
