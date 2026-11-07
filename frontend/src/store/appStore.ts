import { create } from 'zustand';
import type { LangCode } from '../lib/types';
import type { WorkerProfile, JobMatch } from '../lib/types';

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

  screen: 'landing',
  setScreen: (screen) => set({ screen }),
}));
