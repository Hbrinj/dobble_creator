import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react';
import { UploadDropzone } from './components/UploadDropzone';
import {
  ThumbnailGrid,
  type ReorderEvent,
  type Thumbnail,
  type ToggleIncludeEvent,
} from './components/ThumbnailGrid';
import { DeckSettings } from './components/DeckSettings';
import { PrintSettings } from './components/PrintSettings';
import {
  DEFAULT_PRINT_SETTINGS,
  type PrintSettingsValue,
} from './components/printSettingsTypes';
import { deckSize, pickOrder, SUPPORTED_PRIMES } from './lib/orderPicker';
import { mulberry32 } from './lib/prng';
import { generateIncidence } from './lib/incidence';
import { packCircles } from './lib/packer';
import { drawCard } from './render/drawCard';
import { buildPdf, type CardImage, type PrintSettings as BuildPdfSettings } from './render/buildPdf';

interface UploadedImage {
  readonly id: string;
  readonly file: File;
  readonly url: string;
  readonly name: string;
}

interface RenderedCard {
  readonly id: string;
  readonly previewUrl: string;
  readonly pngBytes: Uint8Array;
}

const CARD_RENDER_PX = 1000;
const INITIAL_SEED = 1;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });

const canvasToPngBytes = (
  canvas: HTMLCanvasElement,
): Promise<Uint8Array<ArrayBuffer>> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('canvas.toBlob produced no blob'));
        return;
      }
      const buf = await blob.arrayBuffer();
      resolve(new Uint8Array(buf));
    }, 'image/png');
  });

const move = <T,>(arr: readonly T[], from: number, to: number): T[] => {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  if (item !== undefined) copy.splice(to, 0, item);
  return copy;
};

const swap = <T,>(arr: readonly T[], a: number, b: number): T[] => {
  const copy = [...arr];
  const tmp = copy[a]!;
  copy[a] = copy[b]!;
  copy[b] = tmp;
  return copy;
};

