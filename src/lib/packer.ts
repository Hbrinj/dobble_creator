/**
 * Pack `k` circles of varying radii inside a parent circle of radius 1 centred
 * at the origin, with no pairwise overlap. Deterministic for a given PRNG.
 *
 * Algorithm: force-directed relaxation, wrapped in a convergence-detection +
 * retry loop.
 *  1. `attemptPacking` runs one seed → relax → final-clamp pipeline and
 *     returns the resulting circles. The final clamp can introduce a hair of
 *     pair overlap when it pulls boundary-violating children inward, so the
 *     attempt's output is *candidate* — not guaranteed — non-overlapping.
 *  2. `packCircles` calls `attemptPacking`, scans the result with
 *     `worstPairOverlap`, and returns immediately if the worst pair is below
 *     `OVERLAP_TOLERANCE`. Otherwise it derives a fresh seed from the
 *     caller-supplied rng and re-attempts, up to `MAX_RETRIES`.
 *  3. After exhausting retries, it throws `PackingDidNotConvergeError`.
 *
 * Determinism: the retry seed chain is derived from the caller's rng, so a
 * given `(k, rng)` pair still yields one deterministic output.
 *
 * See `tasks/alpha-aware-packing.md` Decisions 10 + 13 for empirical
 * background (single-attempt per-seed failure rate ~12 % at k=8 at
 * PACKING_FRACTION=0.65; the retry chain collapses that to ~10⁻⁹).
 */

import { mulberry32 } from './prng';

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

/** Maximum residual pair-overlap (in parent-unit space) accepted as
 *  "converged" — see Decision 13 in tasks/alpha-aware-packing.md. */
export const OVERLAP_TOLERANCE = 1e-4;
/** Per-call retry budget. With ~12 % single-attempt failure at k=8 the
 *  effective failure rate collapses to ~12 %^8 ≈ 4·10⁻⁸. */
export const MAX_RETRIES = 8;

interface MutableCircle {
  x: number;
  y: number;
  r: number;
}

/**
 * Thrown by `packCircles` when every retry attempt produces a layout with
 * residual pair overlap above `OVERLAP_TOLERANCE`. Callers (today: the App's
 * `handleGenerate`) surface this as a user-visible amber notice rather than
 * letting an over-packed card slip through to PDF.
 */
export class PackingDidNotConvergeError extends Error {
  readonly k: number;
  readonly attempts: number;

  constructor(k: number, attempts: number) {
    super(
      `packCircles: could not converge for k=${k} after ${attempts} attempts`,
    );
    this.name = 'PackingDidNotConvergeError';
    this.k = k;
    this.attempts = attempts;
  }
}

/**
 * Test-only injection seam — lets the packer unit test substitute a
 * deterministic pathological `attemptPacking` so the retry-exhaust branch can
 * be exercised without relying on a brittle pathological rng. Not exported
 * from the package's public surface; intended only for `packer.test.ts`.
 *
 * @internal
 */
export const __testing = {
  setAttemptPacking(
    fn: (
      k: number,
      rng: () => number,
      insetFraction: number,
    ) => MutableCircle[],
  ): () => void {
    const previous = attemptPackingImpl;
    attemptPackingImpl = fn;
    return () => {
      attemptPackingImpl = previous;
    };
  },
};

/**
 * Pack `k` circles inside the parent disc.
 *
 * @param insetFraction Optional inner-margin fraction in `[0, 1)`. When > 0,
 *   every circle is kept inside the disc of radius `1 - insetFraction` and
 *   the seed-time area budget is scaled by `(1 - insetFraction)²` so the
 *   convergence envelope stays at its tuned 65 % of the inner disc. At `0`
 *   (the default) every code path reduces to the pre-feature arithmetic
 *   exactly, preserving the deterministic seed contract for callers that
 *   opt out of the margin.
 */
export function packCircles(
  k: number,
  rng: () => number,
  insetFraction = 0,
): PackedCircle[] {
  if (!Number.isInteger(k) || k <= 0) {
    throw new Error(`packCircles: k must be a positive integer, got ${k}`);
  }
  if (
    !Number.isFinite(insetFraction) ||
    insetFraction < 0 ||
    insetFraction >= 1
  ) {
    throw new Error(
      `packCircles: insetFraction must be in [0, 1), got ${insetFraction}`,
    );
  }

  // Attempt 1 uses the caller's rng directly so a single-shot success path
  // never spins the retry-seed-derivation loop.
  let circles = attemptPackingImpl(k, rng, insetFraction);
  if (worstPairOverlap(circles) < OVERLAP_TOLERANCE) {
    return freezeOutput(circles);
  }

  for (let attempt = 1; attempt < MAX_RETRIES; attempt++) {
    // Derive a fresh seed from the caller's rng so retries stay deterministic
    // for any given input rng.
    const retrySeed = Math.floor(rng() * 0xffffffff) >>> 0;
    const retryRng = mulberry32(retrySeed);
    circles = attemptPackingImpl(k, retryRng, insetFraction);
    if (worstPairOverlap(circles) < OVERLAP_TOLERANCE) {
      return freezeOutput(circles);
    }
  }

  throw new PackingDidNotConvergeError(k, MAX_RETRIES);
}

