import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { extractProfile, fetchMatches } from '../lib/api';

export function useProfile() {
  const {
    lang, transcript, setTranscript, appendTranscript,
    profile, setProfile, isExtracting, setIsExtracting, extractError, setExtractError,
    setMatches, setFollowUpQuestion, setIsFetchingMatches, setScreen,
  } = useAppStore();

  const runExtraction = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setIsExtracting(true);
      setExtractError(null);
      setMatches([]);
      setFollowUpQuestion(null);
      try {
        const result = await extractProfile(text, lang);
        setProfile(result);

        // Immediately fetch matches for the new profile
        setIsFetchingMatches(true);
        try {
          const matchResp = await fetchMatches(result);
          if (matchResp.follow_up_question) {
            setFollowUpQuestion(matchResp.follow_up_question);
          } else {
            setMatches(matchResp.matches);
            if (matchResp.matches.length > 0) {
              setScreen('jobs');
            }
          }
        } catch {
          // match failure is non-fatal; profile is still shown
        } finally {
          setIsFetchingMatches(false);
        }
      } catch (err) {
        setExtractError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsExtracting(false);
      }
    },
    [lang, setExtractError, setIsExtracting, setIsFetchingMatches, setMatches,
     setFollowUpQuestion, setProfile, setScreen],
  );

  return {
    transcript,
    setTranscript,
    appendTranscript,
    profile,
    isExtracting,
    extractError,
    runExtraction,
  };
}
