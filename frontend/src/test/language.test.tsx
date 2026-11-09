import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Landing } from '../pages/Landing';
import { ProfileCard } from '../components/ProfileCard';
import { LANG_TAG } from '../hooks/useSpeech';
import { useProfile } from '../hooks/useProfile';
import { detectScriptLanguage, suggestedLanguage } from '../lib/scriptLanguage';
import { SKILLS } from '../lib/skills';
import { strings } from '../lib/i18n';
import { useAppStore } from '../store/appStore';
import type { LangCode } from '../lib/types';
import { jobMatch, profile } from './fixtures';

class FakeRecognition {
  static all: FakeRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  stopped = false;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  constructor() {
    FakeRecognition.all.push(this);
  }
  start() {
    this.onstart?.();
  }
  stop() {
    this.stopped = true;
    this.onend?.();
  }
}

function useFakeRecognition() {
  FakeRecognition.all = [];
  vi.stubGlobal('SpeechRecognition', FakeRecognition);
}

function latest() {
  return FakeRecognition.all[FakeRecognition.all.length - 1];
}

function hear(text: string) {
  act(() => {
    latest().onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] });
  });
}

const LABEL: Record<LangCode, string> = { en: 'English', kn: 'Kannada', hi: 'Hindi' };

// ── 1. Speech recognition language ───────────────────────────────────────────

describe('speech recognition language', () => {
  it('uses en-IN, kn-IN and hi-IN', () => {
    expect(LANG_TAG).toEqual({ en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN' });
  });

  it.each(['en', 'kn', 'hi'] as const)('starts in the picker language (%s)', async (lang) => {
    useFakeRecognition();
    useAppStore.setState({ lang });
    const user = userEvent.setup();
    render(<Landing />);
    await user.click(screen.getByRole('button', { name: strings[lang].tapToSpeak }));
    expect(latest().lang).toBe(LANG_TAG[lang]);
  });

  it('switches language mid-session, keeping the words already heard', async () => {
    useFakeRecognition();
    const user = userEvent.setup();
    render(<Landing />);
    await user.click(screen.getByRole('button', { name: 'Tap to Speak' }));
    hear('I am a cook');
    const first = latest();

    await user.click(screen.getByRole('radio', { name: LABEL.kn }));

    expect(first.stopped).toBe(true);
    expect(FakeRecognition.all).toHaveLength(2);
    expect(latest().lang).toBe('kn-IN');
    // Still listening, in the new language, and the earlier words are kept.
    expect(screen.getByRole('button', { name: strings.kn.listening })).toBeTruthy();
    hear('ವೈಟ್‌ಫೀಲ್ಡ್');
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(box.value).toContain('I am a cook');
    expect(box.value).toContain('ವೈಟ್‌ಫೀಲ್ಡ್');
  });

  it('does not start a session when the picker changes while not listening', async () => {
    useFakeRecognition();
    const user = userEvent.setup();
    render(<Landing />);
    await user.click(screen.getByRole('radio', { name: LABEL.hi }));
    expect(FakeRecognition.all).toHaveLength(0);
  });
});

// ── 2. ui_language sent to every endpoint ────────────────────────────────────

describe('language sent to the backend', () => {
  function stubApi(returnedProfile = profile) {
    const fetchMock = vi.fn(async (url: string) => {
      const body = url.includes('extract-profile') ? returnedProfile
        : url.includes('/matches') ? { matches: [jobMatch()], follow_up_question: null }
          : url.includes('skill-gap') ? { gaps: [], is_synthetic: true }
            : { source: 'rules', reply: null, reason: 'not_configured', thread_id: null };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  function sent(fetchMock: ReturnType<typeof stubApi>, part: string) {
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes(part)) as unknown as [string, RequestInit];
    return JSON.parse(call[1].body as string);
  }

  function Runner({ saved }: { saved?: boolean }) {
    const { runExtraction, runSavedProfile } = useProfile();
    return (
      <button onClick={() => void (saved ? runSavedProfile({ ...profile, detected_language: 'en' }) : runExtraction('I am a cook'))}>
        run
      </button>
    );
  }

  it.each(['en', 'kn', 'hi'] as const)('sends the picker language (%s) on every request', async (lang) => {
    // The backend sets detected_language from ui_language; mirror that here.
    const fetchMock = stubApi({ ...profile, detected_language: lang });
    useAppStore.setState({ lang });
    const user = userEvent.setup();
    render(<Runner />);
    await user.click(screen.getByText('run'));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('skill-gap'))).toBe(true));
    expect(sent(fetchMock, 'extract-profile').ui_language).toBe(lang);
    expect(sent(fetchMock, 'agent/chat').ui_language).toBe(lang);
    expect(sent(fetchMock, '/matches').profile.detected_language).toBe(lang);
    expect(sent(fetchMock, 'skill-gap').profile.detected_language).toBe(lang);
  });

  it('uses the picker language, not the saved one, for a saved profile', async () => {
    const fetchMock = stubApi();
    useAppStore.setState({ lang: 'hi' });
    const user = userEvent.setup();
    render(<Runner saved />);
    await user.click(screen.getByText('run'));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('skill-gap'))).toBe(true));
    expect(sent(fetchMock, '/matches').profile.detected_language).toBe('hi');
    expect(sent(fetchMock, 'skill-gap').profile.detected_language).toBe('hi');
  });
});

