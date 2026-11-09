import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { Welcome } from '../pages/Welcome';
import { FADE_MS, LANGUAGE_CHOICES, SPLASH_EXIT, SPLASH_MS } from '../lib/welcome';
import { Landing } from '../pages/Landing';
import { BRAND_PATHS } from '../lib/brand';
import { LANG_TAG } from '../hooks/useSpeech';
import { strings, t } from '../lib/i18n';
import { useAppStore } from '../store/appStore';
import type { LangCode } from '../lib/types';
import { stubMatchMedia } from './setup';
import { profile } from './fixtures';

const NAMES: Record<LangCode, string> = { en: 'English', hi: 'हिन्दी', kn: 'ಕನ್ನಡ' };

function card(code: LangCode): HTMLElement {
  return document.querySelector(`[data-lang-card="${code}"]`) as HTMLElement;
}

function group(): HTMLElement {
  return screen.getByRole('radiogroup');
}

class FakeRecognition {
  static all: FakeRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  constructor() { FakeRecognition.all.push(this); }
  start() { this.onstart?.(); }
  stop() { this.onend?.(); }
}

function installFakeRecognition() {
  FakeRecognition.all = [];
  vi.stubGlobal('SpeechRecognition', FakeRecognition);
}

const latest = () => FakeRecognition.all[FakeRecognition.all.length - 1];

// ── Screen order and content ─────────────────────────────────────────────────

describe('welcome screen', () => {
  it('comes first: no mic until a language is chosen', () => {
    installFakeRecognition();
    render(<App />);
    expect(document.querySelector('[data-welcome]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Tap to Speak' })).toBeNull();
    expect(useAppStore.getState().screen).toBe('welcome');
  });

  it('shows the heading in all three languages, each with its lang', () => {
    render(<Welcome />);
    const heading = screen.getByRole('heading', { level: 1 });
    const lines = [...heading.querySelectorAll('span')].map((s) => [s.lang, s.textContent]);
    expect(lines).toEqual([
      ['en', 'Choose your language'], ['hi', 'भाषा चुनें'], ['kn', 'ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ'],
    ]);
  });

  it('offers three large language cards in a radio group, with lang attributes', () => {
    render(<Welcome />);
    expect(group().getAttribute('aria-labelledby')).toBe('choose-language');
    const radios = within(group()).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('lang'))).toEqual(['en', 'hi', 'kn']);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false']);
    for (const { code, latin } of LANGUAGE_CHOICES) {
      expect(card(code).textContent).toBe(NAMES[code] + (latin ?? ''));
      expect(card(code).className).toContain('min-h-[96px]');
      if (latin) expect(within(card(code)).getByText(latin).getAttribute('lang')).toBe('en');
    }
  });
});

// ── Splash, then fade, then cards ────────────────────────────────────────────

const phase = () => (document.querySelector('[data-welcome]') as HTMLElement).dataset.phase;

