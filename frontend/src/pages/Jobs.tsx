import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import { JobCard } from '../components/JobCard';
import { SaveBurst } from '../components/SaveBurst';
import { prefersReducedMotion } from '../lib/motion';
import { SkillGapSection } from '../components/SkillGapSection';
import { AgentPanel } from '../components/AgentPanel';
import { SpeakToggle } from '../components/SpeakToggle';
import { useReadAloud } from '../hooks/useReadAloud';
import { t } from '../lib/i18n';
import type { JobMatch } from '../lib/types';
import { CARD_HEIGHT, VISIBLE_CARDS, peekStyle } from '../lib/deck';

export function Jobs() {
  const { lang, matches, isFetchingMatches, setScreen, profile } = useAppStore();
  // Read the best match's reason once, when a new set of matches arrives.
  useReadAloud(isFetchingMatches ? null : matches[0]?.reason);
  const [deck, setDeck] = useState<JobMatch[]>([...matches]);
  const [savedCount, setSavedCount] = useState(0);
  // Each save starts a new short burst (none under reduced motion).
  const [burst, setBurst] = useState(0);

  // Sync deck when matches change (e.g. after re-extraction)
  useEffect(() => {
    setDeck([...matches]);
    setSavedCount(0);
  }, [matches]);

  const handleSkip = useCallback(() => {
    setDeck((prev) => prev.slice(1));
  }, []);

  const handleSave = useCallback(() => {
    setSavedCount((c) => c + 1);
    if (!prefersReducedMotion()) setBurst((b) => b + 1);
    setDeck((prev) => prev.slice(1));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') handleSave();
      if (e.key === 'ArrowLeft') handleSkip();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave, handleSkip]);

  const areaName = profile?.area?.name ?? '';
  const jobCount = matches.length;

  if (isFetchingMatches) {
    return (
      <div className="page-min-h bg-[#fdf8f0] flex items-center justify-center">
        <p className="text-[#5a6475] animate-pulse motion-reduce:animate-none">{t(lang, 'findingJobs')}</p>
      </div>
    );
  }

  return (
    <main className="page-min-h bg-[#fdf8f0] flex flex-col">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 flex items-center gap-3">
        <button
          onClick={() => setScreen('landing')}
          aria-label={t(lang, 'backToProfileAria')}
          className="text-[#0d6e6e] font-semibold text-sm touch-target"
        >
          {t(lang, 'backToProfile')}
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-[#1a1a2e]">
            {t(lang, 'jobsFound', { n: jobCount })}
          </h1>
          {areaName && (
            <p className="text-xs text-[#5a6475]">{t(lang, 'nearArea', { area: areaName })}</p>
          )}
        </div>
        <SpeakToggle />
        {savedCount > 0 && (
          <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full">
            {t(lang, 'savedCount', { n: savedCount })}
          </span>
        )}
      </header>

      {/* IBM watsonx Orchestrate agent reply, or the offline banner */}
      <div className="px-4 mb-3">
        <AgentPanel />
      </div>

      {/* Keyboard hint */}
      <p className="text-xs text-center text-[#5a6475] mb-2 hidden md:block">
        {t(lang, 'keyboardHint')}
      </p>

      {/* Card stack */}
      {deck.length > 0 ? (
        <section
          className="relative mx-4"
          style={{ minHeight: CARD_HEIGHT + peekStyle(VISIBLE_CARDS - 1).y }}
          aria-label={t(lang, 'jobCardsLabel')}
        >
          <AnimatePresence>
            {/* The top card plus the next two peeking behind it */}
            {deck.slice(0, VISIBLE_CARDS).map((match, i) => (
              <JobCard
                key={match.job.id}
                match={match}
                isTop={i === 0}
                depth={i}
                onSave={handleSave}
                onSkip={handleSkip}
              />
            )).reverse()}
          </AnimatePresence>

          {burst > 0 && <SaveBurst key={burst} onDone={() => setBurst(0)} />}

          {/* Swipe hints */}
          <div className="absolute bottom-[-40px] left-0 right-0 flex justify-between px-4">
            <span className="text-xs text-[#5a6475]">{t(lang, 'skipHint')}</span>
            <span className="text-xs text-[#5a6475]">{t(lang, 'saveHint')}</span>
          </div>
        </section>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center px-6 py-8 gap-4 text-center"
        >
          <p className="text-4xl">🎉</p>
          <p className="text-lg font-bold text-[#1a1a2e]">
            {savedCount > 0 ? t(lang, 'savedDoneTitle', { n: savedCount }) : t(lang, 'allDone')}
          </p>
          <p className="text-sm text-[#5a6475]">
            {savedCount > 0 ? t(lang, 'savedDoneBody') : t(lang, 'noMoreJobs')}
          </p>
          <button
            onClick={() => setScreen('landing')}
            className="mt-4 bg-[#0d6e6e] text-white font-semibold py-4 px-8 rounded-2xl touch-target hover:bg-[#0f9d9d]"
          >
            {t(lang, 'searchAgain')}
          </button>
        </motion.div>
      )}

      <SkillGapSection />
    </main>
  );
}
