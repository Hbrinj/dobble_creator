/**
 * Canvas-touching adapter: decode an image blob and return its alpha channel.
 *
 * Uses the modern `createImageBitmap` + `OffscreenCanvas` path for a single,
 * promise-shaped decode → `getImageData` flow with no `HTMLImageElement`
 * lifecycle. The longest edge is capped at MAX_SCAN_EDGE px (Decision 7) so
 * upload-time CPU is bounded regardless of source resolution; downsampling
 * preserves silhouette geometry within ~1 px of image space, which is well
 * inside the normalised tolerance the renderer consumes.
 *
 * NOTE: this module is canvas-bound — it cannot run under jsdom. Tests at
 * call sites mock the export. Playwright covers the real adapter end-to-end.
 */

export interface ExtractedAlpha {
  readonly width: number;
  readonly height: number;
  /** Alpha channel only (one byte per pixel, row-major). */
  readonly alpha: Uint8ClampedArray;
}

const MAX_SCAN_EDGE = 512;

export async function extractAlphaMask(file: File): Promise<ExtractedAlpha> {
  const bitmap = await createImageBitmap(file);
  try {
    const naturalW = bitmap.width;
    const naturalH = bitmap.height;
    if (naturalW <= 0 || naturalH <= 0) {
      throw new Error(
        `extractAlphaMask: decoded bitmap has zero size (${naturalW}x${naturalH})`,
      );
    }
    const longest = Math.max(naturalW, naturalH);
    const scale = longest > MAX_SCAN_EDGE ? MAX_SCAN_EDGE / longest : 1;
    const w = Math.max(1, Math.round(naturalW * scale));
    const h = Math.max(1, Math.round(naturalH * scale));

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('extractAlphaMask: OffscreenCanvas 2D context unavailable');
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    // Pull out the alpha plane. ImageData is RGBA, row-major.
    const rgba = imageData.data;
    const alpha = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 3; i < alpha.length; i++, j += 4) {
      alpha[i] = rgba[j]!;
    }
    return { width: w, height: h, alpha };
  } finally {
    bitmap.close();
  }
}
