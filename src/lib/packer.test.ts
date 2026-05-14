import { describe, it, expect } from 'vitest';
import { packCircles } from './packer';
import { mulberry32 } from './prng';

const EPS = 1e-3;

describe('packCircles', () => {
  it.each([3, 4, 6, 8])(
    'packs %i circles inside the unit parent without overlap',
    (k) => {
      const rng = mulberry32(1234 + k);
      const circles = packCircles(k, rng);
      expect(circles.length).toBe(k);
      // all child circles fully inside the parent (centred at origin, radius 1)
      for (const c of circles) {
        const distFromCentre = Math.hypot(c.x, c.y);
        expect(distFromCentre + c.r).toBeLessThanOrEqual(1 + EPS);
        expect(c.r).toBeGreaterThan(0);
      }
      // pairwise non-overlap
      for (let i = 0; i < circles.length; i++) {
        for (let j = i + 1; j < circles.length; j++) {
          const a = circles[i]!;
          const b = circles[j]!;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          expect(d).toBeGreaterThanOrEqual(a.r + b.r - EPS);
        }
      }
    },
  );

  it('achieves reasonable packing density', () => {
    const rng = mulberry32(99);
    const circles = packCircles(8, rng);
    const totalArea = circles.reduce((s, c) => s + Math.PI * c.r * c.r, 0);
    const parentArea = Math.PI; // r = 1
    const density = totalArea / parentArea;
    // Loose lower bound — relaxed packing should beat a trivial layout.
    expect(density).toBeGreaterThan(0.25);
  });

  it('produces identical output for the same seed', () => {
    const a = packCircles(6, mulberry32(42));
    const b = packCircles(6, mulberry32(42));
    expect(a).toEqual(b);
  });

  it('completes within 100ms for k=8', () => {
    const start = performance.now();
    packCircles(8, mulberry32(7));
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('handles the edge case of a single circle (k=1)', () => {
    const [c] = packCircles(1, mulberry32(0));
    expect(c).toBeDefined();
    expect(Math.hypot(c!.x, c!.y) + c!.r).toBeLessThanOrEqual(1 + EPS);
  });

  it('rejects non-positive k', () => {
    expect(() => packCircles(0, mulberry32(0))).toThrow();
    expect(() => packCircles(-1, mulberry32(0))).toThrow();
  });
});
