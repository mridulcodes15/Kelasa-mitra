import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, within } from '@testing-library/react';
import { JobCard } from '../components/JobCard';
import { DEFAULT_JOB_ICON, SKILLS, categoryIcons, jobIcon, skillName } from '../lib/skills';
import { strings } from '../lib/i18n';
import { useAppStore } from '../store/appStore';
import { jobMatch } from './fixtures';

const noop = () => {};

interface BackendSkill {
  id: string;
  label_en: string;
  label_kn: string;
  label_hi: string;
  category: string;
}
// vitest runs from frontend/
const BACKEND_SKILLS = JSON.parse(readFileSync('../backend/data/skills.json', 'utf-8')) as BackendSkill[];

function card(overrides: Partial<ReturnType<typeof jobMatch>> = {}) {
  const match = { ...jobMatch(2.37), matched_skills: ['cook'], missing_skills: ['food_handler'], ...overrides };
  return render(<JobCard match={match} isTop onSave={noop} onSkip={noop} />);
}

describe('skill names', () => {
  it('match backend/data/skills.json exactly', () => {
    expect(Object.keys(SKILLS).sort()).toEqual(BACKEND_SKILLS.map((s) => s.id).sort());
    for (const s of BACKEND_SKILLS) {
      expect(SKILLS[s.id]).toEqual({ en: s.label_en, kn: s.label_kn, hi: s.label_hi, category: s.category });
    }
  });

  it('have an icon for every category', () => {
    const icons = categoryIcons();
    for (const s of BACKEND_SKILLS) expect(icons[s.category], s.category).toBeTruthy();
    expect(jobIcon(['cook'])).toBe('🍳');
    expect(jobIcon(['driver_car', 'driving_licence'])).toBe('🚗');
    expect(jobIcon(['unknown_skill'])).toBe(DEFAULT_JOB_ICON);
    expect(jobIcon([])).toBe(DEFAULT_JOB_ICON);
  });

  it('fall back to a readable ID', () => {
    expect(skillName('new_skill', 'kn')).toBe('new skill');
  });
});

describe.each(['en', 'kn', 'hi'] as const)('job card content in %s', (lang) => {
  it('shows a large decorative icon, distance and pay chips', () => {
    useAppStore.setState({ lang });
    const { container } = card();
    const icon = container.querySelector('[data-job-icon]') as HTMLElement;
    expect(icon.textContent).toBe('🍳');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.className).toContain('text-4xl');
    expect(container.querySelector('[data-chip="distance"]')?.textContent)
      .toContain(strings[lang].aboutKm.replace('{km}', '2.4'));
    expect(container.querySelector('[data-chip="pay"]')?.textContent)
      .toBe(`💰 ₹11k–14k${strings[lang].perMonth}`);
  });

  it('shows matched skills in green and missing skills in grey, with labels', () => {
    useAppStore.setState({ lang });
    const { container } = card();
    const matched = container.querySelector('[data-skills="matched"]') as HTMLElement;
    const missing = container.querySelector('[data-skills="missing"]') as HTMLElement;
    expect(matched.textContent).toContain(strings[lang].skillsYouHave);
    expect(matched.textContent).toContain(SKILLS.cook[lang]);
    expect(within(matched).getByText(SKILLS.cook[lang]).className).toContain('green');
    expect(missing.textContent).toContain(strings[lang].skillsToLearn);
    expect(missing.textContent).toContain(SKILLS.food_handler[lang]);
    expect(within(missing).getByText(SKILLS.food_handler[lang]).className).toContain('stone');
  });
});

describe('job card skill rows', () => {
  it('leaves out the "to learn" row when nothing is missing', () => {
    const { container } = card({ missing_skills: [] });
    expect(container.querySelector('[data-skills="missing"]')).toBeNull();
    expect(container.querySelector('[data-skills="matched"]')).not.toBeNull();
  });

  it('marks skills with ✓ and + as well as colour', () => {
    const { container } = card();
    expect(container.querySelector('[data-skills="matched"]')?.textContent).toContain('✓');
    expect(container.querySelector('[data-skills="missing"]')?.textContent).toContain('+');
  });
});