describe('splash', () => {
  it('shows the logo alone, fades it, then shows the cards', async () => {
    render(<Welcome />);
    expect(phase()).toBe('splash');
    expect(document.querySelector('[data-splash]')?.textContent).toContain('Kelasa Mitra');
    await waitFor(() => expect(phase()).toBe('fading'), { timeout: SPLASH_MS + 1000 });
    await waitFor(() => expect(phase()).toBe('cards'), { timeout: FADE_MS + 1000 });
    expect(document.querySelector('[data-splash]')).toBeNull();
  });

  it('never makes screen readers or keyboard users wait: the cards are in the page under it', async () => {
    const user = userEvent.setup();
    render(<Welcome />);
    expect(document.querySelector('[data-splash]')?.getAttribute('aria-hidden')).toBe('true');
    expect(within(group()).getAllByRole('radio')).toHaveLength(3);
    await user.tab(); // the first key both skips the splash and moves focus
    expect(phase()).toBe('cards');
    expect(document.activeElement).toBe(card('en'));
  });

  it('any key skips straight to the cards, and the splash is gone at once (it never covers the cards)', () => {
    render(<Welcome />);
    fireEvent.keyDown(window, { key: 'a' });
    expect(phase()).toBe('cards');
    expect(document.querySelector('[data-splash]')).toBeNull();
  });

  it('a tap skips straight to the cards', () => {
    render(<Welcome />);
    fireEvent.pointerDown(window);
    expect(phase()).toBe('cards');
  });

  it('fades with an even scale, and the mark never changes its aspect ratio', () => {
    expect(Object.keys(SPLASH_EXIT).sort()).toEqual(['opacity', 'scale']); // no scaleX / scaleY
    expect(SPLASH_EXIT.opacity).toBe(0);
    render(<Welcome />);
    const marks = () => [...document.querySelectorAll('[data-brand-mark]')] as SVGElement[];
    const square = () => marks().every((m) => m.getAttribute('width') === m.getAttribute('height')
      && m.getAttribute('viewBox') === '0 0 64 64');
    expect(marks().map((m) => m.getAttribute('width'))).toEqual(['96', '40']); // splash, cards
    expect(square()).toBe(true);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(square()).toBe(true);
  });

  it('is not shown under reduced motion: the cards come at once', () => {
    stubMatchMedia(true);
    render(<Welcome />);
    expect(phase()).toBe('cards');
    expect(document.querySelector('[data-splash]')).toBeNull();
  });

  it('is skipped when coming back from the mic screen', () => {
    useAppStore.setState({ welcomeSeen: true });
    render(<Welcome />);
    expect(phase()).toBe('cards');
  });

  it('puts a small mark above the heading on the cards screen', () => {
    render(<Welcome />);
    const cards = document.querySelector('[data-cards]') as HTMLElement;
    const mark = cards.querySelector('[data-brand-mark]') as SVGElement;
    expect(mark.getAttribute('width')).toBe('40');
    const heading = screen.getByRole('heading', { level: 1 });
    expect(mark.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ── White and green ──────────────────────────────────────────────────────────

function nameOf(code: LangCode): HTMLElement {
  return card(code).querySelector('span span') as HTMLElement;
}

function isGreen(code: LangCode): boolean {
  const c = card(code);
  return c.dataset.lit === 'true' && nameOf(code).className.includes('text-white')
    && (c.querySelector('[data-lang-highlight]') !== null || c.className.includes('bg-[#0d6e6e]'));
}

function isWhite(code: LangCode): boolean {
  const c = card(code);
  return c.dataset.lit === 'false' && c.className.includes('bg-white')
    && nameOf(code).className.includes('text-[#1a1a2e]') && c.querySelector('[data-lang-highlight]') === null;
}

describe('card colours', () => {
  it('are white by default', () => {
    render(<Welcome />);
    expect(LANGUAGE_CHOICES.every(({ code }) => isWhite(code))).toBe(true);
  });

  it('turn green under a hovering mouse, and back to white when it leaves', () => {
    render(<Welcome />);
    fireEvent.pointerMove(card('hi'));
    expect(isGreen('hi')).toBe(true);
    expect(isWhite('en') && isWhite('kn')).toBe(true);
    fireEvent.pointerMove(card('kn'));
    expect(isGreen('kn') && isWhite('hi')).toBe(true);
    fireEvent.pointerLeave(group());
    expect(LANGUAGE_CHOICES.every(({ code }) => isWhite(code))).toBe(true);
    expect(useAppStore.getState().screen).toBe('welcome');
  });

  it('follow a finger moving across the cards; only one card is green at a time', () => {
    render(<Welcome />);
    fireEvent.pointerDown(card('en'));
    expect(isGreen('en')).toBe(true);
    fireEvent.pointerMove(card('hi'));
    expect(isGreen('hi') && isWhite('en')).toBe(true);
    expect(document.querySelectorAll('[data-lang-highlight]')).toHaveLength(1);
    expect(useAppStore.getState().lang).toBe('en'); // nothing chosen while moving
  });

  it('use the same green for keyboard focus and arrow keys', async () => {
    const user = userEvent.setup();
    render(<Welcome />);
    await user.tab();
    expect(isGreen('en')).toBe(true);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(card('hi'));
    expect(isGreen('hi') && isWhite('en')).toBe(true);
  });

  it('green with white text has at least 4.5:1 contrast', () => {
    const lum = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    expect((1 + 0.05) / (lum('#0d6e6e') + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it('under reduced motion: no gliding highlight or movement, but the green state still shows', () => {
    stubMatchMedia(true);
    render(<Welcome />);
    fireEvent.pointerMove(card('hi'));
    expect(document.querySelector('[data-lang-highlight]')).toBeNull();
    expect(card('hi').className).toContain('bg-[#0d6e6e]');
    expect(isGreen('hi')).toBe(true);
  });
});

// ── Choosing ─────────────────────────────────────────────────────────────────

describe('choosing a language', () => {
  it('a tap (press and release on a card) chooses it, with a check mark', async () => {
    render(<Welcome />);
    fireEvent.pointerDown(card('kn'));
    fireEvent.pointerUp(card('kn'));
    expect(useAppStore.getState().lang).toBe('kn');
    expect(card('kn').getAttribute('aria-checked')).toBe('true');
    expect(card('kn').querySelector('[data-check]')?.getAttribute('aria-hidden')).toBe('true');
    expect(useAppStore.getState().screen).toBe('welcome'); // the brief pulse before the change
    await waitFor(() => expect(useAppStore.getState().screen).toBe('landing'));
  });

  it('releasing over a different card than the one pressed chooses the one under the finger', () => {
    render(<Welcome />);
    fireEvent.pointerDown(card('en'));
    fireEvent.pointerMove(card('kn'));
    fireEvent.pointerUp(card('kn'));
    expect(useAppStore.getState().lang).toBe('kn');
  });

  it('Tab reaches the first card, arrows move, Enter chooses', async () => {
    const user = userEvent.setup();
    render(<Welcome />);
    await user.tab();
    expect(document.activeElement).toBe(card('en'));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(card('hi'));
    await user.keyboard('{Enter}');
    expect(useAppStore.getState().lang).toBe('hi');
    await waitFor(() => expect(useAppStore.getState().screen).toBe('landing'));
  });

  it('Space chooses too, and arrows wrap around', async () => {
    const user = userEvent.setup();
    render(<Welcome />);
    await user.tab();
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(card('kn'));
    await user.keyboard(' ');
    expect(useAppStore.getState().lang).toBe('kn');
  });

  it('a pointer click does not choose twice', () => {
    render(<Welcome />);
    fireEvent.pointerDown(card('hi'));
    fireEvent.pointerUp(card('hi'));
    fireEvent.click(card('kn'), { detail: 1 }); // a mouse click after release is ignored
    expect(useAppStore.getState().lang).toBe('hi');
  });

  it('under reduced motion the screen changes at once', () => {
    stubMatchMedia(true);
    render(<Welcome />);
    fireEvent.pointerDown(card('hi'));
    fireEvent.pointerUp(card('hi'));
    expect(useAppStore.getState().screen).toBe('landing');
  });

  it('dragging across the cards does not scroll the page', () => {
    render(<Welcome />);
    expect(group().className).toContain('touch-none');
  });

  it('stores nothing', async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    render(<Welcome />);
    fireEvent.pointerDown(card('kn'));
    fireEvent.pointerUp(card('kn'));
    await waitFor(() => expect(useAppStore.getState().screen).toBe('landing'));
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});

// ── Into the mic screen ──────────────────────────────────────────────────────

describe('after the welcome screen', () => {
  it('the language is set before the mic appears, and the mic listens in it', async () => {
    stubMatchMedia(true); // instant screen change
    installFakeRecognition();
    const langWhenMicArrived: string[] = [];
    const unsubscribe = useAppStore.subscribe((s, prev) => {
      if (s.screen === 'landing' && prev.screen !== 'landing') langWhenMicArrived.push(s.lang);
    });
    const user = userEvent.setup();
    render(<App />);
    fireEvent.pointerDown(card('kn'));
    fireEvent.pointerUp(card('kn'));
    unsubscribe();
    expect(langWhenMicArrived).toEqual(['kn']);
    const mic = await screen.findByRole('button', { name: strings.kn.tapToSpeak });
    await waitFor(() => expect(document.activeElement).toBe(mic)); // focus moves to the mic once
    await user.click(mic);
    expect(latest().lang).toBe(LANG_TAG.kn);
  });

  it('switching with the header picker never shows the welcome screen again', async () => {
    stubMatchMedia(true);
    installFakeRecognition();
    const user = userEvent.setup();
    render(<App />);
    fireEvent.pointerDown(card('en'));
    fireEvent.pointerUp(card('en'));
    await user.click(await screen.findByRole('radio', { name: 'Hindi' }));
    expect(useAppStore.getState().lang).toBe('hi');
    expect(useAppStore.getState().screen).toBe('landing');
    expect(document.querySelector('[data-welcome]')).toBeNull();
  });
});

// ── Mic screen: "Listening in" and the no-speech hint ────────────────────────

describe('mic screen', () => {
  async function startListening(lang: LangCode = 'kn') {
    installFakeRecognition();
    useAppStore.setState({ screen: 'landing', lang });
    const user = userEvent.setup();
    render(<Landing />);
    await user.click(screen.getByRole('button', { name: strings[lang].tapToSpeak }));
    return user;
  }

  it.each(['en', 'kn', 'hi'] as const)('says which language it is listening in (%s)', async (lang) => {
    await startListening(lang);
    const label = document.querySelector('[data-listening-in]') as HTMLElement;
    expect(label.textContent).toBe(t(lang, 'listeningIn', { language: NAMES[lang] }));
  });

  it('after a session with no words, offers the other two languages', async () => {
    const user = await startListening('kn');
    await user.click(screen.getByRole('button', { name: strings.kn.listening })); // stop, nothing heard
    const hint = document.querySelector('[data-no-speech-hint]') as HTMLElement;
    expect(within(hint).getByRole('status').textContent).toBe(strings.kn.noSpeechHint);
    const choices = [...hint.querySelectorAll('[data-switch-to]')] as HTMLElement[];
    expect(choices.map((b) => [b.dataset.switchTo, b.getAttribute('lang'), b.textContent]))
      .toEqual([['en', 'en', 'English'], ['hi', 'hi', 'हिन्दी']]);
    for (const b of choices) expect(b.className).toContain('touch-target');
  });

  it('tapping a language switches the picker and listens again in it, once', async () => {
    const user = await startListening('kn');
    await user.click(screen.getByRole('button', { name: strings.kn.listening }));
    const before = FakeRecognition.all.length;
    await user.click(screen.getByRole('button', { name: 'हिन्दी' }));
    expect(useAppStore.getState().lang).toBe('hi');
    expect(FakeRecognition.all.length).toBe(before + 1);
    expect(latest().lang).toBe(LANG_TAG.hi);
    expect(screen.getByRole('button', { name: strings.hi.listening })).toBeTruthy();
    expect(document.querySelector('[data-no-speech-hint]')).toBeNull();
  });

  it('appears after a no-speech error too', async () => {
    await startListening('en');
    act(() => {
      latest().onerror?.({ error: 'no-speech' });
      latest().onend?.();
    });
    expect(document.querySelector('[data-no-speech-hint]')).not.toBeNull();
  });

  it('does not appear when words were heard', async () => {
    const user = await startListening('en');
    act(() => {
      latest().onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: 'I am a cook' }], { isFinal: true })] });
    });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
      url.includes('extract-profile') ? profile
        : url.includes('agent') ? { source: 'rules', reply: null, reason: 'x', thread_id: null }
          : { matches: [], follow_up_question: null }))));
    await user.click(screen.getByRole('button', { name: 'Listening…' }));
    expect(document.querySelector('[data-no-speech-hint]')).toBeNull();
  });

  it('can be dismissed with the keyboard', async () => {
    const user = await startListening('hi');
    await user.click(screen.getByRole('button', { name: strings.hi.listening }));
    screen.getByRole('button', { name: strings.hi.notNow }).focus();
    await user.keyboard('{Enter}');
    expect(document.querySelector('[data-no-speech-hint]')).toBeNull();
    expect(useAppStore.getState().lang).toBe('hi');
  });
});

