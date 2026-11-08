import { create } from 'zustand';
import type { LangCode } from '../lib/types';
import type { AgentChatResponse, WorkerProfile, JobMatch, SkillGapResponse } from '../lib/types';

export type AppScreen = 'landing' | 'jobs';

interface AppState {
  lang: LangCode;
  setLang: (lang: LangCode) => void;

  transcript: string;
  setTranscript: (t: string) => void;
  appendTranscript: (chunk: string) => void;

  profile: WorkerProfile | null;
  setProfile: (p: WorkerProfile | null) => void;

  isExtracting: boolean;
  setIsExtracting: (v: boolean) => void;

  extractError: string | null;
  setExtractError: (e: string | null) => void;

  // Phase 2
  matches: JobMatch[];
  setMatches: (m: JobMatch[]) => void;

  followUpQuestion: string | null;
  setFollowUpQuestion: (q: string | null) => void;

  isFetchingMatches: boolean;
  setIsFetchingMatches: (v: boolean) => void;

  // Phase 3
  skillGap: SkillGapResponse | null;
  setSkillGap: (g: SkillGapResponse | null) => void;

  isFetchingSkillGap: boolean;
  setIsFetchingSkillGap: (v: boolean) => void;

  skillGapFailed: boolean;
  setSkillGapFailed: (v: boolean) => void;

  // IBM watsonx Orchestrate agent (via /api/agent/chat)
  agentReply: AgentChatResponse | null;
  setAgentReply: (r: AgentChatResponse | null) => void;

  isAskingAgent: boolean;
  setIsAskingAgent: (v: boolean) => void;

  screen: AppScreen;
  setScreen: (s: AppScreen) => void;
}

export const useAppStore = create<AppState>((set) => ({
  lang: 'en',
  setLang: (lang) => set({ lang }),

  transcript: '',
  setTranscript: (transcript) => set({ transcript }),
  appendTranscript: (chunk) => set((s) => ({ transcript: s.transcript + chunk })),

  profile: null,
  setProfile: (profile) => set({ profile }),

  isExtracting: false,
  setIsExtracting: (isExtracting) => set({ isExtracting }),

  extractError: null,
  setExtractError: (extractError) => set({ extractError }),

  matches: [],
  setMatches: (matches) => set({ matches }),

  followUpQuestion: null,
  setFollowUpQuestion: (followUpQuestion) => set({ followUpQuestion }),

  isFetchingMatches: false,
  setIsFetchingMatches: (isFetchingMatches) => set({ isFetchingMatches }),

  skillGap: null,
  setSkillGap: (skillGap) => set({ skillGap }),

  isFetchingSkillGap: false,
  setIsFetchingSkillGap: (isFetchingSkillGap) => set({ isFetchingSkillGap }),

  skillGapFailed: false,
  setSkillGapFailed: (skillGapFailed) => set({ skillGapFailed }),

  agentReply: null,
  setAgentReply: (agentReply) => set({ agentReply }),

  isAskingAgent: false,
  setIsAskingAgent: (isAskingAgent) => set({ isAskingAgent }),

  screen: 'landing',
  setScreen: (screen) => set({ screen }),
}));
