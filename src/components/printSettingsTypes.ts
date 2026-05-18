/**
 * Shared types and defaults for the print-settings UI and consumers.
 * Kept in a separate module from `PrintSettings.tsx` so that Vite's
 * react-refresh boundary remains valid (the .tsx file should only export
 * components).
 */

export type PageSize = 'A4' | 'Letter';
export type CardBackground = 'white' | 'transparent';

export interface PrintSettingsValue {
  readonly cardDiameterMm: number;
  /**
   * Per-card inner margin in millimetres. No image content is allowed within
   * this distance of the card's outer circle. Threaded into the packer as an
   * `insetFraction = cardEdgeMarginMm / (cardDiameterMm / 2)`. `0` disables
   * the margin and reproduces the pre-feature output exactly.
   */
  readonly cardEdgeMarginMm: number;
  readonly pageSize: PageSize;
  readonly cropMarks: boolean;
  readonly bleed: boolean;
  readonly background: CardBackground;
}

export const MIN_DIAMETER_MM = 60;
export const MAX_DIAMETER_MM = 100;

/**
 * Inner-margin bounds. `0` opts out of the margin (pre-feature behaviour);
 * `15` is the post-compensation convergence-envelope ceiling — see
 * Decision 5 of tasks/card-edge-margin.md.
 */
export const MIN_CARD_EDGE_MARGIN_MM = 0;
export const MAX_CARD_EDGE_MARGIN_MM = 15;
export const DEFAULT_CARD_EDGE_MARGIN_MM = 5;

/** Defaults — see Decision 10 of tasks/dobble-card-generator.md. */
export const DEFAULT_PRINT_SETTINGS: PrintSettingsValue = {
  cardDiameterMm: 85,
  cardEdgeMarginMm: DEFAULT_CARD_EDGE_MARGIN_MM,
  pageSize: 'A4',
  cropMarks: true,
  bleed: true,
  background: 'white',
};
