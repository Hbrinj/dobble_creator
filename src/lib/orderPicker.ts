/**
 * Supported prime orders for the projective-plane construction.
 *
 * Prime-power orders (n=4, 8, 9, ...) require GF(p^k) arithmetic and are
 * deferred — see Decision 2 of tasks/dobble-card-generator.md.
 */
export const SUPPORTED_PRIMES: readonly number[] = [2, 3, 5, 7, 11, 13];

/**
 * Number of cards (and number of distinct symbols) for a deck of order n.
 * A projective plane of order n has exactly n^2 + n + 1 points/lines.
 */
export const deckSize = (n: number): number => n * n + n + 1;

/**
 * Given an image count, return the largest supported prime n such that
 * `n^2 + n + 1 <= count`. Returns null if no supported order fits — i.e.,
 * fewer than 7 images (the n=2 minimum).
 */
export function pickOrder(imageCount: number): number | null {
  if (!Number.isFinite(imageCount) || imageCount < deckSize(SUPPORTED_PRIMES[0]!)) {
    return null;
  }
  for (let i = SUPPORTED_PRIMES.length - 1; i >= 0; i--) {
    const n = SUPPORTED_PRIMES[i]!;
    if (deckSize(n) <= imageCount) {
      return n;
    }
  }
  return null;
}