// ── The mark does not depend on fonts ────────────────────────────────────────

describe('brand mark', () => {
  const favicon = () => readFileSync('public/favicon.svg', 'utf-8'); // vitest runs from frontend/
  const pathsIn = (svg: string) => [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);

  it('draws ಕ as a path, never as text, in the favicon and on screen', () => {
    expect(favicon()).not.toMatch(/<text/);
    render(<Welcome />);
    const mark = document.querySelector('[data-brand-mark]') as SVGElement;
    expect(mark.querySelector('text')).toBeNull();
    expect(mark.querySelector('[data-letter="ka"]')?.getAttribute('d')).toBe(BRAND_PATHS.ka);
  });

  it('uses the identical ಕ and tile paths in the favicon and the component', () => {
    render(<Welcome />);
    const first = document.querySelector('[data-brand-mark]') as SVGElement; // splash and cards use the same mark
    const onScreen = [...first.querySelectorAll('path')].map((p) => p.getAttribute('d'));
    expect(onScreen).toEqual([BRAND_PATHS.tile, BRAND_PATHS.ka]);
    expect(pathsIn(favicon())).toEqual([BRAND_PATHS.tile, BRAND_PATHS.ka]);
  });

  it('is a real outline, centred on the tile, clear of the dot', () => {
    const numbers = BRAND_PATHS.ka.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const xs = numbers.filter((_, i) => i % 2 === 0);
    const ys = numbers.filter((_, i) => i % 2 === 1);
    expect(BRAND_PATHS.ka.length).toBeGreaterThan(500); // a glyph outline, not a placeholder
    expect(Math.min(...xs)).toBeGreaterThan(8);
    expect(Math.max(...xs)).toBeLessThan(47); // the marigold dot starts at x = 47
    expect(Math.min(...ys)).toBeGreaterThan(8);
    expect(Math.max(...ys)).toBeLessThan(56);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(32, 0);
  });

  it('has no speech-bubble shape any more', () => {
    expect(Object.keys(BRAND_PATHS)).toEqual(['tile', 'ka']);
    expect(favicon().match(/<path/g)).toHaveLength(2);
  });
});

