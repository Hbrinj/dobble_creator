import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardBack } from './CardBack';
import type { BackImagePlacement } from '../render/backImagePlacement';
import { CARD_BACK_REJECTION_MESSAGE } from '../render/backImageValidation';

// Match the App test's mock: jsdom's Image does not auto-fire onload, and
// our component relies on `image.onload` to commit the new image.
beforeEach(() => {
  const Original = globalThis.Image;
  class MockImage {
    public onload: ((e: Event) => void) | null = null;
    public onerror: ((e: Event) => void) | null = null;
    public width = 200;
    public height = 100;
    private _src = '';
    set src(value: string) {
      this._src = value;
      queueMicrotask(() => this.onload?.(new Event('load')));
    }
    get src(): string {
      return this._src;
    }
  }
  globalThis.Image = MockImage as unknown as typeof Image;
  return () => {
    globalThis.Image = Original;
  };
});

// Object URL plumbing — jsdom does not implement it.
beforeEach(() => {
  Object.assign(URL, {
    createObjectURL: vi.fn((blob: Blob) => `blob:mock/${blob.type}`),
    revokeObjectURL: vi.fn(),
  });
});

// jsdom 2D canvas — preview renders into one but we don't assert on pixels.
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () =>
      ({
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
      }) as unknown as CanvasRenderingContext2D,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

const flushMicrotasks = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

const makePngFile = (
  name: string,
  bytes: readonly number[] = [1, 2, 3],
): File => new File([new Uint8Array(bytes)], name, { type: 'image/png' });

const makeFile = (name: string, type: string): File =>
  new File([new Uint8Array([1, 2, 3])], name, { type });

// Mirror of UploadDropzone.test.tsx's drag-drop test helper. Synthesises a
// bubbling, cancelable DragEvent with a fake DataTransfer payload so React's
// synthetic event layer picks it up. We dispatch directly via the DOM rather
// than using fireEvent because jsdom does not construct a real DragEvent.
const dispatchWithDataTransfer = (
  zone: HTMLElement,
  type: string,
  files: File[],
): void => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files,
      items: files.map((f) => ({
        kind: 'file',
        type: f.type,
        getAsFile: () => f,
      })),
      types: ['Files'],
      // Allow the component's `dropEffect = 'copy'` assignment to succeed
      // without DataTransfer being a true read-only mock.
      dropEffect: 'none',
    },
  });
  zone.dispatchEvent(event);
};

const dropFiles = async (zone: HTMLElement, files: File[]): Promise<void> => {
  dispatchWithDataTransfer(zone, 'dragover', files);
  dispatchWithDataTransfer(zone, 'drop', files);
  await flushMicrotasks();
};

describe('CardBack', () => {
  it('renders an empty-state dropzone when no image is loaded', () => {
    render(<CardBack onChange={vi.fn()} onWarning={vi.fn()} />);
    // Dashed-border placeholder + a file-input affordance, exposed via the
    // accessible label "Card back image".
    const input = screen.getByLabelText(/card back image/i);
    expect(input).toBeInTheDocument();
    // No preview canvas yet.
    expect(document.querySelector('canvas')).toBeNull();
    // No Reset button yet.
    expect(
      screen.queryByRole('button', { name: /reset placement/i }),
    ).toBeNull();
  });

  it('renders within a titled card with a "Card back" h2 heading', () => {
    render(<CardBack onChange={vi.fn()} onWarning={vi.fn()} />);
    expect(
      screen.getByRole('heading', { level: 2, name: /card back/i }),
    ).toBeInTheDocument();
  });

  it('after uploading a file, hides the empty state and shows the preview + Reset button', async () => {
    render(<CardBack onChange={vi.fn()} onWarning={vi.fn()} />);
    const input = screen.getByLabelText(/card back image/i) as HTMLInputElement;
    const file = makePngFile('back.png');
    await act(async () => {
      await userEvent.upload(input, file);
      await flushMicrotasks();
    });
    expect(document.querySelector('canvas')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: /reset placement/i }),
    ).toBeInTheDocument();
  });

  it('emits onChange with the image + fill-default placement on upload', async () => {
    const onChange = vi.fn();
    render(<CardBack onChange={onChange} onWarning={vi.fn()} />);
    const input = screen.getByLabelText(/card back image/i) as HTMLInputElement;
    await act(async () => {
      await userEvent.upload(input, makePngFile('back.png'));
      await flushMicrotasks();
    });
    expect(onChange).toHaveBeenCalled();
    const [image, placement] = onChange.mock.calls.at(-1)!;
    expect(image).not.toBeNull();
    expect((image as HTMLImageElement).width).toBe(200);
    // Fill default for a 200×100 image inside the 320 px preview frame is
    // 320 / max(200, 100) = 1.6.
    expect((placement as BackImagePlacement).scale).toBeCloseTo(1.6);
    expect((placement as BackImagePlacement).offsetX).toBe(0);
    expect((placement as BackImagePlacement).offsetY).toBe(0);
  });

  it('clicking Reset restores the fill-default placement', async () => {
    const onChange = vi.fn();
    render(<CardBack onChange={onChange} onWarning={vi.fn()} />);
    const input = screen.getByLabelText(/card back image/i) as HTMLInputElement;
    await act(async () => {
      await userEvent.upload(input, makePngFile('back.png'));
      await flushMicrotasks();
    });
    onChange.mockClear();
    const resetButton = screen.getByRole('button', {
      name: /reset placement/i,
    });
    await userEvent.click(resetButton);
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)![1] as BackImagePlacement;
    expect(last.scale).toBeCloseTo(1.6);
    expect(last.offsetX).toBe(0);
    expect(last.offsetY).toBe(0);
  });

  it("uploading a second different-sized file resets placement to *that* file's fill-default", async () => {
    const onChange = vi.fn();
    render(<CardBack onChange={onChange} onWarning={vi.fn()} />);
    const input = screen.getByLabelText(/card back image/i) as HTMLInputElement;
    // First upload (default 200×100 from the Image mock).
    await act(async () => {
      await userEvent.upload(input, makePngFile('first.png'));
      await flushMicrotasks();
    });
    // Override the Image mock to return 50×50 for the second file so we can
    // see the placement reset to a different scale.
    class SquareMockImage {
      public onload: ((e: Event) => void) | null = null;
      public onerror: ((e: Event) => void) | null = null;
      public width = 50;
      public height = 50;
      private _src = '';
      set src(value: string) {
        this._src = value;
        queueMicrotask(() => this.onload?.(new Event('load')));
      }
      get src(): string {
        return this._src;
      }
    }
    globalThis.Image = SquareMockImage as unknown as typeof Image;
    onChange.mockClear();
    await act(async () => {
      await userEvent.upload(input, makePngFile('second.png', [4, 5, 6]));
      await flushMicrotasks();
    });
    const last = onChange.mock.calls.at(-1)![1] as BackImagePlacement;
    // Fill default for a 50×50 image inside 320 px → 320/50 = 6.4.
    expect(last.scale).toBeCloseTo(6.4);
  });
});

