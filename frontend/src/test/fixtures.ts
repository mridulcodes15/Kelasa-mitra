import type { JobMatch, SkillGapItem, WorkerProfile } from '../lib/types';

export const profile: WorkerProfile = {
  skills: ['cook'],
  experience_years: 3,
  area: { id: 'whitefield', name: 'Whitefield', lat: 12.9698, lon: 77.7499 },
  languages: ['kannada'],
  detected_language: 'en',
  raw_input: 'I am a cook in Whitefield',
};

export function jobMatch(distance_km = 2.37, id = 'job-1'): JobMatch {
  return {
    job: {
      id,
      title: 'Canteen Worker',
      employer: 'Fixture Canteen',
      area: 'Whitefield',
      lat: 12.97,
      lon: 77.75,
      pay_min: 11000,
      pay_max: 14000,
      skills_required: ['cook'],
      languages: ['kannada'],
      type: 'job',
      posted_at: '2026-01-01T00:00:00+00:00',
      is_synthetic: true,
    },
    score: 87,
    distance_km,
    matched_skills: ['cook'],
    missing_skills: [],
    reason: 'fixture reason',
  };
}

export function skillGapItem(overrides: Partial<SkillGapItem> = {}): SkillGapItem {
  return {
    skill_id: 'electrician',
    label_en: 'Electrician',
    label: 'Electrician',
    jobs_unlocked: 2,
    avg_pay_uplift_inr: 6000,
    explanation: 'fixture explanation',
    learning_path: [
      { step: 1, action: 'First step', weeks: 8, approx_cost_inr: 3000 },
      { step: 2, action: 'Second step', weeks: 24, approx_cost_inr: 0 },
    ],
    ...overrides,
  };
}
