/**
 * Placement of a back image inside the composer's circular frame. All values
 * are in canvas-pixel units relative to the composer-canvas centre, so
 * `{ scale: 1, offsetX: 0, offsetY: 0 }` puts the image centre at the circle
 * centre at native size.
 *
 * Shared by `composeBackImageCanvas` (the renderer) and `BackImagePreview`
 * (the interactive control) — both read and write the same shape.
 */
export interface BackImagePlacement {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** Decision 4 bounds: scale is clamped to `[MIN × fillScale, MAX × fillScale]`. */
export const DEFAULT_PLACEMENT_FACTORS = {
  MIN: 0.1,
  MAX: 10,
} as const;

/**
 * Pixel diameter of the live preview canvas. Shared by `BackImagePreview`,
 * `CardBack`, and the App's PDF-export scale-up so the placement units stay
 * consistent across the preview and the rasterised PDF back.
 *
 * Semantically the preview represents the *card* area (post-trim), not the
 * bleed area. PDF-time compositing renders into a larger canvas covering the
 * bleed-square; the placement is uniformly scaled up by
 * `(PDF render-px) / PREVIEW_DIAMETER_PX` so the same source-image region
 * that fills the preview also fills the printed card area, while any
 * source-image overflow flows into the bleed area (Decision 11).
 */
export const PREVIEW_DIAMETER_PX = 320;

/**
 * Decision 3 default — scale the image so its longer edge matches the
 * target diameter (CSS `object-fit: cover` analogue). Returns 0 defensively
 * for degenerate inputs so a transiently-zeroed dimension cannot produce
 * Infinity downstream.
 */
export function computeFillScale(
  imageWidth: number,
  imageHeight: number,
  diameterPx: number,
): number {
  if (!(diameterPx > 0)) return 0;
  if (!(imageWidth > 0) || !(imageHeight > 0)) return 0;
  return diameterPx / Math.max(imageWidth, imageHeight);
}

/**
 * Clamp a requested scale to `[MIN × fillScale, MAX × fillScale]`. Used by
 * the preview's wheel handler so the user cannot zoom past the legal range.
 */
export function clampScale(requestedScale: number, fillScale: number): number {
  const min = DEFAULT_PLACEMENT_FACTORS.MIN * fillScale;
  const max = DEFAULT_PLACEMENT_FACTORS.MAX * fillScale;
  return Math.max(min, Math.min(max, requestedScale));
}

/**
 * Clamp a pan offset so the image's rectangular footprint after scale +
 * translate still contains the canvas centre `(0, 0)`. Prevents the
 * "panned the image off-screen, printed blank" failure mode (Decision 4).
 *
 * The image footprint at the current scale spans `±(width × scale / 2,
 * height × scale / 2)` around `(offsetX, offsetY)` — for the origin to lie
 * inside that rectangle we need `|offsetX| ≤ width × scale / 2` and
 * `|offsetY| ≤ height × scale / 2`.
 */
export function clampPan(
  offset: { offsetX: number; offsetY: number },
  scale: number,
  imageNaturalSize: { width: number; height: number },
): { offsetX: number; offsetY: number } {
  const maxX = (imageNaturalSize.width * scale) / 2;
  const maxY = (imageNaturalSize.height * scale) / 2;
  return {
    offsetX: Math.max(-maxX, Math.min(maxX, offset.offsetX)),
    offsetY: Math.max(-maxY, Math.min(maxY, offset.offsetY)),
  };
}
