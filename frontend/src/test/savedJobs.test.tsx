import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Jobs } from '../pages/Jobs';
import { Landing } from '../pages/Landing';
import { useAppStore } from '../store/appStore';
import { strings, t } from '../lib/i18n';
import { SAVED_JOBS_KEY, SAVED_JOB_FIELDS, loadSavedJobs, type SavedJob } from '../lib/savedJobs';
import { SWIPE_THRESHOLD, endSwipe } from '../lib/deck';
import type { JobMatch, LangCode } from '../lib/types';
import { jobMatch, profile } from './fixtures';
import { stubMatchMedia } from './setup';

/**
 * Saved jobs: a shortlist kept in this browser only. Swipe right, Save and → add the top job;
 * swipe left, Skip and ← never do. The list view has trace-green cards, Remove, and Back to
 * Search, which returns to the deck exactly as it was.
 */

const GREEN = 'bg-[#0d6e6e]';

function matchFor(i: number, distance = 2.37): JobMatch {
  const m = jobMatch(distance, `job-${i}`);
  return { ...m, job: { ...m.job, title: `Job ${i}`, employer: `Employer ${i}` }, reason: `Reason with worker words ${i}` };
}

function renderJobs(n = 4, lang: LangCode = 'en') {
  const matches = Array.from({ length: n }, (_, i) => matchFor(i + 1, i === 0 ? 0.5 : 2.37));
  useAppStore.setState({ screen: 'jobs', lang, matches, profile: { ...profile, raw_input: 'I am a cook in Whitefield' } });
  return render(<Jobs />);
}

const topTitle = (container: HTMLElement) =>
  container.querySelector('[data-depth="0"]')?.getAttribute('aria-label') ?? '';
const savedIds = () => useAppStore.getState().savedJobs.map((j) => j.id);
const savedButton = () => document.querySelector('[data-trace-button="saved-jobs"]') as HTMLButtonElement;
const backButton = () => document.querySelector('[data-trace-button="back-to-search"]') as HTMLButtonElement;
const listCard = (id: string) => document.querySelector(`[data-saved-job="${id}"]`) as HTMLElement;

describe('saving', () => {
  it('saves the top job with the Save button and with →', async () => {
    const user = userEvent.setup();
    const { container } = renderJobs();
    await user.click(screen.getByRole('button', { name: 'Save this job' }));
    expect(savedIds()).toEqual(['job-1']);
    expect(topTitle(container)).toContain('Job 2');
    await user.keyboard('{ArrowRight}');
    expect(savedIds()).toEqual(['job-1', 'job-2']);
  });

  it('a swipe right past the threshold saves the top job; a swipe left never does', async () => {
    // jsdom cannot run Framer Motion's drag gesture, so the drag end is driven directly through
    // the same function JobCard calls with the drag offset.
    const { container } = renderJobs();
    // The deck's own save and skip handlers (the same ones JobCard's onSave/onSkip receive).
    const save = () => fireEvent.keyDown(window, { key: 'ArrowRight' });
    const skip = () => fireEvent.keyDown(window, { key: 'ArrowLeft' });
    act(() => { expect(endSwipe(-(SWIPE_THRESHOLD + 10), save, skip)).toBe('skip'); });
    expect(savedIds()).toEqual([]);
    act(() => { expect(endSwipe(SWIPE_THRESHOLD - 1, save, skip)).toBeNull(); });
    expect(savedIds()).toEqual([]);
    act(() => { expect(endSwipe(SWIPE_THRESHOLD, save, skip)).toBe('save'); });
    expect(savedIds()).toEqual(['job-2']);
    expect(topTitle(container)).toContain('Job 3');
  });

  it('Skip and ← never save', async () => {
    const user = userEvent.setup();
    const { container } = renderJobs();
    await user.click(screen.getByRole('button', { name: 'Skip this job' }));
    await user.keyboard('{ArrowLeft}');
    expect(topTitle(container)).toContain('Job 3');
    expect(savedIds()).toEqual([]);
    expect(window.localStorage.getItem(SAVED_JOBS_KEY)).toBeNull();
  });

  it('does not duplicate a job saved twice, and → after the last card saves nothing', async () => {
    const user = userEvent.setup();
    renderJobs(1);
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowRight}');
    act(() => useAppStore.getState().addSavedJob(useAppStore.getState().savedJobs[0]));
    expect(savedIds()).toEqual(['job-1']);
    expect(savedButton().textContent).toBe('Saved jobs (1)');
  });

  it('stores only the listed card fields and the language: no free text', async () => {
    const user = userEvent.setup();
    renderJobs();
    await user.click(screen.getByRole('button', { name: 'Save this job' }));
    const stored = JSON.parse(window.localStorage.getItem(SAVED_JOBS_KEY) as string) as SavedJob[];
    expect(stored).toHaveLength(1);
    expect(Object.keys(stored[0])).toEqual([...SAVED_JOB_FIELDS]);
    expect(stored[0]).toEqual({
      id: 'job-1', title: 'Job 1', employer: 'Employer 1', area: 'Whitefield', pay_min: 11000, pay_max: 14000,
      distance_text: 'in your area', matched_skills: ['cook'], is_synthetic: true, lang: 'en',
    });
    const raw = window.localStorage.getItem(SAVED_JOBS_KEY) as string;
    expect(raw).not.toContain('I am a cook');
    expect(raw).not.toContain('Reason with worker words');
    expect(raw).not.toContain('raw_input');
    // Only this key and nothing else was written.
    expect(Object.keys(window.localStorage)).toEqual([SAVED_JOBS_KEY]);
  });

  it('is never sent to a server', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderJobs();
    await user.click(screen.getByRole('button', { name: 'Save this job' }));
    await user.click(savedButton());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the list after a reload (same browser), dropping malformed entries and extra fields', () => {
    window.localStorage.setItem(SAVED_JOBS_KEY, JSON.stringify([
      { id: 'job-9', title: 'T', employer: 'E', area: 'A', pay_min: 1, pay_max: 2, distance_text: '~1.0 km',
        matched_skills: [], is_synthetic: true, lang: 'kn', raw_input: 'secret words' },
      { id: 'bad' },
    ]));
    const loaded = loadSavedJobs();
    expect(loaded.map((j) => j.id)).toEqual(['job-9']);
    expect(Object.keys(loaded[0])).toEqual([...SAVED_JOB_FIELDS]);
  });
});

