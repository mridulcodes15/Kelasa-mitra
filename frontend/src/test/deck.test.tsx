import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Jobs } from '../pages/Jobs';
import { useAppStore } from '../store/appStore';
import { MAX_TINT, SWIPE_THRESHOLD, VISIBLE_CARDS, dragFeedback, peekStyle, tiltFor } from '../lib/deck';
import { jobMatch, profile } from './fixtures';

function renderDeck(n = 5) {
  const matches = Array.from({ length: n }, (_, i) => {
    const m = jobMatch(2, `job-${i}`);
    return { ...m, job: { ...m.job, title: `Job ${i}` } };
  });
  useAppStore.setState({ matches, profile });
  return render(<Jobs />);
}

function cards(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>('[data-depth]')]
    .sort((a, b) => Number(a.dataset.depth) - Number(b.dataset.depth));
}

describe('drag feedback', () => {
  it('tints green to the right and grey to the left, full at the threshold', () => {
    expect(dragFeedback(0)).toEqual({ save: 0, skip: 0, decision: null });
    expect(dragFeedback(SWIPE_THRESHOLD / 2).save).toBeCloseTo(MAX_TINT / 2);
    expect(dragFeedback(SWIPE_THRESHOLD)).toEqual({ save: MAX_TINT, skip: 0, decision: 'save' });
    expect(dragFeedback(SWIPE_THRESHOLD * 3).save).toBe(MAX_TINT);
    expect(dragFeedback(-SWIPE_THRESHOLD)).toEqual({ save: 0, skip: MAX_TINT, decision: 'skip' });
    expect(dragFeedback(SWIPE_THRESHOLD - 1).decision).toBeNull();
  });

  it('tilts with the drag, and not at all under reduced motion', () => {
    expect(tiltFor(0, false)).toBe(0);
    expect(tiltFor(200, false)).toBe(12);
    expect(tiltFor(-400, false)).toBe(-12);
    expect(tiltFor(200, true)).toBe(0);
  });

  it('peeks each card behind by a further strip', () => {
    expect(peekStyle(0)).toEqual({ scale: 1, y: 0 });
    expect(peekStyle(2).y).toBeGreaterThan(peekStyle(1).y);
    expect(peekStyle(2).scale).toBeLessThan(peekStyle(1).scale);
  });
});

describe('job card deck', () => {
  it('shows the top card and the next two peeking behind', () => {
    const { container } = renderDeck();
    const stack = cards(container);
    expect(stack).toHaveLength(VISIBLE_CARDS);
    expect(stack[0].getAttribute('aria-label')).toContain('Job 0');
    expect(stack.slice(1).every((c) => c.hasAttribute('inert') && c.getAttribute('aria-hidden') === 'true')).toBe(true);
    // Only one card is reachable, so only one set of buttons.
    expect(screen.getAllByRole('button', { name: 'Save this job' })).toHaveLength(1);
  });

  it('has drag tints only on the top card, hidden from screen readers', () => {
    const { container } = renderDeck();
    const [top, behind] = cards(container);
    for (const kind of ['save', 'skip']) {
      expect(top.querySelector(`[data-tint="${kind}"]`)?.getAttribute('aria-hidden')).toBe('true');
      expect(behind.querySelector(`[data-tint="${kind}"]`)).toBeNull();
    }
  });

  it('shows fewer cards when fewer are left', () => {
    const { container } = renderDeck(2);
    expect(cards(container)).toHaveLength(2);
  });

  it('saves with the button and skips with the button', async () => {
    const user = userEvent.setup();
    const { container } = renderDeck();
    await user.click(screen.getByRole('button', { name: 'Save this job' }));
    expect(screen.getByText('Saved: 1')).toBeTruthy();
    expect(cards(container)[0].getAttribute('aria-label')).toContain('Job 1');
    await user.click(screen.getByRole('button', { name: 'Skip this job' }));
    expect(cards(container)[0].getAttribute('aria-label')).toContain('Job 2');
    expect(screen.getByText('Saved: 1')).toBeTruthy();
  });

  it('saves with → and skips with ←', async () => {
    const user = userEvent.setup();
    const { container } = renderDeck();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('Saved: 1')).toBeTruthy();
    await user.keyboard('{ArrowLeft}');
    expect(cards(container)[0].getAttribute('aria-label')).toContain('Job 2');
  });
});
