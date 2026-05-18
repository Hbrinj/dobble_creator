import { describe, it, expect } from 'vitest';
import {
  computeFillScale,
  clampScale,
  clampPan,
  DEFAULT_PLACEMENT_FACTORS,
  type BackImagePlacement,
} from './backImagePlacement';

describe('computeFillScale', () => {
  it('scales the longer edge to the target diameter (landscape)', () => {
    // 200×100 → max edge 200 → scale 200/200 = 1
    expect(computeFillScale(200, 100, 200)).toBe(1);
  });

  it('scales the longer edge to the target diameter (portrait)', () => {
    // 100×200 → max edge 200 → scale 200/200 = 1
    expect(computeFillScale(100, 200, 200)).toBe(1);
  });

  it('handles a square image (either edge picks)', () => {
    // 50×50 → max edge 50 → scale 200/50 = 4
    expect(computeFillScale(50, 50, 200)).toBe(4);
  });

  it('returns 0 defensively when diameterPx is zero', () => {
    expect(computeFillScale(200, 100, 0)).toBe(0);
  });

  it('returns 0 defensively when either dimension is zero (degenerate image)', () => {
    expect(computeFillScale(0, 100, 200)).toBe(0);
    expect(computeFillScale(200, 0, 200)).toBe(0);
  });
});

describe('clampScale', () => {
  const fillScale = 2;

  it('passes through a value inside [MIN × fill, MAX × fill]', () => {
    expect(clampScale(2, fillScale)).toBe(2);
    expect(clampScale(0.5, fillScale)).toBe(0.5);
    expect(clampScale(15, fillScale)).toBe(15);
  });

  it('clamps below MIN × fill up to MIN × fill', () => {
    // MIN = 0.1, fillScale = 2 → floor = 0.2
    expect(clampScale(0.05, fillScale)).toBeCloseTo(
      DEFAULT_PLACEMENT_FACTORS.MIN * fillScale,
    );
  });

  it('clamps above MAX × fill down to MAX × fill', () => {
    // MAX = 10, fillScale = 2 → ceiling = 20
    expect(clampScale(50, fillScale)).toBeCloseTo(
      DEFAULT_PLACEMENT_FACTORS.MAX * fillScale,
    );
  });

  it('returns 0 when fillScale is 0 (degenerate)', () => {
    expect(clampScale(1, 0)).toBe(0);
  });
});

describe('clampPan', () => {
  // The contract: after scale + translate, the image's rectangular footprint
  // (centred on (offsetX, offsetY) with half-extents (w*scale/2, h*scale/2))
  // must still contain the origin (0, 0). That means
  //   |offsetX| <= w * scale / 2
  //   |offsetY| <= h * scale / 2
  const image = { width: 200, height: 100 };

  it('passes a small offset through unchanged', () => {
    const out = clampPan(
      { offsetX: 10, offsetY: 5 },
      1,
      image,
      200,
    );
    expect(out).toEqual({ offsetX: 10, offsetY: 5 });
  });

  it('clamps a positive-X offset to the image right-edge limit (w*scale/2)', () => {
    // scale=1, w=200 → max |offsetX| = 100
    const out = clampPan({ offsetX: 500, offsetY: 0 }, 1, image, 200);
    expect(out.offsetX).toBe(100);
    expect(out.offsetY).toBe(0);
  });

  it('clamps a negative-X offset to the symmetric left-edge limit', () => {
    const out = clampPan({ offsetX: -500, offsetY: 0 }, 1, image, 200);
    expect(out.offsetX).toBe(-100);
  });

  it('clamps Y the same way using image height (independent axis)', () => {
    // scale=1, h=100 → max |offsetY| = 50
    const outPos = clampPan({ offsetX: 0, offsetY: 999 }, 1, image, 200);
    expect(outPos.offsetY).toBe(50);
    const outNeg = clampPan({ offsetX: 0, offsetY: -999 }, 1, image, 200);
    expect(outNeg.offsetY).toBe(-50);
  });

  it('scales the limit by the placement scale (zoomed image allows larger pan)', () => {
    // scale=2, w=200 → max |offsetX| = 200
    const out = clampPan({ offsetX: 999, offsetY: 0 }, 2, image, 200);
    expect(out.offsetX).toBe(200);
  });

  it('diameterPx is currently unused but kept in the signature for future bleed-aware tuning', () => {
    // The contract today is independent of diameterPx — image-footprint
    // contains origin. The arg is reserved so callers can pass it without a
    // future-breaking change.
    const a = clampPan({ offsetX: 0, offsetY: 0 }, 1, image, 200);
    const b = clampPan({ offsetX: 0, offsetY: 0 }, 1, image, 600);
    expect(a).toEqual(b);
  });
});

describe('BackImagePlacement type exports', () => {
  it('exports a shape consumers can destructure', () => {
    const p: BackImagePlacement = { scale: 1, offsetX: 0, offsetY: 0 };
    expect(p.scale).toBe(1);
    expect(p.offsetX).toBe(0);
    expect(p.offsetY).toBe(0);
  });

  it('exposes DEFAULT_PLACEMENT_FACTORS as the Decision 4 bounds', () => {
    expect(DEFAULT_PLACEMENT_FACTORS.MIN).toBe(0.1);
    expect(DEFAULT_PLACEMENT_FACTORS.MAX).toBe(10);
  });
});
