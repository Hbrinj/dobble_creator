import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PRINT_SETTINGS,
  MIN_CARD_EDGE_MARGIN_MM,
  MAX_CARD_EDGE_MARGIN_MM,
  DEFAULT_CARD_EDGE_MARGIN_MM,
} from './printSettingsTypes';

describe('printSettingsTypes — cardEdgeMarginMm', () => {
  it('defaults to 5 mm in DEFAULT_PRINT_SETTINGS', () => {
    expect(DEFAULT_PRINT_SETTINGS.cardEdgeMarginMm).toBe(5);
  });

  it('exposes a 5 mm default constant matching the settings default', () => {
    expect(DEFAULT_CARD_EDGE_MARGIN_MM).toBe(5);
    expect(DEFAULT_PRINT_SETTINGS.cardEdgeMarginMm).toBe(
      DEFAULT_CARD_EDGE_MARGIN_MM,
    );
  });

  it('exposes inclusive bounds of [0, 15] mm', () => {
    expect(MIN_CARD_EDGE_MARGIN_MM).toBe(0);
    expect(MAX_CARD_EDGE_MARGIN_MM).toBe(15);
  });

  it('treats 0 as a valid lower-bound (opt-out of the margin)', () => {
    // 0 must sit inside the inclusive [MIN, MAX] range so callers that clamp
    // user input the same way the diameter row does will accept it.
    expect(MIN_CARD_EDGE_MARGIN_MM).toBeLessThanOrEqual(0);
    expect(MAX_CARD_EDGE_MARGIN_MM).toBeGreaterThanOrEqual(0);
  });

  it('default sits inside the inclusive bounds', () => {
    expect(DEFAULT_CARD_EDGE_MARGIN_MM).toBeGreaterThanOrEqual(
      MIN_CARD_EDGE_MARGIN_MM,
    );
    expect(DEFAULT_CARD_EDGE_MARGIN_MM).toBeLessThanOrEqual(
      MAX_CARD_EDGE_MARGIN_MM,
    );
  });
});
