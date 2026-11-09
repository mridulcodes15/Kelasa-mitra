import { describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Landing } from '../pages/Landing';
import { AgentPanel } from '../components/AgentPanel';
import { STOP_GRACE_MS } from '../hooks/useSpeech';
import { useProfile } from '../hooks/useProfile';
import { strings } from '../lib/i18n';
import { useAppStore } from '../store/appStore';
import type { WorkerProfile } from '../lib/types';
import { profile } from './fixtures';

/**
 * The search, the "not recognised" card and the agent panel must agree with the text on
 * screen: the search runs on the final transcript, a new search clears the last answer, an
 * older search never overwrites a newer one, and the rules' card is preferred to the agent's
 * generic question.
 */

const UNKNOWN_WORK = 'I did not recognise that kind of work yet. This demo covers jobs like these - tap one or say it again.';
const GENERIC = 'What kind of work have you done? (e.g. cooking, security, delivery, tailoring)';
const noSkill: WorkerProfile = { ...profile, skills: [], raw_input: 'I am a teacher in Whitefield' };

type Mode = 'finalOnStop' | 'endOnly' | 'neverEnds';

/** Android-like recognition: what happens when stop() is called depends on the mode. */
class FakeRecognition {
  static all: FakeRecognition[] = [];
  static mode: Mode = 'finalOnStop';
  lang = '';
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  pending = '';
  constructor() { FakeRecognition.all.push(this); }
  start() { this.onstart?.(); }
  stop() {
    if (FakeRecognition.mode === 'neverEnds') return;
    // The browser confirms the words still in progress only after stop, then ends.
    if (FakeRecognition.mode === 'finalOnStop') this.result(this.pending, true);
    this.onend?.();
  }
  result(text: string, final: boolean) {
    this.pending = text;
    this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: final })] });
  }
}

function stubFetch(extract: (text: string) => WorkerProfile | Promise<WorkerProfile>, followUp: string | null = null) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('extract-profile')) {
      return new Response(JSON.stringify(await extract(JSON.parse(init?.body as string).text)));
    }
    if (url.includes('agent')) {
      return new Response(JSON.stringify({ source: 'rules', reply: null, reason: 'x', thread_id: null }));
    }
    if (url.includes('match')) {
      const body = JSON.parse(init?.body as string) as WorkerProfile;
      return new Response(JSON.stringify(body.skills.length === 0
        ? { matches: [], follow_up_question: followUp ?? UNKNOWN_WORK }
        : { matches: [], follow_up_question: null }));
    }
    return new Response('{}');
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function extractTexts(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return (fetchMock.mock.calls as unknown as [string, RequestInit][])
    .filter(([url]) => url.includes('extract-profile'))
    .map(([, init]) => JSON.parse(init.body as string).text);
}

async function speak(words: string, mode: Mode) {
  FakeRecognition.all = [];
  FakeRecognition.mode = mode;
  vi.stubGlobal('SpeechRecognition', FakeRecognition);
  useAppStore.setState({ screen: 'landing', lang: 'en' });
  const user = userEvent.setup();
  render(<Landing />);
  await user.click(screen.getByRole('button', { name: strings.en.tapToSpeak }));
  const rec = FakeRecognition.all[FakeRecognition.all.length - 1];
  act(() => rec.result(words, false)); // still interim when the worker taps stop
  await user.click(screen.getByRole('button', { name: strings.en.listening }));
}

describe('the search runs on the final transcript', () => {
  it('includes words the browser confirms only after stop', async () => {
    const fetchMock = stubFetch(() => profile);
    await speak('I am a cook in Whitefield', 'finalOnStop');
    await waitFor(() => expect(extractTexts(fetchMock)).toEqual(['I am a cook in Whitefield']));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value.trim()).toBe('I am a cook in Whitefield');
  });

  it('includes words still unconfirmed when the session ends', async () => {
    const fetchMock = stubFetch(() => profile);
    await speak('I am a cook in Whitefield', 'endOnly');
    await waitFor(() => expect(extractTexts(fetchMock)).toEqual(['I am a cook in Whitefield']));
  });

  it('still searches if the browser never ends the session', async () => {
    const fetchMock = stubFetch(() => profile);
    await speak('I am a cook in Whitefield', 'neverEnds');
    expect(extractTexts(fetchMock)).toEqual([]);
    await waitFor(() => expect(extractTexts(fetchMock)).toEqual(['I am a cook in Whitefield']),
      { timeout: STOP_GRACE_MS + 1000 });
  });
});

