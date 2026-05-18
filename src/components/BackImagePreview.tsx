import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { composeBackImageCanvas } from '../render/composeBackImageCanvas';
import {
  clampPan,
  clampScale,
  computeFillScale,
  type BackImagePlacement,
} from '../render/backImagePlacement';

const PREVIEW_DIAMETER_PX = 320;
const WHEEL_ZOOM_FACTOR = 1.1;
const GUIDE_STROKE_COLOR = '#f59e0b'; // amber-500, matches the project accent
const GUIDE_STROKE_WIDTH_PX = 1;

export interface BackImagePreviewProps {
  /** Loaded image to compose; `null` renders an empty canvas. */
  readonly image: HTMLImageElement | null;
  /** Current placement; expressed in preview-frame canvas pixels. */
  readonly placement: BackImagePlacement;
  /** Called with the next placement on every gesture frame (drag or wheel). */
  readonly onChange: (next: BackImagePlacement) => void;
}

/**
 * 320×320 circular preview of the user's card-back image. Composes via
 * `composeBackImageCanvas` (single source of truth — same helper feeds the
 * PDF export) and overlays a thin amber circular guide stroke so the user
 * can see exactly which pixels will land inside the card's visible area.
 *
 * Interaction: mouse-drag to pan, mouse-wheel to zoom (cursor-centred,
 * 1.1× per notch). Touch / pinch deferred per Decision 9.
 */
export function BackImagePreview({
  image,
  placement,
  onChange,
}: BackImagePreviewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Drag state lives in a ref so React re-renders during drag don't reset it.
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fillScale = image
    ? computeFillScale(image.width, image.height, PREVIEW_DIAMETER_PX)
    : 0;

  // Redraw whenever image or placement changes. The composer paints into its
  // own offscreen canvas; we then blit it to the visible canvas and stroke
  // the guide ring on top.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, PREVIEW_DIAMETER_PX, PREVIEW_DIAMETER_PX);
    if (image) {
      const composed = composeBackImageCanvas(
        image,
        placement,
        PREVIEW_DIAMETER_PX,
      );
      ctx.drawImage(composed, 0, 0);
      // Guide stroke: drawn at the *card* radius (no bleed) so the user
      // designs against the post-trim visible area (Decision 11). The
      // preview's PREVIEW_DIAMETER_PX is the card-only diameter here — the
      // bleed-aware larger composer call only fires on PDF export.
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        PREVIEW_DIAMETER_PX / 2,
        PREVIEW_DIAMETER_PX / 2,
        PREVIEW_DIAMETER_PX / 2 - GUIDE_STROKE_WIDTH_PX / 2,
        0,
        Math.PI * 2,
      );
      ctx.closePath();
      ctx.strokeStyle = GUIDE_STROKE_COLOR;
      ctx.lineWidth = GUIDE_STROKE_WIDTH_PX;
      ctx.stroke();
      ctx.restore();
    }
  }, [image, placement]);

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      if (!image) return;
      dragRef.current = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        startOffsetX: placement.offsetX,
        startOffsetY: placement.offsetY,
      };
      setIsDragging(true);
    },
    [image, placement.offsetX, placement.offsetY],
  );

  const handleMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      const start = dragRef.current;
      if (!start || !image) return;
      const deltaX = event.clientX - start.startClientX;
      const deltaY = event.clientY - start.startClientY;
      const next = clampPan(
        {
          offsetX: start.startOffsetX + deltaX,
          offsetY: start.startOffsetY + deltaY,
        },
        placement.scale,
        { width: image.width, height: image.height },
        PREVIEW_DIAMETER_PX,
      );
      onChange({ ...placement, ...next });
    },
    [image, onChange, placement],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLCanvasElement>) => {
      if (!image) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
      const requestedScale = placement.scale * factor;
      const nextScale = clampScale(requestedScale, fillScale);
      // If the clamp pinned the scale (e.g. already at MAX), the offset must
      // not drift either — the cursor-centred adjustment is proportional to
      // the *applied* scale change, not the *requested* one.
      const appliedFactor =
        placement.scale > 0 ? nextScale / placement.scale : 1;
      const rect = event.currentTarget.getBoundingClientRect();
      const cursorXRel =
        event.clientX - rect.left - PREVIEW_DIAMETER_PX / 2;
      const cursorYRel =
        event.clientY - rect.top - PREVIEW_DIAMETER_PX / 2;
      // Cursor-centred zoom: the canvas point under the cursor must stay
      // anchored to the same source pixel after the scale change.
      //   offset_new = cursorRel + appliedFactor * (offset_old - cursorRel)
      const rawOffsetX =
        cursorXRel + appliedFactor * (placement.offsetX - cursorXRel);
      const rawOffsetY =
        cursorYRel + appliedFactor * (placement.offsetY - cursorYRel);
      const clamped = clampPan(
        { offsetX: rawOffsetX, offsetY: rawOffsetY },
        nextScale,
        { width: image.width, height: image.height },
        PREVIEW_DIAMETER_PX,
      );
      onChange({
        scale: nextScale,
        offsetX: clamped.offsetX,
        offsetY: clamped.offsetY,
      });
    },
    [fillScale, image, onChange, placement.offsetX, placement.offsetY, placement.scale],
  );

  const cursor = !image ? 'default' : isDragging ? 'grabbing' : 'grab';

  return (
    <canvas
      ref={canvasRef}
      width={PREVIEW_DIAMETER_PX}
      height={PREVIEW_DIAMETER_PX}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onWheel={handleWheel}
      aria-label="Card back placement preview"
      style={{ cursor, touchAction: 'none' }}
      className="rounded-full"
    />
  );
}

export const _PREVIEW_DIAMETER_PX_FOR_TEST = PREVIEW_DIAMETER_PX;
