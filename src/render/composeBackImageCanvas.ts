/**
 * Source-image surface the composer needs: a `CanvasImageSource`-compatible
 * value plus its drawable extent. Both `HTMLImageElement` and
 * `HTMLCanvasElement` satisfy this; tests can pass a hand-built canvas.
 */
export type BackImageSource = CanvasImageSource & {
  readonly width: number;
  readonly height: number;
};

/**
 * Placement of a back image inside the composer's circular frame. All values
 * are in canvas-pixel units relative to the composer-canvas centre, so
 * `{ scale: 1, offsetX: 0, offsetY: 0 }` puts the image centre at the circle
 * centre at native size. Slice 2 will move this type into a dedicated
 * `backImagePlacement` module and re-export it from there.
 */
export interface BackImagePlacement {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/**
 * Rasterise `image` onto an offscreen canvas of `diameterPx × diameterPx`,
 * applying the user's `placement` (scale + translate in canvas-pixel units
 * relative to the canvas centre) and clipping to a circle of radius
 * `diameterPx / 2`.
 *
 * This is the single source of truth for back-image rendering: the live
 * preview component and the PDF exporter both call it. They differ only in
 * the `diameterPx` they request — preview uses a fixed display size, PDF
 * uses a size that covers the card diameter plus bleed.
 */
export function composeBackImageCanvas(
  image: BackImageSource,
  placement: BackImagePlacement,
  diameterPx: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = diameterPx;
  canvas.height = diameterPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('composeBackImageCanvas: 2D context unavailable on canvas');
  }

  const centre = diameterPx / 2;

  ctx.save();
  // Circular clip — caller chooses whether `diameterPx` is the trim-line
  // diameter or includes bleed; the helper just clips at radius = diameter/2.
  ctx.beginPath();
  ctx.arc(centre, centre, centre, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Place the image centre at (canvas centre + offset), then apply user
  // scale. drawImage's origin is the top-left of the image, so the image
  // top-left lives at (-width/2, -height/2) in the transformed frame.
  ctx.translate(centre + placement.offsetX, centre + placement.offsetY);
  ctx.scale(placement.scale, placement.scale);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);

  ctx.restore();
  return canvas;
}