export function App(): JSX.Element {
  const [images, setImages] = useState<readonly UploadedImage[]>([]);
  const [notices, setNotices] = useState<readonly string[]>([]);
  const [seed, setSeed] = useState<number>(INITIAL_SEED);
  const [orderOverride, setOrderOverride] = useState<number | null>(null);
  const [printSettings, setPrintSettings] = useState<PrintSettingsValue>(
    DEFAULT_PRINT_SETTINGS,
  );
  const [backImageFile, setBackImageFile] = useState<File | null>(null);
  const [renderedCards, setRenderedCards] = useState<readonly RenderedCard[]>(
    [],
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const autoOrder = useMemo(() => pickOrder(images.length), [images.length]);
  const order = useMemo(() => {
    if (autoOrder == null) return null;
    if (orderOverride != null && deckSize(orderOverride) <= images.length) {
      return orderOverride;
    }
    return autoOrder;
  }, [autoOrder, orderOverride, images.length]);

  // Revoke object URLs on unmount or replacement.
  const imageUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    imageUrlsRef.current = images.map((i) => i.url);
  }, [images]);
  useEffect(() => {
    const urls = imageUrlsRef;
    return () => {
      for (const u of urls.current) URL.revokeObjectURL(u);
    };
  }, []);

  // Revoke previewUrls on unmount or replacement.
  const previewUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    previewUrlsRef.current = renderedCards.map((c) => c.previewUrl);
  }, [renderedCards]);
  useEffect(() => {
    const urls = previewUrlsRef;
    return () => {
      for (const u of urls.current) URL.revokeObjectURL(u);
    };
  }, []);

  const handleImagesAdded = useCallback((files: readonly File[]) => {
    setImages((current) => {
      const additions: UploadedImage[] = files.map((f, i) => ({
        id: `img-${Date.now()}-${current.length + i}-${f.name}`,
        file: f,
        url: URL.createObjectURL(f),
        name: f.name,
      }));
      return [...current, ...additions];
    });
  }, []);

  const handleWarning = useCallback((msg: string) => {
    setNotices((current) => [...current, `Warning: ${msg}`]);
  }, []);
  const handleError = useCallback((msg: string) => {
    setNotices((current) => [...current, `Error: ${msg}`]);
  }, []);

  const handleReorder = useCallback((event: ReorderEvent) => {
    setImages((current) => move(current, event.from, event.to));
  }, []);
  const handleToggleInclude = useCallback((event: ToggleIncludeEvent) => {
    setImages((current) => swap(current, event.from, event.to));
  }, []);
  const handleRemoveImage = useCallback(({ id }: { id: string }) => {
    setImages((current) => {
      const removed = current.find((i) => i.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((i) => i.id !== id);
    });
  }, []);

  const handleOrderChange = useCallback((next: number) => {
    setOrderOverride(SUPPORTED_PRIMES.includes(next) ? next : null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (order == null) return;
    setIsGenerating(true);
    try {
      const rng = mulberry32(seed);
      const incidence = generateIncidence(order, rng);
      const cardsNeeded = incidence.length;
      const includedImages = images.slice(0, cardsNeeded);

      // Load all images first so we can synchronously draw afterwards.
      const loadedImages = await Promise.all(
        includedImages.map((img) => loadImage(img.url)),
      );

      // Revoke previous preview URLs before replacing.
      for (const u of previewUrlsRef.current) URL.revokeObjectURL(u);

      const rendered: RenderedCard[] = [];
      for (let cardIdx = 0; cardIdx < incidence.length; cardIdx++) {
        const symbolIndices = incidence[cardIdx]!;
        const packing = packCircles(symbolIndices.length, rng);
        const rotations = symbolIndices.map(() => rng() * Math.PI * 2);
        const canvas = document.createElement('canvas');
        canvas.width = CARD_RENDER_PX;
        canvas.height = CARD_RENDER_PX;
        // Each card pulls images by symbol index (mod loaded count so every
        // symbol resolves to one of the uploaded images).
        const symbols = symbolIndices.map(
          (s) => loadedImages[s % loadedImages.length]!,
        );
        drawCard(canvas, symbols, packing, rotations, {
          diameterPx: CARD_RENDER_PX,
          background: printSettings.background,
          outline: true,
        });
        const pngBytes = await canvasToPngBytes(canvas);
        const previewUrl = URL.createObjectURL(
          new Blob([pngBytes], { type: 'image/png' }),
        );
        rendered.push({
          id: `card-${cardIdx}`,
          previewUrl,
          pngBytes,
        });
      }
      setRenderedCards(rendered);
    } finally {
      setIsGenerating(false);
    }
  }, [images, order, printSettings.background, seed]);

  const handleDownloadPdf = useCallback(async () => {
    if (renderedCards.length === 0) return;
    const cards: CardImage[] = renderedCards.map((c) => ({ pngBytes: c.pngBytes }));
    const pdfSettings: BuildPdfSettings = {
      pageSize: printSettings.pageSize,
      cardDiameterMm: printSettings.cardDiameterMm,
      cropMarks: printSettings.cropMarks,
      bleed: printSettings.bleed,
      background: printSettings.background,
    };
    const backImage = backImageFile
      ? {
          pngBytes: new Uint8Array(await backImageFile.arrayBuffer()),
        }
      : null;
    const bytes = await buildPdf(cards, pdfSettings, backImage);
    // Copy into a fresh ArrayBuffer-backed Uint8Array; pdf-lib's signature is
    // `Uint8Array<ArrayBufferLike>` which Blob's BlobPart does not accept
    // directly (SharedArrayBuffer is excluded). The copy keeps the type narrow.
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dobble-cards.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // The browser holds the URL until it has triggered the download; the
    // simplest reliable cleanup is on the next macrotask.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [
    backImageFile,
    printSettings.background,
    printSettings.bleed,
    printSettings.cardDiameterMm,
    printSettings.cropMarks,
    printSettings.pageSize,
    renderedCards,
  ]);

  const thumbnails: Thumbnail[] = images.map((img) => ({
    id: img.id,
    name: img.name,
    url: img.url,
  }));
  const includedCount = order != null ? deckSize(order) : 0;

  const generateDisabled = order == null || isGenerating;

  return (
    <main>
      <h1>Dobble Card Generator</h1>

      <UploadDropzone
        onImagesAdded={handleImagesAdded}
        onWarning={handleWarning}
        onError={handleError}
      />

      {notices.length > 0 ? (
        <ul className="notices" role="status" aria-live="polite">
          {notices.map((n, i) => (
            <li key={`${i}-${n}`}>{n}</li>
          ))}
        </ul>
      ) : null}

      {images.length > 0 ? (
        <ThumbnailGrid
          thumbnails={thumbnails}
          includedCount={includedCount}
          onReorder={handleReorder}
          onToggleInclude={handleToggleInclude}
          onRemove={handleRemoveImage}
        />
      ) : null}

      {order != null ? (
        <DeckSettings
          imageCount={images.length}
          order={order}
          seed={seed}
          onOrderChange={handleOrderChange}
          onSeedChange={setSeed}
        />
      ) : null}

      <PrintSettings
        value={printSettings}
        backImage={backImageFile}
        onChange={setPrintSettings}
        onBackImageChange={setBackImageFile}
      />

      <div className="generate-bar">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generateDisabled}
        >
          {isGenerating ? 'Generating…' : 'Generate'}
        </button>
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={renderedCards.length === 0}
        >
          Download PDF
        </button>
      </div>

      {renderedCards.length > 0 ? (
        <section aria-label="Preview" className="preview-gallery">
          {renderedCards.map((c) => (
            <img
              key={c.id}
              src={c.previewUrl}
              alt="Dobble card preview"
              data-testid="preview-card"
            />
          ))}
        </section>
      ) : null}
    </main>
  );
}
