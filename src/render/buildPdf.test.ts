import { describe, it, expect, beforeAll } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildPdf, type PrintSettings, type CardImage } from './buildPdf';

const A4_WIDTH_PT = 595.276; // 210mm in pt (72/25.4 * 210)
const A4_HEIGHT_PT = 841.890; // 297mm in pt

const PT_TOLERANCE = 1.0;

/**
 * Create a 1x1 PNG byte array (a single white pixel). Suitable as a stub
 * card image — pdf-lib will happily embed it.
 */
const ONE_PIXEL_PNG: Uint8Array = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44,
  0x41, 0x54, 0x78, 0x9c, 0x63, 0xfa, 0xcf, 0xff, 0xff, 0x3f, 0x00, 0x05, 0xfe,
  0x02, 0xfe, 0xa7, 0x35, 0x81, 0x84, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

const makeStubCards = (n: number): CardImage[] =>
  Array.from({ length: n }, () => ({ pngBytes: ONE_PIXEL_PNG }));

const a4Settings: PrintSettings = {
  pageSize: 'A4',
  cardDiameterMm: 85,
  cropMarks: true,
  bleed: true,
  background: 'white',
};

describe('buildPdf', () => {
  let pdfBytes: Uint8Array;
  let pdfDoc: PDFDocument;

  beforeAll(async () => {
    pdfBytes = await buildPdf(makeStubCards(7), a4Settings, null);
    pdfDoc = await PDFDocument.load(pdfBytes);
  });

  it('produces a PDF that pdf-lib can re-parse', () => {
    expect(pdfBytes.byteLength).toBeGreaterThan(0);
    expect(pdfDoc).toBeDefined();
  });

  it('produces 2 pages for 7 cards at 6-per-sheet', () => {
    expect(pdfDoc.getPageCount()).toBe(2);
  });

  it('emits A4 page dimensions in points', () => {
    const [page] = pdfDoc.getPages();
    expect(page).toBeDefined();
    const { width, height } = page!.getSize();
    expect(Math.abs(width - A4_WIDTH_PT)).toBeLessThan(PT_TOLERANCE);
    expect(Math.abs(height - A4_HEIGHT_PT)).toBeLessThan(PT_TOLERANCE);
  });

  it('switches to US Letter dimensions when selected', async () => {
    const bytes = await buildPdf(makeStubCards(7), { ...a4Settings, pageSize: 'Letter' }, null);
    const doc = await PDFDocument.load(bytes);
    const [page] = doc.getPages();
    // US Letter: 8.5 x 11 in = 612 x 792 pt
    expect(Math.abs(page!.getWidth() - 612)).toBeLessThan(PT_TOLERANCE);
    expect(Math.abs(page!.getHeight() - 792)).toBeLessThan(PT_TOLERANCE);
  });

  it('emits crop marks when enabled and omits them when disabled', async () => {
    const withMarks = await buildPdf(makeStubCards(1), a4Settings, null);
    const withoutMarks = await buildPdf(
      makeStubCards(1),
      { ...a4Settings, cropMarks: false },
      null,
    );
    // PDF stream representation grows when crop marks add operators
    expect(withMarks.byteLength).toBeGreaterThan(withoutMarks.byteLength);
  });

  it('handles a deck that fits in a single page', async () => {
    const bytes = await buildPdf(makeStubCards(6), a4Settings, null);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it('throws on empty input', async () => {
    await expect(buildPdf([], a4Settings, null)).rejects.toThrow();
  });

  describe('with a card-back image', () => {
    it('interleaves a back page after each front page (4 pages for 7 cards)', async () => {
      const bytes = await buildPdf(makeStubCards(7), a4Settings, {
        pngBytes: ONE_PIXEL_PNG,
      });
      const doc = await PDFDocument.load(bytes);
      // 2 front sheets + 2 back sheets
      expect(doc.getPageCount()).toBe(4);
    });

    it('omits back pages when no back image is provided (already-tested-but-here-for-symmetry)', async () => {
      const bytes = await buildPdf(makeStubCards(7), a4Settings, null);
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(2);
    });

    it('emits a back page even for a single-sheet deck (2 pages for 6 cards)', async () => {
      const bytes = await buildPdf(makeStubCards(6), a4Settings, {
        pngBytes: ONE_PIXEL_PNG,
      });
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(2);
    });

    it('mirrors slot x-coordinates horizontally on the back page', async () => {
      // Compare bytes: a single-card deck on a single sheet — front at slot 0,
      // back is the same image at the mirrored slot. The image x-offset on the
      // back page must be (pageWidth - frontX - imageWidth) ± rounding.
      //
      // We test indirectly via the public slot helper exposed for testing.
      // (We expose `computeSlotsForTest` from the module for this purpose.)
      const { _computeSlotsForTest, _mirrorSlotsForTest } = await import(
        './buildPdf'
      );
      const slots = _computeSlotsForTest('A4', 85);
      const mirrored = _mirrorSlotsForTest(slots, 'A4');
      expect(slots.length).toBe(6);
      const pageWidth = A4_WIDTH_PT;
      for (let i = 0; i < slots.length; i++) {
        const front = slots[i]!;
        const back = mirrored[i]!;
        expect(Math.abs(back.centreXPt - (pageWidth - front.centreXPt))).toBeLessThan(
          0.01,
        );
        expect(back.centreYPt).toBeCloseTo(front.centreYPt, 5);
      }
    });
  });
});
