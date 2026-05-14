import { describe, it, expect } from 'vitest';
import {
  computeSilhouetteCircle,
  EmptySilhouetteError,
} from './silhouette';

/**
 * Build an alpha mask of the given dimensions where each entry is 255 if the
 * predicate is true at (x, y) and 0 otherwise. This mirrors the layout
 * `getImageData` returns when only the alpha channel is retained.
 */
const makeMask = (
  width: number,
  height: number,
  predicate: (x: number, y: number) => boolean,
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out[y * width + x] = predicate(x, y) ? 255 : 0;
    }
  }
  return out;
};

describe('computeSilhouetteCircle', () => {
  it('computes correct circle for a 7×7 centred cross', () => {
    // Cross: row 3 and column 3 are opaque.
    const W = 7;
    const H = 7;
    const mask = makeMask(W, H, (x, y) => x === 3 || y === 3);
    const { cx, cy, r } = computeSilhouetteCircle(mask, W, H);
    // Centred cross: silhouette circle is centred and radius ~ 3 / 7 in
    // normalised x-space (the cross's farthest opaque pixel is 3 away from
    // the centre column / row).
    expect(cx).toBeCloseTo(3 / W, 2);
    expect(cy).toBeCloseTo(3 / H, 2);
    expect(r).toBeCloseTo(3 / W, 2);
  });

  it('computes correct circle for an off-centre solid disc', () => {
    const W = 16;
    const H = 16;
    const discCx = 4;
    const discCy = 8;
    const discR = 3;
    const mask = makeMask(W, H, (x, y) => {
      const dx = x - discCx;
      const dy = y - discCy;
      return dx * dx + dy * dy <= discR * discR;
    });
    const { cx, cy, r } = computeSilhouetteCircle(mask, W, H);
    // Tolerance accounts for Welzl's randomised order and the discrete
    // rasterisation of the disc.
    expect(cx).toBeCloseTo(discCx / W, 1);
    expect(cy).toBeCloseTo(discCy / H, 1);
    expect(r).toBeCloseTo(discR / W, 1);
  });

  it('computes correct circle for an L-shape that exceeds the AABB-circumscribed circle only marginally', () => {
    // L-shape: bottom row 0..7 and left column 0..7 in a 8x8 grid.
    const W = 8;
    const H = 8;
    const mask = makeMask(W, H, (x, y) => x === 0 || y === H - 1);
    const { cx, cy, r } = computeSilhouetteCircle(mask, W, H);
    // The optimal smallest enclosing circle for the two endpoints (7,7) and
    // (0,0) has centre (3.5, 3.5) and radius ≈ sqrt(2) * 3.5 = 4.95. The
    // AABB-circumscribed circle would have radius sqrt(2) * 3.5 too in this
    // square case, so they coincide. Use a generous tolerance.
    // Two diagonal extremes: (0,0) and (7,7) — pixel centres normalised.
    expect(cx).toBeCloseTo(3.5 / W, 1);
    expect(cy).toBeCloseTo(3.5 / H, 1);
    const expectedRadiusPx = Math.hypot(3.5, 3.5);
    expect(r).toBeCloseTo(expectedRadiusPx / W, 1);
  });

  it('throws EmptySilhouetteError when no pixels meet the threshold', () => {
    const W = 4;
    const H = 4;
    const mask = new Uint8ClampedArray(W * H); // all zeros
    expect(() => computeSilhouetteCircle(mask, W, H)).toThrow(
      EmptySilhouetteError,
    );
  });

  it('handles a single opaque pixel as a degenerate (zero-radius) circle', () => {
    const W = 8;
    const H = 8;
    const mask = makeMask(W, H, (x, y) => x === 2 && y === 5);
    const { cx, cy, r } = computeSilhouetteCircle(mask, W, H);
    expect(cx).toBeCloseTo(2 / W, 6);
    expect(cy).toBeCloseTo(5 / H, 6);
    expect(r).toBeCloseTo(0, 6);
  });

  it('respects a custom threshold', () => {
    // All pixels alpha=10; with threshold=1 we get a full mask; with
    // threshold=128 we get an empty silhouette and the call should throw.
    const W = 4;
    const H = 4;
    const mask = new Uint8ClampedArray(W * H).fill(10);
    expect(() =>
      computeSilhouetteCircle(mask, W, H, 128),
    ).toThrow(EmptySilhouetteError);
    const { r } = computeSilhouetteCircle(mask, W, H, 1);
    expect(r).toBeGreaterThan(0);
  });
});
