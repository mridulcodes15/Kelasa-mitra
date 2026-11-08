import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatchRing } from '../components/MatchRing';
import { SkillGapStepper } from '../components/SkillGapStepper';
import { BURST_SHAPES } from '../components/SaveBurst';
import { Jobs } from '../pages/Jobs';
import { STAGGER_MAX_S, staggerDelay, useCountUp } from '../lib/motion';
import { useAppStore } from '../store/appStore';
import { jobMatch, profile, skillGapItem } from './fixtures';
import { stubMatchMedia } from './setup';

function Counter({ to }: { to: number }) {
  return <span data-testid="n">{useCountUp(to, 50)}</span>;
}

describe('count-up', () => {
  it('counts up to the target', async () => {
    render(<Counter to={42} />);
    await waitFor(() => expect(screen.getByTestId('n').textContent).toBe('42'));
  });

  it('shows the target at once under reduced motion', () => {
    stubMatchMedia(true);
    render(<Counter to={42} />);
    expect(screen.getByTestId('n').textContent).toBe('42');
  });

  it('match ring: the real score is labelled from the start, the number counts up', async () => {
    const { container } = render(<MatchRing score={75} />);
    expect(screen.getByRole('img', { name: 'Match score: 75%' })).toBeTruthy();
    await waitFor(() => expect(container.querySelector('span')?.textContent).toBe('75%'));
  });

  it('match ring shows the final score at once under reduced motion', () => {
    stubMatchMedia(true);
    const { container } = render(<MatchRing score={75} />);
    expect(container.querySelector('span')?.textContent).toBe('75%');
  });

  it('"+N more jobs": screen readers get N at once, the visible number counts up', async () => {
    const { container } = render(<SkillGapStepper gap={skillGapItem({ jobs_unlocked: 7 })} lang="en" />);
    expect(screen.getByText('+7', { selector: '.sr-only' })).toBeTruthy();
    const visible = container.querySelector('[data-countup]') as HTMLElement;
    expect(visible.getAttribute('aria-hidden')).toBe('true');
    await waitFor(() => expect(visible.textContent).toBe('+7'));
  });

  it('"+N more jobs" shows N at once under reduced motion', () => {
    stubMatchMedia(true);
    const { container } = render(<SkillGapStepper gap={skillGapItem({ jobs_unlocked: 7 })} lang="en" />);
    expect(container.querySelector('[data-countup]')?.textContent).toBe('+7');
  });
});

describe('staggered entrance', () => {
  it('delays each card a little more, capped so content never waits long', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBeGreaterThan(0);
    expect(staggerDelay(2)).toBeGreaterThan(staggerDelay(1));
    expect(staggerDelay(50)).toBe(STAGGER_MAX_S);
    expect(STAGGER_MAX_S).toBeLessThanOrEqual(0.2);
  });

  it('puts every card in the page at once (animation never hides content from the DOM)', () => {
    useAppStore.setState({
      skillGap: { is_synthetic: true, gaps: [skillGapItem(), skillGapItem({ skill_id: 'plumber', label: 'Plumber' })] },
      matches: [jobMatch(2, 'a'), jobMatch(2, 'b')],
      profile,
    });
    render(<Jobs />);
    expect(screen.getByText('Plumber')).toBeTruthy();
    expect(screen.getAllByText('Canteen Worker')).toHaveLength(2);
  });
});

describe('save burst', () => {
  function renderJobs() {
    useAppStore.setState({ matches: [jobMatch(2, 'a'), jobMatch(2, 'b')], profile });
    return render(<Jobs />);
  }

  it('plays small decorative shapes when a job is saved', async () => {
    const user = userEvent.setup();
    const { container } = renderJobs();
    expect(container.querySelector('[data-save-burst]')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save this job' }));
    const burst = container.querySelector('[data-save-burst]') as HTMLElement;
    expect(burst.getAttribute('aria-hidden')).toBe('true');
    expect(burst.className).toContain('pointer-events-none');
    expect(burst.querySelectorAll('[data-burst-shape]')).toHaveLength(BURST_SHAPES);
  });

  it('does not play under reduced motion', async () => {
    stubMatchMedia(true);
    const user = userEvent.setup();
    const { container } = renderJobs();
    await user.click(screen.getByRole('button', { name: 'Save this job' }));
    expect(container.querySelector('[data-save-burst]')).toBeNull();
    expect(screen.getByText('Saved: 1')).toBeTruthy();
  });

  it('does not play on skip', async () => {
    const user = userEvent.setup();
    const { container } = renderJobs();
    await user.click(screen.getByRole('button', { name: 'Skip this job' }));
    expect(container.querySelector('[data-save-burst]')).toBeNull();
  });
});
