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
import { ListeningWave } from '../components/ListeningWave';
import { LanguageNudge } from '../components/LanguageNudge';
import { DemoNote } from '../components/DemoNote';
import { NoSpeechHint } from '../components/NoSpeechHint';
import type { LangCode } from '../lib/types';
import { useReadAloud } from '../hooks/useReadAloud';
import { stopSpeaking } from '../lib/tts';
import { t } from '../lib/i18n';
import { AREA_CHIPS, chipName } from '../lib/areaChips';
import { joinText } from '../lib/speechText';
import { SKILL_CHIPS } from '../lib/skillChips';
import { skillName } from '../lib/skills';


export function Landing() {
  const {
    lang, setLang, followUpQuestion, savedProfile, dataDeleted, storageBlocked, focusMicOnArrival, setFocusMicOnArrival,
    setScreen,
  } = useAppStore();
  useReadAloud(followUpQuestion);
  const {
    transcript, setTranscript, profile, isExtracting, extractError, runExtraction, runSavedProfile,
  } = useProfile();

  // Text that was already in the box when listening started (an answer to a follow-up adds to
  // it), and the full text of the current listening run, base + what was heard.
  const baseRef = useRef('');
  const spokenRef = useRef('');
  const micRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // The hook reports the whole confirmed text of this run each time; replace, never append.
  const handleFinalText = useCallback(
    (heard: string) => {
      const text = joinText(baseRef.current, heard);
      spokenRef.current = text;
      setTranscript(text ? text + ' ' : '');
    },
    [setTranscript],
  );

  const {
    status, interimText, error: micError, isSupported, noSpeech, dismissNoSpeech, startListening, stopListening,
  } = useSpeech(lang, handleFinalText);

  const isListening = status === 'listening';

  // A follow-up question means the worker should answer next: move focus to the mic,
  // or to the text box on browsers without speech recognition.
  useEffect(() => {
    if (!followUpQuestion) return;
    (micRef.current ?? textRef.current)?.focus();
  }, [followUpQuestion]);

  // Arriving from the welcome screen: the language is chosen, so the mic is the next step.
  useEffect(() => {
    if (!focusMicOnArrival) return;
    (micRef.current ?? textRef.current)?.focus();
    setFocusMicOnArrival(false);
  }, [focusMicOnArrival, setFocusMicOnArrival]);

  const handleMicClick = useCallback(() => {
    if (isListening) {
      const base = baseRef.current;
      // Wait for the browser to finish: on Android the last words are often confirmed only
      // after stop, and the search must run on the same final text the box shows.
      void stopListening().then(() => {
        const finalText = spokenRef.current.trim();
        // Search only if something new was heard (stopping in silence changes nothing).
        if (finalText && finalText !== base) void runExtraction(finalText); // errors are shown by runExtraction
      });
    } else {
      // An answer to a follow-up adds to what the worker already said.
      baseRef.current = followUpQuestion ? transcript.trim() : '';
      spokenRef.current = baseRef.current;
      stopSpeaking(); // the mic must not hear the app talking
      startListening();
    }
  }, [followUpQuestion, isListening, runExtraction, startListening, stopListening, transcript]);

  // Nothing was heard: the worker picks another language and the mic listens again in it.
  const handlePickLanguage = useCallback(
    (code: LangCode) => {
      setLang(code);
      // A retry in another language continues the same answer: keep what is in the box.
      baseRef.current = transcript.trim();
      spokenRef.current = baseRef.current;
      stopSpeaking();
      startListening(code);
    },
    [setLang, startListening, transcript],
  );

  const handleTextSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const text = transcript.trim();
      if (text) void runExtraction(text);
    },
    [transcript, runExtraction],
  );

  // A tapped area or skill chip is added to what the worker already said, then matched again.
  const handleChip = useCallback(
    (areaName: string) => {
      const text = `${transcript.trim()} ${areaName}`.trim();
      setTranscript(text + ' ');
      void runExtraction(text);
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
                      onClick={() => handleChip(chipName(chip, lang))}
                      className="touch-target px-4 rounded-full border-2 border-[#0d6e6e] text-[#0d6e6e] font-semibold text-sm bg-white
                        hover:bg-[#0d6e6e] hover:text-white disabled:opacity-50 transition-colors"
                    >
                      {chipName(chip, lang)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {profile && profile.area && profile.skills.length === 0 && (
              <div className="mt-3">
                <p id="skill-chips-label" className="text-sm font-semibold text-[#1a1a2e]">
                  {t(lang, 'skillChipsLabel')}
                </p>
                <div role="group" aria-labelledby="skill-chips-label" data-skill-chips className="mt-2 flex flex-wrap gap-2">
                  {SKILL_CHIPS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      lang={lang}
                      data-skill-chip={id}
                      disabled={isExtracting}
                      onClick={() => handleChip(skillName(id, lang))}
                      className="touch-target px-4 rounded-full border-2 border-[#0d6e6e] text-[#0d6e6e] font-semibold text-sm bg-white
                        hover:bg-[#0d6e6e] hover:text-white disabled:opacity-50 transition-colors"
                    >
                      {skillName(id, lang)}
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
        <AgentPanel
          hideReplyEqualTo={followUpQuestion}
          preferRulesMessage={Boolean(followUpQuestion && profile?.area && profile.skills.length === 0)}
        />
      </div>

      {/* Mic area */}
      <section className="flex flex-col items-center mt-6 px-4">
        {/* The language the mic will listen in; tap to choose again (typed text is kept). */}
        <button
          type="button"
          data-language-chip
          lang={lang}
          onClick={() => setScreen('welcome')}
          className="touch-target mb-4 inline-flex flex-col items-center justify-center rounded-2xl border-2 border-[#0d6e6e] bg-white px-4 py-1.5 text-[#0d6e6e] hover:bg-[#e6f4f4]"
        >
          <span className="text-sm font-bold">{t(lang, 'languageChip', { language: t(lang, 'languageName') })}</span>
          <span className="text-xs font-semibold"><span aria-hidden="true">✎ </span>{t(lang, 'changeLanguage')}</span>
        </button>
        {isSupported ? (
          <>
            <MicButton
              ref={micRef}
              isListening={isListening}
              onClick={handleMicClick}
              label={isListening ? t(lang, 'listening') : t(lang, 'tapToSpeak')}
            />
            {/* Decorative waveform while recording (fixed rhythm) */}
            {isListening && <ListeningWave />}
            <p className="mt-3 text-sm text-[#5a6475]">
              {isListening ? t(lang, 'listening') : t(lang, 'tapToSpeak')}
            </p>
            {isListening && (
              <p data-listening-in className="mt-1 text-sm font-semibold text-[#0d6e6e]">
                {t(lang, 'listeningIn', { language: t(lang, 'languageName') })}
              </p>
            )}
            {noSpeech && !isListening && (
              <NoSpeechHint onPick={handlePickLanguage} onDismiss={dismissNoSpeech} />
            )}
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
              data-live-words
              className={[
                'mt-4 max-w-sm w-full bg-white rounded-2xl shadow px-4 py-3 text-[#1a1a2e] break-words',
                isListening ? 'text-base border-2 border-[#0d6e6e]/40' : 'text-sm',
              ].join(' ')}
            >
              {/* Words appear as they are heard; the part not yet confirmed is grey and italic. */}
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
            // While listening the box shows confirmed words plus the words still being heard.
            value={isListening && interimText ? joinText(transcript, interimText) : transcript}
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
        <DemoNote className="mt-2 w-full max-w-sm" />

        {/* Suggest switching the picker when the words are clearly in another language */}
        <LanguageNudge text={`${transcript} ${interimText}`} />

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
            onClick={() => void runSavedProfile(savedProfile)}
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
