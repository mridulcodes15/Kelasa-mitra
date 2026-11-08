// Canonical language codes returned by langdetect / Web Speech API language tags
export type LangCode = 'en' | 'kn' | 'hi';

export interface AreaLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface WorkerProfile {
  skills: string[];
  experience_years: number | null;
  area: AreaLocation | null;
  languages: string[];
  detected_language: string;
  raw_input: string;
}

export interface Job {
  id: string;
  title: string;
  employer: string;
  area: string;
  lat: number;
  lon: number;
  pay_min: number;
  pay_max: number;
  skills_required: string[];
  languages: string[];
  type: 'job' | 'apprenticeship';
  posted_at: string;
  is_synthetic: boolean;
}

export interface JobMatch {
  job: Job;
  score: number;
  distance_km: number;
  matched_skills: string[];
  missing_skills: string[];
  reason: string;
}

export interface MatchResponse {
  matches: JobMatch[];
  follow_up_question?: string | null;
}

export interface LearningStep {
  step: number;
  action: string;
  weeks: number;
  approx_cost_inr: number;
}

export interface SkillGapItem {
  skill_id: string;
  label_en: string;
  label: string;
  jobs_unlocked: number;
  avg_pay_uplift_inr: number;
  explanation: string;
  learning_path: LearningStep[];
}

export interface SkillGapResponse {
  gaps: SkillGapItem[];
  is_synthetic: boolean;
}

export interface AgentChatResponse {
  source: 'agent' | 'rules';
  reply: string | null;
  reason: string | null;
  thread_id: string | null;
}
