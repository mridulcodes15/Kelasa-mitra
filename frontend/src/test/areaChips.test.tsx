import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Landing } from '../pages/Landing';
import { useAppStore } from '../store/appStore';
import { AREA_CHIPS } from '../lib/areaChips';
import { strings } from '../lib/i18n';
import { profile } from './fixtures';

const AREA_QUESTION = 'Bengaluru is a big city. Which area do you live in?';
const SKILLS_QUESTION = 'What kind of work have you done?';

function stubApi(question = AREA_QUESTION, noArea = true) {
  const fetchMock = vi.fn(async (url: string) => {
    const body = url.includes('extract-profile')
      ? { ...profile, area: noArea ? null : profile.area, skills: noArea ? profile.skills : [] }
      : { matches: [], follow_up_question: question };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function askWithoutArea(text = 'I am a cook in Bangalore') {
  const user = userEvent.setup();
  render(<Landing />);
  await user.type(screen.getByRole('textbox'), text);
  await user.click(screen.getByRole('button', { name: /Find Jobs/ }));
  await screen.findByText(new RegExp(AREA_QUESTION));
  return user;
}

function chipGroup() {
  return screen.getByRole('group', { name: strings.en.areaChipsLabel });
}

describe('area chips for a missing area', () => {
  it('shows the 8 areas as buttons with the touch-target size', async () => {
    stubApi();
    await askWithoutArea();
    const chips = within(chipGroup()).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(AREA_CHIPS.map((c) => c.en));
    for (const chip of chips) expect(chip.className).toContain('touch-target');
  });

  it.each(['kn', 'hi'] as const)('labels the chips in %s', async (lang) => {
    stubApi();
    useAppStore.setState({ lang, followUpQuestion: AREA_QUESTION, profile: { ...profile, area: null } });
    render(<Landing />);
    const group = screen.getByRole('group', { name: strings[lang].areaChipsLabel });
    expect(within(group).getAllByRole('button').map((c) => c.textContent))
      .toEqual(AREA_CHIPS.map((c) => c[lang]));
  });

  it('adds the tapped area to what the worker said and searches again', async () => {
    const fetchMock = stubApi();
    const user = await askWithoutArea();
    fetchMock.mockClear();

    await user.click(within(chipGroup()).getByRole('button', { name: 'Hoodi' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const extract = fetchMock.mock.calls.find(([url]) => String(url).includes('extract-profile')) as unknown as
      [string, RequestInit];
    const sent = JSON.parse(extract[1].body as string) as { text: string };
    expect(sent.text).toBe('I am a cook in Bangalore Hoodi');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toContain('Hoodi');
  });

  it('can be reached and pressed with the keyboard', async () => {
    const fetchMock = stubApi();
    const user = await askWithoutArea();
    fetchMock.mockClear();

    const first = within(chipGroup()).getByRole('button', { name: 'Whitefield' });
    first.focus();
    await user.tab();
    expect(document.activeElement).toBe(within(chipGroup()).getByRole('button', { name: 'Koramangala' }));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it('are not shown when the area is known and only skills are missing', async () => {
    stubApi(SKILLS_QUESTION, false);
    const user = userEvent.setup();
    render(<Landing />);
    await user.type(screen.getByRole('textbox'), 'I live in Whitefield');
    await user.click(screen.getByRole('button', { name: /Find Jobs/ }));
    await screen.findByText(new RegExp(SKILLS_QUESTION));
    expect(screen.queryByRole('group', { name: strings.en.areaChipsLabel })).toBeNull();
  });

  it('keeps the question in a live region without the buttons inside it', async () => {
    stubApi();
    await askWithoutArea();
    const status = screen.getByRole('status');
    expect(status.textContent).toContain(AREA_QUESTION);
    expect(within(status).queryAllByRole('button')).toHaveLength(0);
  });
});