describe('CardBack drag-and-drop', () => {
  const getSection = (): HTMLElement =>
    screen.getByRole('region', { name: /card back/i });

  it('drop of a valid PNG calls onChange with the loaded image + fill-default placement', async () => {
    const onChange = vi.fn();
    render(<CardBack onChange={onChange} onWarning={vi.fn()} />);
    await act(async () => {
      await dropFiles(getSection(), [makePngFile('dropped.png')]);
    });
    expect(onChange).toHaveBeenCalled();
    const [image, placement] = onChange.mock.calls.at(-1)!;
    expect(image).not.toBeNull();
    expect((image as HTMLImageElement).width).toBe(200);
    expect((placement as BackImagePlacement).scale).toBeCloseTo(1.6);
  });

  it('drop of a PDF emits onWarning with the canonical message and does NOT call onChange', async () => {
    const onChange = vi.fn();
    const onWarning = vi.fn();
    render(<CardBack onChange={onChange} onWarning={onWarning} />);
    await act(async () => {
      await dropFiles(getSection(), [makeFile('x.pdf', 'application/pdf')]);
    });
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(onWarning).toHaveBeenCalledWith(CARD_BACK_REJECTION_MESSAGE);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('drop with multiple files uses files[0] only (no notice for the others)', async () => {
    const onChange = vi.fn();
    const onWarning = vi.fn();
    render(<CardBack onChange={onChange} onWarning={onWarning} />);
    await act(async () => {
      await dropFiles(getSection(), [
        makePngFile('first.png', [1, 2, 3]),
        makePngFile('second.png', [4, 5, 6]),
      ]);
    });
    // Exactly one image emit (no double-fire from the second file).
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('drop on the loaded-state section replaces the image', async () => {
    const onChange = vi.fn();
    render(<CardBack onChange={onChange} onWarning={vi.fn()} />);
    // Pre-load an image via the click path so the section moves to loaded state.
    const input = screen.getByLabelText(/card back image/i) as HTMLInputElement;
    await act(async () => {
      await userEvent.upload(input, makePngFile('first.png'));
      await flushMicrotasks();
    });
    expect(document.querySelector('canvas')).not.toBeNull();
    onChange.mockClear();
    // Drop a different valid file onto the now-loaded section.
    await act(async () => {
      await dropFiles(getSection(), [makePngFile('second.png', [4, 5, 6])]);
    });
    expect(onChange).toHaveBeenCalled();
  });

  it('isDragOver toggles the amber drag-over classes on dragover / dragleave / drop', async () => {
    render(<CardBack onChange={vi.fn()} onWarning={vi.fn()} />);
    const section = getSection();
    expect(section.className).not.toMatch(/border-amber-500/);

    await act(async () => {
      dispatchWithDataTransfer(section, 'dragover', []);
      await flushMicrotasks();
    });
    expect(section.className).toMatch(/border-amber-500/);

    await act(async () => {
      dispatchWithDataTransfer(section, 'dragleave', []);
      await flushMicrotasks();
    });
    expect(section.className).not.toMatch(/border-amber-500/);

    // After dragover -> drop, the class should also be removed.
    await act(async () => {
      dispatchWithDataTransfer(section, 'dragover', []);
      await flushMicrotasks();
    });
    expect(section.className).toMatch(/border-amber-500/);
    await act(async () => {
      dispatchWithDataTransfer(section, 'drop', [makePngFile('y.png')]);
      await flushMicrotasks();
    });
    expect(section.className).not.toMatch(/border-amber-500/);
  });
});
