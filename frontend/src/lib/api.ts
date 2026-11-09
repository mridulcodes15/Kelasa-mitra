import type { AgentChatResponse, WorkerProfile, MatchResponse, SkillGapResponse } from './types';

const BASE = '/api';

/** POST JSON to our backend and return the JSON reply; a non-2xx reply throws `${failure}: status — body`. */
async function postJson<T>(path: string, body: unknown, failure: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => 'Unknown error');
    throw new Error(`${failure}: ${res.status} — ${msg}`);
  }
  return (await res.json()) as T;
}

export function extractProfile(text: string, uiLanguage?: string): Promise<WorkerProfile> {
  return postJson('/profile/extract-profile', { text, ui_language: uiLanguage ?? null }, 'Profile extraction failed');
}

export function fetchMatches(profile: WorkerProfile): Promise<MatchResponse> {
  return postJson('/matches', { profile }, 'Match fetch failed');
}

export function fetchSkillGap(profile: WorkerProfile): Promise<SkillGapResponse> {
  return postJson('/skill-gap', { profile }, 'Skill gap fetch failed');
}

/**
 * Ask the IBM watsonx Orchestrate agent through our backend. The Orchestrate key never
 * reaches the browser. Any failure is reported as source "rules" so the app carries on.
 */
export async function agentChat(text: string, uiLanguage: string): Promise<AgentChatResponse> {
  try {
    return await postJson<AgentChatResponse>('/agent/chat', { text, ui_language: uiLanguage }, 'Agent chat failed');
  } catch {
    return { source: 'rules', reply: null, reason: 'backend_unreachable', thread_id: null };
  }
}
