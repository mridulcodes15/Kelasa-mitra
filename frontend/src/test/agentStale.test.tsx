import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { useAppStore } from '../store/appStore';
import { strings } from '../lib/i18n';
import { jobMatch, profile } from './fixtures';
import { stubMatchMedia } from './setup';

const QUESTION = 'Where in Bengaluru do you live? (e.g. Whitefield, Koramangala, Jayanagar)';
const JOBS_REPLY = 'Cook (Jayanagar Meals Kitchen Co.): Matched because you have cooking experience.';

/**
 * A fake backend. The agent answers like the real one: the follow-up question when the text has
 * no area, job lines when it does. Each agent reply waits until the test releases it.
 */
function fakeBackend() {
  const pending: { text: string; release: () => void }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    const hasArea = (t: string) => /jayanagar/i.test(t);
    if (url.includes('agent/chat')) {
      await new Promise<void>((release) => {
        pending.push({ text: body.text, release });
      });
      const reply = hasArea(body.text) ? JOBS_REPLY : QUESTION;
      return new Response(JSON.stringify({ source: 'agent', reply, reason: null, thread_id: 't' }));
    }
    if (url.includes('extract-profile')) {
      const area = hasArea(body.text) ? { id: 'jayanagar', name: 'Jayanagar', lat: 12.925, lon: 77.5938 } : null;
      return new Response(JSON.stringify({ ...profile, area, raw_input: body.text }));
    }
    if (url.includes('/matches')) {
      return new Response(JSON.stringify(body.profile.area
        ? { matches: [jobMatch(1, 'a'), jobMatch(2, 'b')], follow_up_question: null }
        : { matches: [], follow_up_question: QUESTION }));
    }
    return new Response(JSON.stringify({ gaps: [], is_synthetic: true }));
  }));
  const releaseFor = async (match: RegExp) => {
    const i = pending.findIndex((p) => match.test(p.text));
    const [p] = pending.splice(i, 1);
    await act(async () => { p.release(); });
  };
  return { pending, releaseFor };
}

function agentPanelText(): string {
  return screen.queryByRole('region', { name: strings.en.agentLabel })?.textContent ?? '';
}

async function askWithoutArea(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox'), 'I am a cook');
  await user.click(screen.getByRole('button', { name: /Find Jobs/ }));
  await screen.findByText(new RegExp('Where in Bengaluru'));
}

async function answerByTyping(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox'), ' in Jayanagar');
  await user.click(screen.getByRole('button', { name: /Find Jobs/ }));
}

async function answerByChip(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Jayanagar' }));
}

async function onJobsScreen() {
  await waitFor(() => expect(useAppStore.getState().screen).toBe('jobs'));
  await screen.findByText(/Jobs found/);
}

// Framer Motion's exit animations need real frames; skip them so the screen change is immediate.
function instantMotion() {
  stubMatchMedia(true);
}

/** Like fakeBackend, but the agent repeats the old question even after the worker answered. */
function agentRepeatsQuestion() {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    const hasArea = /jayanagar/i.test(body.text ?? '');
    if (url.includes('agent/chat')) {
      return new Response(JSON.stringify({ source: 'agent', reply: QUESTION, reason: null, thread_id: 't' }));
    }
    if (url.includes('extract-profile')) {
      const area = hasArea ? { id: 'jayanagar', name: 'Jayanagar', lat: 12.925, lon: 77.5938 } : null;
      return new Response(JSON.stringify({ ...profile, area, raw_input: body.text }));
    }
    if (url.includes('/matches')) {
      return new Response(JSON.stringify(body.profile.area
        ? { matches: [jobMatch(1, 'a'), jobMatch(2, 'b')], follow_up_question: null }
        : { matches: [], follow_up_question: QUESTION }));
    }
    return new Response(JSON.stringify({ gaps: [], is_synthetic: true }));
  }));
}

describe.each([
  ['typing', answerByTyping],
  ['tapping a chip', answerByChip],
] as const)('agent repeats the answered question (answer by %s)', (_, answer) => {
  it('does not show the answered question next to the jobs', async () => {
    instantMotion();
    agentRepeatsQuestion();
    const user = userEvent.setup();
    render(<App />);
    await askWithoutArea(user);
    await answer(user);
    await onJobsScreen();
    await waitFor(() => expect(useAppStore.getState().isAskingAgent).toBe(false));
    expect(useAppStore.getState().agentReply?.reply).toBe(QUESTION); // what the agent said
    expect(agentPanelText()).not.toContain('Where in Bengaluru'); // what the worker sees
  });
});

describe.each([
  ['typing', answerByTyping],
  ['tapping a chip', answerByChip],
] as const)('answering the area question by %s', (_, answer) => {
  it('the question reply arrived first: the jobs screen never shows it', async () => {
    instantMotion();
    const backend = fakeBackend();
    const user = userEvent.setup();
    render(<App />);
    await askWithoutArea(user);
    await backend.releaseFor(/^I am a cook$/);
    await answer(user);
    await onJobsScreen();
    expect(agentPanelText()).not.toContain('Where in Bengaluru');
    await backend.releaseFor(/Jayanagar/);
    await waitFor(() => expect(agentPanelText()).toContain(JOBS_REPLY));
  });

  it('the question reply arrives late: it is dropped, the new reply replaces the thinking state', async () => {
    instantMotion();
    const backend = fakeBackend();
    const user = userEvent.setup();
    render(<App />);
    await askWithoutArea(user);
    await answer(user);
    await onJobsScreen();
    await backend.releaseFor(/^I am a cook$/); // the old reply comes in after the answer
    expect(agentPanelText()).not.toContain('Where in Bengaluru');
    await backend.releaseFor(/Jayanagar/);
    await waitFor(() => expect(agentPanelText()).toContain(JOBS_REPLY));
  });
});

describe('AgentPanel and questions already asked', () => {
  it('hides a reply that repeats an asked question, on any screen', async () => {
    const { AgentPanel } = await import('../components/AgentPanel');
    act(() => useAppStore.getState().setFollowUpQuestion(QUESTION));
    act(() => useAppStore.getState().setFollowUpQuestion(null)); // answered
    useAppStore.setState({ agentReply: { source: 'agent', reply: `  ${QUESTION} `, reason: null, thread_id: 't' } });
    render(<AgentPanel />);
    expect(agentPanelText()).toBe('');
    expect(useAppStore.getState().askedQuestions).toEqual([QUESTION]);
  });

  it('still shows any other reply', async () => {
    const { AgentPanel } = await import('../components/AgentPanel');
    act(() => useAppStore.getState().setFollowUpQuestion(QUESTION));
    useAppStore.setState({ agentReply: { source: 'agent', reply: JOBS_REPLY, reason: null, thread_id: 't' } });
    render(<AgentPanel />);
    expect(agentPanelText()).toContain(JOBS_REPLY);
  });

  it('forgets asked questions when the worker deletes their data', () => {
    act(() => useAppStore.getState().setFollowUpQuestion(QUESTION));
    act(() => useAppStore.getState().deleteMyData());
    expect(useAppStore.getState().askedQuestions).toEqual([]);
  });
});
