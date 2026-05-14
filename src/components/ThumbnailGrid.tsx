import { useRef, type DragEvent, type JSX } from 'react';
import { Trash2 } from 'lucide-react';

export interface Thumbnail {
  readonly id: string;
  readonly name: string;
  /** Object URL or data URL for the thumbnail preview. */
  readonly url: string;
}

export interface ReorderEvent {
  readonly from: number;
  readonly to: number;
}

export interface ToggleIncludeEvent {
  readonly from: number;
  readonly to: number;
}

export interface RemoveEvent {
  readonly id: string;
}

export interface ThumbnailGridProps {
  readonly thumbnails: readonly Thumbnail[];
  /** How many of the leading thumbnails are included in the active deck. */
  readonly includedCount: number;
  readonly onReorder: (event: ReorderEvent) => void;
  readonly onToggleInclude: (event: ToggleIncludeEvent) => void;
  readonly onRemove: (event: RemoveEvent) => void;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Visual grid of uploaded thumbnails. The first `includedCount` items are
 * marked as "included" (rendered normally); the rest are "excluded" (faded).
 *
 * Click-to-toggle: clicking an excluded item swaps it with the last included
 * item so it moves into the included prefix; clicking an included item swaps
 * it with the first excluded one to remove it from the active deck.
 *
 * Drag-reorder: standard HTML5 drag events. Drop position becomes the new
 * index of the dragged item.
 */
export function ThumbnailGrid({
  thumbnails,
  includedCount,
  onReorder,
  onToggleInclude,
  onRemove,
}: ThumbnailGridProps): JSX.Element {
  const draggingIndexRef = useRef<number | null>(null);
  const effectiveIncluded = clamp(includedCount, 0, thumbnails.length);

  const handleToggle = (index: number): void => {
    if (index < effectiveIncluded) {
      // included → push out to first excluded slot
      const target = effectiveIncluded;
      if (target < thumbnails.length) {
        onToggleInclude({ from: index, to: target });
      }
    } else {
      // excluded → swap with last included slot
      const target = effectiveIncluded - 1;
      if (target >= 0) {
        onToggleInclude({ from: index, to: target });
      }
    }
  };

  const handleDragStart =
    (index: number) => (event: DragEvent<HTMLLIElement>) => {
      draggingIndexRef.current = index;
      // Required to enable drag in some browsers.
      event.dataTransfer?.setData('text/plain', String(index));
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
      }
    };

  const handleDragOver = (event: DragEvent<HTMLLIElement>): void => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop =
    (targetIndex: number) => (event: DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      const sourceIndex =
        draggingIndexRef.current ??
        Number(event.dataTransfer?.getData('text/plain'));
      if (Number.isNaN(sourceIndex) || sourceIndex === targetIndex) return;
      onReorder({ from: sourceIndex, to: targetIndex });
      draggingIndexRef.current = null;
    };

  const handleDragEnd = (): void => {
    draggingIndexRef.current = null;
  };

  return (
    <ul
      role="list"
      data-testid="thumbnail-grid"
      className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 list-none p-0 m-0"
    >
      {thumbnails.map((thumb, index) => {
        const isIncluded = index < effectiveIncluded;
        return (
          <li
            key={thumb.id}
            role="listitem"
            data-included={isIncluded ? 'true' : 'false'}
            draggable
            onDragStart={handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={`flex flex-col gap-1 relative transition-opacity duration-150 ${
              isIncluded ? '' : 'opacity-50'
            }`}
          >
            <button
              type="button"
              onClick={() => handleToggle(index)}
              aria-label={`${isIncluded ? 'Exclude' : 'Include'} ${thumb.name}`}
              className="aspect-square w-full rounded-lg overflow-hidden bg-slate-900 border border-slate-800 p-0 cursor-pointer relative focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:outline-offset-2"
            >
              <img
                src={thumb.url}
                alt={thumb.name}
                draggable={false}
                className="w-full h-full object-contain block"
              />
              <span className="absolute top-2 left-2 bg-slate-900/80 text-amber-300 border border-amber-500/40 rounded-full text-xs px-2 py-0.5 pointer-events-none">
                {isIncluded ? 'Included' : 'Excluded'}
              </span>
            </button>
            <button
              type="button"
              aria-label={`Remove ${thumb.name}`}
              onClick={() => onRemove({ id: thumb.id })}
              className="self-end inline-flex items-center justify-center rounded-lg p-1 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:outline-offset-2"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
