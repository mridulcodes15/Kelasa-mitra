import type { WorkerProfile, MatchResponse } from './types';

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
