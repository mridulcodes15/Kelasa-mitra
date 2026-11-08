import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { agentChat, extractProfile, fetchMatches, fetchSkillGap } from '../lib/api';
import type { WorkerProfile } from '../lib/types';

// Only the latest request may update the agent panel.
let agentRequestId = 0;

export function useProfile() {
  const {
    lang, transcript, setTranscript, appendTranscript,
    profile, setProfile, isExtracting, setIsExtracting, extractError, setExtractError,
    setMatches, setFollowUpQuestion, setIsFetchingMatches, setScreen,
    setSkillGap, setIsFetchingSkillGap, setSkillGapFailed,
    setAgentReply, setIsAskingAgent, rememberProfile,
  } = useAppStore();

  const askAgent = useCallback(
    async (text: string) => {
      const requestId = ++agentRequestId;
      setAgentReply(null);
      setIsAskingAgent(true);
      const reply = await agentChat(text, lang);
      if (requestId !== agentRequestId) return;
      setAgentReply(reply);
      setIsAskingAgent(false);
    },
    [lang, setAgentReply, setIsAskingAgent],
  );

  /** Matches, then skill gap, for a profile; asks the follow-up question when one is due. */
  const findJobsFor = useCallback(
    async (result: WorkerProfile) => {
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
    },
    [setFollowUpQuestion, setIsFetchingMatches, setIsFetchingSkillGap, setMatches, setScreen,
     setSkillGap, setSkillGapFailed],
  );

  const resetResults = useCallback(() => {
    setExtractError(null);
    setMatches([]);
    setFollowUpQuestion(null);
    setSkillGap(null);
    setSkillGapFailed(false);
  }, [setExtractError, setFollowUpQuestion, setMatches, setSkillGap, setSkillGapFailed]);

  const runExtraction = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      // The agent runs alongside the deterministic pipeline; cards never wait for it.
      void askAgent(text);
      setIsExtracting(true);
      resetResults();
      try {
        const result = await extractProfile(text, lang);
        setProfile(result);
        rememberProfile(result); // only if the worker chose to save on this device
        await findJobsFor(result);
      } catch (err) {
        setExtractError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsExtracting(false);
      }
    },
    [askAgent, findJobsFor, lang, rememberProfile, resetResults, setExtractError, setIsExtracting,
     setProfile],
  );

  /** Find jobs for a profile saved on this device. There is no text, so the agent is not asked. */
  const runSavedProfile = useCallback(
    async (saved: WorkerProfile) => {
      resetResults();
      setAgentReply(null);
      setProfile(saved);
      await findJobsFor(saved);
    },
    [findJobsFor, resetResults, setAgentReply, setProfile],
  );

  return {
    transcript,
    setTranscript,
    appendTranscript,
    profile,
    isExtracting,
    extractError,
    runExtraction,
    runSavedProfile,
  };
}
