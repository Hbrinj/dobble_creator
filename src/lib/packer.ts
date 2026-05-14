/**
 * Pack `k` circles of varying radii inside a parent circle of radius 1 centred
 * at the origin, with no pairwise overlap. Deterministic for a given PRNG.
 *
 * Algorithm: force-directed relaxation.
 *  1. Seed k child positions uniformly in the parent disc.
 *  2. Assign each child a small random radius variation around a base radius
 *     chosen so that the total child area is a target fraction of the parent.
 *  3. Iterate: for each pair, if overlapping push apart along the separating
 *     axis; for each child overlapping the parent boundary, pull it inward.
 *  4. Stop when no significant displacement occurs, or after a max iteration cap.
 */

export interface PackedCircle {
  /** x position in the parent's frame. */
  readonly x: number;
  /** y position in the parent's frame. */
  readonly y: number;
  /** radius (parent radius is 1). */
  readonly r: number;
}

const MAX_ITERATIONS = 600;
const STOP_THRESHOLD = 1e-5;
/** Target fraction of parent disc area that the child circles together occupy. */
const PACKING_FRACTION = 0.65;
/** Spread in child radii: r in [base * (1 - SPREAD), base * (1 + SPREAD)]. */
const RADIUS_SPREAD = 0.25;

interface MutableCircle {
  x: number;
  y: number;
  r: number;
}

export function packCircles(k: number, rng: () => number): PackedCircle[] {
  if (!Number.isInteger(k) || k <= 0) {
    throw new Error(`packCircles: k must be a positive integer, got ${k}`);
  }

  const circles = seedCircles(k, rng);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const moved = relaxOnce(circles);
    if (moved < STOP_THRESHOLD) break;
  }

  // Final clamp so floating-point drift can't push a circle marginally outside.
  clampInsideParent(circles);

  return circles.map((c) => ({ x: c.x, y: c.y, r: c.r }));
}

const seedCircles = (k: number, rng: () => number): MutableCircle[] => {
  const baseRadius = Math.sqrt(PACKING_FRACTION / k);
  const circles: MutableCircle[] = [];
  for (let i = 0; i < k; i++) {
    const radius =
      baseRadius * (1 + (rng() * 2 - 1) * RADIUS_SPREAD);
    // Distribute initial positions in a ring just inside the parent boundary
    // when k > 1 so they have somewhere to spread to; single circle goes centre.
    let x = 0;
    let y = 0;
    if (k > 1) {
      const angle = (i / k) * Math.PI * 2 + rng() * 0.4;
      const dist = (1 - radius) * (0.4 + rng() * 0.4);
      x = Math.cos(angle) * dist;
      y = Math.sin(angle) * dist;
    }
    circles.push({ x, y, r: radius });
  }
  return circles;
};

const relaxOnce = (circles: MutableCircle[]): number => {
  let totalDisplacement = 0;
  totalDisplacement += resolvePairOverlaps(circles);
  totalDisplacement += resolveBoundaryOverlaps(circles);
  return totalDisplacement;
};

const resolvePairOverlaps = (circles: MutableCircle[]): number => {
  let displacement = 0;
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i]!;
      const b = circles[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = a.r + b.r;
      if (dist >= minDist) continue;
      const overlap = minDist - dist;
      // If circles are concentric, nudge along an arbitrary axis to break symmetry.
      const ux = dist > 0 ? dx / dist : 1;
      const uy = dist > 0 ? dy / dist : 0;
      const shift = overlap / 2;
      a.x -= ux * shift;
      a.y -= uy * shift;
      b.x += ux * shift;
      b.y += uy * shift;
      displacement += overlap;
    }
  }
  return displacement;
};

const resolveBoundaryOverlaps = (circles: MutableCircle[]): number => {
  let displacement = 0;
  for (const c of circles) {
    const dist = Math.hypot(c.x, c.y);
    const maxDist = 1 - c.r;
    if (dist <= maxDist) continue;
    if (dist === 0) continue;
    const overshoot = dist - maxDist;
    c.x -= (c.x / dist) * overshoot;
    c.y -= (c.y / dist) * overshoot;
    displacement += overshoot;
  }
  return displacement;
};

const clampInsideParent = (circles: MutableCircle[]): void => {
  for (const c of circles) {
    const dist = Math.hypot(c.x, c.y);
    const maxDist = 1 - c.r;
    if (dist > maxDist && dist > 0) {
      const scale = maxDist / dist;
      c.x *= scale;
      c.y *= scale;
    }
  }
};
