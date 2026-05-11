import { describe, it, expect, vi } from 'vitest';
import { drawCard, type DrawCardOptions, type SymbolImage } from './drawCard';
import type { PackedCircle } from '../lib/packer';

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

const makeSymbol = (name: string): SymbolImage =>
  ({ tag: name, width: 100, height: 100 }) as unknown as SymbolImage;

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
});
