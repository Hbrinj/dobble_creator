import { describe, it, expect } from 'vitest';

describe('scaffold', () => {
  it('runs Vitest under a configured environment', () => {
    expect(import.meta).toBeDefined();
  });

  it('exposes the jsdom DOM globals', () => {
    expect(typeof document).toBe('object');
    expect(typeof window).toBe('object');
  });
});