// ── 3. Mismatch nudge ────────────────────────────────────────────────────────

describe('language detection for the nudge', () => {
  it.each([
    ['ನಾನು ವೈಟ್‌ಫೀಲ್ಡ್‌ನಲ್ಲಿ ಅಡುಗೆ ಮಾಡುತ್ತೇನೆ', 'kn'],
    ['मैं व्हाइटफील्ड में खाना बनाता हूँ', 'hi'],
    ['I am a cook and I have worked for 3 years', 'en'],
  ])('detects %s as %s', (text, lang) => {
    expect(detectScriptLanguage(text)).toBe(lang);
  });

  it.each([
    ['too short', 'ನಾನು ಅಡುಗೆ'],
    ['romanised Kannada', 'naanu adige maadtini Whitefield alli'],
    ['romanised Hindi', 'main cook hoon Whitefield mein'],
    ['an even mix', 'I cook ಅಡುಗೆ ಮಾಡುತ್ತೇನೆ in Whitefield'],
  ])('stays quiet for %s', (_, text) => {
    expect(detectScriptLanguage(text)).toBeNull();
  });

  it('suggests only a different language', () => {
    expect(suggestedLanguage('ನಾನು ವೈಟ್‌ಫೀಲ್ಡ್‌ನಲ್ಲಿ ಅಡುಗೆ ಮಾಡುತ್ತೇನೆ', 'kn')).toBeNull();
    expect(suggestedLanguage('ನಾನು ವೈಟ್‌ಫೀಲ್ಡ್‌ನಲ್ಲಿ ಅಡುಗೆ ಮಾಡುತ್ತೇನೆ', 'en')).toBe('kn');
  });
});

