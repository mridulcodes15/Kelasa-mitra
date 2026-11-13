import { t } from './i18n';
import type { JobMatch, LangCode } from './types';

/**
 * "Saved jobs": a shortlist kept in this browser only (localStorage), never sent to a server.
 * Only fields already shown on the job card are stored, plus the picker language: no profile,
 * no worker's words, no audio. Every storage call is wrapped, because private modes and site
 * settings can block it; the list then lasts for this visit only.
 */
export const SAVED_JOBS_KEY = 'kelasa-mitra-saved-jobs';

export interface SavedJob {
  id: string;
  title: string;
  employer: string;
  area: string;
  pay_min: number;
  pay_max: number;
  /** The distance as shown on the card when it was saved, e.g. "~2.4 km" or "in your area". */
  distance_text: string;
  /** Skill ids the worker has for this job (shown in the current language). */
  matched_skills: string[];
  is_synthetic: boolean;
  /** The picker language when the job was saved. */
  lang: LangCode;
}

/** The fields stored for each job, in this order. Nothing else is ever written. */
export const SAVED_JOB_FIELDS = [
  'id', 'title', 'employer', 'area', 'pay_min', 'pay_max', 'distance_text', 'matched_skills',
  'is_synthetic', 'lang',
] as const;

/** Distances are approximate, so they are shown as estimates, never as exact figures. */
export function distanceText(lang: LangCode, km: number): string {
  return km < 1 ? t(lang, 'inYourArea') : t(lang, 'aboutKm', { km: km.toFixed(1) });
}

export function toSavedJob(match: JobMatch, lang: LangCode): SavedJob {
  const { job } = match;
  return {
    id: job.id,
    title: job.title,
    employer: job.employer,
    area: job.area,
    pay_min: job.pay_min,
    pay_max: job.pay_max,
    distance_text: distanceText(lang, match.distance_km),
    matched_skills: [...match.matched_skills],
    is_synthetic: job.is_synthetic,
    lang,
  };
}

const LANGS: readonly string[] = ['en', 'kn', 'hi'];

function isSavedJob(value: unknown): value is SavedJob {
  if (!value || typeof value !== 'object') return false;
  const j = value as Record<string, unknown>;
  return (
    typeof j.id === 'string' && typeof j.title === 'string' && typeof j.employer === 'string'
    && typeof j.area === 'string' && typeof j.pay_min === 'number' && typeof j.pay_max === 'number'
    && typeof j.distance_text === 'string'
    && Array.isArray(j.matched_skills) && j.matched_skills.every((s) => typeof s === 'string')
    && typeof j.is_synthetic === 'boolean' && typeof j.lang === 'string' && LANGS.includes(j.lang)
  );
}

/** Copy only the listed fields (drops anything extra a stored entry might carry). */
function pick(job: SavedJob): SavedJob {
  return {
    id: job.id, title: job.title, employer: job.employer, area: job.area,
    pay_min: job.pay_min, pay_max: job.pay_max, distance_text: job.distance_text,
    matched_skills: [...job.matched_skills], is_synthetic: job.is_synthetic, lang: job.lang,
  };
}

/** The saved list, or [] when there is none, it is unreadable, or storage is blocked. */
export function loadSavedJobs(): SavedJob[] {
  try {
    const raw = window.localStorage.getItem(SAVED_JOBS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.filter(isSavedJob).filter((j) => !seen.has(j.id) && seen.add(j.id)).map(pick);
  } catch {
    return [];
  }
}

/** Writes the list. Returns false when storage is blocked. */
export function storeSavedJobs(jobs: SavedJob[]): boolean {
  try {
    if (jobs.length === 0) window.localStorage.removeItem(SAVED_JOBS_KEY);
    else window.localStorage.setItem(SAVED_JOBS_KEY, JSON.stringify(jobs.map(pick)));
    return true;
  } catch {
    return false;
  }
}
