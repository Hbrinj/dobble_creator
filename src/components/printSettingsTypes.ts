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
  readonly pageSize: PageSize;
  readonly cropMarks: boolean;
  readonly bleed: boolean;
  readonly background: CardBackground;
}

export const MIN_DIAMETER_MM = 60;
export const MAX_DIAMETER_MM = 100;

/** Defaults — see Decision 10 of tasks/dobble-card-generator.md. */
export const DEFAULT_PRINT_SETTINGS: PrintSettingsValue = {
  cardDiameterMm: 85,
  pageSize: 'A4',
  cropMarks: true,
  bleed: true,
  background: 'white',
};
