import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JobCard } from '../components/JobCard';
import { Jobs } from '../pages/Jobs';
import { strings, t, type StringKey } from '../lib/i18n';
import type { LangCode } from '../lib/types';
import { useAppStore } from '../store/appStore';
import { jobMatch, profile } from './fixtures';

const noop = () => {};
const ENGLISH_UI = /\b(Skip|Save|Sample data|in your area|Jobs found|near|Job\b|\/mo|Profile)\b/;

function setLang(lang: LangCode) {
  useAppStore.setState({ lang });
}

describe('i18n strings', () => {
  it('has every key in every language, with the same placeholders', () => {
    const keys = Object.keys(strings.en) as StringKey[];
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const lang of ['kn', 'hi'] as const) {
      expect(Object.keys(strings[lang]).sort()).toEqual([...keys].sort());
      for (const key of keys) {
        expect(placeholders(strings[lang][key]), `${lang}.${key}`).toEqual(placeholders(strings.en[key]));
      }
    }
  });

  it('fills placeholders', () => {
    expect(t('en', 'aboutKm', { km: '2.4' })).toBe('~2.4 km');
    expect(t('hi', 'aboutKm', { km: '2.4' })).toBe('लगभग 2.4 किमी');
    expect(t('kn', 'aboutKm', { km: '2.4' })).toBe('ಸುಮಾರು 2.4 ಕಿಮೀ');
  });
});

describe.each(['kn', 'hi'] as const)('job screens in %s', (lang) => {
  it('JobCard has no hard-coded English', () => {
    setLang(lang);
    const { container } = render(<JobCard match={jobMatch()} isTop onSave={noop} onSkip={noop} />);
    const visible = (container.textContent ?? '').replace('Canteen Worker', '').replace('Fixture Canteen', '').replace('Whitefield', '');
    expect(visible).not.toMatch(ENGLISH_UI);
    expect(screen.getByRole('button', { name: strings[lang].saveAria })).toBeTruthy();
    expect(container.textContent).toContain(strings[lang].sampleData);
  });

  it('Jobs header has no hard-coded English', () => {
    setLang(lang);
    useAppStore.setState({ matches: [jobMatch()], profile });
    const { container } = render(<Jobs />);
    const header = container.querySelector('header')?.textContent ?? '';
    expect(header.replace('Whitefield', '')).not.toMatch(ENGLISH_UI);
    expect(header).toContain(t(lang, 'jobsFound', { n: 1 }));
  });
});

describe.each(['en', 'kn', 'hi'] as const)('distance display in %s', (lang) => {
  it('shows "in your area" under 1 km', () => {
    setLang(lang);
    const { container } = render(<JobCard match={jobMatch(0.4)} isTop onSave={noop} onSkip={noop} />);
    expect(container.textContent).toContain(strings[lang].inYourArea);
  });

  it('shows an approximate distance to one decimal from 1 km', () => {
    setLang(lang);
    const { container } = render(<JobCard match={jobMatch(2.37)} isTop onSave={noop} onSkip={noop} />);
    expect(container.textContent).toContain(t(lang, 'aboutKm', { km: '2.4' }));
    expect(container.textContent).not.toContain('2.37');
  });
});
