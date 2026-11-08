import { useAppStore } from '../store/appStore';
import { t } from '../lib/i18n';
import { SkillGapStepper } from './SkillGapStepper';

export function SkillGapSection() {
  const { lang, skillGap, isFetchingSkillGap, skillGapFailed } = useAppStore();

  if (!skillGap && !isFetchingSkillGap && !skillGapFailed) return null;

  const gaps = skillGap?.gaps ?? [];

  return (
    <section className="mx-4 mt-16 pb-8" aria-labelledby="skill-gap-title">
      <h2 id="skill-gap-title" className="text-lg font-bold text-[#0d6e6e]">
        {t(lang, 'skillGapTitle')}
      </h2>

      {isFetchingSkillGap && (
        <p className="text-sm text-[#5a6475] mt-2 animate-pulse motion-reduce:animate-none">
          {t(lang, 'skillGapLoading')}
        </p>
      )}

      {skillGapFailed && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3 mt-2">
          {t(lang, 'skillGapError')}
        </p>
      )}

      {skillGap && gaps.length === 0 && (
        <p className="text-sm text-[#5a6475] mt-2">{t(lang, 'skillGapEmpty')}</p>
      )}

      {gaps.length > 0 && (
        <>
          <p className="text-sm text-[#5a6475] mt-1">{t(lang, 'skillGapIntro')}</p>
          <div className="flex flex-col gap-4 mt-4">
            {gaps.map((gap, index) => (
              <SkillGapStepper key={gap.skill_id} gap={gap} lang={lang} defaultOpen={index === 0} index={index} />
            ))}
          </div>
          <p className="text-xs text-[#5a6475] italic mt-4">{t(lang, 'skillGapSample')}</p>
        </>
      )}
    </section>
  );
}
