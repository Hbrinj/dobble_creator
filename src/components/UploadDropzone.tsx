import { useCallback, useRef, useState, type DragEvent, type JSX } from 'react';
import { UploadCloud } from 'lucide-react';

const ACCEPTED_MIME_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

const LARGE_FILE_BYTES = 5 * 1024 * 1024;

export interface UploadDropzoneProps {
  readonly onImagesAdded: (files: readonly File[]) => void;
  readonly onWarning: (message: string) => void;
  readonly onError: (message: string) => void;
}

export function UploadDropzone({
  onImagesAdded,
  onWarning,
  onError,
}: UploadDropzoneProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = useCallback(
    (incoming: readonly File[]) => {
      if (incoming.length === 0) return;
      const accepted: File[] = [];
      const rejectedNames: string[] = [];
      const warnings: string[] = [];

      for (const file of incoming) {
        if (!ACCEPTED_MIME_TYPES.has(file.type)) {
          rejectedNames.push(file.name);
          continue;
        }
        if (file.size > LARGE_FILE_BYTES) {
          warnings.push(
            `${file.name} is larger than 5MB and may slow rendering.`,
          );
        }
        accepted.push(file);
      }

      if (rejectedNames.length > 0) {
        onError(
          `Skipped unsupported file${rejectedNames.length > 1 ? 's' : ''}: ${rejectedNames.join(', ')}`,
        );
      }
      for (const w of warnings) onWarning(w);
      if (accepted.length > 0) onImagesAdded(accepted);
    },
    [onImagesAdded, onWarning, onError],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      handleFiles(files);
    },
    [handleFiles],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const onClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [],
  );

  const baseClasses =
    'min-h-48 flex flex-col items-center justify-center gap-2 text-center px-6 py-8 border-2 border-dashed rounded-xl bg-slate-900 cursor-pointer transition-[transform,background-color,border-color] duration-150 focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:outline-offset-2';
  const stateClasses = isDragOver
    ? 'border-amber-500 bg-amber-500/10 scale-[1.005]'
    : 'border-slate-700 hover:border-slate-500';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload images by clicking or dragging files here"
      onClick={onClick}
      onKeyDown={onKeyDown}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`${baseClasses} ${stateClasses}`}
    >
      <UploadCloud aria-hidden="true" className="size-8 text-slate-400" />
      <p className="text-slate-100">
        Drop images here, or click to choose files
      </p>
      <p className="text-sm text-slate-400">
        Accepted: PNG, JPEG, WebP, SVG. Min 7 images, max 200.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={(e) => {
          handleFiles(Array.from(e.target.files ?? []));
          // Reset so re-selecting the same file fires another change event.
          e.target.value = '';
        }}
        className="hidden"
      />
    </div>
  );
}
