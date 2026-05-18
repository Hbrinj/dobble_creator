import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type JSX,
} from 'react';
import { UploadCloud } from 'lucide-react';
import { BackImagePreview } from './BackImagePreview';
import {
  computeFillScale,
  type BackImagePlacement,
} from '../render/backImagePlacement';

const PREVIEW_DIAMETER_PX = 320;

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
export function CardBack({ onChange }: CardBackProps): JSX.Element {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [placement, setPlacement] = useState<BackImagePlacement>({
    scale: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track the object URL we minted for the current image so we can revoke it
  // when the image is replaced or the component unmounts.
  const currentObjectUrlRef = useRef<string | null>(null);

  // Propagate every (image, placement) edit to the parent.
  useEffect(() => {
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

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      // Reset the input value so re-selecting the same file fires a change.
      event.target.value = '';
      if (!file) return;
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
    [],
  );

  const handleReset = useCallback(() => {
    if (!image) return;
    setPlacement(fillDefault(image.width, image.height));
  }, [image]);

  const handleClickEmptyState = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <section
      aria-label="Card back"
      className="bg-slate-900 rounded-xl p-6 border border-slate-800 space-y-3"
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
