import { describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { agentChat, extractProfile, fetchMatches, fetchSkillGap } from '../lib/api';
import { useCountUp } from '../lib/motion';
import { useSpeech } from '../hooks/useSpeech';
import { Jobs } from '../pages/Jobs';
import { useAppStore } from '../store/appStore';
import { jobMatch, profile } from './fixtures';
import { stubMatchMedia } from './setup';

// ── One POST helper for every endpoint ───────────────────────────────────────

describe('api helpers', () => {
  function stub(status = 200, body: unknown = { ok: true }) {
    const fetchMock = vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it.each([
    ['extractProfile', () => extractProfile('I am a cook', 'kn'), '/api/profile/extract-profile', { text: 'I am a cook', ui_language: 'kn' }],
    ['extractProfile without a language', () => extractProfile('x'), '/api/profile/extract-profile', { text: 'x', ui_language: null }],
    ['fetchMatches', () => fetchMatches(profile), '/api/matches', { profile }],
    ['fetchSkillGap', () => fetchSkillGap(profile), '/api/skill-gap', { profile }],
  ] as const)('%s posts JSON to the right path', async (_, call, path, body) => {
    const fetchMock = stub();
    await call();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(path);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it.each([
    [() => extractProfile('x'), 'Profile extraction failed: 422 — too long'],
    [() => fetchMatches(profile), 'Match fetch failed: 422 — too long'],
    [() => fetchSkillGap(profile), 'Skill gap fetch failed: 422 — too long'],
  ])('keeps the error message for a failed request (%#)', async (call, message) => {
    stub(422, 'too long');
    await expect(call()).rejects.toThrow(message);
  });

  it('agentChat still turns any failure into the rules answer', async () => {
    stub(500, 'boom');
    expect(await agentChat('x', 'en')).toEqual({ source: 'rules', reply: null, reason: 'backend_unreachable', thread_id: null });
  });
});

// ── Count-up without setState inside the effect body ─────────────────────────

describe('useCountUp', () => {
  it('starts again from 0 for a new target and reaches it', async () => {
    const { result, rerender } = renderHook(({ to }) => useCountUp(to, 30), { initialProps: { to: 5 } });
    await waitFor(() => expect(result.current).toBe(5));
    rerender({ to: 9 });
    expect(result.current).toBe(0);
    await waitFor(() => expect(result.current).toBe(9));
  });

  it('returns the target at once under reduced motion, also for a new target', () => {
    stubMatchMedia(true);
    const { result, rerender } = renderHook(({ to }) => useCountUp(to), { initialProps: { to: 5 } });
    expect(result.current).toBe(5);
    rerender({ to: 9 });
    expect(result.current).toBe(9);
  });
});

// ── Speech: the latest callback is used (the ref is updated after render) ─────

describe('useSpeech callback', () => {
  class FakeRecognition {
    static last: FakeRecognition;
    onstart: (() => void) | null = null;
    onresult: ((e: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    constructor() { FakeRecognition.last = this; }
    start() { this.onstart?.(); }
    stop() { this.onend?.(); }
  }

  it('sends results to the newest onFinalResult', () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useSpeech('en', cb), { initialProps: { cb: first } });
    act(() => result.current.startListening());
    rerender({ cb: second });
    act(() => {
      FakeRecognition.last.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: 'cook' }], { isFinal: true })] });
    });
    expect(second).toHaveBeenCalledWith('cook');
    expect(first).not.toHaveBeenCalled();
  });
});

// ── Jobs deck resets for new matches without an effect ───────────────────────

describe('Jobs deck', () => {
  it('starts a fresh deck and saved count when new matches arrive', async () => {
    useAppStore.setState({ matches: [jobMatch(1, 'a'), jobMatch(1, 'b')], profile });
    render(<Jobs />);
    act(() => screen.getByRole('button', { name: 'Save this job' }).click());
    expect(screen.getByText('Saved: 1')).toBeTruthy();
    act(() => useAppStore.setState({ matches: [jobMatch(1, 'c'), jobMatch(1, 'd'), jobMatch(1, 'e')] }));
    expect(screen.queryByText('Saved: 1')).toBeNull();
    expect(screen.getByText('Jobs found: 3')).toBeTruthy();
    // The old cards leave through AnimatePresence; the new deck has three.
    await waitFor(() => expect(document.querySelectorAll('[data-depth]')).toHaveLength(3));
  });
});
