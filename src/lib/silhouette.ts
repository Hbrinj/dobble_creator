/**
 * Pure silhouette geometry helpers.
 *
 * Given an 8-bit alpha mask (the alpha channel of an RGBA image, laid out row
 * by row), compute the smallest enclosing circle of the opaque-pixel set in
 * normalised image-space: cx/cy normalised to width/height respectively, r
 * normalised to width. Decision 5 sets the default threshold at 1 (any
 * non-zero alpha counts as silhouette).
 *
 * Implementation notes:
 *   - We only feed Welzl the *contour* pixels (opaque pixels with at least
 *     one transparent 4-neighbour, plus opaque pixels on the mask boundary).
 *     The smallest enclosing circle of a filled region is determined by its
 *     boundary points, so dropping interior pixels does not change the answer
 *     and keeps the SEC input small for large solid silhouettes.
 *   - Welzl's algorithm is iterative here (explicit point-shuffle + move-to-
 *     front) to keep recursion depth bounded and behaviour deterministic per
 *     RNG seed. We use a local LCG seeded from the contour length so tests
 *     don't depend on `Math.random`.
 */

export interface SilhouetteCircle {
  /** Centre x, normalised to image width (in [0, 1]). */
  readonly cx: number;
  /** Centre y, normalised to image height (in [0, 1]). */
  readonly cy: number;
  /** Radius, normalised to image width (in [0, 1]). */
  readonly r: number;
}

export class EmptySilhouetteError extends Error {
  constructor(message = 'silhouette: no pixels meet the alpha threshold') {
    super(message);
    this.name = 'EmptySilhouetteError';
  }
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Circle {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

const EPS = 1e-10;

export function computeSilhouetteCircle(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 1,
): SilhouetteCircle {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(
      `computeSilhouetteCircle: width/height must be positive integers (got ${width}x${height})`,
    );
  }
  if (alpha.length !== width * height) {
    throw new Error(
      `computeSilhouetteCircle: alpha length ${alpha.length} does not match width*height ${width * height}`,
    );
  }

  const contour = extractContourPoints(alpha, width, height, threshold);
  if (contour.length === 0) {
    throw new EmptySilhouetteError();
  }

  const circle = welzlSmallestEnclosingCircle(contour);

  return {
    cx: circle.x / width,
    cy: circle.y / height,
    r: circle.r / width,
  };
}

const isOpaque = (
  alpha: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  height: number,
  threshold: number,
): boolean => {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  return alpha[y * width + x]! >= threshold;
};

const extractContourPoints = (
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): Point[] => {
  const points: Point[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x]! < threshold) continue;
      // Image-boundary pixel is automatically on the contour.
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        points.push({ x, y });
        continue;
      }
      // Otherwise: opaque AND at least one 4-neighbour is transparent.
      if (
        !isOpaque(alpha, x - 1, y, width, height, threshold) ||
        !isOpaque(alpha, x + 1, y, width, height, threshold) ||
        !isOpaque(alpha, x, y - 1, width, height, threshold) ||
        !isOpaque(alpha, x, y + 1, width, height, threshold)
      ) {
        points.push({ x, y });
      }
    }
  }
  return points;
};

/**
 * Small deterministic 32-bit PRNG (Mulberry32 variant) used only to shuffle
 * the Welzl input order in a reproducible way — no cryptographic claims.
 */
const makeLcg = (seed: number): (() => number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleInPlace = <T,>(arr: T[], rng: () => number): void => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
};

const circleFromOne = (p: Point): Circle => ({ x: p.x, y: p.y, r: 0 });

const circleFromTwo = (a: Point, b: Point): Circle => {
  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2;
  const r = Math.hypot(a.x - b.x, a.y - b.y) / 2;
  return { x, y, r };
};

const circleFromThree = (a: Point, b: Point, c: Point): Circle => {
  const ax = a.x;
  const ay = a.y;
  const bx = b.x;
  const by = b.y;
  const cx = c.x;
  const cy = c.y;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < EPS) {
    // Collinear: fall back to the circle from the two extreme points.
    const ab = Math.hypot(ax - bx, ay - by);
    const ac = Math.hypot(ax - cx, ay - cy);
    const bc = Math.hypot(bx - cx, by - cy);
    if (ab >= ac && ab >= bc) return circleFromTwo(a, b);
    if (ac >= bc) return circleFromTwo(a, c);
    return circleFromTwo(b, c);
  }
  const ux =
    ((ax * ax + ay * ay) * (by - cy) +
      (bx * bx + by * by) * (cy - ay) +
      (cx * cx + cy * cy) * (ay - by)) /
    d;
  const uy =
    ((ax * ax + ay * ay) * (cx - bx) +
      (bx * bx + by * by) * (ax - cx) +
      (cx * cx + cy * cy) * (bx - ax)) /
    d;
  const r = Math.hypot(ax - ux, ay - uy);
  return { x: ux, y: uy, r };
};

const inCircle = (c: Circle, p: Point): boolean => {
  const d = Math.hypot(p.x - c.x, p.y - c.y);
  return d <= c.r + EPS;
};

/**
 * Smallest enclosing circle for a set of >= 1 boundary points using the
 * classic move-to-front iterative form of Welzl's algorithm.
 */
const minCircleWithTwoBoundary = (
  points: readonly Point[],
  upTo: number,
  q1: Point,
  q2: Point,
): Circle => {
  let circle = circleFromTwo(q1, q2);
  for (let i = 0; i < upTo; i++) {
    const p = points[i]!;
    if (inCircle(circle, p)) continue;
    circle = circleFromThree(q1, q2, p);
  }
  return circle;
};

const minCircleWithOneBoundary = (
  points: readonly Point[],
  upTo: number,
  q: Point,
): Circle => {
  let circle = circleFromTwo(points[0]!, q);
  for (let i = 1; i < upTo; i++) {
    const p = points[i]!;
    if (inCircle(circle, p)) continue;
    circle = minCircleWithTwoBoundary(points, i, q, p);
  }
  return circle;
};

const welzlSmallestEnclosingCircle = (input: readonly Point[]): Circle => {
  if (input.length === 1) return circleFromOne(input[0]!);
  if (input.length === 2) return circleFromTwo(input[0]!, input[1]!);

  // Deterministic shuffle so the algorithm is reproducible for given input.
  const points: Point[] = [...input];
  shuffleInPlace(points, makeLcg(points.length * 2654435761));

  let circle = circleFromTwo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i++) {
    const p = points[i]!;
    if (inCircle(circle, p)) continue;
    circle = minCircleWithOneBoundary(points, i, p);
  }
  return circle;
};
