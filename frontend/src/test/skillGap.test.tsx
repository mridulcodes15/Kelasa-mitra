import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkillGapSection } from '../components/SkillGapSection';
import { SkillGapStepper } from '../components/SkillGapStepper';
import { fetchSkillGap } from '../lib/api';
import { strings } from '../lib/i18n';
import { useProfile } from '../hooks/useProfile';
import { useAppStore } from '../store/appStore';
import { jobMatch, profile, skillGapItem } from './fixtures';

describe('SkillGapStepper', () => {
  it('shows jobs unlocked, pay uplift and steps', () => {
    render(<SkillGapStepper gap={skillGapItem()} lang="en" defaultOpen />);
    expect(screen.getByText('+2')).toBeTruthy();
    expect(screen.getByText('~₹6,000 more/month')).toBeTruthy();
    expect(screen.getByText('First step')).toBeTruthy();
    expect(screen.getByText(/~₹3,000/)).toBeTruthy();
  });

  it('makes no pay claim when uplift is 0', () => {
    const { container } = render(
      <SkillGapStepper gap={skillGapItem({ avg_pay_uplift_inr: 0, learning_path: [] })} lang="en" defaultOpen />,
    );
    expect(screen.getByText('+2')).toBeTruthy();
    expect(container.textContent).not.toContain('₹');
  });

  it('toggles steps with a 48px button', async () => {
    const user = userEvent.setup();
    render(<SkillGapStepper gap={skillGapItem()} lang="en" />);
    expect(screen.queryByText('First step')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Show steps' });
    expect(toggle.className).toContain('touch-target');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    expect(screen.getByText('First step')).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it.each(['kn', 'hi'] as const)('says steps are in English only in %s', (lang) => {
    render(<SkillGapStepper gap={skillGapItem()} lang={lang} defaultOpen />);
    expect(screen.getByText(strings[lang].stepsEnglishOnly)).toBeTruthy();
  });
});

describe('SkillGapSection', () => {
  it('renders nothing before a request', () => {
    const { container } = render(<SkillGapSection />);
    expect(container.textContent).toBe('');
  });

  it('labels the numbers as sample data and opens only the first gap', () => {
    useAppStore.setState({
      skillGap: {
        is_synthetic: true,
        gaps: [
          skillGapItem(),
          skillGapItem({ skill_id: 'plumber', label: 'Plumber', learning_path: [{ step: 1, action: 'Plumb step', weeks: 1, approx_cost_inr: 0 }] }),
        ],
      },
    });
    render(<SkillGapSection />);
    expect(screen.getByText(strings.en.skillGapSample)).toBeTruthy();
    expect(screen.getByText('First step')).toBeTruthy();
    expect(screen.queryByText('Plumb step')).toBeNull();
  });

  it('shows the empty state', () => {
    useAppStore.setState({ skillGap: { gaps: [], is_synthetic: true } });
    render(<SkillGapSection />);
    expect(screen.getByText(strings.en.skillGapEmpty)).toBeTruthy();
  });

  it('shows the error state', () => {
    useAppStore.setState({ skillGapFailed: true });
    render(<SkillGapSection />);
    expect(screen.getByText(strings.en.skillGapError)).toBeTruthy();
  });

  it('shows the loading state', () => {
    useAppStore.setState({ isFetchingSkillGap: true });
    render(<SkillGapSection />);
    expect(screen.getByText(strings.en.skillGapLoading)).toBeTruthy();
  });
});

describe('fetching', () => {
  it('fetchSkillGap posts the profile', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ gaps: [], is_synthetic: true })));
    vi.stubGlobal('fetch', fetchMock);
    await fetchSkillGap(profile);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/skill-gap');
    expect(JSON.parse(init.body as string)).toEqual({ profile });
  });

  it('fetchSkillGap throws on a server error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    await expect(fetchSkillGap(profile)).rejects.toThrow('500');
  });

  function Runner() {
    const { runExtraction } = useProfile();
    return <button onClick={() => void runExtraction('I am a cook')}>run</button>;
  }

  function stubResponses(skillGap: () => Response) {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('extract-profile')) return new Response(JSON.stringify(profile));
      if (url.includes('matches')) return new Response(JSON.stringify({ matches: [jobMatch()] }));
      return skillGap();
    }));
  }

  it('loads skill gaps after matches', async () => {
    stubResponses(() => new Response(JSON.stringify({ gaps: [skillGapItem()], is_synthetic: true })));
    const user = userEvent.setup();
    render(<Runner />);
    await user.click(screen.getByText('run'));
    await waitFor(() => expect(useAppStore.getState().skillGap?.gaps).toHaveLength(1));
    expect(useAppStore.getState().screen).toBe('jobs');
  });

  it('keeps job matches when the skill-gap request fails', async () => {
    stubResponses(() => new Response('boom', { status: 500 }));
    const user = userEvent.setup();
    render(<Runner />);
    await user.click(screen.getByText('run'));
    await waitFor(() => expect(useAppStore.getState().skillGapFailed).toBe(true));
    expect(useAppStore.getState().matches).toHaveLength(1);
  });
});
