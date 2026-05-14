import { describe, it, expect, vi } from 'vitest';
import { drawCard, type DrawCardOptions, type SymbolImage } from './drawCard';
import type { PackedCircle } from '../lib/packer';

const DEFAULT_SILHOUETTE = { cx: 0.5, cy: 0.5, r: 0.5 } as const;

/**
 * Build a minimal stub of CanvasRenderingContext2D that records every call.
 * jsdom does not implement a real canvas, so we use a hand-rolled spy.
 */
const makeStubContext = (): {
  ctx: CanvasRenderingContext2D;
  calls: string[];
  drawImageArgs: unknown[][];
} => {
  const calls: string[] = [];
  const drawImageArgs: unknown[][] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      void args;
      calls.push(name);
    };
  const drawImage = (...args: unknown[]) => {
    calls.push('drawImage');
    drawImageArgs.push(args);
  };
  const ctx = {
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    arc: record('arc'),
    clip: record('clip'),
    translate: record('translate'),
    rotate: record('rotate'),
    drawImage,
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    stroke: record('stroke'),
    fill: record('fill'),
    clearRect: record('clearRect'),
    fillStyle: '' as string,
    strokeStyle: '' as string,
    lineWidth: 0,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls, drawImageArgs };
};

const makeStubCanvas = (
  size: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; calls: string[]; drawImageArgs: unknown[][] } => {
  const stub = makeStubContext();
  const canvas = {
    width: size,
    height: size,
    getContext: vi.fn(() => stub.ctx),
  } as unknown as HTMLCanvasElement;
  return { canvas, ctx: stub.ctx, calls: stub.calls, drawImageArgs: stub.drawImageArgs };
};

const makeSymbol = (
  name: string,
  silhouette: { cx: number; cy: number; r: number } = DEFAULT_SILHOUETTE,
  width = 100,
  height = 100,
): SymbolImage =>
  ({ tag: name, width, height, silhouette }) as unknown as SymbolImage;

const stubPacking: PackedCircle[] = [
  { x: -0.4, y: -0.3, r: 0.3 },
  { x: 0.4, y: -0.3, r: 0.25 },
  { x: 0.0, y: 0.4, r: 0.28 },
];

const baseOptions: DrawCardOptions = {
  diameterPx: 1000,
  background: 'white',
  outline: true,
};

