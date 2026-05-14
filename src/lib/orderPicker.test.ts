import { describe, it, expect } from 'vitest';
import { pickOrder, SUPPORTED_PRIMES } from './orderPicker';

describe('pickOrder', () => {
  it.each([
    [0, null],
    [1, null],
    [6, null],
    [7, 2], // n=2 needs 2^2+2+1 = 7
    [8, 2],
    [12, 2], // n=3 needs 13, so 12 still falls back to 2
    [13, 3], // n=3 fits exactly
    [30, 3], // n=5 needs 31
    [31, 5], // n=5 fits exactly
    [56, 5], // n=7 needs 57
    [57, 7], // n=7 fits exactly
    [132, 7], // n=11 needs 133
    [133, 11], // n=11 fits exactly
    [182, 11], // n=13 needs 183
    [183, 13], // n=13 fits exactly
    [200, 13], // capped at the largest supported prime
    [10_000, 13], // still capped at 13 — larger orders are out of scope
  ])('picks the right prime order for image count %s', (count, expected) => {
    expect(pickOrder(count)).toBe(expected);
  });

  it('exports the supported prime list in ascending order', () => {
    expect(SUPPORTED_PRIMES).toEqual([2, 3, 5, 7, 11, 13]);
  });

  it('returns null for negative counts (defensive edge case)', () => {
    expect(pickOrder(-1)).toBeNull();
    expect(pickOrder(-100)).toBeNull();
  });
});
