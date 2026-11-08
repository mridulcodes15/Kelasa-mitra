import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkillGapStepper } from '../components/SkillGapStepper';
import { strings, t } from '../lib/i18n';
import { skillGapItem } from './fixtures';

function renderOpen(lang: 'en' | 'kn' | 'hi' = 'en') {
  return render(<SkillGapStepper gap={skillGapItem()} lang={lang} defaultOpen />);
}

function stepButton(name: RegExp) {
  return screen.getByRole('button', { name });
}

function progress() {
  return screen.getByRole('progressbar');
}

describe('learning path progress', () => {
  it('starts with nothing done', () => {
    renderOpen();
    expect(progress().getAttribute('aria-valuenow')).toBe('0');
    expect(progress().getAttribute('aria-valuemax')).toBe('2');
    expect(screen.getByText('Steps done: 0 of 2')).toBeTruthy();
    expect(stepButton(/First step/).getAttribute('aria-pressed')).toBe('false');
  });

  it('marks a step done when tapped, and undone when tapped again', async () => {
    const user = userEvent.setup();
    const { container } = renderOpen();
    await user.click(stepButton(/First step/));
    expect(stepButton(/First step/).getAttribute('aria-pressed')).toBe('true');
    expect(progress().getAttribute('aria-valuenow')).toBe('1');
    expect((container.querySelector('[data-progress-fill]') as HTMLElement).style.width).toBe('50%');
    await user.click(stepButton(/First step/));
    expect(progress().getAttribute('aria-valuenow')).toBe('0');
  });

  it('shows a short completion message when every step is done', async () => {
    const user = userEvent.setup();
    renderOpen();
    expect(screen.queryByText(new RegExp(strings.en.stepsComplete))).toBeNull();
    await user.click(stepButton(/First step/));
    await user.click(stepButton(/Second step/));
    expect(screen.getByRole('status').textContent).toContain(strings.en.stepsComplete);
    expect(screen.getByText('Steps done: 2 of 2')).toBeTruthy();
  });

  it('works from the keyboard with Space and Enter', async () => {
    const user = userEvent.setup();
    renderOpen();
    stepButton(/First step/).focus();
    await user.keyboard(' ');
    expect(progress().getAttribute('aria-valuenow')).toBe('1');
    await user.tab();
    expect(document.activeElement).toBe(stepButton(/Second step/));
    await user.keyboard('{Enter}');
    expect(progress().getAttribute('aria-valuenow')).toBe('2');
  });

  it('keeps 48px targets', () => {
    renderOpen();
    for (const name of [/First step/, /Second step/]) expect(stepButton(name).className).toContain('touch-target');
  });

  it('shows no progress bar when there are no steps', () => {
    render(<SkillGapStepper gap={skillGapItem({ learning_path: [] })} lang="en" defaultOpen />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('keeps each skill\'s progress separate', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SkillGapStepper gap={skillGapItem()} lang="en" defaultOpen />
        <SkillGapStepper gap={skillGapItem({ skill_id: 'plumber', learning_path: [{ step: 1, action: 'Plumb step', weeks: 1, approx_cost_inr: 0 }] })} lang="en" defaultOpen />
      </>,
    );
    await user.click(stepButton(/Plumb step/));
    const bars = screen.getAllByRole('progressbar');
    expect(bars.map((b) => b.getAttribute('aria-valuenow'))).toEqual(['0', '1']);
  });
});

describe.each(['kn', 'hi'] as const)('learning path labels in %s', (lang) => {
  it('shows progress, hint and completion text in the language', async () => {
    const user = userEvent.setup();
    renderOpen(lang);
    expect(screen.getByText(t(lang, 'stepsProgress', { done: 0, total: 2 }))).toBeTruthy();
    expect(screen.getByText(strings[lang].tapStepHint)).toBeTruthy();
    await user.click(stepButton(/First step/));
    await user.click(stepButton(/Second step/));
    expect(screen.getByRole('status').textContent).toContain(strings[lang].stepsComplete);
  });
});
