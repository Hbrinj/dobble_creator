import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { UploadDropzone } from './components/UploadDropzone';
import {
  ThumbnailGrid,
  type ReorderEvent,
  type Thumbnail,
  type ToggleIncludeEvent,
} from './components/ThumbnailGrid';
import { DeckSettings } from './components/DeckSettings';
import { PrintSettings } from './components/PrintSettings';
import { CardBack } from './components/CardBack';
import {
  DEFAULT_PRINT_SETTINGS,
  type PrintSettingsValue,
} from './components/printSettingsTypes';
import { deckSize, pickOrder, SUPPORTED_PRIMES } from './lib/orderPicker';
import { mulberry32 } from './lib/prng';
import { generateIncidence } from './lib/incidence';
import { packCircles, PackingDidNotConvergeError } from './lib/packer';
import { drawCard, computeInsetFraction } from './render/drawCard';
import { extractAlphaMask } from './lib/imageAlpha';
import {
  computeSilhouetteCircle,
  EmptySilhouetteError,
  type SilhouetteCircle,
} from './lib/silhouette';
import {
  buildPdf,
  type CardImage,
  type PrintSettings as BuildPdfSettings,
} from './render/buildPdf';
import { composeBackImageCanvas } from './render/composeBackImageCanvas';
import type { BackImagePlacement } from './render/backImagePlacement';

interface UploadedImage {
  readonly id: string;
  readonly file: File;
  readonly url: string;
  readonly name: string;
  readonly silhouette: SilhouetteCircle;
}

interface RenderedCard {
  readonly id: string;
  readonly previewUrl: string;
  readonly pngBytes: Uint8Array;
}

