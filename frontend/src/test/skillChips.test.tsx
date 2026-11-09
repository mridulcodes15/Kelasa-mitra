import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Landing } from '../pages/Landing';
import { SKILL_CHIPS } from '../lib/skillChips';
import { SKILLS } from '../lib/skills';
import { strings } from '../lib/i18n';
import { useAppStore } from '../store/appStore';
import type { LangCode } from '../lib/types';
import { profile } from './fixtures';

const UNKNOWN_WORK = 'I did not recognise that kind of work yet. This demo covers jobs like these - tap one or say it again.';

function showUnknownWork(lang: LangCode = 'en', withArea = true) {
  useAppStore.setState({
    screen: 'landing',
    lang,
    transcript: 'I am a teacher in Whitefield ',
    followUpQuestion: UNKNOWN_WORK,
    profile: { ...profile, skills: [], area: withArea ? profile.area : null },
  });
  return render(<Landing />);
}

function chipGroup(lang: LangCode = 'en') {
  return screen.getByRole('group', { name: strings[lang].skillChipsLabel });
}

describe('no skill recognised', () => {
  it('shows the message once, not the generic question, with the 10 skill chips', () => {
    showUnknownWork();
    expect(screen.getByRole('status').textContent).toContain(UNKNOWN_WORK);
    expect(screen.queryByText(/What kind of work have you done/)).toBeNull();
    const chips = within(chipGroup()).getAllByRole('button');
    expect(chips.map((c) => c.dataset.skillChip)).toEqual(SKILL_CHIPS);
    expect(chips).toHaveLength(10);
    for (const chip of chips) expect(chip.className).toContain('touch-target');
  });

  it.each(['en', 'kn', 'hi'] as const)('labels the chips in the picker language (%s)', (lang) => {
    showUnknownWork(lang);
    const chips = within(chipGroup(lang)).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(SKILL_CHIPS.map((id) => SKILLS[id][lang]));
    expect(chips.every((c) => c.getAttribute('lang') === lang)).toBe(true);
  });

  it('tapping a chip adds the skill name to the text and searches again', async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(
      url.includes('extract-profile') ? profile
        : url.includes('agent') ? { source: 'rules', reply: null, reason: 'x', thread_id: null }
          : { matches: [], follow_up_question: null })));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    showUnknownWork();
    await user.click(within(chipGroup()).getByRole('button', { name: 'Cook' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const extract = calls.find(([url]) => url.includes('extract-profile')) as [string, RequestInit];
    expect(JSON.parse(extract[1].body as string).text).toBe('I am a teacher in Whitefield Cook');
  });

  it('only offers skills the demo covers', () => {
    expect(SKILL_CHIPS.every((id) => id in SKILLS)).toBe(true);
    expect(SKILL_CHIPS).not.toContain('teacher');
  });

  it('asks for the area first: no skill chips while the area is missing', () => {
    showUnknownWork('en', false);
    expect(screen.queryByRole('group', { name: strings.en.skillChipsLabel })).toBeNull();
    expect(screen.getByRole('group', { name: strings.en.areaChipsLabel })).toBeTruthy();
  });
});