describe('a new search clears the last answer', () => {
  it('removes the not-recognised card and the previous agent reply at once', async () => {
    stubFetch(() => new Promise(() => {})); // the new search is still running
    useAppStore.setState({
      screen: 'landing', lang: 'en', transcript: 'I am an electrician in Whitefield ',
      profile: noSkill, followUpQuestion: UNKNOWN_WORK,
      agentReply: { source: 'agent', reply: 'Tell me more about your work.', reason: null, thread_id: 't' },
    });
    const user = userEvent.setup();
    render(<Landing />);
    expect(screen.getByText(UNKNOWN_WORK, { exact: false })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: strings.en.findJobs }));
    expect(screen.queryByText(UNKNOWN_WORK, { exact: false })).toBeNull();
    expect(screen.queryByRole('group', { name: strings.en.skillChipsLabel })).toBeNull();
    expect(useAppStore.getState().agentReply?.reply).not.toBe('Tell me more about your work.');
    expect(screen.queryByText('Tell me more about your work.')).toBeNull();
  });
});

describe('never "not recognised" next to a recognised skill', () => {
  it('an older, slower search with no skill cannot overwrite the newer one', async () => {
    let releaseOld: (p: WorkerProfile) => void = () => {};
    stubFetch((text) => (text.includes('teacher')
      ? new Promise<WorkerProfile>((resolve) => { releaseOld = resolve; })
      : { ...profile, raw_input: text }));
    useAppStore.setState({ screen: 'landing', lang: 'en' });
    const { result } = renderHook(() => useProfile());
    // e.g. a typed search, then the mic (the search button is disabled while one runs)
    void act(() => { void result.current.runExtraction('I am a teacher in Whitefield'); });
    await act(async () => { await result.current.runExtraction('I am a cook in Whitefield'); });
    render(<Landing />);
    await waitFor(() => expect(useAppStore.getState().profile?.skills).toEqual(['cook']));
    await act(async () => releaseOld(noSkill)); // the old answer arrives last
    expect(useAppStore.getState().profile?.skills).toEqual(['cook']);
    expect(useAppStore.getState().followUpQuestion).toBeNull();
    expect(screen.queryByText(UNKNOWN_WORK, { exact: false })).toBeNull();
  });
});

describe('the rules\' not-recognised card is preferred to the agent', () => {
  const agentGeneric = { source: 'agent' as const, reply: GENERIC, reason: null, thread_id: 't' };

  it('hides an agent reply asking the generic question next to the card', () => {
    useAppStore.setState({
      screen: 'landing', lang: 'en', transcript: 'I am a teacher in Whitefield ',
      profile: noSkill, followUpQuestion: UNKNOWN_WORK, agentReply: agentGeneric,
    });
    render(<Landing />);
    expect(screen.getByText(UNKNOWN_WORK, { exact: false })).toBeTruthy();
    expect(screen.queryByText(GENERIC)).toBeNull();
    expect(screen.queryByRole('region', { name: strings.en.agentLabel })).toBeNull();
  });

  it('still shows the agent reply when there is no not-recognised card', () => {
    useAppStore.setState({ agentReply: agentGeneric });
    render(<AgentPanel preferRulesMessage={false} />);
    expect(screen.getByRole('region', { name: strings.en.agentLabel }).textContent).toContain(GENERIC);
  });

  it('keeps the offline banner (it asks nothing)', () => {
    useAppStore.setState({ agentReply: { source: 'rules', reply: null, reason: 'x', thread_id: null } });
    render(<AgentPanel preferRulesMessage />);
    expect(screen.getByRole('status').textContent).toBe(strings.en.agentOffline);
  });
});
