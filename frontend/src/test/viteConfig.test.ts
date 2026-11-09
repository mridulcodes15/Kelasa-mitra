import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// vitest runs from frontend/
const CONFIG = readFileSync('vite.config.ts', 'utf-8');

describe('vite dev server', () => {
  it('allows only Cloudflare quick-tunnel hosts besides the defaults', () => {
    const match = CONFIG.match(/allowedHosts:\s*\[([^\]]*)\]/);
    expect(match).not.toBeNull();
    expect(match![1].split(',').map((h) => h.trim()).filter(Boolean)).toEqual(["'.trycloudflare.com'"]);
    expect(CONFIG).not.toMatch(/allowedHosts:\s*true/);
  });

  it('still proxies /api to the local backend', () => {
    expect(CONFIG).toMatch(/'\/api':\s*{\s*target:\s*'http:\/\/localhost:8000'/);
  });
});
