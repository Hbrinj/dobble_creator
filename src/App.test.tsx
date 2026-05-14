import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the rendering pipeline so the integration test stays focused on
// component wiring rather than canvas/PDF byte-level behaviour (which has
// dedicated tests in src/render/).
vi.mock('./render/drawCard', () => ({
  drawCard: vi.fn(() => undefined),
}));

const ONE_PIXEL_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44,
  0x41, 0x54, 0x78, 0x9c, 0x63, 0xfa, 0xcf, 0xff, 0xff, 0x3f, 0x00, 0x05, 0xfe,
  0x02, 0xfe, 0xa7, 0x35, 0x81, 0x84, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

vi.mock('./render/buildPdf', async () => {
  return {
    buildPdf: vi.fn(async () => ONE_PIXEL_PNG_BYTES),
    CARDS_PER_SHEET: 6,
  };
});

// jsdom lacks HTMLCanvasElement.toBlob — provide a deterministic stub.
beforeEach(() => {
  HTMLCanvasElement.prototype.toBlob = function (
    this: HTMLCanvasElement,
    cb: BlobCallback,
  ) {
    cb(new Blob([ONE_PIXEL_PNG_BYTES], { type: 'image/png' }));
  };
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
        rotate: vi.fn(),
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        stroke: vi.fn(),
        clearRect: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
      }) as unknown as CanvasRenderingContext2D,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

// Object URLs.
const createObjectURL = vi.fn((blob: Blob) => `blob:mock/${blob.type}`);
const revokeObjectURL = vi.fn();
beforeEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
});

// HTMLImageElement loading: tests load images by creating Image() and waiting
// for `.onload`. Force `.onload` to fire synchronously in the next tick.
beforeEach(() => {
  const OriginalImage = globalThis.Image;
  // Replace Image with a constructor that auto-resolves on src assignment.
  // We keep width/height to satisfy drawCard's structural requirements.
  class MockImage {
    public onload: ((e: Event) => void) | null = null;
    public onerror: ((e: Event) => void) | null = null;
    public width = 100;
    public height = 100;
    public crossOrigin: string | null = null;
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
    globalThis.Image = OriginalImage;
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

const makeUploadFiles = (count: number): File[] =>
  Array.from(
    { length: count },
    (_, i) =>
      new File([new Uint8Array([1, 2, 3, i])], `img-${i}.png`, {
        type: 'image/png',
      }),
  );

const dispatchDrop = (zone: HTMLElement, files: File[]): void => {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files,
      items: files.map((f) => ({
        kind: 'file',
        type: f.type,
        getAsFile: () => f,
      })),
      types: ['Files'],
    },
  });
  zone.dispatchEvent(event);
};

