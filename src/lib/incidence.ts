import { SUPPORTED_PRIMES } from './orderPicker';

/**
 * Generate a Dobble (projective-plane) incidence for a prime order n.
 *
 * Returns an array of `n^2 + n + 1` cards. Each card has `n + 1` symbol
 * indices in [0, n^2+n+1). The incidence satisfies:
 *   - every pair of cards shares exactly one symbol
 *   - every pair of symbols co-occurs on exactly one card
 *
 * Construction: textbook ℤₙ projective-plane.
 * Points are labelled in [0, n^2+n+1) and grouped as:
 *   - n^2 finite points (i, j) for i,j in [0, n)
 *   - n "points at infinity" (one per slope class)
 *   - 1 special point at infinity for the vertical class
 *
 * Lines come in n+1 parallel classes plus the line at infinity:
 *   - slope-m class (m in [0, n)): { (i, (m*i + b) mod n) : i in [0, n) } ∪ { ∞_m }
 *   - vertical class: { (c, j) : j in [0, n) } ∪ { ∞_v }, one per column c
 *   - line at infinity: { ∞_0, ∞_1, ..., ∞_{n-1}, ∞_v }
 *
 * The PRNG is used to shuffle the card order and the symbol relabelling so
 * that the same seed yields the same output, but different seeds yield
 * visually distinct decks.
 */
export function generateIncidence(
  n: number,
  rng: () => number,
): number[][] {
  if (!SUPPORTED_PRIMES.includes(n)) {
    throw new Error(
      `generateIncidence: unsupported order ${n}. Supported primes: ${SUPPORTED_PRIMES.join(', ')}`,
    );
  }

  const totalSymbols = n * n + n + 1;

  // Point labelling. Build a function (kind, a, b) -> index.
  // Finite points: index = i * n + j, range [0, n^2)
  // ∞_m (slope at infinity): index = n^2 + m, range [n^2, n^2 + n)
  // ∞_v (vertical at infinity): index = n^2 + n
  const finite = (i: number, j: number): number => i * n + j;
  const slopeInfinity = (m: number): number => n * n + m;
  const verticalInfinity = (): number => n * n + n;

  const cards: number[][] = [];

  // n classes of n parallel lines: slope m, intercept b
  for (let m = 0; m < n; m++) {
    for (let b = 0; b < n; b++) {
      const card: number[] = [];
      for (let i = 0; i < n; i++) {
        const j = (m * i + b) % n;
        card.push(finite(i, j));
      }
      card.push(slopeInfinity(m));
      cards.push(card);
    }
  }

  // Vertical class: one line per column c
  for (let c = 0; c < n; c++) {
    const card: number[] = [];
    for (let j = 0; j < n; j++) {
      card.push(finite(c, j));
    }
    card.push(verticalInfinity());
    cards.push(card);
  }

  // Line at infinity: all the "points at infinity"
  const infinityLine: number[] = [];
  for (let m = 0; m < n; m++) infinityLine.push(slopeInfinity(m));
  infinityLine.push(verticalInfinity());
  cards.push(infinityLine);

  // Sanity check before shuffling — fail loud if construction is off.
  if (cards.length !== totalSymbols) {
    throw new Error(
      `generateIncidence: internal error — produced ${cards.length} cards, expected ${totalSymbols}`,
    );
  }

  // Apply seeded shuffles for reproducible variety.
  const symbolPermutation = randomPermutation(totalSymbols, rng);
  const relabelled = cards.map((card) =>
    card.map((s) => symbolPermutation[s]!).sort((a, b) => a - b),
  );
  return shuffleInPlace(relabelled, rng);
}

const randomPermutation = (size: number, rng: () => number): number[] => {
  const arr = Array.from({ length: size }, (_, i) => i);
  return shuffleInPlace(arr, rng);
};

const shuffleInPlace = <T>(arr: T[], rng: () => number): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
};
