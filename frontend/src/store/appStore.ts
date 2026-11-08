import { create } from 'zustand';
import type { LangCode } from '../lib/types';
import type { AgentChatResponse, WorkerProfile, JobMatch, SkillGapResponse } from '../lib/types';
import { deleteSavedProfile, loadSavedProfile, saveProfile } from '../lib/savedProfile';

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

  // Read-aloud (browser speech synthesis); remembered on this device only.
  ttsMuted: boolean;
  setTtsMuted: (v: boolean) => void;

  screen: AppScreen;
  setScreen: (s: AppScreen) => void;

  // Optional "Save my profile on this device" (localStorage, profile JSON only).
  saveOnDevice: boolean;
  savedProfile: WorkerProfile | null;
  storageBlocked: boolean;
  dataDeleted: boolean;
  /** Turn saving on or off. Turning it off removes the saved copy. */
  setSaveOnDevice: (on: boolean) => void;
  /** Save this profile if saving is on. */
  rememberProfile: (p: WorkerProfile) => void;
  /** Remove the saved copy and forget everything about this visit. */
  deleteMyData: () => void;
}

const TTS_KEY = 'kelasa-mitra-tts-muted';

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(TTS_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(TTS_KEY, muted ? '1' : '0');
  } catch {
    // storage unavailable (private mode); the setting lasts for this visit only
  }
}

const startingSavedProfile = loadSavedProfile();

export const useAppStore = create<AppState>((set, get) => ({
  lang: 'en',
  setLang: (lang) => set({ lang }),

  transcript: '',
  setTranscript: (transcript) => set({ transcript }),
  appendTranscript: (chunk) => set((s) => ({ transcript: s.transcript + chunk })),

  profile: startingSavedProfile,
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

  ttsMuted: readMuted(),
  setTtsMuted: (ttsMuted) => {
    writeMuted(ttsMuted);
    set({ ttsMuted });
  },

  screen: 'landing',
  setScreen: (screen) => set({ screen }),

  saveOnDevice: startingSavedProfile !== null,
  savedProfile: startingSavedProfile,
  storageBlocked: false,
  dataDeleted: false,
  setSaveOnDevice: (on) => {
    if (!on) {
      const removed = deleteSavedProfile();
      set({ saveOnDevice: false, savedProfile: null, storageBlocked: !removed });
      return;
    }
    const { profile } = get();
    if (profile && !saveProfile(profile)) {
      set({ saveOnDevice: false, storageBlocked: true });
      return;
    }
    set({ saveOnDevice: true, savedProfile: profile, storageBlocked: false, dataDeleted: false });
  },
  rememberProfile: (profile) => {
    if (!get().saveOnDevice) return;
    if (saveProfile(profile)) set({ savedProfile: profile });
    else set({ saveOnDevice: false, storageBlocked: true });
  },
  deleteMyData: () => {
    const removed = deleteSavedProfile();
    set({
      saveOnDevice: false, savedProfile: null, storageBlocked: !removed, dataDeleted: removed,
      profile: null, transcript: '', matches: [], followUpQuestion: null, skillGap: null,
      skillGapFailed: false, agentReply: null, extractError: null, screen: 'landing',
    });
  },
}));