describe('mismatch nudge', () => {
  const KN_TEXT = 'ನಾನು ವೈಟ್‌ಫೀಲ್ಡ್‌ನಲ್ಲಿ ಅಡುಗೆ ಮಾಡುತ್ತೇನೆ';

  function nudgeButton(lang: LangCode) {
    return screen.queryByRole('button', { name: new RegExp(strings[lang].switchLangPrompt.replace(/[?.]/g, '.')) });
  }

  it('offers to switch, and switches only when tapped', async () => {
    const user = userEvent.setup();
    render(<Landing />);
    await user.type(screen.getByRole('textbox'), KN_TEXT);
    const button = nudgeButton('kn') as HTMLElement;
    expect(button).toBeTruthy();
    expect(button.className).toContain('touch-target');
    expect(button.closest('[data-language-nudge]')?.getAttribute('lang')).toBe('kn');
    // Not switched automatically
    expect(useAppStore.getState().lang).toBe('en');
    await user.click(button);
    expect(useAppStore.getState().lang).toBe('kn');
    expect(nudgeButton('kn')).toBeNull();
    // No translation: the text is untouched
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(KN_TEXT);
  });

  it('can be dismissed, with the keyboard too', async () => {
    const user = userEvent.setup();
    render(<Landing />);
    await user.type(screen.getByRole('textbox'), KN_TEXT);
    const dismiss = screen.getByRole('button', { name: strings.kn.notNow });
    expect(dismiss.className).toContain('touch-target');
    dismiss.focus();
    await user.keyboard('{Enter}');
    expect(nudgeButton('kn')).toBeNull();
    expect(useAppStore.getState().lang).toBe('en');
  });

  it('is keyboard reachable from the text box', async () => {
    const user = userEvent.setup();
    render(<Landing />);
    await user.type(screen.getByRole('textbox'), KN_TEXT);
    screen.getByRole('button', { name: /Find Jobs/ }).focus();
    await user.tab();
    expect(document.activeElement).toBe(nudgeButton('kn'));
    await user.keyboard(' ');
    expect(useAppStore.getState().lang).toBe('kn');
  });

  it.each([
    ['hi', 'मैं व्हाइटफील्ड में खाना बनाता हूँ और 3 साल का अनुभव है', 'en'],
    ['en', 'I am a cook and I have worked in Whitefield for 3 years', 'kn'],
  ] as const)('suggests %s in that language', async (target, text, picker) => {
    useAppStore.setState({ lang: picker });
    const user = userEvent.setup();
    render(<Landing />);
    await user.type(screen.getByRole('textbox'), text);
    expect(nudgeButton(target)).toBeTruthy();
  });

  it('stays hidden when the text matches the picker or is short', async () => {
    const user = userEvent.setup();
    render(<Landing />);
    await user.type(screen.getByRole('textbox'), 'I am a cook in Whitefield and I have 3 years');
    expect(document.querySelector('[data-language-nudge]')).toBeNull();
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'ಅಡುಗೆ');
    expect(document.querySelector('[data-language-nudge]')).toBeNull();
  });

  it('also reacts to recognised speech', async () => {
    useFakeRecognition();
    const user = userEvent.setup();
    render(<Landing />);
    await user.click(screen.getByRole('button', { name: 'Tap to Speak' }));
    hear(KN_TEXT);
    expect(nudgeButton('kn')).toBeTruthy();
  });
});

// ── 4. Profile card skill names ──────────────────────────────────────────────

describe.each(['en', 'kn', 'hi'] as const)('profile card in %s', (lang) => {
  it('shows skill names in the chosen language', () => {
    const { container } = render(
      <ProfileCard profile={{ ...profile, skills: ['cook', 'food_handler', 'driving_licence'] }} lang={lang} />,
    );
    for (const id of ['cook', 'food_handler', 'driving_licence']) {
      expect(container.textContent).toContain(SKILLS[id][lang]);
    }
    if (lang !== 'en') expect(container.textContent).not.toContain('Cook');
  });
});

// ── 5. Wrong script from recognition: the text stays editable ────────────────

describe('recognised text in an unexpected script', () => {
  it('stays in an editable text box and the edited text is what gets sent', async () => {
    useFakeRecognition();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ...profile, area: null })));
    vi.stubGlobal('fetch', fetchMock);
    useAppStore.setState({ lang: 'kn' });
    const user = userEvent.setup();
    render(<Landing />);
    await user.click(screen.getByRole('button', { name: strings.kn.tapToSpeak }));
    hear('naanu adige');
    await user.click(screen.getByRole('button', { name: strings.kn.listening }));

    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(box.disabled).toBe(false);
    expect(box.readOnly).toBe(false);
    await user.clear(box);
    await user.type(box, 'ನಾನು ಅಡುಗೆಯವನು');
    fetchMock.mockClear();
    await user.click(screen.getByRole('button', { name: strings.kn.findJobs }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const extract = calls.find(([url]) => url.includes('extract-profile')) as [string, RequestInit];
    expect(JSON.parse(extract[1].body as string)).toEqual({ text: 'ನಾನು ಅಡುಗೆಯವನು', ui_language: 'kn' });
  });
});
