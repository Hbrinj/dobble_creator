import { describe, it, expect } from 'vitest';
import { generateIncidence } from './incidence';
import { mulberry32 } from './prng';

const intersect = <T>(a: readonly T[], b: readonly T[]): T[] =>
  a.filter((x) => b.includes(x));

const checkDobbleProperty = (cards: readonly number[][], n: number): void => {
  const expectedCardCount = n * n + n + 1;
  expect(cards.length).toBe(expectedCardCount);
  for (const card of cards) {
    expect(card.length).toBe(n + 1);
    // each symbol within a card is unique
    expect(new Set(card).size).toBe(n + 1);
  }

  // Every pair of cards shares exactly one symbol.
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const shared = intersect(cards[i]!, cards[j]!);
      expect(shared.length).toBe(1);
    }
  }

  // Every pair of symbols co-occurs on exactly one card.
  const symbols = new Set<number>();
  for (const card of cards) for (const s of card) symbols.add(s);
  expect(symbols.size).toBe(expectedCardCount);

  const symbolList = Array.from(symbols);
  for (let i = 0; i < symbolList.length; i++) {
    for (let j = i + 1; j < symbolList.length; j++) {
      const a = symbolList[i]!;
      const b = symbolList[j]!;
      const sharedCardCount = cards.filter(
        (c) => c.includes(a) && c.includes(b),
      ).length;
      expect(sharedCardCount).toBe(1);
    }
  }
};

describe('generateIncidence', () => {
  it.each([2, 3, 5, 7])(
    'produces a valid Dobble incidence for prime n=%i',
    (n) => {
      const cards = generateIncidence(n, mulberry32(42));
      checkDobbleProperty(cards, n);
    },
  );

  it('produces reproducible output for the same seed', () => {
    const a = generateIncidence(5, mulberry32(123));
    const b = generateIncidence(5, mulberry32(123));
    expect(a).toEqual(b);
  });

  it('produces different output for different seeds', () => {
    const a = generateIncidence(5, mulberry32(1));
    const b = generateIncidence(5, mulberry32(2));
    // Property holds but ordering differs.
    expect(a).not.toEqual(b);
  });

  it('uses contiguous symbol indices starting at 0', () => {
    const cards = generateIncidence(3, mulberry32(7));
    const symbols = new Set<number>();
    for (const card of cards) for (const s of card) symbols.add(s);
    const expectedSize = 3 * 3 + 3 + 1;
    expect(symbols.size).toBe(expectedSize);
    for (let i = 0; i < expectedSize; i++) {
      expect(symbols.has(i)).toBe(true);
    }
  });

  it('rejects non-prime / unsupported orders', () => {
    expect(() => generateIncidence(1, mulberry32(0))).toThrow();
    expect(() => generateIncidence(4, mulberry32(0))).toThrow();
    expect(() => generateIncidence(0, mulberry32(0))).toThrow();
  });
});