// ── Mic screen: the language chip ────────────────────────────────────────────

describe('language chip on the mic screen', () => {
  it.each([
    ['en', 'Language: English'],
    ['kn', 'ಭಾಷೆ: ಕನ್ನಡ'],
    ['hi', 'भाषा: हिन्दी'],
  ] as const)('shows the chosen language (%s)', (lang, label) => {
    useAppStore.setState({ screen: 'landing', lang });
    render(<Landing />);
    const chip = document.querySelector('[data-language-chip]') as HTMLElement;
    expect(chip.textContent).toContain(label);
    expect(chip.textContent).toContain(strings[lang].changeLanguage);
    expect(chip.getAttribute('lang')).toBe(lang);
    expect(chip.className).toContain('touch-target');
  });

  it('goes back to the cards (no splash) without losing typed text, then on to the new language', async () => {
    stubMatchMedia(true);
    const user = userEvent.setup();
    useAppStore.setState({ screen: 'landing', lang: 'en', welcomeSeen: true });
    render(<App />);
    await user.type(screen.getByRole('textbox'), 'I am a cook');
    await user.click(screen.getByRole('button', { name: /Language: English/ }));
    expect(useAppStore.getState().screen).toBe('welcome');
    expect((document.querySelector('[data-welcome]') as HTMLElement).dataset.phase).toBe('cards');
    fireEvent.pointerDown(card('kn'));
    fireEvent.pointerUp(card('kn'));
    expect(useAppStore.getState().lang).toBe('kn');
    const box = await screen.findByRole('textbox');
    expect((box as HTMLTextAreaElement).value).toBe('I am a cook');
    expect(document.querySelector('[data-language-chip]')?.textContent).toContain('ಭಾಷೆ: ಕನ್ನಡ');
  });

  it('keeps "Listening in" while recording', async () => {
    installFakeRecognition();
    useAppStore.setState({ screen: 'landing', lang: 'hi' });
    const user = userEvent.setup();
    render(<Landing />);
    await user.click(screen.getByRole('button', { name: strings.hi.tapToSpeak }));
    expect(document.querySelector('[data-listening-in]')?.textContent).toBe(t('hi', 'listeningIn', { language: 'हिन्दी' }));
    expect(document.querySelector('[data-language-chip]')).not.toBeNull();
  });
});
