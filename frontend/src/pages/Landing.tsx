import { useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import { useProfile } from '../hooks/useProfile';
import { useSpeech } from '../hooks/useSpeech';
import { MicButton } from '../components/MicButton';
import { ProfileCard } from '../components/ProfileCard';
import { LanguagePicker } from '../components/LanguagePicker';
import { AgentPanel } from '../components/AgentPanel';
import { SpeakToggle } from '../components/SpeakToggle';
import { SaveOnDevice } from '../components/SaveOnDevice';
import { useReadAloud } from '../hooks/useReadAloud';
import { stopSpeaking } from '../lib/tts';
import { t } from '../lib/i18n';
import { AREA_CHIPS, chipName } from '../lib/areaChips';


export function Landing() {
  const { lang, followUpQuestion, savedProfile, dataDeleted, storageBlocked } = useAppStore();
  useReadAloud(followUpQuestion);
  const {
    transcript, setTranscript, appendTranscript, profile, isExtracting, extractError, runExtraction, runSavedProfile,
  } = useProfile();

  const accumulatedRef = useRef('');
  const micRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handleFinalResult = useCallback(
    (text: string) => {
      accumulatedRef.current += ' ' + text;
      appendTranscript(text + ' ');
    },
    [appendTranscript],
  );

  const { status, interimText, error: micError, isSupported, startListening, stopListening } =
    useSpeech(lang, handleFinalResult);

  const isListening = status === 'listening';

  // A follow-up question means the worker should answer next: move focus to the mic,
  // or to the text box on browsers without speech recognition.
  useEffect(() => {
    if (!followUpQuestion) return;
    (micRef.current ?? textRef.current)?.focus();
  }, [followUpQuestion]);

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
      const finalText = accumulatedRef.current.trim();
      if (finalText) runExtraction(finalText);
    } else {
      // An answer to a follow-up adds to what the worker already said.
      accumulatedRef.current = followUpQuestion ? transcript : '';
      stopSpeaking(); // the mic must not hear the app talking
      startListening();
    }
  }, [followUpQuestion, isListening, runExtraction, startListening, stopListening, transcript]);

  const handleTextSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const text = transcript.trim();
      if (text) runExtraction(text);
    },
    [transcript, runExtraction],
  );

  // A tapped area chip is added to what the worker already said, then matched again.
  const handleAreaChip = useCallback(
    (areaName: string) => {
      const text = `${transcript.trim()} ${areaName}`.trim();
      setTranscript(text + ' ');
      runExtraction(text);
    },
    [transcript, setTranscript, runExtraction],
  );

  const showError = micError === 'no_mic_permission'
    ? t(lang, 'noMicPermission')
    : micError === 'mic_not_supported'
      ? t(lang, 'micNotSupported')
      : extractError ?? null;

  return (
    <main className="page-min-h bg-[#fdf8f0] flex flex-col">
      {/* Header */}
      <header className="px-4 pt-5 pb-2">
        <div className="flex items-center justify-between gap-2">
          <SpeakToggle />
          <LanguagePicker />
        </div>
        <div className="text-center mt-4">
          <h1 className="text-3xl font-extrabold text-[#0d6e6e] tracking-tight">
            {t(lang, 'appName')}
          </h1>
          <p className="text-sm text-[#5a6475] mt-1">{t(lang, 'tagline')}</p>
        </div>
      </header>

      {/* Follow-up question when the profile is missing an area or skills */}
      <AnimatePresence>
        {followUpQuestion && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-auto mt-4 w-[calc(100%-2rem)] max-w-sm bg-white rounded-3xl shadow-md p-5 border-2 border-[#f59e0b]"
          >
            <div role="status">
              <p className="text-[#1a1a2e] font-semibold text-base">🤔 {followUpQuestion}</p>
              <p className="text-sm text-[#5a6475] mt-2">{t(lang, 'followUpHint')}</p>
            </div>
            {profile && !profile.area && (
              <div className="mt-3">
                <p id="area-chips-label" className="text-sm font-semibold text-[#1a1a2e]">
                  {t(lang, 'areaChipsLabel')}
                </p>
                <div role="group" aria-labelledby="area-chips-label" className="mt-2 flex flex-wrap gap-2">
                  {AREA_CHIPS.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      disabled={isExtracting}
                      onClick={() => handleAreaChip(chipName(chip, lang))}
                      className="touch-target px-4 rounded-full border-2 border-[#0d6e6e] text-[#0d6e6e] font-semibold text-sm bg-white
                        hover:bg-[#0d6e6e] hover:text-white disabled:opacity-50 transition-colors"
                    >
                      {chipName(chip, lang)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* IBM watsonx Orchestrate agent reply, or the offline banner */}
      <div className="px-4 mt-3">
        <AgentPanel hideReplyEqualTo={followUpQuestion} />
      </div>

      {/* Mic area */}
      <section className="flex flex-col items-center mt-8 px-4">
        {isSupported ? (
          <>
            <MicButton
              ref={micRef}
              isListening={isListening}
              onClick={handleMicClick}
              label={isListening ? t(lang, 'listening') : t(lang, 'tapToSpeak')}
            />
            <p className="mt-3 text-sm text-[#5a6475]">
              {isListening ? t(lang, 'listening') : t(lang, 'tapToSpeak')}
            </p>
          </>
        ) : (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3 text-center max-w-sm">
            {t(lang, 'micNotSupported')}
          </p>
        )}

        {/* Interim transcript bubble */}
        <AnimatePresence>
          {(interimText || transcript) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-4 max-w-sm w-full bg-white rounded-2xl shadow px-4 py-3 text-sm text-[#1a1a2e]"
            >
              {transcript}
              {interimText && (
                <span className="text-[#5a6475] italic">{interimText}</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Separator */}
        <p className="mt-5 text-xs text-[#5a6475]">{t(lang, 'orType')}</p>

        {/* Text input form */}
        <form onSubmit={handleTextSubmit} className="mt-2 w-full max-w-sm">
          <textarea
            ref={textRef}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={t(lang, 'typeHere')}
            rows={3}
            className="w-full border border-stone-200 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0d6e6e] bg-white"
          />
          <button
            type="submit"
            disabled={!transcript.trim() || isExtracting}
            className="mt-3 w-full bg-[#0d6e6e] text-white font-semibold py-4 rounded-2xl text-base
              disabled:opacity-50 disabled:cursor-not-allowed
              hover:bg-[#0f9d9d] active:scale-[0.98] transition-all touch-target"
          >
            {isExtracting ? '…' : t(lang, 'findJobs')}
          </button>
        </form>

        {/* Error message */}
        <AnimatePresence>
          {showError && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-3 text-sm text-red-600 text-center max-w-sm"
            >
              {showError}
            </motion.p>
          )}
        </AnimatePresence>
      </section>

      {/* Profile card */}
      <section className="px-4 pb-8 mt-6">
        <AnimatePresence>
          {(profile || isExtracting) && (
            <ProfileCard
              profile={profile ?? { skills: [], experience_years: null, area: null, languages: [], detected_language: 'en', raw_input: '' }}
              lang={lang}
              isLoading={isExtracting}
            />
          )}
        </AnimatePresence>

        {savedProfile && !transcript.trim() && !isExtracting && (
          <button
            type="button"
            onClick={() => runSavedProfile(savedProfile)}
            className="mt-4 w-full max-w-sm mx-auto block bg-[#0d6e6e] text-white font-semibold py-4 rounded-2xl text-base
              hover:bg-[#0f9d9d] active:scale-[0.98] transition-all touch-target"
          >
            {t(lang, 'useSavedProfile')}
          </button>
        )}

        {((profile && !isExtracting) || savedProfile || dataDeleted || storageBlocked) && <SaveOnDevice />}
      </section>
    </main>
  );
}
