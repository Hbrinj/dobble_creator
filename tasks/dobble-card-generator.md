# dobble-card-generator

A static web page that takes a user-supplied set of images and generates Dobble (Spot It!) cards — where every pair of cards shares exactly one symbol — with on-screen preview and a printable PDF download.

## Context
_Codebase facts and constraints learned during grilling._
- Greenfield project at `/Users/geekair/development/dobble_creator`. No existing source code; only a `tasks/` directory.
- Dobble math: a finite projective plane of order `n` yields `n²+n+1` cards and `n²+n+1` symbols, with `n+1` symbols per card and every pair of cards sharing exactly one symbol.
- Prime-only construction (ℤₙ-based) covers n ∈ {2, 3, 5, 7, 11, 13, ...} and is implementable in ~30 lines. Prime-power orders (4, 8, 9, ...) require GF(p^k) and are deferred.

## Decisions
_Resolved through grilling._
1. **Mode** — software work producing executable behaviour (a runnable web page).
2. **Deck order (n)** — Support **prime** orders only in v1 (n ∈ {2, 3, 5, 7, 11, 13, ...}). Generator auto-picks the largest prime n where `n²+n+1 ≤ uploaded image count`, with user override. Prime-power orders are deferred.
3. **Output format** — On-screen preview + printable PDF download (A4 + US Letter page sizes, multiple cards per sheet with cut guides).
4. **Card shape** — Circular only. Matches iconic Dobble look; varied symbol rotation/size is part of the visual-matching challenge.
5. **Tech stack** — React + Vite + TypeScript SPA, all client-side. `pdf-lib` for PDF assembly, HTML5 canvas for card rendering.
6. **Symbol placement algorithm** — Circle packing: pack `n+1` circles of varying radii inside each card circle (force-directed / Lloyd-style relaxation), then draw a symbol in each packed circle with random rotation.
7. **Image preprocessing** — Auto-fit each uploaded image (center-crop to square) and apply a circular clip mask matching its packed slot. No background removal in v1.
8. **Incidence construction** — Prime-order projective-plane construction using ℤₚ modular arithmetic.
9. **Upload UX** — File picker + drag-and-drop zone. Accepted formats: PNG, JPEG, WebP, SVG. Min 7 images (n=2 deck), max 200 (n=13 deck). Soft-warn on per-image size >5MB. Thumbnail grid with per-image remove button.
10. **PDF print layout** — Default 85mm card diameter (slider 60–100mm), 6 cards per sheet on both A4 and US Letter, crop marks + faint cut-circle outline (toggle), 2mm bleed (toggle, on by default), white background (option for transparent). Surfaced via a "Print settings" panel.
11. **Image-subset selection** — Auto-pick the first `n²+n+1` images in upload order. Thumbnail grid clearly indicates included vs excluded (greyed out / badge). User can drag-reorder or click a thumbnail to swap inclusion.
12. **Determinism via seeded RNG** — All randomness (incidence shuffling, packing relaxation, symbol rotation) routes through a seedable PRNG (`mulberry32`). Seed shown in the UI with a "Re-roll" button and a paste-to-reproduce text field.
13. **Testing strategy** — Vitest unit tests for all pure logic (incidence generator, PRNG, circle packer, order picker). React Testing Library component tests for upload + settings UI. One Playwright happy-path E2E for upload → preview → PDF download. No canvas snapshot tests.
14. **Rendering pipeline** — Render each card to an offscreen canvas at 300dpi (≈1000×1000px for 85mm), reuse the bitmap for both on-screen preview (downscaled) and PDF embed via `pdf-lib`'s `drawImage`.
15. **Project structure & deployment** — Vite + React + TypeScript at repo root. `src/lib/` for pure logic, `src/render/` for canvas + PDF, `src/components/` for UI, `tests/` for Vitest, `e2e/` for Playwright. `npm run dev` runs locally. Deployed as a static site to GitHub Pages via a GitHub Actions workflow on push to `main`.
16. **Card backs** — Optional user-uploaded card-back image. If provided, PDF interleaves a back page after each front page with mirrored card layout (so flipping the printed sheet on the long edge aligns backs to fronts). If blank, print single-sided. No built-in back patterns in v1.

## Slices

### Slice 1 — Project scaffold runs locally
**Outcome:** `npm install && npm run dev` serves a blank React app on localhost; `npm test` runs Vitest with one passing sanity test.
**Test (Red):** `tests/scaffold.test.ts` — `expect(import.meta).toBeDefined()` style sanity test that fails before Vitest is configured.
**Implementation (Green):** Vite + React + TS scaffold via `npm create vite@latest`. Add Vitest config, `tsconfig` paths, ESLint baseline. Folder layout per Decision 15.
**Refactor:** none expected.
**Acceptance:** `npm run dev` serves on localhost; `npm test` exits 0.

### Slice 2 — Seedable PRNG
**Outcome:** A `mulberry32(seed)` pure function returns a deterministic stream of `[0, 1)` floats.
**Test (Red):** `src/lib/prng.test.ts` — same seed produces identical first 100 values; different seeds diverge; output range is `[0, 1)`.
**Implementation (Green):** `src/lib/prng.ts` exporting `mulberry32(seed: number): () => number`.
**Refactor:** none expected.
**Acceptance:** All PRNG tests green.

