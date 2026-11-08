import type { AgentChatResponse, WorkerProfile, MatchResponse, SkillGapResponse } from './types';

const BASE = '/api';

export async function extractProfile(text: string, uiLanguage?: string): Promise<WorkerProfile> {
  const res = await fetch(`${BASE}/profile/extract-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, ui_language: uiLanguage ?? null }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => 'Unknown error');
    throw new Error(`Profile extraction failed: ${res.status} — ${msg}`);
  }
  return res.json() as Promise<WorkerProfile>;
}

export async function fetchMatches(profile: WorkerProfile): Promise<MatchResponse> {
  const res = await fetch(`${BASE}/matches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => 'Unknown error');
    throw new Error(`Match fetch failed: ${res.status} — ${msg}`);
  }
  return res.json() as Promise<MatchResponse>;
}

/**
 * Ask the IBM watsonx Orchestrate agent through our backend. The Orchestrate key never
 * reaches the browser. Any failure is reported as source "rules" so the app carries on.
 */
export async function agentChat(text: string, uiLanguage: string): Promise<AgentChatResponse> {
  try {
    const res = await fetch(`${BASE}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ui_language: uiLanguage }),
    });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as AgentChatResponse;
  } catch {
    return { source: 'rules', reply: null, reason: 'backend_unreachable', thread_id: null };
  }
}

export async function fetchSkillGap(profile: WorkerProfile): Promise<SkillGapResponse> {
  const res = await fetch(`${BASE}/skill-gap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => 'Unknown error');
    throw new Error(`Skill gap fetch failed: ${res.status} — ${msg}`);
  }
  return res.json() as Promise<SkillGapResponse>;
}
