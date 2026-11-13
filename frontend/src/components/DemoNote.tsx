import { useAppStore } from '../store/appStore';
import { t } from '../lib/i18n';

/** Small reminder that this is a public demo: do not type personal details. */
export function DemoNote({ className = '', inverted = false }: { className?: string; inverted?: boolean }) {
  const lang = useAppStore((s) => s.lang);
  // inverted: white text on the green (teal) background of a lit card.
  return (
    <p data-demo-note className={`text-xs ${inverted ? 'text-white' : 'text-[#5a6475]'} ${className}`}>
      <span aria-hidden="true">ⓘ </span>
      {t(lang, 'demoNote')}
    </p>
  );
}