const freezeOutput = (circles: MutableCircle[]): PackedCircle[] =>
  circles.map((c) => ({ x: c.x, y: c.y, r: c.r }));

/**
 * Read-only scan for the worst (largest) pair-overlap distance in `circles`.
 * Returns 0 when every pair is disjoint (or just touching). Mirrors the
 * distance check inside `resolvePairOverlaps` but never mutates.
 */
const worstPairOverlap = (circles: readonly MutableCircle[]): number => {
  let worst = 0;
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i]!;
      const b = circles[j]!;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const overlap = a.r + b.r - dist;
      if (overlap > worst) worst = overlap;
    }
  }
  return worst;
};

const attemptPacking = (
  k: number,
  rng: () => number,
  insetFraction: number,
): MutableCircle[] => {
  const boundary = 1 - insetFraction;
  const circles = seedCircles(k, rng, boundary);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const moved = relaxOnce(circles, boundary);
    if (moved < STOP_THRESHOLD) break;
  }

  // Final clamp so floating-point drift can't push a circle marginally
  // outside the (effective) parent. This can re-introduce micro pair-overlap,
  // which the caller catches via `worstPairOverlap` and resolves by retrying
  // with a fresh seed.
  clampInsideParent(circles, boundary);

  return circles;
};

// `attemptPackingImpl` is the indirection the retry loop calls. `__testing`
// swaps it in tests; production code always sees `attemptPacking`.
let attemptPackingImpl: (
  k: number,
  rng: () => number,
  insetFraction: number,
) => MutableCircle[] = attemptPacking;

const seedCircles = (
  k: number,
  rng: () => number,
  boundary: number,
): MutableCircle[] => {
  // Scale the area budget so the seeded child total area stays at the tuned
  // 65 % of the *inner* disc (radius `boundary = 1 - insetFraction`). At
  // insetFraction=0 → boundary=1 this reduces exactly to
  // `Math.sqrt(PACKING_FRACTION / k)` — the pre-feature arithmetic —
  // preserving the deterministic seed contract.
  const baseRadius = Math.sqrt((PACKING_FRACTION * boundary ** 2) / k);
  const circles: MutableCircle[] = [];
  for (let i = 0; i < k; i++) {
    const radius = baseRadius * (1 + (rng() * 2 - 1) * RADIUS_SPREAD);
    // Distribute initial positions in a ring just inside the parent boundary
    // when k > 1 so they have somewhere to spread to; single circle goes centre.
    let x = 0;
    let y = 0;
    if (k > 1) {
      const angle = (i / k) * Math.PI * 2 + rng() * 0.4;
      const dist = (boundary - radius) * (0.4 + rng() * 0.4);
      x = Math.cos(angle) * dist;
      y = Math.sin(angle) * dist;
    }
    circles.push({ x, y, r: radius });
  }
  return circles;
};

const relaxOnce = (circles: MutableCircle[], boundary: number): number => {
  let totalDisplacement = 0;
  totalDisplacement += resolvePairOverlaps(circles);
  totalDisplacement += resolveBoundaryOverlaps(circles, boundary);
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

const resolveBoundaryOverlaps = (
  circles: MutableCircle[],
  boundary: number,
): number => {
  let displacement = 0;
  for (const c of circles) {
    const dist = Math.hypot(c.x, c.y);
    const maxDist = boundary - c.r;
    if (dist <= maxDist) continue;
    if (dist === 0) continue;
    const overshoot = dist - maxDist;
    c.x -= (c.x / dist) * overshoot;
    c.y -= (c.y / dist) * overshoot;
    displacement += overshoot;
  }
  return displacement;
};

const clampInsideParent = (
  circles: MutableCircle[],
  boundary: number,
): void => {
  for (const c of circles) {
    const dist = Math.hypot(c.x, c.y);
    const maxDist = boundary - c.r;
    if (dist > maxDist && dist > 0) {
      const scale = maxDist / dist;
      c.x *= scale;
      c.y *= scale;
    }
  }
};