const CARD_RENDER_PX = 1000;
const INITIAL_SEED = 1;
// Composer diameter for the PDF back image: matches the canvas pixel size
// used for the front cards so the composed PNG has equivalent resolution.
// pdf-lib stretches the embedded image to (cardDiameter + 2×bleed) at print
// time — we mirror that aspect by composing into a single square canvas of
// the same pixel count and letting the circular clip live at radius = half
// the composer diameter (Decision 11: bleed-aware clip).
const BACK_COMPOSE_PX = CARD_RENDER_PX;
// The BackImagePreview renders at this many pixels; the App scales the
// placement up by (BACK_COMPOSE_PX / BACK_PREVIEW_PX) so the composed PDF
// PNG carries the same crop/zoom the user dialled in at preview size.
const BACK_PREVIEW_PX = 320;

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
  const [backImage, setBackImage] = useState<HTMLImageElement | null>(null);
  const [backPlacement, setBackPlacement] = useState<BackImagePlacement>({
    scale: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const handleBackChange = useCallback(
    (image: HTMLImageElement | null, placement: BackImagePlacement) => {
      setBackImage(image);
      setBackPlacement(placement);
    },
    [],
  );
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

  const handleImagesAdded = useCallback(async (files: readonly File[]) => {
    // Parallel silhouette extraction; commit successes + per-file notices in
    // one batch (Decision 9 — sync-then-add UX).
    const results = await Promise.allSettled(
      files.map(async (f) => {
        const { width, height, alpha } = await extractAlphaMask(f);
        const silhouette = computeSilhouetteCircle(alpha, width, height);
        return { file: f, silhouette };
      }),
    );

    const accepted: { file: File; silhouette: SilhouetteCircle }[] = [];
    const rejections: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      const file = files[i]!;
      if (result.status === 'fulfilled') {
        accepted.push(result.value);
      } else if (result.reason instanceof EmptySilhouetteError) {
        rejections.push(
          `${file.name}: this image has no visible content — nothing would print.`,
        );
      } else {
        rejections.push(
          `${file.name}: could not read image silhouette — file may be corrupt or unsupported.`,
        );
      }
    }

    if (accepted.length > 0) {
      setImages((current) => {
        const additions: UploadedImage[] = accepted.map((a, i) => ({
          id: `img-${Date.now()}-${current.length + i}-${a.file.name}`,
          file: a.file,
          url: URL.createObjectURL(a.file),
          name: a.file.name,
          silhouette: a.silhouette,
        }));
        return [...current, ...additions];
      });
    }
    if (rejections.length > 0) {
      setNotices((current) => [...current, ...rejections]);
    }
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

      // Load all images first so we can synchronously draw afterwards. Tag
      // each HTMLImageElement with its pre-computed silhouette so drawCard
      // can map the image's opaque region onto the slot circle (Decision 10).
      // We attach silhouette as a property on the element itself so the
      // CanvasImageSource cast inside drawCard still resolves to a real
      // drawable at runtime.
      const loadedImages = await Promise.all(
        includedImages.map(async (img) => {
          const element = await loadImage(img.url);
          return Object.assign(element, { silhouette: img.silhouette });
        }),
      );

      // Revoke previous preview URLs before replacing.
      for (const u of previewUrlsRef.current) URL.revokeObjectURL(u);

      const rendered: RenderedCard[] = [];
      // Derive the dimensionless inset fraction once per generate run — the
      // value is constant across the deck and the helper guards against
      // diameter <= 0 so a transiently-zeroed setting cannot corrupt the
      // packer's boundary checks.
      const insetFraction = computeInsetFraction(
        printSettings.cardDiameterMm,
        printSettings.cardEdgeMarginMm,
      );
      try {
        let packFailure: { cardIndex: number; attempts: number } | null = null;
        for (let cardIdx = 0; cardIdx < incidence.length; cardIdx++) {
          const symbolIndices = incidence[cardIdx]!;
          let packing: ReturnType<typeof packCircles>;
          try {
            packing = packCircles(symbolIndices.length, rng, insetFraction);
          } catch (err) {
            if (err instanceof PackingDidNotConvergeError) {
              // Treat the whole generate run as failed — abandon mid-loop and
              // fall through to the cleanup branch below. Re-running with a
              // different seed (Decision 13) is the user's recovery path.
              packFailure = {
                cardIndex: cardIdx,
                attempts: err.attempts,
              };
              break;
            }
            throw err;
          }
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
        if (packFailure !== null) {
          // Convergence-failure cleanup: revoke any blob URLs we minted for
          // the partial run, clear the gallery so the UI doesn't reference
          // them, and surface an amber notice telling the user to retry.
          const { cardIndex, attempts } = packFailure;
          for (const c of rendered) URL.revokeObjectURL(c.previewUrl);
          setRenderedCards([]);
          setNotices((current) => [
            ...current,
            `Could not pack card ${cardIndex + 1} after ${attempts} attempts — please regenerate.`,
          ]);
          return;
        }
        setRenderedCards(rendered);
      } catch (err) {
        // Mid-loop failure: the previous batch's preview URLs were already
        // revoked above, so leaving `renderedCards` referencing them would
        // render broken <img src="blob:revoked"> tags. Revoke any URLs we
        // managed to mint this run and clear the gallery so the UI returns
        // to a clean state. Re-throw so callers/error reporting still see
        // the failure.
        for (const c of rendered) URL.revokeObjectURL(c.previewUrl);
        setRenderedCards([]);
        throw err;
      }
    } finally {
      setIsGenerating(false);
    }
  }, [
    images,
    order,
    printSettings.background,
    printSettings.cardDiameterMm,
    printSettings.cardEdgeMarginMm,
    seed,
  ]);

  const handleDownloadPdf = useCallback(async () => {
    if (renderedCards.length === 0) return;
    const cards: CardImage[] = renderedCards.map((c) => ({
      pngBytes: c.pngBytes,
    }));
    const pdfSettings: BuildPdfSettings = {
      pageSize: printSettings.pageSize,
      cardDiameterMm: printSettings.cardDiameterMm,
      cropMarks: printSettings.cropMarks,
      bleed: printSettings.bleed,
      background: printSettings.background,
    };
    // Compose the back image at export time using the same helper the live
    // preview draws with — single source of truth (Decision 5). The composer
    // diameter scales the placement (which is in 320-px preview units) up to
    // the BACK_COMPOSE_PX render resolution so the composed PNG carries the
    // same crop/zoom the user dialled in.
    let composedBack: { pngBytes: Uint8Array } | null = null;
    if (backImage) {
      const scaleUp = BACK_COMPOSE_PX / BACK_PREVIEW_PX;
      const renderPlacement: BackImagePlacement = {
        scale: backPlacement.scale * scaleUp,
        offsetX: backPlacement.offsetX * scaleUp,
        offsetY: backPlacement.offsetY * scaleUp,
      };
      const composed = composeBackImageCanvas(
        backImage,
        renderPlacement,
        BACK_COMPOSE_PX,
      );
      composedBack = { pngBytes: await canvasToPngBytes(composed) };
    }
    const bytes = await buildPdf(cards, pdfSettings, composedBack);
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
    backImage,
    backPlacement,
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

  const hasImages = images.length > 0;
  const hasRenderedCards = renderedCards.length > 0;
  const showActionBar = hasImages || hasRenderedCards;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <h1 className="text-2xl font-semibold">Dobble Card Generator</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl w-full px-6 py-6 space-y-6 flex-1">
        <UploadDropzone
          onImagesAdded={handleImagesAdded}
          onWarning={handleWarning}
          onError={handleError}
        />

        {notices.length > 0 ? (
          <ul className="space-y-2" role="status" aria-live="polite">
            {notices.map((n, i) => (
              <li
                key={`${i}-${n}`}
                className="flex items-center gap-2 rounded-md border bg-amber-500/10 border-amber-500/30 text-amber-200 text-sm px-3 py-2"
              >
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {hasImages ? (
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

        <PrintSettings value={printSettings} onChange={setPrintSettings} />

        <CardBack onChange={handleBackChange} />

        {renderedCards.length > 0 ? (
          <section
            aria-label="Preview"
            className="bg-slate-900 rounded-xl p-6 border border-slate-800"
          >
            <h2 className="text-lg font-semibold mb-4">Preview</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {renderedCards.map((c) => (
                <div
                  key={c.id}
                  className="bg-slate-800 rounded-lg p-3 border border-slate-700 aspect-square"
                >
                  <img
                    src={c.previewUrl}
                    alt="Dobble card preview"
                    data-testid="preview-card"
                    className="w-full h-full object-contain"
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      {showActionBar ? (
        <footer className="sticky bottom-0 bg-slate-900 border-t border-slate-800">
          <div className="mx-auto max-w-5xl px-6 py-3 flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={renderedCards.length === 0}
              className="rounded-lg px-4 py-2 font-medium transition-colors bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:outline-offset-2"
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generateDisabled}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors bg-amber-500 text-slate-900 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:outline-offset-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  Generating…
                </>
              ) : (
                'Generate'
              )}
            </button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
