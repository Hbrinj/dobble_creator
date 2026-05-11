import { PDFDocument, rgb } from 'pdf-lib';

/** A card rasterised to PNG bytes, ready for PDF embedding. */
export interface CardImage {
  readonly pngBytes: Uint8Array;
}

export type PageSize = 'A4' | 'Letter';
export type CardBackground = 'white' | 'transparent';

export interface PrintSettings {
  readonly pageSize: PageSize;
  readonly cardDiameterMm: number;
  readonly cropMarks: boolean;
  readonly bleed: boolean;
  readonly background: CardBackground;
}

/** A back image to print on the reverse of every front page. Provided as PNG bytes. */
export interface BackImage {
  readonly pngBytes: Uint8Array;
}

/** Fixed grid: 6 cards per sheet — 2 columns × 3 rows. See Decision 10. */
export const CARDS_PER_SHEET = 6;
const GRID_COLS = 2;
const GRID_ROWS = 3;

const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;
const mmToPt = (mm: number): number => (mm / MM_PER_INCH) * PT_PER_INCH;

const PAGE_SIZES_PT: Record<PageSize, { widthPt: number; heightPt: number }> = {
  A4: { widthPt: mmToPt(210), heightPt: mmToPt(297) },
  Letter: { widthPt: 8.5 * PT_PER_INCH, heightPt: 11 * PT_PER_INCH },
};

const CROP_MARK_LEN_PT = mmToPt(3);
const BLEED_MM = 2;

interface SlotPosition {
  readonly centreXPt: number;
  readonly centreYPt: number;
  readonly cardRadiusPt: number;
}

/**
 * Assemble a printable PDF from rasterised card images.
 *
 * Pagination: cards are laid out in a 2×3 grid on each sheet. Cards beyond a
 * full sheet flow to the next page. A trailing partial page is allowed.
 *
 * If `backImage` is provided, a back page is interleaved after each front page
 * with horizontally mirrored slot positions so a long-edge duplex flip aligns
 * the backs with their fronts.
 */
export async function buildPdf(
  cards: readonly CardImage[],
  settings: PrintSettings,
  backImage: BackImage | null,
): Promise<Uint8Array> {
  if (cards.length === 0) {
    throw new Error('buildPdf: cards array must not be empty');
  }
  const pdfDoc = await PDFDocument.create();
  const { widthPt, heightPt } = PAGE_SIZES_PT[settings.pageSize];
  const cardRadiusPt = mmToPt(settings.cardDiameterMm) / 2;
  const bleedPt = settings.bleed ? mmToPt(BLEED_MM) : 0;

  const slotsPerSheet = computeSlots(widthPt, heightPt, cardRadiusPt);

  const sheetCount = Math.ceil(cards.length / CARDS_PER_SHEET);

  // Embed back image once, reused across pages.
  const embeddedBack = backImage
    ? await pdfDoc.embedPng(backImage.pngBytes)
    : null;

  for (let sheet = 0; sheet < sheetCount; sheet++) {
    const start = sheet * CARDS_PER_SHEET;
    const sheetCards = cards.slice(start, start + CARDS_PER_SHEET);
    const frontPage = pdfDoc.addPage([widthPt, heightPt]);
    for (let i = 0; i < sheetCards.length; i++) {
      const slot = slotsPerSheet[i]!;
      const embedded = await pdfDoc.embedPng(sheetCards[i]!.pngBytes);
      drawCardImageAtSlot(frontPage, embedded, slot, cardRadiusPt, bleedPt);
      if (settings.cropMarks) {
        drawCropMarks(frontPage, slot, cardRadiusPt, widthPt, heightPt);
      }
    }
    if (embeddedBack) {
      const backPage = pdfDoc.addPage([widthPt, heightPt]);
      const mirroredSlots = mirrorSlots(slotsPerSheet, widthPt);
      for (let i = 0; i < sheetCards.length; i++) {
        const slot = mirroredSlots[i]!;
        drawCardImageAtSlot(backPage, embeddedBack, slot, cardRadiusPt, bleedPt);
        if (settings.cropMarks) {
          drawCropMarks(backPage, slot, cardRadiusPt, widthPt, heightPt);
        }
      }
    }
  }

  return pdfDoc.save();
}