describe('Saved jobs button', () => {
  it('sits below the deck and its Skip/Save buttons and shows the live count', async () => {
    const user = userEvent.setup();
    renderJobs();
    const deck = screen.getByRole('region', { name: strings.en.jobCardsLabel });
    expect(deck.compareDocumentPosition(savedButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(savedButton().textContent).toBe('Saved jobs (0)');
    expect(savedButton().className).toContain('touch-target');
    await user.click(screen.getByRole('button', { name: 'Save this job' }));
    expect(savedButton().textContent).toBe('Saved jobs (1)');
    expect(screen.getByText('Saved: 1')).toBeTruthy(); // the header counter matches the list
  });

  it('is still there after the last card', async () => {
    const user = userEvent.setup();
    renderJobs(1);
    await user.click(screen.getByRole('button', { name: 'Save this job' }));
    expect(savedButton().textContent).toBe('Saved jobs (1)');
    expect(screen.getByText('Jobs saved: 1')).toBeTruthy();
  });

  it('turns green on hover, a finger pressing or moving over it, and keyboard focus', async () => {
    renderJobs();
    const button = savedButton();
    expect(button.className).not.toContain(GREEN);
    fireEvent.pointerMove(button, { pointerType: 'mouse' });
    expect(button.className).toContain(GREEN);
    expect(button.className).toContain('text-white');
    fireEvent.pointerMove(document.body, { pointerType: 'mouse' });
    expect(button.className).not.toContain(GREEN);
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    expect(button.dataset.lit).toBe('true');
    fireEvent.pointerUp(button, { pointerType: 'touch' });
    expect(button.dataset.lit).toBe('false');
    fireEvent.pointerMove(button, { pointerType: 'touch', buttons: 1 }); // a finger dragged onto it
    expect(button.dataset.lit).toBe('true');
    fireEvent.pointerCancel(button, { pointerType: 'touch' }); // the browser takes over to scroll
    expect(button.dataset.lit).toBe('false');
    act(() => button.focus());
    expect(button.className).toContain(GREEN);
  });

  it('green with white text has at least 4.5:1 contrast', () => {
    const lum = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    expect((1 + 0.05) / (lum('#0d6e6e') + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it('opens the saved list', async () => {
    const user = userEvent.setup();
    renderJobs();
    await user.click(savedButton());
    expect(screen.getByRole('heading', { name: 'Saved jobs (0)' })).toBeTruthy();
    expect(document.activeElement?.id).toBe('saved-jobs-heading');
  });
});

describe('saved list', () => {
  async function openWithTwo() {
    const user = userEvent.setup();
    const utils = renderJobs();
    await user.click(screen.getByRole('button', { name: 'Save this job' }));
    await user.click(screen.getByRole('button', { name: 'Save this job' }));
    await user.click(savedButton());
    return { user, ...utils };
  }

  it('shows each saved job as a card with the right fields, labelled by its title', async () => {
    await openWithTwo();
    const list = screen.getByRole('list', { name: 'Saved jobs (2)' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].getAttribute('aria-labelledby')).toBe('saved-title-job-1');
    expect(screen.getByRole('listitem', { name: 'Job 1' })).toBe(items[0]);
    const first = items[0];
    expect(first.textContent).toContain('Employer 1');
    expect(first.querySelector('[data-saved-field="place"]')?.textContent).toContain('Whitefield · in your area');
    expect(items[1].querySelector('[data-saved-field="place"]')?.textContent).toContain('~2.4 km');
    expect(first.querySelector('[data-saved-field="pay"]')?.textContent).toContain('₹11k–14k');
    expect(first.querySelector('[data-saved-field="skills"]')?.textContent).toContain('Cook');
    expect(first.textContent).toContain(strings.en.sampleData);
    expect(first.querySelector('[data-demo-note]')).toBeTruthy();
    expect(screen.getByText(`🔒 ${strings.en.savedJobsPrivacy}`)).toBeTruthy();
    const remove = within(first).getByRole('button', { name: 'Remove Job 1 from saved jobs' });
    expect(remove.className).toContain('touch-target');
  });

  it('the card under the pointer turns green, and the green moves with the trace', async () => {
    await openWithTwo();
    fireEvent.pointerMove(listCard('job-1'), { pointerType: 'mouse' });
    expect(listCard('job-1').dataset.lit).toBe('true');
    expect(listCard('job-1').querySelector('[data-saved-highlight]')).toBeTruthy();
    expect(listCard('job-1').querySelector('h3')?.className).toContain('text-white');
    fireEvent.pointerMove(listCard('job-2').querySelector('h3') as HTMLElement, { pointerType: 'touch', buttons: 1 });
    expect(listCard('job-2').dataset.lit).toBe('true');
    expect(listCard('job-1').dataset.lit).toBe('false');
    expect(document.querySelectorAll('[data-saved-highlight]')).toHaveLength(1);
    // In the green state every text is white and Remove keeps teal on white (both 6:1).
    const lit = listCard('job-2');
    expect(lit.querySelector('[data-demo-note]')?.className).toContain('text-white');
    expect(lit.querySelector('[data-remove]')?.className).toContain('bg-white');
    expect(lit.querySelector('[data-remove]')?.className).toContain('text-[#0d6e6e]');
    fireEvent.pointerMove(document.body, { pointerType: 'mouse' });
    expect(listCard('job-2').dataset.lit).toBe('false');
  });

  it('does not block vertical scrolling of the list', async () => {
    await openWithTwo();
    const list = screen.getByRole('list');
    expect(list.className).toContain('touch-pan-y');
    expect(list.className).not.toContain('touch-none');
  });

  it('keyboard: Tab reaches each card and its Remove button with the same green', async () => {
    const { user } = await openWithTwo();
    await user.tab();
    expect(document.activeElement).toBe(listCard('job-1'));
    expect(listCard('job-1').dataset.lit).toBe('true');
    await user.tab();
    expect(document.activeElement?.getAttribute('data-remove')).toBe('job-1');
    expect(listCard('job-1').dataset.lit).toBe('true');
    await user.tab();
    expect(document.activeElement).toBe(listCard('job-2'));
    expect(listCard('job-1').dataset.lit).toBe('false');
  });

  it('Remove updates the list and the count at once, and the stored list', async () => {
    const { user } = await openWithTwo();
    await user.click(screen.getByRole('button', { name: 'Remove Job 1 from saved jobs' }));
    expect(screen.getByRole('heading', { name: 'Saved jobs (1)' })).toBeTruthy();
    expect(listCard('job-1')).toBeNull();
    expect(document.activeElement?.id).toBe('saved-jobs-heading');
    expect(loadSavedJobs().map((j) => j.id)).toEqual(['job-2']);
    await user.click(screen.getByRole('button', { name: 'Remove Job 2 from saved jobs' }));
    expect(window.localStorage.getItem(SAVED_JOBS_KEY)).toBeNull();
  });

  it.each(['en', 'kn', 'hi'] as const)('shows the empty state, privacy line and back button in %s', async (lang) => {
    const user = userEvent.setup();
    renderJobs(2, lang);
    await user.click(savedButton());
    expect(screen.getByRole('heading', { name: t(lang, 'savedJobsHeading', { n: 0 }) })).toBeTruthy();
    expect(screen.getByText(strings[lang].savedJobsEmpty)).toBeTruthy();
    expect(screen.getByText(`🔒 ${strings[lang].savedJobsPrivacy}`)).toBeTruthy();
    expect(backButton().textContent).toBe(strings[lang].backToSearch);
  });

  it.each(['en', 'kn', 'hi'] as const)('labels the Saved jobs button and Remove in %s', async (lang) => {
    const user = userEvent.setup();
    renderJobs(2, lang);
    await user.click(screen.getByRole('button', { name: strings[lang].saveAria }));
    expect(savedButton().textContent).toBe(t(lang, 'savedJobsButton', { n: 1 }));
    await user.click(savedButton());
    expect(screen.getByRole('button', { name: t(lang, 'removeSavedAria', { title: 'Job 1' }) }).textContent)
      .toBe(strings[lang].removeSaved);
  });
});

describe('Back to Search', () => {
  it('turns green on hover, touch and focus, and returns to the deck with nothing lost', async () => {
    const user = userEvent.setup();
    const { container } = renderJobs(4);
    await user.click(screen.getByRole('button', { name: 'Skip this job' }));
    await user.click(screen.getByRole('button', { name: 'Save this job' }));
    const before = useAppStore.getState();
    await user.click(savedButton());

    const back = backButton();
    expect(back.className).toContain('touch-target');
    fireEvent.pointerMove(back, { pointerType: 'mouse' });
    expect(back.className).toContain(GREEN);
    fireEvent.pointerMove(document.body, { pointerType: 'mouse' });
    fireEvent.pointerDown(back, { pointerType: 'touch' });
    expect(back.dataset.lit).toBe('true');
    fireEvent.pointerUp(back, { pointerType: 'touch' });
    act(() => back.focus());
    expect(back.className).toContain(GREEN);

    await user.click(back);
    // The deck is where the worker left it: job 3 on top (1 skipped, 2 saved).
    expect(topTitle(container)).toContain('Job 3');
    const after = useAppStore.getState();
    expect(after.matches).toBe(before.matches);
    expect(after.profile).toBe(before.profile);
    expect(after.savedJobs.map((j) => j.id)).toEqual(['job-2']);
    expect(document.activeElement).toBe(savedButton());
  });

  it('← and → do nothing while the list is open', async () => {
    const user = userEvent.setup();
    const { container } = renderJobs(3);
    await user.click(savedButton());
    await user.keyboard('{ArrowRight}{ArrowLeft}');
    expect(savedIds()).toEqual([]);
    await user.click(backButton());
    expect(topTitle(container)).toContain('Job 1');
  });
});

describe('privacy', () => {
  it('Delete my data clears saved jobs as well as the profile and the visit', async () => {
    const user = userEvent.setup();
    renderJobs();
    await user.click(screen.getByRole('button', { name: 'Save this job' }));
    expect(window.localStorage.getItem(SAVED_JOBS_KEY)).not.toBeNull();
    act(() => useAppStore.setState({ screen: 'landing', profile: null, matches: [] }));
    render(<Landing />);
    await user.click(screen.getByRole('button', { name: strings.en.deleteMyData }));
    const s = useAppStore.getState();
    expect(s.savedJobs).toEqual([]);
    expect(s.profile).toBeNull();
    expect(s.matches).toEqual([]);
    expect(window.localStorage.getItem(SAVED_JOBS_KEY)).toBeNull();
  });

  it('blocked storage keeps the list for the visit and says so', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const user = userEvent.setup();
    renderJobs();
    await user.click(screen.getByRole('button', { name: 'Save this job' }));
    expect(savedButton().textContent).toBe('Saved jobs (1)');
    await user.click(savedButton());
    expect(screen.getByRole('listitem', { name: 'Job 1' })).toBeTruthy();
    expect(screen.getByText(strings.en.savedJobsBlocked).getAttribute('role')).toBe('status');
    vi.restoreAllMocks();
  });
});

describe('reduced motion', () => {
  it('no gliding highlight or lift, but the green state still shows on cards and buttons', async () => {
    stubMatchMedia(true);
    const user = userEvent.setup();
    renderJobs();
    await user.click(screen.getByRole('button', { name: 'Save this job' }));
    expect(document.querySelector('[data-save-burst]')).toBeNull();
    fireEvent.pointerMove(savedButton(), { pointerType: 'mouse' });
    expect(savedButton().className).toContain(GREEN);
    expect(savedButton().getAttribute('style') ?? '').not.toContain('translateY');
    await user.click(savedButton());
    fireEvent.pointerMove(listCard('job-1'), { pointerType: 'mouse' });
    expect(listCard('job-1').querySelector('[data-saved-highlight]')).toBeNull();
    expect(listCard('job-1').className).toContain(GREEN);
    expect(listCard('job-1').querySelector('h3')?.className).toContain('text-white');
  });
});
