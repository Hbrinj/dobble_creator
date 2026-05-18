import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type JSX,
} from 'react';
import { UploadCloud } from 'lucide-react';
import { BackImagePreview } from './BackImagePreview';
import {
  computeFillScale,
  PREVIEW_DIAMETER_PX,
  type BackImagePlacement,
} from '../render/backImagePlacement';
import { validateBackImageFile } from '../render/backImageValidation';

const fillDefault = (width: number, height: number): BackImagePlacement => ({
  scale: computeFillScale(width, height, PREVIEW_DIAMETER_PX),
  offsetX: 0,
  offsetY: 0,
});

export interface CardBackProps {
  /**
   * Called with the loaded image + current placement on every change (upload,
   * drag, wheel, reset). The parent uses these to compose the back PNG at
   * export time via the same composer the preview renders with.
   *
   * `image` is `null` until the user uploads a file; once non-null it stays
   * non-null for the lifetime of the component.
   */
  readonly onChange: (
    image: HTMLImageElement | null,
    placement: BackImagePlacement,
  ) => void;
  /**
   * Surface a user-correctable warning (e.g. wrong MIME type on a drag-drop)
   * via the app-level notice strip. Mirrors `UploadDropzone`'s `onWarning`
   * prop — the same `handleWarning` callback is wired in `App.tsx`.
   */
  readonly onWarning: (message: string) => void;
}

/**
 * Owns the card-back lifecycle: empty-state dropzone, file input, loaded
 * preview with drag/zoom, and a Reset button. Reads file → loads into an
 * HTMLImageElement → emits (image, placement) to the parent so PDF export
 * can call composeBackImageCanvas with the exact same arguments the preview
 * is showing.
 *
 * Re-upload and Reset share the same code path per Decision 7 / 8 — both
 * compute the fill default for the current image and reset the offset to
 * (0, 0). Any prior user tweaks are discarded.
 */
export function CardBack({ onChange, onWarning }: CardBackProps): JSX.Element {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [placement, setPlacement] = useState<BackImagePlacement>({
    scale: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track the object URL we minted for the current image so we can revoke it
  // when the image is replaced or the component unmounts.
  const currentObjectUrlRef = useRef<string | null>(null);

  // Propagate every (image, placement) edit to the parent. Guarded so the
  // mount-time `(null, {scale:0,...})` from the initial state does not fire —
  // the parent only learns about the back image once one is actually loaded.
  useEffect(() => {
    if (!image) return;
    onChange(image, placement);
  }, [image, placement, onChange]);

  // Revoke the active object URL on unmount.
  useEffect(() => {
    return () => {
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
      }
    };
  }, []);

  // Shared load path for both the click-to-browse picker and the drag-drop
  // surface. Validation runs FIRST so an invalid file never reaches the
  // URL/Image side effects — the wrong-MIME case emits a warning via the
  // app-level notice strip and returns early.
  const loadFileIntoState = useCallback(
    (file: File): void => {
      const validation = validateBackImageFile(file);
      if (!validation.ok) {
        onWarning(validation.reason);
        return;
      }
      // Revoke the previous URL before minting the new one.
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
      }
      const url = URL.createObjectURL(file);
      currentObjectUrlRef.current = url;
      const next = new Image();
      next.onload = (): void => {
        setImage(next);
        setPlacement(fillDefault(next.width, next.height));
      };
      next.src = url;
    },
    [onWarning],
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (!file) return;
      // Reset the input value so re-selecting the same file fires a change.
      // Guarded above so a cancelled picker does not mutate the input value.
      event.target.value = '';
      loadFileIntoState(file);
    },
    [loadFileIntoState],
  );

  const handleReset = useCallback(() => {
    if (!image) return;
    setPlacement(fillDefault(image.width, image.height));
  }, [image]);

  const handleClickEmptyState = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLElement>): void => {
      event.preventDefault();
      event.stopPropagation();
      // Tell the browser the drop is a "copy" so the cursor shows the right
      // affordance instead of the default "not allowed".
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
      if (!isDragOver) setIsDragOver(true);
    },
    [isDragOver],
  );

  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>): void => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
      // Multi-file drop: silently take the first file (mirrors the click
      // path's `event.target.files?.[0]`). The drop surface is unambiguous,
      // so a "ignored N others" notice would just clutter the notice bar.
      const file = event.dataTransfer?.files?.[0];
      if (file) loadFileIntoState(file);
    },
    [loadFileIntoState],
  );

  // Mirror UploadDropzone's stateClasses split so the drag-over feedback is
  // visually identical across both dropzones.
  const dragStateClasses = isDragOver
    ? 'border-amber-500 bg-amber-500/10 scale-[1.005]'
    : 'border-slate-700 hover:border-slate-500';

  return (
    <section
      aria-label="Card back"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-slate-900 rounded-xl p-6 border space-y-3 transition-[transform,background-color,border-color] duration-150 ${dragStateClasses}`}
    >
      <h2 className="text-lg font-semibold mb-1">Card back</h2>

      {/*
        The file input is always present (just visually hidden when not in
        empty state) so the label-based query in tests resolves regardless of
        whether an image has been uploaded.
      */}
      <input
        id="card-back-image-input"
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Card back image"
      />

      {image ? (
        <div className="flex flex-col items-center gap-3">
          <BackImagePreview
            image={image}
            placement={placement}
            onChange={setPlacement}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:outline-offset-2"
            >
              Reset placement
            </button>
            <button
              type="button"
              onClick={handleClickEmptyState}
              className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:outline-offset-2"
            >
              Replace image
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClickEmptyState}
          className="min-h-48 w-full flex flex-col items-center justify-center gap-2 text-center px-6 py-8 border-2 border-dashed rounded-xl bg-slate-900 cursor-pointer transition-[transform,background-color,border-color] duration-150 border-slate-700 hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:outline-offset-2"
        >
          <UploadCloud aria-hidden="true" className="size-8 text-slate-400" />
          <p className="text-slate-100">Upload a card-back image</p>
          <p className="text-sm text-slate-400">
            PNG, JPEG, or WebP. Scale and pan after upload.
          </p>
        </button>
      )}
    </section>
  );
}
