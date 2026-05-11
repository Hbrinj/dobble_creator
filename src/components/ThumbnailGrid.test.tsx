import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThumbnailGrid, type Thumbnail } from './ThumbnailGrid';

const makeThumbs = (n: number): Thumbnail[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `thumb-${i}`,
    name: `image-${i}.png`,
    url: `data:image/png;base64,iVBORw0K`,
  }));

const dispatchDragEvent = (el: Element, type: string): void => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      data: new Map<string, string>(),
      setData(key: string, value: string): void {
        (this.data as Map<string, string>).set(key, value);
      },
      getData(key: string): string {
        return (this.data as Map<string, string>).get(key) ?? '';
      },
      effectAllowed: 'move',
      dropEffect: 'move',
    },
  });
  el.dispatchEvent(event);
};

describe('ThumbnailGrid', () => {
  it('marks the first `includedCount` items as included and the rest excluded', () => {
    const thumbs = makeThumbs(20);
    render(
      <ThumbnailGrid
        thumbnails={thumbs}
        includedCount={13}
        onReorder={vi.fn()}
        onToggleInclude={vi.fn()}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(20);
    for (let i = 0; i < 13; i++) {
      expect(items[i]).toHaveAttribute('data-included', 'true');
    }
    for (let i = 13; i < 20; i++) {
      expect(items[i]).toHaveAttribute('data-included', 'false');
    }
  });

  it('emits onToggleInclude with the indices to swap when an excluded thumbnail is clicked', async () => {
    const thumbs = makeThumbs(20);
    const onToggleInclude = vi.fn();
    render(
      <ThumbnailGrid
        thumbnails={thumbs}
        includedCount={13}
        onReorder={vi.fn()}
        onToggleInclude={onToggleInclude}
      />,
    );
    const items = screen.getAllByRole('listitem');
    // Click the first excluded one (index 13). It should swap with index 12
    // (the last currently-included item) so it becomes included.
    const target = items[13]!;
    const toggle = within(target).getByRole('button');
    await userEvent.click(toggle);
    expect(onToggleInclude).toHaveBeenCalledWith({ from: 13, to: 12 });
  });

  it('emits onToggleInclude swapping an included thumbnail out (with the first excluded)', async () => {
    const thumbs = makeThumbs(20);
    const onToggleInclude = vi.fn();
    render(
      <ThumbnailGrid
        thumbnails={thumbs}
        includedCount={13}
        onReorder={vi.fn()}
        onToggleInclude={onToggleInclude}
      />,
    );
    const items = screen.getAllByRole('listitem');
    const toggle = within(items[0]!).getByRole('button');
    await userEvent.click(toggle);
    expect(onToggleInclude).toHaveBeenCalledWith({ from: 0, to: 13 });
  });

  it('emits onReorder when a thumbnail is dragged onto another', () => {
    const thumbs = makeThumbs(5);
    const onReorder = vi.fn();
    render(
      <ThumbnailGrid
        thumbnails={thumbs}
        includedCount={5}
        onReorder={onReorder}
        onToggleInclude={vi.fn()}
      />,
    );
    const items = screen.getAllByRole('listitem');
    const source = items[0]!;
    const target = items[3]!;
    dispatchDragEvent(source, 'dragstart');
    dispatchDragEvent(target, 'dragover');
    dispatchDragEvent(target, 'drop');
    dispatchDragEvent(source, 'dragend');
    expect(onReorder).toHaveBeenCalledWith({ from: 0, to: 3 });
  });

  it('renders nothing meaningful for an empty list (no items)', () => {
    render(
      <ThumbnailGrid
        thumbnails={[]}
        includedCount={0}
        onReorder={vi.fn()}
        onToggleInclude={vi.fn()}
      />,
    );
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('caps includedCount at the thumbnail array length (defensive)', () => {
    render(
      <ThumbnailGrid
        thumbnails={makeThumbs(3)}
        includedCount={50}
        onReorder={vi.fn()}
        onToggleInclude={vi.fn()}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item).toHaveAttribute('data-included', 'true');
    }
  });
});
