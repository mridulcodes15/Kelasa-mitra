import type { WorkerProfile } from './types';

/**
 * Optional "Save my profile on this device". Only the structured profile is stored, in
 * this browser's localStorage: skills, experience, area and languages. The worker's own
 * words (raw_input) are blanked before saving, and no history or audio is ever kept.
 * Every storage call is wrapped, because private modes and site settings can block it.
 */
export const PROFILE_KEY = 'kelasa-mitra-profile';

export function toStoredProfile(profile: WorkerProfile): WorkerProfile {
  return {
    skills: [...profile.skills],
    experience_years: profile.experience_years,
    area: profile.area ? { ...profile.area } : null,
    languages: [...profile.languages],
    detected_language: profile.detected_language,
    raw_input: '',
  };
}

function isProfile(value: unknown): value is WorkerProfile {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  const area = p.area as Record<string, unknown> | null;
  return (
    Array.isArray(p.skills) && p.skills.every((s) => typeof s === 'string')
    && (p.experience_years === null || typeof p.experience_years === 'number')
    && (area === null || (typeof area === 'object' && typeof area.id === 'string'
      && typeof area.name === 'string' && typeof area.lat === 'number' && typeof area.lon === 'number'))
    && Array.isArray(p.languages) && p.languages.every((l) => typeof l === 'string')
    && typeof p.detected_language === 'string'
  );
}

/** The saved profile, or null when there is none, it is unreadable, or storage is blocked. */
export function loadSavedProfile(): WorkerProfile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isProfile(parsed) ? toStoredProfile(parsed) : null;
  } catch {
    return null;
  }
}

/** Saves the profile without the worker's words. Returns false when storage is blocked. */
export function saveProfile(profile: WorkerProfile): boolean {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(toStoredProfile(profile)));
    return true;
  } catch {
    return false;
  }
}

/** Removes the saved profile. Returns false when storage is blocked. */
export function deleteSavedProfile(): boolean {
  try {
    window.localStorage.removeItem(PROFILE_KEY);
    return true;
  } catch {
    return false;
  }
}
