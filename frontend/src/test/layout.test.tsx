import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import App from '../App';
import { stubMatchMedia } from './setup';
import { readFileSync } from 'node:fs';

// Vitest stubs CSS imports (even ?raw), so read the stylesheet from disk.
const CSS = readFileSync('src/index.css', 'utf-8') // vitest runs from frontend/;

function mediaBlock(query: string): string {
  const start = CSS.indexOf(`@media (${query})`);
  expect(start, query).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = CSS.indexOf('{', start); i < CSS.length; i++) {
    if (CSS[i] === '{') depth++;
    if (CSS[i] === '}' && --depth === 0) return CSS.slice(start, i + 1);
  }
  throw new Error('unclosed block');
}

describe('app frame', () => {
  it('puts every screen inside one app column', () => {
    render(<App />);
    const column = screen.getByTestId('app-column');
    expect(column.className).toContain('app-column');
    expect(column.querySelector('main')).not.toBeNull();
  });

  it('is full width on phones and a centred 440px column from 600px', () => {
    const wide = mediaBlock('min-width: 600px');
    expect(wide).toMatch(/\.app-column\s*{[^}]*max-width:\s*440px/);
    expect(wide).toMatch(/\.app-backdrop\s*{[^}]*radial-gradient/);
    // Outside the media query the column sets no width limit.
    const outside = CSS.replace(wide, '');
    expect(outside).not.toMatch(/\.app-column\s*{[^}]*max-width/);
  });

  it('clips instead of scrolling sideways', () => {
    expect(CSS).toMatch(/\.app-column\s*{[^}]*overflow:\s*clip/);
  });
});

describe('reduced motion', () => {
  it('turns every Framer Motion animation off under prefers-reduced-motion', () => {
    stubMatchMedia(true);
    render(<App />);
    expect(MotionGlobalConfig.skipAnimations).toBe(true);
  });

  it('leaves animations on otherwise', () => {
    render(<App />);
    expect(MotionGlobalConfig.skipAnimations).toBe(false);
  });

  it('stops every CSS animation in the stylesheet under reduce', () => {
    const reduce = mediaBlock('prefers-reduced-motion: reduce');
    const animated = [...CSS.replace(reduce, '').matchAll(/\.([\w-]+)\s*{[^}]*animation:/g)].map((m) => m[1]);
    expect(animated.length).toBeGreaterThan(0);
    for (const name of animated) expect(reduce, name).toContain(`.${name}`);
  });
});
