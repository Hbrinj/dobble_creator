import { describe, it, expect, beforeEach, vi } from 'vitest';
import { composeBackImageCanvas } from './composeBackImageCanvas';

/**
 * jsdom does not implement a real 2D canvas, so we install a structural mock
 * context and verify the operator sequence the helper emits: circular clip,
 * translate(centre + offset), scale, drawImage(image, -w/2, -h/2). This gives
 * us behavioural coverage equivalent to pixel reads — drawCard.test.ts uses
 * the same approach.
 */
interface MockCtx {
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  closePath: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  clip: ReturnType<typeof vi.fn>;
  translate: ReturnType<typeof vi.fn>;
  scale: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
}

const installMockContext = (): MockCtx => {
  const ctx: MockCtx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    clip: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
  };
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ctx as unknown as CanvasRenderingContext2D,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  return ctx;
};

const stubImage = (width: number, height: number): HTMLImageElement => {
  const img = { width, height } as unknown as HTMLImageElement;
  return img;
};

describe('composeBackImageCanvas', () => {
  let ctx: MockCtx;
  beforeEach(() => {
    ctx = installMockContext();
  });

  it('returns a square canvas of diameterPx × diameterPx', () => {
    const out = composeBackImageCanvas(
      stubImage(200, 100),
      { scale: 1, offsetX: 0, offsetY: 0 },
      200,
    );
    expect(out.width).toBe(200);
    expect(out.height).toBe(200);
  });

  it('clips to a circle of radius diameterPx/2 centred on the canvas', () => {
    composeBackImageCanvas(
      stubImage(200, 100),
      { scale: 1, offsetX: 0, offsetY: 0 },
      200,
    );
    expect(ctx.arc).toHaveBeenCalledWith(100, 100, 100, 0, Math.PI * 2);
    expect(ctx.clip).toHaveBeenCalledTimes(1);
  });

  it('translates by (centre + offset) and scales by placement.scale', () => {
    composeBackImageCanvas(
      stubImage(200, 100),
      { scale: 2, offsetX: 30, offsetY: -10 },
      200,
    );
    expect(ctx.translate).toHaveBeenCalledWith(100 + 30, 100 + -10);
    expect(ctx.scale).toHaveBeenCalledWith(2, 2);
  });

  it('draws the image with its centre at the transformed origin (drawImage at -w/2, -h/2)', () => {
    const img = stubImage(200, 100);
    composeBackImageCanvas(
      img,
      { scale: 1, offsetX: 0, offsetY: 0 },
      200,
    );
    expect(ctx.drawImage).toHaveBeenCalledWith(img, -100, -50);
  });

  it('emits operators in clip-before-transform-before-draw order (save/clip/translate/scale/drawImage/restore)', () => {
    const callLog: string[] = [];
    for (const key of Object.keys(ctx) as (keyof MockCtx)[]) {
      ctx[key].mockImplementation(() => callLog.push(key));
    }
    composeBackImageCanvas(
      stubImage(200, 100),
      { scale: 1, offsetX: 0, offsetY: 0 },
      200,
    );
    // Slice out the operators that matter for ordering; ignore beginPath /
    // closePath chatter so the test stays robust to immaterial reshuffles.
    const ordered = callLog.filter((c) =>
      ['save', 'clip', 'translate', 'scale', 'drawImage', 'restore'].includes(
        c,
      ),
    );
    expect(ordered).toEqual([
      'save',
      'clip',
      'translate',
      'scale',
      'drawImage',
      'restore',
    ]);
  });

  it('honours a non-square diameterPx by clipping at the requested radius (edge case: small diameter)', () => {
    composeBackImageCanvas(
      stubImage(200, 100),
      { scale: 1, offsetX: 0, offsetY: 0 },
      40,
    );
    // For diameterPx=40 → centre=20, radius=20.
    expect(ctx.arc).toHaveBeenCalledWith(20, 20, 20, 0, Math.PI * 2);
  });

  it('throws if the canvas has no 2D context', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    expect(() =>
      composeBackImageCanvas(
        stubImage(200, 100),
        { scale: 1, offsetX: 0, offsetY: 0 },
        200,
      ),
    ).toThrow(/2D context/);
  });
});