const flushMicrotasks = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe('App integration: generate flow', () => {
  it('renders the title', async () => {
    const { App } = await import('./App');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /dobble/i,
    );
  });

  it('uploads 13 images, clicks Generate, shows 13 preview cards, and downloads a PDF', async () => {
    const { App } = await import('./App');
    render(<App />);

    // Upload 13 images via the dropzone
    const zone = screen.getByRole('button', { name: /upload images/i });
    await act(async () => {
      dispatchDrop(zone, makeUploadFiles(13));
      await flushMicrotasks();
    });

    // Generate
    const generateButton = await screen.findByRole('button', {
      name: /generate/i,
    });
    await act(async () => {
      await userEvent.click(generateButton);
      // allow renderer microtasks to settle
      await flushMicrotasks();
      await flushMicrotasks();
    });

    // Preview gallery should show 13 cards
    await waitFor(() => {
      const cards = screen.getAllByTestId('preview-card');
      expect(cards).toHaveLength(13);
    });

    // Click Download PDF
    const downloadButton = screen.getByRole('button', {
      name: /download pdf/i,
    });
    await act(async () => {
      await userEvent.click(downloadButton);
      await flushMicrotasks();
    });

    // Assert a Blob URL with the PDF mime type was created
    expect(createObjectURL).toHaveBeenCalled();
    const arg = createObjectURL.mock.calls.at(-1)?.[0] as Blob;
    expect(arg.type).toBe('application/pdf');
  });

  it('clicking remove on a thumbnail removes it from the gallery and revokes its blob URL', async () => {
    const { App } = await import('./App');
    render(<App />);

    const zone = screen.getByRole('button', { name: /upload images/i });
    await act(async () => {
      dispatchDrop(zone, makeUploadFiles(3));
      await flushMicrotasks();
    });

    // Three thumbnail list items present.
    const itemsBefore = await screen.findAllByRole('listitem');
    expect(itemsBefore).toHaveLength(3);
    expect(screen.getByAltText('img-1.png')).toBeInTheDocument();

    // Capture the blob URL of the second thumbnail before removal.
    const secondImage = within(itemsBefore[1]!).getByRole('img');
    const removedUrl = secondImage.getAttribute('src');
    expect(removedUrl).toBeTruthy();

    const removeButton = within(itemsBefore[1]!).getByRole('button', {
      name: /remove img-1\.png/i,
    });
    await userEvent.click(removeButton);

    // Two thumbnails remain; the second name is gone.
    const itemsAfter = screen.getAllByRole('listitem');
    expect(itemsAfter).toHaveLength(2);
    expect(screen.queryByAltText('img-1.png')).not.toBeInTheDocument();

    // The removed image's blob URL was revoked.
    expect(revokeObjectURL).toHaveBeenCalledWith(removedUrl);
  });

  it('Generate button shows a loading state while a generate is in flight', async () => {
    // Hold the buildPdf-adjacent canvas.toBlob path open via a pending blob to
    // simulate a slow render. We control resolution via a deferred Promise on
    // canvas.toBlob — App's handleGenerate awaits each card's PNG bytes inside
    // a loop, so the very first toBlob being deferred is enough to keep the
    // Generate handler running.
    let resolveFirstBlob: ((blob: Blob) => void) | null = null;
    const firstBlobReady = new Promise<Blob>((resolve) => {
      resolveFirstBlob = resolve;
    });
    let blobCount = 0;
    HTMLCanvasElement.prototype.toBlob = function (
      this: HTMLCanvasElement,
      cb: BlobCallback,
    ) {
      blobCount += 1;
      if (blobCount === 1) {
        // Defer the first blob until the test resolves it.
        firstBlobReady.then((blob) => cb(blob));
      } else {
        cb(new Blob([ONE_PIXEL_PNG_BYTES], { type: 'image/png' }));
      }
    };

    const { App } = await import('./App');
    render(<App />);
    const zone = screen.getByRole('button', { name: /upload images/i });
    await act(async () => {
      dispatchDrop(zone, makeUploadFiles(13));
      await flushMicrotasks();
    });
    const generateButton = await screen.findByRole('button', {
      name: /^generate$/i,
    });
    await act(async () => {
      await userEvent.click(generateButton);
      await flushMicrotasks();
    });

    // Mid-flight: the button label changes to "Generating…" and disables.
    const generatingButton = await screen.findByRole('button', {
      name: /generating/i,
    });
    expect(generatingButton).toBeDisabled();
    expect(generatingButton.textContent).toMatch(/generating/i);
    // A spinner SVG (Loader2) is rendered alongside the label.
    expect(generatingButton.querySelector('svg')).not.toBeNull();

    // Resolve the first blob and let the rest of the render finish.
    await act(async () => {
      resolveFirstBlob?.(
        new Blob([ONE_PIXEL_PNG_BYTES], { type: 'image/png' }),
      );
      await flushMicrotasks();
      await flushMicrotasks();
      await flushMicrotasks();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^generate$/i })).toBeEnabled();
    });
  });

  it('preview gallery renders within a titled card once previews exist', async () => {
    const { App } = await import('./App');
    render(<App />);
    const zone = screen.getByRole('button', { name: /upload images/i });
    await act(async () => {
      dispatchDrop(zone, makeUploadFiles(13));
      await flushMicrotasks();
    });
    const generateButton = await screen.findByRole('button', {
      name: /generate/i,
    });
    await act(async () => {
      await userEvent.click(generateButton);
      await flushMicrotasks();
      await flushMicrotasks();
    });
    await waitFor(() => {
      expect(screen.getAllByTestId('preview-card')).toHaveLength(13);
    });
    expect(
      screen.getByRole('heading', { level: 2, name: /preview/i }),
    ).toBeInTheDocument();
  });

  it('renders notices as warning banners with an alert icon', async () => {
    const { App } = await import('./App');
    render(<App />);
    const zone = screen.getByRole('button', { name: /upload images/i });
    // Drop one unsupported file — this enqueues a notice in App state.
    const unsupported = new File([new Uint8Array([1, 2, 3])], 'doc.pdf', {
      type: 'application/pdf',
    });
    await act(async () => {
      dispatchDrop(zone, [unsupported]);
      await flushMicrotasks();
    });
    const list = await screen.findByRole('status');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.className).toContain('border-amber-500/30');
    // AlertTriangle from lucide-react renders as an inline SVG.
    expect(item.querySelector('svg')).not.toBeNull();
  });

  it('hides the sticky action bar (Generate / Download PDF) when no images are uploaded', async () => {
    const { App } = await import('./App');
    render(<App />);
    // Before any upload, neither Generate nor Download PDF should be rendered.
    expect(
      screen.queryByRole('button', { name: /^generate(?:…|\.\.\.)?$/i }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: /download pdf/i })).toBeNull();
  });

  it('shows the sticky action bar once at least one image is uploaded', async () => {
    const { App } = await import('./App');
    render(<App />);
    const zone = screen.getByRole('button', { name: /upload images/i });
    await act(async () => {
      dispatchDrop(zone, makeUploadFiles(1));
      await flushMicrotasks();
    });
    expect(
      await screen.findByRole('button', { name: /^generate(?:…|\.\.\.)?$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /download pdf/i }),
    ).toBeInTheDocument();
  });

  it('disables the Generate button when fewer than 7 images are uploaded (edge case)', async () => {
    const { App } = await import('./App');
    render(<App />);
    const zone = screen.getByRole('button', { name: /upload images/i });
    await act(async () => {
      dispatchDrop(zone, makeUploadFiles(5));
      await flushMicrotasks();
    });
    const generateButton = await screen.findByRole('button', {
      name: /generate/i,
    });
    expect(generateButton).toBeDisabled();
  });

  it('keeps the Download PDF button reachable after the user removes every uploaded image post-generate', async () => {
    const { App } = await import('./App');
    render(<App />);

    // Upload 13 images and generate so renderedCards is populated.
    const zone = screen.getByRole('button', { name: /upload images/i });
    await act(async () => {
      dispatchDrop(zone, makeUploadFiles(13));
      await flushMicrotasks();
    });
    const generateButton = await screen.findByRole('button', {
      name: /^generate$/i,
    });
    await act(async () => {
      await userEvent.click(generateButton);
      await flushMicrotasks();
      await flushMicrotasks();
    });
    await waitFor(() => {
      expect(screen.getAllByTestId('preview-card')).toHaveLength(13);
    });

    // Remove every uploaded image via the remove buttons on the thumbnail
    // grid. After every removal the action bar should still be mounted,
    // because renderedCards is still non-empty.
    let remaining = screen.getAllByRole('listitem').length;
    while (remaining > 0) {
      const firstItem = screen.getAllByRole('listitem')[0]!;
      const removeButton = within(firstItem).getByRole('button', {
        name: /^remove /i,
      });
      await userEvent.click(removeButton);
      remaining = screen.queryAllByRole('listitem').length;
    }

    // No thumbnails remain — but the previews and the Download PDF action
    // bar MUST still be present so the user can grab the PDF they just
    // generated.
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getAllByTestId('preview-card')).toHaveLength(13);
    const downloadButton = screen.getByRole('button', {
      name: /download pdf/i,
    });
    expect(downloadButton).toBeInTheDocument();
    expect(downloadButton).toBeEnabled();
  });

  it('clears stale previews and re-enables the Generate button when canvas.toBlob fails mid-generate', async () => {
    // First generate succeeds; the second generate fails after the first card
    // has been rendered. Without the fix, the previous-batch preview URLs
    // would already be revoked while renderedCards still referenced them —
    // resulting in stale <img> tags pointing at revoked blob URLs. The fix
    // is to reset renderedCards on the throw path.

    // handleGenerate re-throws on failure, which surfaces as an unhandled
    // rejection because it is invoked from a button onClick. Capture it on
    // the Node process so Vitest does not flag the run with an error, while
    // still asserting the UI recovers.
    const capturedRejections: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      capturedRejections.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    try {
      let toBlobCallCount = 0;
      const cardsThroughFirstGenerate = 13;
      HTMLCanvasElement.prototype.toBlob = function (
        this: HTMLCanvasElement,
        cb: BlobCallback,
      ) {
        toBlobCallCount += 1;
        // The first generate produces `cardsThroughFirstGenerate` cards.
        // The very next toBlob (first card of the second generate) is the
        // one that fails — App's catch path must clear renderedCards.
        if (toBlobCallCount === cardsThroughFirstGenerate + 1) {
          // Simulate canvas.toBlob's documented "no blob produced" failure
          // mode — App rejects with an Error and propagates.
          cb(null);
          return;
        }
        cb(new Blob([ONE_PIXEL_PNG_BYTES], { type: 'image/png' }));
      };

      const { App } = await import('./App');
      render(<App />);

      const zone = screen.getByRole('button', { name: /upload images/i });
      await act(async () => {
        dispatchDrop(zone, makeUploadFiles(13));
        await flushMicrotasks();
      });

      // First generate succeeds and populates the preview gallery.
      const generateButton = await screen.findByRole('button', {
        name: /^generate$/i,
      });
      await act(async () => {
        await userEvent.click(generateButton);
        await flushMicrotasks();
        await flushMicrotasks();
      });
      await waitFor(() => {
        expect(screen.getAllByTestId('preview-card')).toHaveLength(13);
      });

      // Second generate: the first card's toBlob rejects mid-loop.
      await act(async () => {
        await userEvent.click(generateButton);
        await flushMicrotasks();
        await flushMicrotasks();
        await flushMicrotasks();
      });

      // After the failure, the Generate button MUST return to idle (not
      // stuck on "Generating…") and MUST be enabled again — `finally`
      // clears isGenerating.
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /^generate$/i });
        expect(btn).toBeEnabled();
      });

      // And the preview gallery MUST be empty — no stale <img> tags
      // pointing at the previous batch's revoked blob URLs.
      expect(screen.queryAllByTestId('preview-card')).toHaveLength(0);

      // The failure was surfaced (caller / global error reporting still
      // sees the original rejection).
      await waitFor(() => {
        expect(capturedRejections).toHaveLength(1);
      });
      const [reason] = capturedRejections;
      expect(reason).toBeInstanceOf(Error);
      expect((reason as Error).message).toMatch(/canvas\.toBlob/i);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
