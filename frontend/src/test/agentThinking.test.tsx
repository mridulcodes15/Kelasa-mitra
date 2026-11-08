import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { AGENT_STEPS, AgentPanel } from '../components/AgentPanel';
import { strings } from '../lib/i18n';
import { useAppStore } from '../store/appStore';

const rules = { source: 'rules' as const, reply: null, reason: 'not_configured', thread_id: null };

describe.each(['en', 'kn', 'hi'] as const)('agent thinking state in %s', (lang) => {
  it('shows three dots labelled with the tool steps', () => {
    useAppStore.setState({ lang, isAskingAgent: true });
    const { container } = render(<AgentPanel />);
    expect(screen.getByRole('status').textContent).toBe(strings[lang].agentThinking);
    const steps = screen.getByRole('list', { name: strings[lang].agentStepsLabel });
    const items = within(steps).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(
      AGENT_STEPS.map((s) => strings[lang][s.label] + s.tool),
    );
    const dots = container.querySelectorAll('.thinking-dot');
    expect(dots).toHaveLength(3);
    dots.forEach((d) => expect(d.getAttribute('aria-hidden')).toBe('true'));
  });
});

describe('agent thinking state', () => {
  it('names the three tools in the order the agent calls them', () => {
    expect(AGENT_STEPS.map((s) => s.tool)).toEqual(['extract_profile', 'find_matches', 'skill_gap']);
    expect(strings.en.agentStepProfile).toBe('Reading your profile');
    expect(strings.en.agentStepJobs).toBe('Finding jobs');
    expect(strings.en.agentStepSkills).toBe('Checking skills');
  });

  it('is replaced by the reply', () => {
    useAppStore.setState({ isAskingAgent: true });
    const { container } = render(<AgentPanel />);
    act(() => useAppStore.setState({
      isAskingAgent: false,
      agentReply: { source: 'agent', reply: 'Cook at Fixture Canteen', reason: null, thread_id: 't' },
    }));
    expect(container.querySelector('[data-agent-thinking]')).toBeNull();
    expect(screen.getByRole('region', { name: strings.en.agentLabel }).textContent).toContain('Cook at Fixture Canteen');
  });

  it('is replaced by the offline banner when the agent is offline', () => {
    useAppStore.setState({ isAskingAgent: true });
    const { container } = render(<AgentPanel />);
    act(() => useAppStore.setState({ isAskingAgent: false, agentReply: rules }));
    expect(container.querySelector('[data-agent-thinking]')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe(strings.en.agentOffline);
  });

  it('stops the dots under prefers-reduced-motion', () => {
    const css = readFileSync('src/index.css', 'utf-8'); // vitest runs from frontend/
    expect(css).toMatch(/\.thinking-dot\s*{[^}]*animation:\s*thinking-dot/);
    const reduce = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduce).toMatch(/\.thinking-dot[\s,{]/);
  });
});
