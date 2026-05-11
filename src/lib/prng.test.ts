import { describe, it, expect } from 'vitest';
import { mulberry32 } from './prng';

const take = (rng: () => number, n: number): number[] =>
  Array.from({ length: n }, () => rng());

describe('mulberry32', () => {
  it('returns the same first 100 values for the same seed', () => {
    const a = take(mulberry32(42), 100);
    const b = take(mulberry32(42), 100);
    expect(a).toEqual(b);
  });

  it('diverges for different seeds', () => {
    const a = take(mulberry32(1), 100);
    const b = take(mulberry32(2), 100);
    expect(a).not.toEqual(b);
    // sanity: at least one position differs
    expect(a.some((v, i) => v !== b[i])).toBe(true);
  });

  it('produces values strictly in [0, 1)', () => {
    const rng = mulberry32(0xdeadbeef);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('handles edge-case seed 0 deterministically', () => {
    const a = take(mulberry32(0), 10);
    const b = take(mulberry32(0), 10);
    expect(a).toEqual(b);
    expect(a.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('handles large seed values', () => {
    const rng = mulberry32(0xffffffff);
    const values = take(rng, 50);
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    // Distribution sanity: mean should be roughly 0.5 over 50 samples (loose bound)
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    expect(mean).toBeGreaterThan(0.2);
    expect(mean).toBeLessThan(0.8);
  });
});
