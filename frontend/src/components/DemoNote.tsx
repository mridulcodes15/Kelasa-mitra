import { useAppStore } from '../store/appStore';
import { t } from '../lib/i18n';

/** Small reminder that this is a public demo: do not type personal details. */
export function DemoNote({ className = '' }: { className?: string }) {
  const lang = useAppStore((s) => s.lang);
  return (
    <p data-demo-note className={`text-xs text-[#5a6475] ${className}`}>
      <span aria-hidden="true">ⓘ </span>
      {t(lang, 'demoNote')}
    </p>
  );
}
