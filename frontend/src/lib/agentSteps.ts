import type { StringKey } from './i18n';

/** The agent's three tool calls, in order. Labels only: the app gets no live progress. */
export const AGENT_STEPS: { tool: string; label: StringKey }[] = [
  { tool: 'extract_profile', label: 'agentStepProfile' },
  { tool: 'find_matches', label: 'agentStepJobs' },
  { tool: 'skill_gap', label: 'agentStepSkills' },
];
