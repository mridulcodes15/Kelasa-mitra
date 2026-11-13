import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { useAppStore } from '../store/appStore';

function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }));
}

beforeEach(() => {
  stubMatchMedia(false);
  // jsdom has no Web Animations API.
  Element.prototype.animate = vi.fn(() => ({ cancel: () => {} })) as unknown as Element['animate'];
  try {
    window.localStorage.clear(); // saved jobs and settings never leak between tests
  } catch {
    // storage stubbed out by a test
  }
  useAppStore.setState(useAppStore.getInitialState(), true);
  MotionGlobalConfig.skipAnimations = false;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

export { stubMatchMedia };
