import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import App from '../App';
import { JobCard } from '../components/JobCard';
import { MatchRing } from '../components/MatchRing';
import { useAppStore } from '../store/appStore';
import { jobMatch } from './fixtures';

const noop = () => {};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgbToHex(rgb: string): string {
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

describe('accessibility fixes', () => {
  it('keeps <html lang> in step with the language picker', () => {
    render(<App />);
    expect(document.documentElement.lang).toBe('en');
    act(() => useAppStore.getState().setLang('kn'));
    expect(document.documentElement.lang).toBe('kn');
    act(() => useAppStore.getState().setLang('hi'));
    expect(document.documentElement.lang).toBe('hi');
  });

  it.each([95, 70, 30])('score text %i%% has at least 4.5:1 contrast on white', (score) => {
    const { container } = render(<MatchRing score={score} />);
    const text = container.querySelector('span') as HTMLElement;
    const ratio = (1 + 0.05) / (luminance(rgbToHex(text.style.color)) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('takes the card behind the top one out of the tab order and the accessibility tree', () => {
    const { container } = render(
      <>
        <JobCard match={jobMatch(2, 'behind')} isTop={false} onSave={noop} onSkip={noop} />
        <JobCard match={jobMatch(2, 'top')} isTop onSave={noop} onSkip={noop} />
      </>,
    );
    const [behind, top] = container.querySelectorAll<HTMLElement>('[aria-label^="Job card"]');
    // jsdom has no `inert` property, so check the attribute React writes.
    expect(behind.hasAttribute('inert')).toBe(true);
    expect(behind.getAttribute('aria-hidden')).toBe('true');
    expect(top.hasAttribute('inert')).toBe(false);
    expect(top.hasAttribute('aria-hidden')).toBe(false);
    expect(screen.getAllByRole('button', { name: 'Save this job' })).toHaveLength(1);
  });
});