### Slice 3 — Order picker
**Outcome:** Given an image count, return the largest prime `n` such that `n² + n + 1 ≤ count`, or `null` if count < 7.
**Test (Red):** `src/lib/orderPicker.test.ts` — count 6 → null; 7 → 2; 12 → 2 (n=3 needs 13); 13 → 3; 31 → 5; 57 → 7; 200 → 13.
**Implementation (Green):** `src/lib/orderPicker.ts` with a small prime list (up to 13) and a linear scan downward.
**Refactor:** none expected.
**Acceptance:** All order-picker tests green.

### Slice 4 — Projective-plane incidence generator
**Outcome:** Given prime `n` and a PRNG, return `cards: number[][]` (length `n²+n+1`, each card has `n+1` symbol indices) with the property that every pair of cards shares exactly one symbol.
**Test (Red):** `src/lib/incidence.test.ts` — for n ∈ {2, 3, 5, 7}: card count = `n²+n+1`, each card has `n+1` symbols, every distinct pair of cards intersects in exactly one symbol, every pair of symbols co-occurs on exactly one card; seeded PRNG produces reproducible output.
**Implementation (Green):** `src/lib/incidence.ts` implementing the textbook ℤₙ construction (point at infinity + n+1 parallel-line classes).
**Refactor:** none expected.
**Acceptance:** All incidence tests green for n ∈ {2, 3, 5, 7}.

### Slice 5 — Circle packer
**Outcome:** Pack `k` circles of varying radii inside a unit parent circle without overlap, returning positions + radii. Deterministic given a seeded PRNG.
**Test (Red):** `src/lib/packer.test.ts` — for k ∈ {3, 4, 6, 8}: all child circles fully inside parent (centre distance + radius ≤ 1 within tolerance), no pair overlaps (pairwise centre distance ≥ sum of radii within tolerance), packing density above a minimum threshold; same seed → identical output.
**Implementation (Green):** `src/lib/packer.ts` — Lloyd/force-directed relaxation: seed positions, iteratively repel overlaps and pull toward centre, bounded iterations.
**Refactor:** extract overlap-resolution into a private helper if loop body grows beyond ~30 lines.
**Acceptance:** All packer tests green; runs in <100ms for k=8.

### Slice 6 — Card canvas renderer
**Outcome:** A pure function `drawCard(canvas, symbols, packing, rotations, options)` draws `n+1` images into a circular card on a given canvas, each image clipped to its packed circle and rotated.
**Test (Red):** `src/render/drawCard.test.ts` (uses `node-canvas` or jsdom canvas mock) — given 3 dummy `ImageBitmap`-like inputs and a stub packing, asserts `drawImage` called 3 times with expected clip/transform sequence; assert background and outline drawn.
**Implementation (Green):** `src/render/drawCard.ts` — clears canvas, draws white background, for each symbol applies `save/clip/translate/rotate/drawImage/restore`.
**Refactor:** none expected.
**Acceptance:** Card render test green; manual smoke test in the browser renders a recognisable card.

### Slice 7 — Multi-card front-pages PDF assembly
**Outcome:** Given an array of card canvases + print settings, produce a `Uint8Array` PDF with the correct number of pages, each containing up to 6 cards laid out on the chosen page size with bleed + crop marks.
**Test (Red):** `src/render/buildPdf.test.ts` — for 7 stub canvases at A4: PDF parses (load with `pdf-lib`), has 2 pages, page dimensions match A4 mm→pt; crop marks present (count rectangles/lines on first page).
**Implementation (Green):** `src/render/buildPdf.ts` — embed each canvas PNG, place at calculated grid positions, draw crop-mark lines via `page.drawLine`.
**Refactor:** none expected.
**Acceptance:** Front-only PDF test green.

### Slice 8 — Card-back pages with mirrored layout
**Outcome:** When a back image is provided, `buildPdf` interleaves a back page after each front page with horizontally-mirrored card positions so duplex long-edge flip aligns.
**Test (Red):** Extend `buildPdf.test.ts` — given 7 stub front canvases + a back image, PDF has 4 pages (2 fronts + 2 backs); on page 2, card centres are horizontally mirrored across the page centre line relative to page 1; back image appears at each card slot.
**Implementation (Green):** Add a back-page emission branch to `buildPdf`, computing mirrored x-coordinates per card slot.
**Refactor:** extract slot-position calculator into a helper if the back branch duplicates the front loop.
**Acceptance:** Front+back PDF test green; manual duplex print verifies alignment (deferred to manual smoke check at end of feature).