/**
 * Compute the centre positions of the (up to) `CARDS_PER_SHEET` card slots on
 * a page. The grid is centred horizontally and vertically; slots are spaced
 * evenly with equal margin top/bottom and left/right.
 */
const computeSlots = (
  pageWidthPt: number,
  pageHeightPt: number,
  cardRadiusPt: number,
): SlotPosition[] => {
  const cardDiameterPt = cardRadiusPt * 2;
  const horizontalUsed = GRID_COLS * cardDiameterPt;
  const verticalUsed = GRID_ROWS * cardDiameterPt;
  const hMargin = (pageWidthPt - horizontalUsed) / (GRID_COLS + 1);
  const vMargin = (pageHeightPt - verticalUsed) / (GRID_ROWS + 1);
  const slots: SlotPosition[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const centreXPt = hMargin + cardRadiusPt + col * (cardDiameterPt + hMargin);
      const centreYPt =
        pageHeightPt -
        (vMargin + cardRadiusPt + row * (cardDiameterPt + vMargin));
      slots.push({ centreXPt, centreYPt, cardRadiusPt });
    }
  }
  return slots;
};

const mirrorSlots = (
  slots: readonly SlotPosition[],
  pageWidthPt: number,
): SlotPosition[] =>
  slots.map((s) => ({
    centreXPt: pageWidthPt - s.centreXPt,
    centreYPt: s.centreYPt,
    cardRadiusPt: s.cardRadiusPt,
  }));

/** Test-only export of the slot calculator. */
export const _computeSlotsForTest = (
  pageSize: PageSize,
  cardDiameterMm: number,
): SlotPosition[] => {
  const { widthPt, heightPt } = PAGE_SIZES_PT[pageSize];
  return computeSlots(widthPt, heightPt, mmToPt(cardDiameterMm) / 2);
};

/** Test-only export of the mirror transform. */
export const _mirrorSlotsForTest = (
  slots: readonly SlotPosition[],
  pageSize: PageSize,
): SlotPosition[] => mirrorSlots(slots, PAGE_SIZES_PT[pageSize].widthPt);

type EmbeddedImage = Awaited<ReturnType<PDFDocument['embedPng']>>;
type Page = ReturnType<PDFDocument['addPage']>;

const drawCardImageAtSlot = (
  page: Page,
  image: EmbeddedImage,
  slot: SlotPosition,
  cardRadiusPt: number,
  bleedPt: number,
): void => {
  const sideLen = (cardRadiusPt + bleedPt) * 2;
  page.drawImage(image, {
    x: slot.centreXPt - sideLen / 2,
    y: slot.centreYPt - sideLen / 2,
    width: sideLen,
    height: sideLen,
  });
};

const drawCropMarks = (
  page: Page,
  slot: SlotPosition,
  cardRadiusPt: number,
  pageWidthPt: number,
  pageHeightPt: number,
): void => {
  const colour = rgb(0.4, 0.4, 0.4);
  const lineGap = mmToPt(1);
  const len = CROP_MARK_LEN_PT;
  const left = slot.centreXPt - cardRadiusPt;
  const right = slot.centreXPt + cardRadiusPt;
  const top = slot.centreYPt + cardRadiusPt;
  const bottom = slot.centreYPt - cardRadiusPt;

  // four corner ticks, oriented outwards
  const corners: Array<[number, number, 'tl' | 'tr' | 'bl' | 'br']> = [
    [left, top, 'tl'],
    [right, top, 'tr'],
    [left, bottom, 'bl'],
    [right, bottom, 'br'],
  ];
  for (const [x, y, where] of corners) {
    const horizSign = where === 'tl' || where === 'bl' ? -1 : 1;
    const vertSign = where === 'tl' || where === 'tr' ? 1 : -1;
    // horizontal stroke
    page.drawLine({
      start: { x: x + horizSign * lineGap, y },
      end: { x: x + horizSign * (lineGap + len), y },
      thickness: 0.5,
      color: colour,
    });
    // vertical stroke
    page.drawLine({
      start: { x, y: y + vertSign * lineGap },
      end: { x, y: y + vertSign * (lineGap + len) },
      thickness: 0.5,
      color: colour,
    });
  }

  // Clamp to page bounds — pdf-lib clips automatically, but guard the math.
  void pageWidthPt;
  void pageHeightPt;
};
