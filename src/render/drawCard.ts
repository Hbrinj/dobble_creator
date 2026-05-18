import type { PackedCircle } from '../lib/packer';
import type { SilhouetteCircle } from '../lib/silhouette';

/**
 * The subset of HTMLImageElement / ImageBitmap surface that drawCard needs.
 * Accepting a structural type lets tests pass stubs and the production code
 * pass `HTMLImageElement` or `ImageBitmap` directly. `silhouette` carries the
 * pre-computed smallest-enclosing-circle of the opaque pixel set in
 * normalised image-space (cx/cy normalised to width/height respectively, r
 * normalised to width). It is required: Decision 8 routes every silhouette
 * extraction failure to upload rejection, so any image reaching this renderer
 * is guaranteed to carry one.
 */
export interface SymbolImage {
  readonly width: number;
  readonly height: number;
  readonly silhouette: SilhouetteCircle;
}

export type CardBackground = 'white' | 'transparent';

export interface DrawCardOptions {
  /** Pixel diameter of the rendered card (the canvas is sized to this on both axes). */
  readonly diameterPx: number;
  readonly background: CardBackground;
  readonly outline: boolean;
}

/**
 * Convert a physical inner-margin in millimetres to the dimensionless inset
 * fraction the packer expects (where the parent disc has radius 1). The
 * fraction is `marginMm / (diameterMm / 2)`. Guarded for `diameterMm <= 0` so
 * a transiently-zeroed setting cannot produce a NaN/Infinity that would
 * corrupt the packer's boundary checks — the fallback `0` reproduces the
 * pre-feature no-margin behaviour exactly.
 */
export function computeInsetFraction(
  diameterMm: number,
  marginMm: number,
): number {
  if (!(diameterMm > 0)) return 0;
  return marginMm / (diameterMm / 2);
}

/**
 * Draw a Dobble card onto `canvas`:
 *   - clear, then optionally fill the background
 *   - for each (symbol, packing, rotation) triplet: save, clip to the packed
 *     circle, translate to the circle centre, rotate, draw the symbol image
 *     fitted to the circle's diameter, restore
 *   - optionally stroke a faint outline around the parent card
 *
 * Packing positions/radii are in the parent's unit frame (centred at origin,
 * radius 1); they are mapped onto the canvas using `diameterPx / 2` as the
 * pixel radius.
 */
export function drawCard(
  canvas: HTMLCanvasElement,
  symbols: readonly SymbolImage[],
  packing: readonly PackedCircle[],
  rotations: readonly number[],
  options: DrawCardOptions,
): void {
  if (
    symbols.length !== packing.length ||
    packing.length !== rotations.length
  ) {
    throw new Error(
      `drawCard: symbols (${symbols.length}), packing (${packing.length}), and rotations (${rotations.length}) must be the same length`,
    );
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('drawCard: 2D context unavailable on canvas');
  }

  const size = options.diameterPx;
  const radiusPx = size / 2;

  ctx.clearRect(0, 0, size, size);

  if (options.background === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
  }

  // Clip to the card circle so symbol drawings can't bleed outside.
  ctx.save();
  ctx.beginPath();
  ctx.arc(radiusPx, radiusPx, radiusPx, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  for (let i = 0; i < symbols.length; i++) {
    drawSingleSymbol(ctx, symbols[i]!, packing[i]!, rotations[i]!, radiusPx);
  }

  ctx.restore();

  if (options.outline) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(radiusPx, radiusPx, radiusPx - 1, 0, Math.PI * 2);
    ctx.closePath();
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

const drawSingleSymbol = (
  ctx: CanvasRenderingContext2D,
  symbol: SymbolImage,
  slot: PackedCircle,
  rotation: number,
  radiusPx: number,
): void => {
  const cx = radiusPx + slot.x * radiusPx;
  const cy = radiusPx + slot.y * radiusPx;
  const slotRadiusPx = slot.r * radiusPx;

  // Silhouette mapping (Decision 10): scale and position the image so its
  // silhouette circle (normalised in [0, 1] image space) maps exactly to the
  // slot circle. After translate(cx, cy) and rotate(rotation), the origin
  // sits at the slot centre — so the drawImage offsets are expressed
  // relative to that centre. Degenerate case: an image whose silhouette
  // collapses to a single point (sil.r === 0, e.g. a 1×1 opaque PNG) has no
  // meaningful "fit by silhouette" — fall back to fitting the longer image
  // edge to the slot diameter so the draw still produces visible output
  // rather than an Infinity-scaled no-op.
  const sil = symbol.silhouette;
  const silRadiusPx = sil.r * symbol.width;
  const scale =
    silRadiusPx > 0
      ? slotRadiusPx / silRadiusPx
      : (slotRadiusPx * 2) / Math.max(symbol.width, symbol.height);
  const drawW = symbol.width * scale;
  const drawH = symbol.height * scale;
  const drawX = -sil.cx * symbol.width * scale;
  const drawY = -sil.cy * symbol.height * scale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, slotRadiusPx, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  // Cast through CanvasImageSource — at runtime, callers pass HTMLImageElement
  // or ImageBitmap; in tests they pass a stub. We only rely on width/height.
  ctx.drawImage(
    symbol as unknown as CanvasImageSource,
    drawX,
    drawY,
    drawW,
    drawH,
  );
  ctx.restore();
};