### Slice 9 — Upload component (picker + drag-drop)
**Outcome:** An `<UploadDropzone>` React component accepts PNG/JPEG/WebP/SVG via click or drag-drop, rejects others, surfaces a soft warning on files >5MB, and emits an `onImagesAdded(File[])` callback.
**Test (Red):** `src/components/UploadDropzone.test.tsx` — simulates a drop event with a mix of PNG + PDF + 10MB PNG; asserts callback receives only PNG, error toast for PDF, warning for the large file.
**Implementation (Green):** `src/components/UploadDropzone.tsx` using `react-dropzone` or a hand-rolled drop handler.
**Refactor:** none expected.
**Acceptance:** Upload component test green.

### Slice 10 — Thumbnail grid with inclusion + reorder
**Outcome:** A `<ThumbnailGrid>` shows uploaded images with a visual "included / excluded" state based on the active deck order; supports drag-reorder and click-to-toggle inclusion.
**Test (Red):** `src/components/ThumbnailGrid.test.tsx` — given 20 mock images and order n=3 (13 included): first 13 marked included; clicking a greyed thumbnail swaps it with the last included one; drag-reorder updates parent state via callback.
**Implementation (Green):** `src/components/ThumbnailGrid.tsx` using a lightweight drag-reorder lib (`@dnd-kit/sortable`) or HTML5 drag events.
**Refactor:** none expected.
**Acceptance:** Thumbnail grid tests green.

### Slice 11 — Order selector + seed controls
**Outcome:** `<DeckSettings>` shows the auto-picked order, lets the user override to any valid prime ≤ auto, displays the active seed, has a "Re-roll" button, and accepts a pasted seed.
**Test (Red):** `src/components/DeckSettings.test.tsx` — given image count 31, default order is 5; override dropdown lists {2, 3, 5}; reroll changes the displayed seed; pasting a seed updates state.
**Implementation (Green):** `src/components/DeckSettings.tsx`.
**Refactor:** none expected.
**Acceptance:** DeckSettings tests green.

### Slice 12 — Print settings panel + optional back image upload
**Outcome:** `<PrintSettings>` exposes card diameter slider (60–100mm, default 85), page size (A4/Letter), crop marks toggle, bleed toggle, background colour (white/transparent), and an optional single-file "Card back image" upload slot.
**Test (Red):** `src/components/PrintSettings.test.tsx` — default values match Decision 10; slider change emits new diameter; uploading a PNG to the back-image slot emits the back image; toggling crop marks emits the new value.
**Implementation (Green):** `src/components/PrintSettings.tsx`.
**Refactor:** none expected.
**Acceptance:** PrintSettings tests green.

### Slice 13 — App integration: generate flow
**Outcome:** `App.tsx` wires upload → thumbnails → deck settings → print settings → "Generate" button. Clicking Generate runs incidence + packing + card rendering and shows a preview gallery; "Download PDF" emits the file.
**Test (Red):** `src/App.test.tsx` — simulates uploading 13 images, clicking Generate; asserts preview gallery shows 13 cards; clicking Download PDF triggers a Blob URL with `application/pdf`.
**Implementation (Green):** `App.tsx` composing components, holding state, orchestrating the generate pipeline.
**Refactor:** extract a `useDeckGenerator` hook if `App.tsx` exceeds ~150 lines.
**Acceptance:** Integration test green.

### Slice 14 — Playwright E2E happy path
**Outcome:** A Playwright test that loads the app, drag-drops 13 fixture images, clicks Generate, then Download PDF, and asserts a PDF file is delivered.
**Test (Red):** `e2e/happy-path.spec.ts` written first; fails because Playwright not yet configured.
**Implementation (Green):** Install Playwright, add `playwright.config.ts`, add 13 fixture PNGs to `e2e/fixtures/`.
**Refactor:** none expected.
**Acceptance:** `npx playwright test` exits 0.

### Slice 15 — GitHub Pages deploy workflow
**Outcome:** `.github/workflows/deploy.yml` builds the app on push to `main` and publishes the static output to GitHub Pages.
**Test (Red):** N/A — infra slice. Acceptance verified by the workflow running green on the first push to `main`.
**Implementation (Green):** Workflow checking out, installing, `npm run build`, uploading `dist/` to `actions/deploy-pages`. `vite.config.ts` configures `base` for the GH Pages subpath.
**Refactor:** none expected.
**Acceptance:** Workflow runs green on push to `main`; the published URL serves the app.

## Deferred (out of scope)
| Item | Why deferred | Related decision |
|------|--------------|------------------|
| Prime-power deck orders (n=4, 8, 9, ...) | Requires GF(p^k) finite-field arithmetic; disproportionate complexity for v1 | Decision 2, 8 |
| Background removal for uploaded images | Heavy WASM dependency / server call; v1 keeps preprocessing minimal | Decision 7 |
| Built-in card-back patterns / wordmark generator | Out of scope for v1 — user uploads a back image or prints single-sided | Decision 16 |
| Accessibility audit (keyboard nav, focus management, ARIA) | Sensible-defaults baked into components; full audit deferred | — |
| Progress UI / web-worker offload during generation | Generation is fast enough for v1 image counts; revisit if profiling shows jank | — |

## Open Questions
- Whether a fallback subset of the prime list (e.g., capping at n=11 rather than n=13) is preferable on memory-constrained devices — revisit after first manual smoke test of a 200-image upload.
