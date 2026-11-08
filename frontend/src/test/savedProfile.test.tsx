import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Landing } from '../pages/Landing';
import { useAppStore } from '../store/appStore';
import { strings } from '../lib/i18n';
import { PROFILE_KEY, deleteSavedProfile, loadSavedProfile, saveProfile } from '../lib/savedProfile';
import { profile } from './fixtures';

const S = strings.en;

function stubApi() {
  const fetchMock = vi.fn(async (url: string) => {
    const body = url.includes('extract-profile')
      ? profile
      : url.includes('/matches')
        ? { matches: [], follow_up_question: null }
        : { source: 'rules', reply: null, reason: 'not_configured', thread_id: null };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function searchOnce(user: ReturnType<typeof userEvent.setup>, text = 'I am a cook in Whitefield') {
  await user.type(screen.getByRole('textbox'), text);
  await user.click(screen.getByRole('button', { name: /Find Jobs/ }));
  return screen.findByRole('checkbox', { name: S.saveOnDevice });
}

function stored(): Record<string, unknown> | null {
  const raw = window.localStorage.getItem(PROFILE_KEY);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('save my profile on this device', () => {
  it('is off by default and stores nothing until the worker opts in', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<Landing />);
    const box = await searchOnce(user);
    expect((box as HTMLInputElement).checked).toBe(false);
    expect(window.localStorage.length).toBe(0);
    expect(screen.getByText(new RegExp(S.saveOnDeviceNote.slice(0, 30)))).toBeTruthy();
  });

  it('stores only the profile JSON, without the worker\'s words', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<Landing />);
    await user.click(await searchOnce(user));

    expect(Object.keys(window.localStorage)).toEqual([PROFILE_KEY]);
    expect(stored()).toEqual({ ...profile, raw_input: '' });
    expect(window.localStorage.getItem(PROFILE_KEY)).not.toContain('I am a cook');
  });

  it('keeps the saved copy up to date and removes it when unticked', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<Landing />);
    const box = await searchOnce(user);
    await user.click(box);

    useAppStore.getState().rememberProfile({ ...profile, skills: ['driver'] });
    expect(stored()?.skills).toEqual(['driver']);

    await user.click(box);
    expect(stored()).toBeNull();
  });

  it('"Delete my data" clears the device and this visit', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<Landing />);
    await user.click(await searchOnce(user));

    await user.click(screen.getByRole('button', { name: S.deleteMyData }));

    expect(window.localStorage.getItem(PROFILE_KEY)).toBeNull();
    const state = useAppStore.getState();
    expect([state.profile, state.savedProfile, state.transcript, state.saveOnDevice]).toEqual([null, null, '', false]);
    expect(screen.getByRole('status').textContent).toBe(S.dataDeleted);
    expect(screen.queryByRole('button', { name: S.deleteMyData })).toBeNull();
  });

  it.each(['kn', 'hi'] as const)('labels the controls in %s', (lang) => {
    useAppStore.setState({ lang, profile, savedProfile: profile, saveOnDevice: true });
    render(<Landing />);
    expect(screen.getByRole('checkbox', { name: strings[lang].saveOnDevice })).toBeTruthy();
    expect(screen.getByRole('button', { name: strings[lang].deleteMyData })).toBeTruthy();
    expect(screen.getByText(new RegExp(strings[lang].saveOnDeviceNote))).toBeTruthy();
  });

  it('finds jobs from a saved profile without sending any text or asking the agent', async () => {
    const fetchMock = stubApi();
    const saved = { ...profile, raw_input: '' };
    useAppStore.setState({ profile: saved, savedProfile: saved, saveOnDevice: true });
    const user = userEvent.setup();
    render(<Landing />);

    await user.click(screen.getByRole('button', { name: S.useSavedProfile }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual(['/api/matches']);
    const init = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init[1].body as string)).toEqual({ profile: saved });
  });
});

describe('blocked storage', () => {
  it('says the profile cannot be saved and keeps the box unticked', async () => {
    stubApi();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const user = userEvent.setup();
    render(<Landing />);
    const box = await searchOnce(user);
    await user.click(box);

    expect((box as HTMLInputElement).checked).toBe(false);
    // The agent's offline banner is another live region, so find the message by its text.
    expect(screen.getByText(S.storageBlocked).getAttribute('role')).toBe('status');
  });

  it('never throws from the storage helpers', () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
    }
    expect(loadSavedProfile()).toBeNull();
    expect(saveProfile(profile)).toBe(false);
    expect(deleteSavedProfile()).toBe(false);
  });
});

describe('loading a saved profile', () => {
  it('returns the saved profile without raw text', () => {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    expect(loadSavedProfile()).toEqual({ ...profile, raw_input: '' });
  });

  it.each([
    ['not JSON', '{oops'],
    ['wrong shape', JSON.stringify({ skills: 'cook' })],
    ['bad area', JSON.stringify({ ...profile, area: { id: 'x' } })],
    ['null', 'null'],
  ])('ignores %s', (_, raw) => {
    window.localStorage.setItem(PROFILE_KEY, raw);
    expect(loadSavedProfile()).toBeNull();
  });
});
