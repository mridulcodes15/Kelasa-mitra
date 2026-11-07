import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { extractProfile, fetchMatches, fetchSkillGap } from '../lib/api';

export function useProfile() {
  const {
    lang, transcript, setTranscript, appendTranscript,
    profile, setProfile, isExtracting, setIsExtracting, extractError, setExtractError,
    setMatches, setFollowUpQuestion, setIsFetchingMatches, setScreen,
    setSkillGap, setIsFetchingSkillGap, setSkillGapFailed,
  } = useAppStore();

  const runExtraction = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setIsExtracting(true);
      setExtractError(null);
      setMatches([]);
      setFollowUpQuestion(null);
      setSkillGap(null);
      setSkillGapFailed(false);
      try {
        const result = await extractProfile(text, lang);
        setProfile(result);

        // Immediately fetch matches for the new profile
        setIsFetchingMatches(true);
        let hasMatches = false;
        try {
          const matchResp = await fetchMatches(result);
          if (matchResp.follow_up_question) {
            setFollowUpQuestion(matchResp.follow_up_question);
          } else {
            setMatches(matchResp.matches);
            if (matchResp.matches.length > 0) {
              hasMatches = true;
              setScreen('jobs');
            }
          }
        } catch {
          // match failure is non-fatal; profile is still shown
        } finally {
          setIsFetchingMatches(false);
        }

        if (hasMatches) {
          setIsFetchingSkillGap(true);
          try {
            setSkillGap(await fetchSkillGap(result));
          } catch {
            setSkillGapFailed(true); // job matches stay on screen
          } finally {
            setIsFetchingSkillGap(false);
          }
        }
      } catch (err) {
        setExtractError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsExtracting(false);
      }
    },
    [lang, setExtractError, setIsExtracting, setIsFetchingMatches, setMatches,
     setFollowUpQuestion, setProfile, setScreen, setSkillGap, setIsFetchingSkillGap,
     setSkillGapFailed],
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