describe('drawCard', () => {
  it('draws an image once per packed circle', () => {
    const { canvas, calls } = makeStubCanvas(1000);
    const symbols = [makeSymbol('a'), makeSymbol('b'), makeSymbol('c')];
    drawCard(canvas, symbols, stubPacking, [0, Math.PI / 4, Math.PI / 2], baseOptions);
    const drawImageCount = calls.filter((c) => c === 'drawImage').length;
    expect(drawImageCount).toBe(3);
  });

  it('applies save → clip → translate → rotate → drawImage → restore per symbol', () => {
    const { canvas, calls } = makeStubCanvas(1000);
    const symbols = [makeSymbol('a'), makeSymbol('b'), makeSymbol('c')];
    drawCard(canvas, symbols, stubPacking, [0, 0, 0], baseOptions);
    // For each symbol we expect at minimum these calls in order: save, beginPath, arc, clip, translate, rotate, drawImage, restore
    const expectedPattern = ['save', 'beginPath', 'arc', 'clip', 'translate', 'rotate', 'drawImage', 'restore'];
    for (let i = 0; i < 3; i++) {
      // find the i-th drawImage and inspect the surrounding sequence
      const drawIdx = calls.reduce<number[]>((acc, c, idx) => {
        if (c === 'drawImage') acc.push(idx);
        return acc;
      }, []);
      expect(drawIdx.length).toBe(3);
      const idx = drawIdx[i]!;
      const before = calls.slice(0, idx);
      // The closest preceding 'save' marks the start of this symbol's block
      const saveIdx = before.lastIndexOf('save');
      const sequence = calls.slice(saveIdx, idx + 2);
      for (const expected of expectedPattern) {
        expect(sequence).toContain(expected);
      }
    }
  });

  it('clears and fills the background before drawing symbols', () => {
    const { canvas, calls } = makeStubCanvas(1000);
    drawCard(canvas, [makeSymbol('a')], [stubPacking[0]!], [0], baseOptions);
    const clearIdx = calls.indexOf('clearRect');
    const fillRectIdx = calls.indexOf('fillRect');
    const firstDrawImageIdx = calls.indexOf('drawImage');
    expect(clearIdx).toBeGreaterThanOrEqual(0);
    expect(fillRectIdx).toBeGreaterThan(clearIdx);
    expect(firstDrawImageIdx).toBeGreaterThan(fillRectIdx);
  });

  it('omits background fill when background is transparent', () => {
    const { canvas, calls } = makeStubCanvas(1000);
    drawCard(canvas, [makeSymbol('a')], [stubPacking[0]!], [0], {
      ...baseOptions,
      background: 'transparent',
    });
    // clearRect still happens to reset the canvas, but no fillRect for the bg
    expect(calls).toContain('clearRect');
    expect(calls).not.toContain('fillRect');
  });

  it('draws an outline when the option is enabled', () => {
    const { canvas, calls } = makeStubCanvas(1000);
    drawCard(canvas, [makeSymbol('a')], [stubPacking[0]!], [0], {
      ...baseOptions,
      outline: true,
    });
    expect(calls).toContain('stroke');
  });

  it('skips the outline when disabled', () => {
    const { canvas, calls } = makeStubCanvas(1000);
    drawCard(canvas, [makeSymbol('a')], [stubPacking[0]!], [0], {
      ...baseOptions,
      outline: false,
    });
    // 'stroke' should not appear (only beginPath/arc for the clip, which doesn't stroke)
    expect(calls).not.toContain('stroke');
  });

  it('rejects mismatched arrays (symbol/packing/rotation lengths)', () => {
    const { canvas } = makeStubCanvas(1000);
    expect(() =>
      drawCard(canvas, [makeSymbol('a')], stubPacking, [0, 0, 0], baseOptions),
    ).toThrow();
  });

  it('throws when canvas 2D context is unavailable', () => {
    const canvas = {
      width: 100,
      height: 100,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    expect(() => drawCard(canvas, [], [], [], baseOptions)).toThrow();
  });

  it('falls back to a finite scale when the silhouette is degenerate (sil.r === 0)', () => {
    // A 1×1 opaque PNG produces a single-point silhouette (r = 0). The
    // silhouette-radius-based scale would be Infinity, which makes
    // drawImage no-op or throw. drawCard must fall back to a finite scale
    // (longer-edge-to-slot-diameter) so the draw still produces output.
    const symbol = makeSymbol('degenerate', { cx: 0, cy: 0, r: 0 }, 1, 1);
    const slot: PackedCircle = { x: 0, y: 0, r: 0.2 };
    const { canvas, drawImageArgs } = makeStubCanvas(1000);
    drawCard(canvas, [symbol], [slot], [0], baseOptions);
    expect(drawImageArgs).toHaveLength(1);
    const [, drawX, drawY, drawW, drawH] = drawImageArgs[0]!;
    for (const v of [drawX, drawY, drawW, drawH]) {
      expect(Number.isFinite(v as number)).toBe(true);
    }
    expect(drawW as number).toBeGreaterThan(0);
    expect(drawH as number).toBeGreaterThan(0);
  });

  it("draws each image scaled and positioned so its silhouette circle maps to the slot circle", () => {
    // Single-slot fixture: slot at (0.3, 0.4) with radius 0.2 in parent-unit
    // frame (parent radius = 1). On a 1000px canvas the slot maps to:
    //   slotCxPx = 500 + 0.3 * 500 = 650
    //   slotCyPx = 500 + 0.4 * 500 = 700
    //   slotRPx  = 0.2 * 500       = 100
    const naturalWidth = 200;
    const naturalHeight = 240;
    const silhouette = { cx: 0.4, cy: 0.6, r: 0.25 };
    const symbol = makeSymbol('s', silhouette, naturalWidth, naturalHeight);
    const slot: PackedCircle = { x: 0.3, y: 0.4, r: 0.2 };

    const { canvas, drawImageArgs } = makeStubCanvas(1000);
    drawCard(canvas, [symbol], [slot], [0], baseOptions);

    expect(drawImageArgs).toHaveLength(1);
    const [src, drawX, drawY, drawW, drawH] = drawImageArgs[0]!;
    void src;
    // Expected per Decision 10 (in the post-translate/rotate local frame —
    // ctx.translate(slotCx, slotCy) and ctx.rotate(0) leave the origin at
    // the slot centre, so drawImage receives offsets relative to (slotCx,
    // slotCy)):
    //   scale = slotRPx / (silhouette.r * naturalWidth)
    //   drawX = -silhouette.cx * naturalWidth  * scale
    //   drawY = -silhouette.cy * naturalHeight * scale
    //   drawW =  naturalWidth  * scale
    //   drawH =  naturalHeight * scale
    const slotRPx = slot.r * 500;
    const scale = slotRPx / (silhouette.r * naturalWidth);
    const expectedDrawX = -silhouette.cx * naturalWidth * scale;
    const expectedDrawY = -silhouette.cy * naturalHeight * scale;
    const expectedDrawW = naturalWidth * scale;
    const expectedDrawH = naturalHeight * scale;
    expect(drawX as number).toBeCloseTo(expectedDrawX, 5);
    expect(drawY as number).toBeCloseTo(expectedDrawY, 5);
    expect(drawW as number).toBeCloseTo(expectedDrawW, 5);
    expect(drawH as number).toBeCloseTo(expectedDrawH, 5);
  });
});
