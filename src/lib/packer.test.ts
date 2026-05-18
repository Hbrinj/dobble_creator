import { describe, it, expect } from 'vitest';
import {
  packCircles,
  PackingDidNotConvergeError,
  OVERLAP_TOLERANCE,
  MAX_RETRIES,
  __testing,
} from './packer';
import { mulberry32 } from './prng';

const EPS = 1e-3;

describe('packCircles', () => {
  // The 200-seed sweep is the load-bearing assertion that future density
  // changes can't silently regress: at PACKING_FRACTION=0.65 the relaxation
  // loop fails to converge on ~12% of seeds at k=8 (Decision 10), and the
  // retry-with-fresh-seed policy in Decision 13 must collapse that to zero
  // observable failures across the production deck orders.
  it.each([8, 13])(
    'produces non-overlapping output across 200 seeds for k=%i at PACKING_FRACTION=0.65',
    (k) => {
      for (let s = 0; s < 200; s++) {
        const rng = mulberry32(s);
        const circles = packCircles(k, rng);
        expect(circles.length).toBe(k);
        // Every child fully inside the parent (centre at origin, radius 1).
        for (const c of circles) {
          const distFromCentre = Math.hypot(c.x, c.y);
          expect(distFromCentre + c.r).toBeLessThanOrEqual(1 + EPS);
          expect(c.r).toBeGreaterThan(0);
        }
        // Worst pair-overlap below the tolerance Decision 13 pins.
        let worst = 0;
        for (let i = 0; i < circles.length; i++) {
          for (let j = i + 1; j < circles.length; j++) {
            const a = circles[i]!;
            const b = circles[j]!;
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            const overlap = a.r + b.r - d;
            if (overlap > worst) worst = overlap;
          }
        }
        expect(worst).toBeLessThan(OVERLAP_TOLERANCE);
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

  it('produces identical output for the same caller-supplied rng across retries', () => {
    // Even when the retry chain kicks in for some seeds, the chain itself is
    // derived from the caller's rng — so two invocations with the same seed
    // must yield byte-identical output (Decision 13: determinism preserved).
    const a = packCircles(8, mulberry32(42));
    const b = packCircles(8, mulberry32(42));
    expect(a).toEqual(b);
  });

  it('exports PackingDidNotConvergeError and throws it when every retry fails', () => {
    // Monkey-patch the per-attempt packing primitive via the test-only
    // `__testing` export so every attempt deterministically produces an
    // overlapping layout. The retry loop in `packCircles` is the unit under
    // test here — we want to assert it exhausts MAX_RETRIES and surfaces a
    // typed error, not the relaxation math. Documented as test-only on the
    // export itself.
    const k = 13;
    const pathological = (): { x: number; y: number; r: number }[] =>
      // Two co-centred circles of radius 0.4 → guaranteed overlap of 0.8,
      // far above OVERLAP_TOLERANCE. Padded out to `k` entries by repeating
      // the same overlapping pair pattern.
      Array.from({ length: k }, (_, i) => ({
        x: i % 2 === 0 ? 0 : 0.01,
        y: 0,
        r: 0.4,
      }));
    const restore = __testing.setAttemptPacking(pathological);
    try {
      let thrown: unknown = null;
      try {
        packCircles(k, mulberry32(1));
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(PackingDidNotConvergeError);
      const err = thrown as PackingDidNotConvergeError;
      expect(err.k).toBe(k);
      expect(err.attempts).toBe(MAX_RETRIES);
      expect(err.name).toBe('PackingDidNotConvergeError');
    } finally {
      restore();
    }
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

  describe('insetFraction', () => {
    it('keeps every circle inside the inset boundary (1 - insetFraction) at k=8 across 50 seeds', () => {
      const inset = 0.15;
      const effective = 1 - inset;
      for (let s = 0; s < 50; s++) {
        const rng = mulberry32(s);
        const circles = packCircles(8, rng, inset);
        expect(circles.length).toBe(8);
        for (const c of circles) {
          // Hard boundary: centre distance + radius must not exceed the
          // (1 - insetFraction) effective parent radius beyond float noise.
          expect(Math.hypot(c.x, c.y) + c.r).toBeLessThanOrEqual(
            effective + EPS,
          );
          expect(c.r).toBeGreaterThan(0);
        }
      }
    });

    it('produces byte-identical output to the no-arg call when insetFraction is 0 (regression guard)', () => {
      // The no-margin path must compute exactly the same baseRadius and apply
      // exactly the same boundary checks as the pre-feature implementation —
      // this guards the deterministic seed contract for users who opt out.
      const k = 8;
      const seed = 123;
      const withoutArg = packCircles(k, mulberry32(seed));
      const withZero = packCircles(k, mulberry32(seed), 0);
      expect(withZero).toEqual(withoutArg);
    });
  });
});
