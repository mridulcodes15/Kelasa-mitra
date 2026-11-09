import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Landing } from '../pages/Landing';
import { useAppStore } from '../store/appStore';
import { profile } from './fixtures';

const QUESTION = 'Where in Bengaluru do you live?';

class FakeRecognition {
  static last: FakeRecognition;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.onstart?.();
  }
  stop() {
    this.onend?.();
  }
}

function stubApi() {
  const fetchMock = vi.fn(async (url: string) => {
    const body = url.includes('extract-profile')
      ? { ...profile, area: null }
      : { matches: [], follow_up_question: QUESTION };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('follow-up question', () => {
  // These tests render the mic screen directly: start past the welcome screen.
  beforeEach(() => useAppStore.setState({ screen: 'landing' }));

  it('appears on screen and focuses the mic', async () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    stubApi();
    const user = userEvent.setup();
    render(<Landing />);

    await user.type(screen.getByRole('textbox'), 'I am a cook');
    await user.click(screen.getByRole('button', { name: /Find Jobs/ }));

    expect(await screen.findByText(new RegExp(QUESTION))).toBeTruthy();
    expect(useAppStore.getState().screen).toBe('landing');
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tap to Speak' }));
    });
  });

  it('focuses the text box when the browser has no speech recognition', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<Landing />);

    await user.type(screen.getByRole('textbox'), 'I am a cook');
    await user.click(screen.getByRole('button', { name: /Find Jobs/ }));

    await screen.findByText(new RegExp(QUESTION));
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('textbox'));
    });
  });

  it('keeps earlier text when the worker answers by voice', async () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    const fetchMock = stubApi();
    useAppStore.setState({ transcript: 'I am a cook', followUpQuestion: QUESTION });
    const user = userEvent.setup();
    render(<Landing />);

    await user.click(screen.getByRole('button', { name: 'Tap to Speak' }));
    const recognition = FakeRecognition.last as unknown as {
      onresult: (event: unknown) => void;
    };
    act(() => {
      recognition.onresult({
        resultIndex: 0,
        results: [Object.assign([{ transcript: 'in Whitefield' }], { isFinal: true })],
      });
    });
    await user.click(screen.getByRole('button', { name: 'Listening…' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(init[1].body as string) as { text: string };
    expect(sent.text).toContain('I am a cook');
    expect(sent.text).toContain('in Whitefield');
  });

  it('shows nothing when there is no question', () => {
    render(<Landing />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
