import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Landing } from '../pages/Landing';
import { Jobs } from '../pages/Jobs';
import { SpeakToggle } from '../components/SpeakToggle';
import { findVoice, speak } from '../lib/tts';
import { strings } from '../lib/i18n';
import { useAppStore } from '../store/appStore';
import { jobMatch, profile } from './fixtures';

const QUESTION = 'ನೀವು ಬೆಂಗಳೂರಿನ ಯಾವ ಭಾಗದಲ್ಲಿ ವಾಸಿಸುತ್ತೀರಿ?';

class FakeUtterance {
  text: string;
  voice: SpeechSynthesisVoice | null = null;
  lang = '';
  constructor(text: string) {
    this.text = text;
  }
}

function installSpeech(voiceLangs: string[]) {
  const voices = voiceLangs.map((lang) => ({ lang, name: `voice-${lang}` }) as SpeechSynthesisVoice);
  const synth = {
    getVoices: vi.fn(() => voices),
    speak: vi.fn(),
    cancel: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  return synth;
}

function spoken(synth: ReturnType<typeof installSpeech>) {
  return synth.speak.mock.calls.map(([u]) => ({ text: (u as FakeUtterance).text, lang: (u as FakeUtterance).lang }));
}

beforeEach(() => {
  window.localStorage.clear();
  useAppStore.setState({ ttsMuted: false });
});

describe('voice choice', () => {
  const v = (lang: string) => ({ lang, name: lang }) as SpeechSynthesisVoice;

  it('prefers the Indian variant and accepts underscores', () => {
    expect(findVoice([v('en-US'), v('en_IN')], 'en')?.lang).toBe('en_IN');
    expect(findVoice([v('en-US')], 'en')?.lang).toBe('en-US');
  });

  it('never borrows another language', () => {
    expect(findVoice([v('en-IN'), v('hi-IN')], 'kn')).toBeNull();
  });

  it('does nothing when there is no voice for the language', async () => {
    const synth = installSpeech(['en-IN']);
    expect(await speak('ನಮಸ್ಕಾರ', 'kn')).toBe(false);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('does nothing when the browser has no speech synthesis', async () => {
    expect(await speak('hello', 'en')).toBe(false);
  });
});

describe('read-aloud on screen', () => {
  it('reads the follow-up question in Kannada with a Kannada voice', async () => {
    const synth = installSpeech(['en-IN', 'kn-IN']);
    useAppStore.setState({ lang: 'kn', followUpQuestion: QUESTION });
    render(<Landing />);
    await waitFor(() => expect(spoken(synth)).toEqual([{ text: QUESTION, lang: 'kn-IN' }]));
  });

  it('keeps the question visible and silent when no Kannada voice exists', async () => {
    const synth = installSpeech(['en-IN']);
    useAppStore.setState({ lang: 'kn', followUpQuestion: QUESTION });
    render(<Landing />);
    expect(screen.getByText(new RegExp(QUESTION))).toBeTruthy();
    await new Promise((r) => { setTimeout(r, 20); });
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('reads the top match reason once on the jobs screen', async () => {
    const synth = installSpeech(['hi-IN']);
    const top = { ...jobMatch(2, 'a'), reason: 'top reason' };
    useAppStore.setState({ lang: 'hi', profile, matches: [top, { ...jobMatch(3, 'b'), reason: 'second' }] });
    render(<Jobs />);
    await waitFor(() => expect(spoken(synth)).toEqual([{ text: 'top reason', lang: 'hi-IN' }]));
  });

  it('says nothing while muted', async () => {
    const synth = installSpeech(['kn-IN']);
    useAppStore.setState({ lang: 'kn', followUpQuestion: QUESTION, ttsMuted: true });
    render(<Landing />);
    await new Promise((r) => { setTimeout(r, 20); });
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('stops speech when the mic starts', async () => {
    const synth = installSpeech(['en-IN']);
    vi.stubGlobal('SpeechRecognition', class { start() {} stop() {} });
    const user = userEvent.setup();
    render(<Landing />);
    synth.cancel.mockClear();
    await user.click(screen.getByRole('button', { name: strings.en.tapToSpeak }));
    expect(synth.cancel).toHaveBeenCalled();
  });
});

describe('mute toggle', () => {
  it.each(['en', 'kn', 'hi'] as const)('is labelled in %s and is a 48px toggle', async (lang) => {
    installSpeech([]);
    useAppStore.setState({ lang });
    const user = userEvent.setup();
    render(<SpeakToggle />);
    const button = screen.getByRole('button', { name: strings[lang].readAloudOn });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.className).toContain('touch-target');
    await user.click(button);
    expect(screen.getByRole('button', { name: strings[lang].readAloudOff }).getAttribute('aria-pressed')).toBe('false');
  });

  it('stops current speech when muted and remembers the choice', async () => {
    const synth = installSpeech(['en-IN']);
    const user = userEvent.setup();
    render(<SpeakToggle />);
    await user.click(screen.getByRole('button', { name: strings.en.readAloudOn }));
    expect(synth.cancel).toHaveBeenCalled();
    expect(useAppStore.getState().ttsMuted).toBe(true);
    expect(window.localStorage.getItem('kelasa-mitra-tts-muted')).toBe('1');
    act(() => useAppStore.getState().setTtsMuted(false));
    expect(window.localStorage.getItem('kelasa-mitra-tts-muted')).toBe('0');
  });
});
