import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobCard } from '../components/JobCard';
import { Landing } from '../pages/Landing';
import { strings } from '../lib/i18n';
import { ApiError, extractProfile } from '../lib/api';
import { useAppStore } from '../store/appStore';
import { jobMatch } from './fixtures';

const noop = () => {};

describe.each(['en', 'kn', 'hi'] as const)('public demo note in %s', (lang) => {
  it('sits right under the sample-data label on a job card', () => {
    useAppStore.setState({ lang });
    const { container } = render(<JobCard match={jobMatch()} isTop onSave={noop} onSkip={noop} />);
    const note = container.querySelector('[data-demo-note]') as HTMLElement;
    expect(note.textContent).toContain(strings[lang].demoNote);
    expect(note.className).toContain('text-xs');
    const label = screen.getByText(strings[lang].sampleData);
    expect(label.nextElementSibling).toBe(note);
  });

  it('is shown under the text box on the first screen', () => {
    useAppStore.setState({ lang });
    const { container } = render(<Landing />);
    const note = container.querySelector('[data-demo-note]') as HTMLElement;
    expect(note.textContent).toContain(strings[lang].demoNote);
    expect(note.previousElementSibling?.tagName).toBe('FORM');
  });
});

describe('too many requests', () => {
  it('a 429 from the backend is an ApiError with its status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"detail":"Too many requests"}', { status: 429 })));
    const error = await extractProfile('x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(429);
  });

  it.each(['en', 'kn', 'hi'] as const)('shows a short message in %s instead of the raw error', async (lang) => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('agent')
      ? new Response(JSON.stringify({ source: 'rules', reply: null, reason: 'x', thread_id: null }))
      : new Response('{"detail":"Too many requests"}', { status: 429 }))));
    useAppStore.setState({ lang });
    const user = userEvent.setup();
    render(<Landing />);
    await user.type(screen.getByRole('textbox'), 'I am a cook');
    await user.click(screen.getByRole('button', { name: strings[lang].findJobs }));
    await waitFor(() => expect(screen.getByText(strings[lang].tooManyRequests)).toBeTruthy());
    expect(screen.queryByText(/429/)).toBeNull();
  });

  it('other errors still show their message', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('agent')
      ? new Response(JSON.stringify({ source: 'rules', reply: null, reason: 'x', thread_id: null }))
      : new Response('boom', { status: 500 }))));
    const user = userEvent.setup();
    render(<Landing />);
    await user.type(screen.getByRole('textbox'), 'I am a cook');
    await user.click(screen.getByRole('button', { name: /Find Jobs/ }));
    await waitFor(() => expect(screen.getByText(/Profile extraction failed: 500/)).toBeTruthy());
  });
});
