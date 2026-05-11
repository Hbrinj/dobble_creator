/**
 * mulberry32 — a small, fast, seedable PRNG.
 *
 * Returns a function that yields a deterministic stream of floats in [0, 1)
 * for a given 32-bit seed. Same seed → same stream. Used throughout the deck
 * generator so that every randomised step (incidence shuffling, packing
 * relaxation, symbol rotation) is reproducible from a single seed value.
 *
 * Reference: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
 */
export function mulberry32(seed: number): () => number {
  // Coerce to an unsigned 32-bit integer so seed 0 and negative seeds behave.
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
