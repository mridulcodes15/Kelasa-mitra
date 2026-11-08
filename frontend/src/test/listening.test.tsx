import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Landing } from '../pages/Landing';
import { ListeningWave, WAVE_BARS } from '../components/ListeningWave';

class FakeRecognition {
  static last: FakeRecognition;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((event: unknown) => void) | null = null;
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

function hear(text: string, isFinal: boolean) {
  act(() => {
    FakeRecognition.last.onresult?.({
      resultIndex: 0,
      results: [Object.assign([{ transcript: text }], { isFinal })],
    });
  });
}

async function startListening() {
  vi.stubGlobal('SpeechRecognition', FakeRecognition);
  const user = userEvent.setup();
  const view = render(<Landing />);
  await user.click(screen.getByRole('button', { name: 'Tap to Speak' }));
  return { user, ...view };
}


describe('listening waveform', () => {
  it('shows only while recording', async () => {
    const { user, container } = await startListening();
    expect(container.querySelector('[data-listening-wave]')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Listening…' }));
    expect(container.querySelector('[data-listening-wave]')).toBeNull();
  });

  it('is decorative: hidden from screen readers, no text', () => {
    const { container } = render(<ListeningWave />);
    const wave = container.querySelector('[data-listening-wave]') as HTMLElement;
    expect(wave.getAttribute('aria-hidden')).toBe('true');
    expect(wave.dataset.decorative).toBe('true');
    expect(wave.textContent).toBe('');
    expect(wave.querySelectorAll('.listening-bar')).toHaveLength(WAVE_BARS);
  });

  it('moves in a fixed rhythm set in CSS, stopped under reduced motion', () => {
    const css = readFileSync('src/index.css', 'utf-8'); // vitest runs from frontend/
    expect(css).toMatch(/\.listening-bar\s*{[^}]*animation:\s*listening-wave/);
    const reduce = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduce).toMatch(/\.listening-bar[\s,{]/);
  });
});

describe('live words', () => {
  it('shows words as they are heard, then keeps the confirmed ones', async () => {
    const { container } = await startListening();
    hear('I am a co', false);
    const live = container.querySelector('[data-live-words]') as HTMLElement;
    expect(live.textContent).toContain('I am a co');
    expect(live.className).toContain('text-base');
    hear('I am a cook', true);
    expect(live.textContent).toContain('I am a cook');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toContain('I am a cook');
  });
});
