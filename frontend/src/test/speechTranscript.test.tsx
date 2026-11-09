import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Landing } from '../pages/Landing';
import { strings } from '../lib/i18n';
import { useAppStore } from '../store/appStore';
import type { LangCode } from '../lib/types';
import { profile } from './fixtures';

/**
 * Speech results as Android Chrome delivers them. With continuous recognition it sends the
 * whole result list on every event, often with growing partial results as separate entries
 * ("I", "I am", "I am a", …) and sometimes marks each growing entry final. The text box must
 * show the words once.
 */
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

type Entry = [text: string, final: boolean];

function emit(entries: Entry[], resultIndex = 0) {
  const results = entries.map(([text, final]) => Object.assign([{ transcript: text }], { isFinal: final }));
  const rec = FakeRecognition.all[FakeRecognition.all.length - 1];
  act(() => { rec.onresult?.({ resultIndex, results }); });
}

async function listen(lang: LangCode = 'en') {
  FakeRecognition.all = [];
  vi.stubGlobal('SpeechRecognition', FakeRecognition);
  useAppStore.setState({ screen: 'landing', lang });
  const user = userEvent.setup();
  render(<Landing />);
  await user.click(screen.getByRole('button', { name: strings[lang].tapToSpeak }));
  return user;
}

const textBox = () => (screen.getByRole('textbox') as HTMLTextAreaElement).value.trim().replace(/\s+/g, ' ');
const liveWords = () => (document.querySelector('[data-live-words]')?.textContent ?? '').trim().replace(/\s+/g, ' ');

/** Grow a sentence word by word: ["I", "I am", "I am a", …]. */
function prefixes(sentence: string): string[] {
  const words = sentence.split(' ');
  return words.map((_, i) => words.slice(0, i + 1).join(' '));
}

describe('speech transcript (Android Chrome partial results)', () => {
  it('cumulative non-final partials in one list show only the latest, then the final once', async () => {
    await listen('en');
    const steps = prefixes('I am a teacher');
    const growing: Entry[] = [];
    for (const text of steps) {
      growing.push([text, false]);
      emit(growing);
      expect(liveWords()).toBe(text); // replaces, never "I I am I am a"
      expect(textBox()).toBe(text);
    }
    emit([...growing, ['I am a teacher', true]], growing.length);
    expect(textBox()).toBe('I am a teacher');
    expect(liveWords()).toBe('I am a teacher');
  });

  it('growing partials each marked final (the phone bug) are not appended again and again', async () => {
    const user = await listen('en');
    const sentence = 'I am a teacher and I have 10 years of experience';
    const growing: Entry[] = [];
    for (const text of prefixes(sentence)) {
      growing.push([text, true]);
      emit(growing, 0); // the phone re-sends the whole list from index 0
    }
    expect(textBox()).toBe(sentence);
    await user.click(screen.getByRole('button', { name: 'Listening…' }));
    expect(textBox()).toBe(sentence);
  });

  it('works the same for Hindi', async () => {
    await listen('hi');
    const sentence = 'मैं शिक्षक हूँ और मुझे दस साल का अनुभव है';
    const growing: Entry[] = [];
    for (const text of prefixes(sentence)) {
      growing.push([text, false]);
      emit(growing);
    }
    expect(textBox()).toBe(sentence);
    emit([...growing, [sentence, true]], growing.length);
    expect(textBox()).toBe(sentence);
  });

  it('interim text replaces the previous interim text', async () => {
    await listen('en');
    emit([['I am', false]]);
    emit([['I am a', false]]);
    emit([['I am a cook', false]]);
    expect(textBox()).toBe('I am a cook');
  });

  it('keeps separate sentences: a final, then the next one growing after it', async () => {
    await listen('en');
    emit([['I am a teacher', true]]);
    emit([['I am a teacher', true], ['and I', false]], 1);
    emit([['I am a teacher', true], ['and I have', false]], 1);
    expect(textBox()).toBe('I am a teacher and I have');
    emit([['I am a teacher', true], ['and I have 10 years of experience', true]], 1);
    expect(textBox()).toBe('I am a teacher and I have 10 years of experience');
  });

  it('a re-sent final at the same index is not added twice', async () => {
    await listen('en');
    emit([['I am a cook', true]]);
    emit([['I am a cook', true]]);
    emit([['I am a cook', true]], 0);
    expect(textBox()).toBe('I am a cook');
  });

  it('a language switch while listening keeps the words already heard, once', async () => {
    const user = await listen('en');
    emit([['I am a cook', true]]);
    await user.click(screen.getByRole('radio', { name: 'Kannada' }));
    emit([['ವೈಟ್‌ಫೀಲ್ಡ್', false]]);
    expect(textBox()).toBe('I am a cook ವೈಟ್‌ಫೀಲ್ಡ್');
    emit([['ವೈಟ್‌ಫೀಲ್ಡ್', true]]);
    expect(textBox()).toBe('I am a cook ವೈಟ್‌ಫೀಲ್ಡ್');
  });

  it('a restart from the no-speech hint does not duplicate earlier text', async () => {
    useAppStore.setState({ followUpQuestion: 'Where in Bengaluru do you live?', transcript: 'I am a cook ' });
    const user = await listen('en');
    await user.click(screen.getByRole('button', { name: 'Listening…' })); // nothing heard
    await user.click(screen.getByRole('button', { name: 'हिन्दी' }));
    emit([['व्हाइटफील्ड', true]]);
    expect(textBox()).toBe('I am a cook व्हाइटफील्ड');
  });

  it('stays editable after listening, and the edited text is what gets searched', async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(
      url.includes('extract-profile') ? { ...profile, area: null }
        : url.includes('agent') ? { source: 'rules', reply: null, reason: 'x', thread_id: null }
          : { matches: [], follow_up_question: 'Where in Bengaluru do you live?' })));
    vi.stubGlobal('fetch', fetchMock);
    const user = await listen('en');
    emit([['I am a teecher', true]]);
    await user.click(screen.getByRole('button', { name: 'Listening…' }));
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.clear(box);
    await user.type(box, 'I am a cook');
    expect(textBox()).toBe('I am a cook');
    fetchMock.mockClear();
    await user.click(screen.getByRole('button', { name: /Find Jobs/ }));
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const extract = calls.find(([url]) => url.includes('extract-profile')) as [string, RequestInit];
    expect(JSON.parse(extract[1].body as string).text).toBe('I am a cook');
  });

  it('stopping without new words does not search again', async () => {
    const fetchMock = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const user = await listen('en');
    await user.click(screen.getByRole('button', { name: 'Listening…' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('collapsing partial results', () => {
  it('drops an entry only when the next one repeats it word for word and adds more', async () => {
    const { collapseSegments, sessionText } = await import('../lib/speechText');
    expect(collapseSegments([{ text: 'I', final: true }, { text: 'In Whitefield', final: true }]).map((s) => s.text))
      .toEqual(['I', 'In Whitefield']); // "In" is not "I" + more words
    expect(sessionText([{ text: 'I am', final: false }, { text: 'I am a cook', final: true }]))
      .toEqual({ final: 'I am a cook', interim: '' });
    expect(sessionText([{ text: 'I am a cook', final: true }, { text: 'in Whitefield', final: false }]))
      .toEqual({ final: 'I am a cook', interim: 'in Whitefield' });
  });
});
