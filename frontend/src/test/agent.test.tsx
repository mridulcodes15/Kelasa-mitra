import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentPanel } from '../components/AgentPanel';
import { agentChat } from '../lib/api';
import { strings } from '../lib/i18n';
import { useProfile } from '../hooks/useProfile';
import { useAppStore } from '../store/appStore';
import { jobMatch, profile } from './fixtures';

const rules = { source: 'rules' as const, reply: null, reason: 'not_configured', thread_id: null };

describe('AgentPanel', () => {
  it('renders nothing before any request', () => {
    const { container } = render(<AgentPanel />);
    expect(container.textContent).toBe('');
  });

  it.each(['en', 'kn', 'hi'] as const)('shows the offline banner in %s when the rules answered', (lang) => {
    useAppStore.setState({ lang, agentReply: rules });
    render(<AgentPanel />);
    expect(screen.getByRole('status').textContent).toBe(strings[lang].agentOffline);
  });

  it('shows the agent reply with its label and a sample-data note', () => {
    useAppStore.setState({ agentReply: { source: 'agent', reply: 'line one\nline two', reason: null, thread_id: 't' } });
    render(<AgentPanel />);
    const panel = screen.getByRole('region', { name: strings.en.agentLabel });
    expect(panel.textContent).toContain('line one');
    expect(panel.textContent).toContain(strings.en.sampleData);
  });

  it('does not repeat a reply that is already on screen', () => {
    useAppStore.setState({ agentReply: { source: 'agent', reply: 'Where do you live?', reason: null, thread_id: null } });
    const { container } = render(<AgentPanel hideReplyEqualTo="Where do you live?" />);
    expect(container.textContent).toBe('');
  });

  it('shows a waiting line while the agent is asked', () => {
    useAppStore.setState({ isAskingAgent: true });
    render(<AgentPanel />);
    expect(screen.getByRole('status').textContent).toBe(strings.en.agentThinking);
  });
});

describe('agentChat', () => {
  it('posts the text and language to our backend only', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(rules)));
    vi.stubGlobal('fetch', fetchMock);
    await agentChat('I am a cook', 'kn');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/agent/chat');
    expect(JSON.parse(init.body as string)).toEqual({ text: 'I am a cook', ui_language: 'kn' });
  });

  it('treats an unreachable backend as the rules', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await agentChat('x', 'en')).toMatchObject({ source: 'rules', reason: 'backend_unreachable' });
  });
});

describe('agent alongside the deterministic pipeline', () => {
  function Runner() {
    const { runExtraction } = useProfile();
    return <button onClick={() => void runExtraction('I am a cook in Whitefield')}>run</button>;
  }

  it('shows cards from the backend endpoints, not from the agent text', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('agent')) {
        return new Response(JSON.stringify({ source: 'agent', reply: 'Invented Job ₹99,999', reason: null, thread_id: 't' }));
      }
      if (url.includes('extract-profile')) return new Response(JSON.stringify(profile));
      if (url.includes('matches')) return new Response(JSON.stringify({ matches: [jobMatch()] }));
      return new Response(JSON.stringify({ gaps: [], is_synthetic: true }));
    }));
    const user = userEvent.setup();
    render(<Runner />);
    await user.click(screen.getByText('run'));
    await waitFor(() => expect(useAppStore.getState().agentReply?.source).toBe('agent'));
    await waitFor(() => expect(useAppStore.getState().matches).toHaveLength(1));
    expect(useAppStore.getState().matches[0].job.title).toBe('Canteen Worker');
  });

  it('keeps working when the agent is offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('agent')) return new Response(JSON.stringify(rules));
      if (url.includes('extract-profile')) return new Response(JSON.stringify(profile));
      if (url.includes('matches')) return new Response(JSON.stringify({ matches: [jobMatch()] }));
      return new Response(JSON.stringify({ gaps: [], is_synthetic: true }));
    }));
    const user = userEvent.setup();
    render(<Runner />);
    await user.click(screen.getByText('run'));
    await waitFor(() => expect(useAppStore.getState().matches).toHaveLength(1));
    await waitFor(() => expect(useAppStore.getState().agentReply?.source).toBe('rules'));
  });
});
