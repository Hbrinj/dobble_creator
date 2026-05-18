import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { BackImagePreview } from './BackImagePreview';
import type { BackImagePlacement } from '../render/backImagePlacement';

// jsdom has no real 2D context. Install a structural mock that captures
// operator calls — the same pattern used by drawCard.test.ts and
// composeBackImageCanvas.test.ts.
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
  stroke: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
  strokeStyle: string;
  lineWidth: number;
}

beforeEach(() => {
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
    stroke: vi.fn(),
    clearRect: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
  };
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ctx as unknown as CanvasRenderingContext2D,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

// jsdom does not implement Element.setPointerCapture / hasPointerCapture /
// releasePointerCapture. Stub them so the pointer-capture drag path runs.
beforeEach(() => {
  Element.prototype.setPointerCapture =
    Element.prototype.setPointerCapture ?? vi.fn();
  Element.prototype.releasePointerCapture =
    Element.prototype.releasePointerCapture ?? vi.fn();
  Element.prototype.hasPointerCapture =
    Element.prototype.hasPointerCapture ?? (() => true);
});

const stubImage = (width = 200, height = 100): HTMLImageElement =>
  ({ width, height }) as unknown as HTMLImageElement;

const basePlacement = (): BackImagePlacement => ({
  scale: 1,
  offsetX: 0,
  offsetY: 0,
});

describe('BackImagePreview', () => {
  it('renders a 320×320 canvas', () => {
    const { container } = render(
      <BackImagePreview
        image={null}
        placement={basePlacement()}
        onChange={vi.fn()}
      />,
    );
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas!.width).toBe(320);
    expect(canvas!.height).toBe(320);
  });

  it('does not draw any image when image is null (empty canvas)', () => {
    let ctxRef: MockCtx | null = null;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => {
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        arc: vi.fn(),
        clip: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        drawImage: vi.fn(),
        stroke: vi.fn(),
        clearRect: vi.fn(),
        strokeStyle: '',
        lineWidth: 0,
      } as MockCtx;
      ctxRef = ctx;
      return ctx as unknown as CanvasRenderingContext2D;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    render(
      <BackImagePreview
        image={null}
        placement={basePlacement()}
        onChange={vi.fn()}
      />,
    );
    expect(ctxRef!.drawImage).not.toHaveBeenCalled();
  });

  it('draws the image into the canvas when image and placement are provided', () => {
    let ctxRef: MockCtx | null = null;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => {
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        arc: vi.fn(),
        clip: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        drawImage: vi.fn(),
        stroke: vi.fn(),
        clearRect: vi.fn(),
        strokeStyle: '',
        lineWidth: 0,
      } as MockCtx;
      ctxRef = ctx;
      return ctx as unknown as CanvasRenderingContext2D;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    render(
      <BackImagePreview
        image={stubImage(200, 100)}
        placement={basePlacement()}
        onChange={vi.fn()}
      />,
    );
    expect(ctxRef!.drawImage).toHaveBeenCalled();
  });

  it('strokes a guide circle over the composed image when an image is loaded', () => {
    // The visible canvas's context is the first one allocated (the
    // composer's offscreen canvas is constructed inside the effect, after
    // the visible canvas has already been measured). Capture the first ctx
    // so we can assert stroke fired on it specifically.
    const contexts: MockCtx[] = [];
    HTMLCanvasElement.prototype.getContext = vi.fn(() => {
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        arc: vi.fn(),
        clip: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        drawImage: vi.fn(),
        stroke: vi.fn(),
        clearRect: vi.fn(),
        strokeStyle: '',
        lineWidth: 0,
      } as MockCtx;
      contexts.push(ctx);
      return ctx as unknown as CanvasRenderingContext2D;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    render(
      <BackImagePreview
        image={stubImage(200, 100)}
        placement={basePlacement()}
        onChange={vi.fn()}
      />,
    );
    // At least one of the contexts must have received a stroke (the visible
    // canvas's). The composer's offscreen ctx does not stroke; the visible
    // canvas's does (the guide ring).
    expect(contexts.some((c) => c.stroke.mock.calls.length > 0)).toBe(true);
  });

  it('emits onChange with an updated offset when the user drags via pointer events', () => {
    const onChange = vi.fn();
    const { container } = render(
      <BackImagePreview
        image={stubImage(200, 100)}
        placement={basePlacement()}
        onChange={onChange}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      clientX: 110,
      clientY: 105,
    });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 110, clientY: 105 });
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)![0] as BackImagePlacement;
    // Pointer-move delta was (+10, +5); offset should move by that amount in
    // canvas-pixel units (320-px frame → 1:1 within preview).
    expect(last.offsetX).toBeGreaterThan(0);
    expect(last.offsetY).toBeGreaterThan(0);
  });

  it('clamps the emitted offset so the image footprint still contains (0, 0)', () => {
    const onChange = vi.fn();
    const { container } = render(
      <BackImagePreview
        image={stubImage(200, 100)}
        placement={basePlacement()}
        onChange={onChange}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 0, clientY: 0 });
    // Drag far enough to exceed the legal pan limit. clampPan should bring
    // it back to ±(width × scale / 2) in the preview frame. Preview frame is
    // 320 px and the image is rendered at fillScale (320 / max(200,100) =
    // 1.6); the legal pan limit on X is then 200 * 1.6 / 2 = 160.
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      clientX: 99999,
      clientY: 0,
    });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 99999, clientY: 0 });
    const last = onChange.mock.calls.at(-1)![0] as BackImagePlacement;
    expect(last.offsetX).toBeLessThanOrEqual(160 + 1e-6);
  });

  it('keeps emitting drag updates after the pointer leaves the 320 px canvas (pointer capture)', () => {
    // Regression for the "drag stops mid-gesture if the cursor exits the
    // 320 px target" bug. The pointer-capture path means pointermove keeps
    // flowing even when the event coordinates land outside the canvas.
    const onChange = vi.fn();
    const { container } = render(
      <BackImagePreview
        image={stubImage(200, 100)}
        placement={basePlacement()}
        onChange={onChange}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 50, clientY: 50 });
    // Pointer leaves the canvas — with pointer capture, the listener still
    // fires and we still get an offset update.
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      clientX: 500,
      clientY: 50,
    });
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)![0] as BackImagePlacement;
    expect(last.offsetX).not.toBe(0);
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 500, clientY: 50 });
  });

  it('wheel with negative deltaY scales up by 1.1× (native handler)', () => {
    const onChange = vi.fn();
    const { container } = render(
      <BackImagePreview
        image={stubImage(200, 100)}
        placement={basePlacement()}
        onChange={onChange}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.wheel(canvas, { deltaY: -1, clientX: 160, clientY: 160 });
    const last = onChange.mock.calls.at(-1)![0] as BackImagePlacement;
    expect(last.scale).toBeCloseTo(1.1);
  });

  it('wheel with positive deltaY scales down by 1/1.1 (native handler)', () => {
    const onChange = vi.fn();
    const { container } = render(
      <BackImagePreview
        image={stubImage(200, 100)}
        placement={{ scale: 2, offsetX: 0, offsetY: 0 }}
        onChange={onChange}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.wheel(canvas, { deltaY: 1, clientX: 160, clientY: 160 });
    const last = onChange.mock.calls.at(-1)![0] as BackImagePlacement;
    expect(last.scale).toBeCloseTo(2 / 1.1);
  });

  it('wheel scale is clamped to the placement bounds (edge case)', () => {
    const onChange = vi.fn();
    const { container } = render(
      <BackImagePreview
        image={stubImage(200, 100)}
        // Already at MAX × fillScale. fillScale for a 200×100 image in 320 px
        // is 320/200 = 1.6 → MAX × fill = 16. Start at 16 and try to zoom up.
        placement={{ scale: 16, offsetX: 0, offsetY: 0 }}
        onChange={onChange}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.wheel(canvas, { deltaY: -1, clientX: 160, clientY: 160 });
    const last = onChange.mock.calls.at(-1)![0] as BackImagePlacement;
    expect(last.scale).toBe(16);
  });

  it('wheel zoom is cursor-centred — the point under the cursor stays anchored', () => {
    const onChange = vi.fn();
    const { container } = render(
      <BackImagePreview
        image={stubImage(200, 100)}
        placement={basePlacement()}
        onChange={onChange}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    // Cursor is 60 px to the right of the canvas centre (160, 160). After a
    // 1.1× zoom, the offset must move so the same source pixel is still under
    // the cursor → offsetX_new = 1.1*offsetX_old - 0.1*cursorOffsetX_canvas.
    // For starting offsetX=0 and cursorOffsetX=60, expected offsetX_new = -6.
    fireEvent.wheel(canvas, { deltaY: -1, clientX: 220, clientY: 160 });
    const last = onChange.mock.calls.at(-1)![0] as BackImagePlacement;
    expect(last.offsetX).toBeCloseTo(-6);
  });

  it('the wheel handler calls preventDefault so page-scroll is suppressed', () => {
    // Regression: a React synthetic `onWheel` is registered passive, so
    // preventDefault would be a no-op (and the page would also scroll while
    // the user zooms). The native listener we register in a useEffect with
    // { passive: false } MUST be the one that fires and MUST consume the
    // event. We assert that the dispatched WheelEvent's defaultPrevented
    // flag flips to true after the handler runs.
    const onChange = vi.fn();
    const { container } = render(
      <BackImagePreview
        image={stubImage(200, 100)}
        placement={basePlacement()}
        onChange={onChange}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    // Dispatch a *real* WheelEvent (cancelable). fireEvent.wheel routes the
    // event through dispatchEvent, so a native addEventListener handler picks
    // it up exactly as it would in a browser.
    const event = new WheelEvent('wheel', {
      deltaY: -1,
      clientX: 160,
      clientY: 160,
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenCalled();
  });

  it('the wheel handler is removed when the image is cleared', () => {
    // If we unmount the native listener with the effect's cleanup, no
    // onChange should fire on a wheel event after the image goes null.
    const onChange = vi.fn();
    const { container, rerender } = render(
      <BackImagePreview
        image={stubImage(200, 100)}
        placement={basePlacement()}
        onChange={onChange}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    rerender(
      <BackImagePreview
        image={null}
        placement={basePlacement()}
        onChange={onChange}
      />,
    );
    onChange.mockClear();
    fireEvent.wheel(canvas, { deltaY: -1, clientX: 160, clientY: 160 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
