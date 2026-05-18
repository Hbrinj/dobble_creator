# back-image-placement

Let the user upload a card-back image, then scale and pan it within a circular guide. The placement is reflected live in a preview and in the exported PDF, with the image clipped to the card's circular edge.

## Context
_Codebase facts and constraints learned during grilling._
- Back-image upload already exists end-to-end as raw file pass-through. UI: `src/components/PrintSettings.tsx:12-15, 219-244` (plain `<input type="file">` row "Card back image"). State lifted to `App.tsx:102` as `backImageFile`. On PDF export, read into `Uint8Array` and wrapped in `BackImage` struct (`buildPdf.ts:19-22`, App call site `App.tsx:339-344`).
- PDF emit: image embedded once via `pdfDoc.embedPng` (`buildPdf.ts:75-76`); for each front sheet a back page is appended immediately after (line 92) drawn by `drawCardImageAtSlot` (lines 163-177) which `page.drawImage`s the raw bytes stretched to `(cardRadiusPt + bleedPt) * 2` on both axes. Back-page slot positions are mirrored via `mirrorSlots` (lines 135-143) for long-edge duplex flip registration.
- No circular clip, scale, or offset state exists anywhere — the back image bleeds into the full card-square bounding box today.
- Reusable primitives in `src/render/drawCard.ts`:
  - Circular clip: `ctx.arc` + `ctx.clip()` at card-radius (lines 87-92) and per-symbol (lines 143-147).
  - Image-fit math: `scale = slotRadiusPx / silRadiusPx`, `drawX/drawY` offsets relative to slot centre (lines 132-141) — identical arithmetic to what user-supplied scale + offset would replace.
- Decision 6 moves the upload OUT of `PrintSettings` — the prior `PrintSettings.tsx:244` row is removed and back-image concerns relocate to a new `CardBack` section, so the `PrintSettings` `rowClasses` pattern is not extended here.
- App structure already follows "one titled card per major concern" (uploads, settings, generated cards) per the `prettify-ui` feature — a new "Card back" card slots in naturally.
- Empty-state convention from `prettify-ui`: dashed-border dropzone style for "no file yet".

## Decisions
1. **Output semantics** — The back image is clipped to the card's circular edge in the printed PDF. The user's scale + offset controls determine what part of the source image lands inside the circle; pixels outside the circle are not printed. This also fixes today's "back image bleeds into the card-square corners" behaviour.
2. **Interaction model** — Direct manipulation on the circular preview: mouse-drag to translate, mouse-wheel to scale. No slider / numeric input fallback in v1. Internal state is still `(scale, offsetX, offsetY)` — the gestures just drive those numbers.
3. **Default placement** — Fill: on upload, scale is set so the image's larger dimension matches the circle diameter (`scale = circleDiameter / max(naturalWidth, naturalHeight)`), centred at offset `(0, 0)`. Overflow on the shorter axis is cropped by the circular clip. Mirrors the conventional photo-crop default (CSS `object-fit: cover`).
4. **Bounds** — Scale: min `0.1 × fillScale`, max `10 × fillScale` (fillScale = the per-image default from Decision 3). Below-fill is allowed so users can intentionally leave white border around a logo. Pan: constrained so the image's rectangular footprint always contains the circle's centre `(0, 0)` after scale + translate — prevents "pan off-screen, print blank" failure mode.
5. **Rendering pipeline** — Pre-rasterise via offscreen canvas. New pure helper (working name `composeBackImageCanvas(image, placement, diameterPx)`) applies scale + translate + `ctx.clip()` arc and returns a canvas/PNG bytes. The PDF layer is changed minimally: `BackImage` now carries the *composed* PNG bytes (or a callable that produces them), so `pdfDoc.embedPng` + existing `drawCardImageAtSlot` still apply on the back pages. Same composer feeds the live preview component — single source of truth, eliminates preview-vs-PDF divergence.
6. **UI placement** — New top-level "Card back" section as its own titled card in the App page (alongside uploads, settings, generated cards). Section contains BOTH the file-upload input AND the circular preview component. Existing back-image upload row is removed from `PrintSettings`. Rationale: all back-image concerns colocated; `PrintSettings` stays focused on sizes/copies/margins; preview gets the canvas real estate it needs for drag-to-pan to be usable.
7. **Re-upload behaviour** — On every new file upload, placement state resets to fill-default + `(0, 0)` offset (per Decision 3). Any prior user tweaks are discarded. Trades convenience for the rare iterate-on-same-asset case against silent breakage when the new image has different proportions.
8. **Reset action** — Visible "Reset placement" text button rendered in the Card-back section near the preview. Clicking restores fill default + `(0, 0)` offset for the currently-loaded image. Shares the reset code path with Decision 7's re-upload handler.
9. **Input devices (v1)** — Mouse only: `mousedown`/`mousemove`/`mouseup` (or PointerEvents bound to mouse) for drag-pan, `wheel` for zoom. Touch / pinch deferred to a follow-up feature.
10. **Empty state** — Card-back section renders a dashed-border placeholder + upload button when no file is loaded (matches the `prettify-ui` dropzone convention). On upload, the placeholder is replaced by the circular preview + Reset button. Footprint stays the same to avoid layout shift.
11. **Bleed interaction** — Composer clips at `cardRadius + bleed` so the printed back image extends to the bleed boundary, matching the trim-safety pattern used for fronts. The App passes `diameterPx` covering the full bleed-square to `composeBackImageCanvas`. The live preview component, in contrast, draws its circular guide at the *card* radius (no bleed) so the user designs against the post-trim visible area.

### Sensible defaults (not grilled, baked into slices)
- Wheel zoom: `1.1×` per notch (multiplicative); zoom centred on the cursor position, not the image centre.
- Preview canvas: fixed 320 px square; circular guide is a thin stroked ring drawn over the composed image.
- Cursors: `grab` on preview hover, `grabbing` while dragging.
- `BackImagePlacement` state shape: `{ scale: number, offsetX: number, offsetY: number }` in canvas-pixel units relative to the composer canvas centre (i.e. `0, 0` = image centre at circle centre). Composer + preview share the same units; the canvas size at compose time vs preview time differs only by a uniform scale factor.

## Slices

### Slice 1 — `composeBackImageCanvas` pure helper
**Outcome:** A pure helper rasterises an `HTMLImageElement` (or `ImageBitmap`) onto an offscreen canvas at the given placement, clipped to a circle. The function is the single source of truth for back-image rendering — reused by the preview and the PDF export.
**Test (Red):** Unit tests on the helper signature and behaviour:
- Given a `200×100` image, `placement = { scale: 1, offsetX: 0, offsetY: 0 }`, `diameterPx: 200` → the returned canvas is `200×200`, pixels outside the circle (e.g. corner `(0, 0)`) are transparent, pixel at canvas centre matches a source-image centre pixel.
- Given the same image at `placement = { scale: 2, offsetX: 0, offsetY: 0 }` → image is scaled 2×, source-pixel-per-canvas-pixel ratio halves; pixel at canvas centre still matches source centre.
- Given `placement = { scale: 1, offsetX: 50, offsetY: 0 }` → image is translated; canvas pixel `(50 + canvasCentreX, canvasCentreY)` matches source centre pixel.
- Clip boundary: pixel at the circle's edge boundary is opaque/image-coloured; pixel just outside (e.g. `(1, 1)`) is transparent.

  File: `src/render/composeBackImageCanvas.test.ts` (new). Use `OffscreenCanvas` if available in jsdom, else `document.createElement('canvas')`; read pixels via `ctx.getImageData`.
**Implementation (Green):** Create `src/render/composeBackImageCanvas.ts` exporting `composeBackImageCanvas(image, placement, diameterPx) → HTMLCanvasElement`. Steps inside: create canvas of `diameterPx × diameterPx`; get `ctx`; `ctx.save()` → `ctx.beginPath()` → `ctx.arc(diameterPx/2, diameterPx/2, diameterPx/2, 0, 2π)` → `ctx.clip()`; `ctx.translate(diameterPx/2 + offsetX, diameterPx/2 + offsetY)`; `ctx.scale(scale, scale)`; `ctx.drawImage(image, -image.width/2, -image.height/2)`; `ctx.restore()`. Return the canvas.
**Refactor:** None expected; helper is small and single-purpose.
**Acceptance:** All new tests pass; `npm run typecheck` clean; no caller wired yet.

### Slice 2 — `BackImagePlacement` type, `computeFillScale`, and pan/scale clamping helpers
**Outcome:** The placement state type and its math primitives exist as pure functions, ready to be consumed by the preview component and the App.
**Test (Red):** Unit tests on three pure helpers:
- `computeFillScale(imageWidth, imageHeight, diameterPx) → number` — returns `diameterPx / max(imageWidth, imageHeight)`. Cases: portrait, landscape, square, `diameterPx = 0` (returns 0 defensively).
- `clampScale(requestedScale, fillScale) → number` — clamps to `[0.1 * fillScale, 10 * fillScale]`. Cases: within range passes through; below min clamps to min; above max clamps to max.
- `clampPan(offset, scale, imageNaturalSize, diameterPx) → { offsetX, offsetY }` — enforces that the image footprint after scale+translate contains `(0, 0)` (circle centre). Cases: small offset passes through; extreme offset on +X gets clamped so the image's right edge equals `0`; symmetric for −X, +Y, −Y.

  File: `src/render/backImagePlacement.test.ts` (new).
**Implementation (Green):** Create `src/render/backImagePlacement.ts` exporting the `BackImagePlacement` type, `computeFillScale`, `clampScale`, `clampPan`, and a `DEFAULT_PLACEMENT_FACTORS` constant (`{ MIN: 0.1, MAX: 10 }`). All pure functions.
**Refactor:** None expected.
**Acceptance:** All new tests pass; helpers exported with stable signatures.

### Slice 3 — `BackImagePreview` component with mouse drag + wheel zoom
**Outcome:** A self-contained component renders a 320×320 circular preview, calls `composeBackImageCanvas` to draw the current placement, overlays a thin circular guide stroke at the card-radius, and lets the user drag-pan and wheel-zoom (clamped). Emits `onChange(placement)` on each gesture frame.
**Test (Red):** React Testing Library component tests:
- Renders an empty canvas when no `image` prop. With an image and a placement prop, the canvas is non-empty (smoke check on `toDataURL` length or a single pixel read).
- `mousedown` → `mousemove` → `mouseup` emits `onChange` with updated offset; offset is clamped (mouse moved so far that the image footprint would no longer cover `(0, 0)` → `onChange` value is clamped, not the raw delta).
- `wheel` event with negative `deltaY` emits `onChange` with `scale * 1.1`, positive `deltaY` emits `scale / 1.1`; clamped at min/max from Slice 2.
- The circular guide stroke is drawn (assert `ctx.stroke` was called or check a snapshot).

  File: `src/components/BackImagePreview.test.tsx` (new).
**Implementation (Green):** Create `src/components/BackImagePreview.tsx`. Props: `{ image: HTMLImageElement | null, placement: BackImagePlacement, onChange: (next: BackImagePlacement) => void }`. Uses a `<canvas ref>` of 320×320; in a `useEffect` keyed on `(image, placement)`, calls `composeBackImageCanvas(image, scaledPlacement, 320)` (scaling the placement to the preview's 320 px frame) then strokes a guide circle. Mouse handlers compute pixel deltas → placement deltas → invoke `clampPan` / `clampScale` from Slice 2 → call `onChange`. Wheel handler uses `event.preventDefault()` + `deltaY` sign to compute multiplicative scale change centred on cursor (so the point under the cursor stays anchored).
**Refactor:** Pull the "pixel delta → placement delta" math into a tiny helper if it grows past ~5 lines.
**Acceptance:** Component tests pass; manual browser check deferred to Slice 5 wiring.

### Slice 4 — `CardBack` section with empty state, file input, preview, and Reset button
**Outcome:** A new `CardBack` section component owns the back-image lifecycle: empty-state dropzone, file input, loaded-state preview + Reset button. Manages its own `image` and `placement` state. On file upload, image is loaded into an `HTMLImageElement`, placement resets to fill-default. Emits `onPlacementChange(file, placement)` (or similar) so the App can compose-and-export.
**Test (Red):** React Testing Library component tests:
- Empty state: renders dashed-border dropzone with an upload button; clicking the button opens a file dialog (mock the input change event).
- After uploading a file: empty state disappears, preview component renders, Reset button is visible.
- Click Reset: placement state returns to fill-default (assert via `onChange` callback or by re-querying the preview's emitted placement).
- Upload a second different-sized file: placement resets to *that* file's fill-default (not the prior file's tweaks).

  File: `src/components/CardBack.test.tsx` (new).
**Implementation (Green):** Create `src/components/CardBack.tsx`. Owns `useState<HTMLImageElement | null>(null)` and `useState<BackImagePlacement>(DEFAULT)`. File-input change handler: read file → `new Image()` → `image.onload = () => setImage(...); setPlacement(fillDefault(...))`. Reset button handler: `setPlacement(fillDefault(image.naturalWidth, image.naturalHeight, PREVIEW_DIAMETER))`. Empty-state JSX mirrors the existing dropzone styling from `prettify-ui` (dashed border, centred upload button + helper text). Renders `<BackImagePreview image={image} placement={placement} onChange={setPlacement} />` when image is loaded.
**Refactor:** If the dropzone JSX duplicates the existing front-image dropzone significantly, extract a `<Dropzone>` only if reuse is genuine; otherwise leave inline (two near-twins is fine per project convention).
**Acceptance:** Component tests pass; the component is self-contained — no App wiring yet.

### Slice 5 — Wire `CardBack` into the App; remove back-image row from `PrintSettings`; route composed PNG to PDF
**Outcome:** End-to-end: user uploads a back image in the new section, adjusts it via drag/wheel, generates the PDF, and the PDF embeds the composed (clipped-to-bleed-circle) PNG bytes — not the raw upload. The back-image upload row is removed from `PrintSettings`. Layout shows the new "Card back" titled card alongside existing sections per `prettify-ui` styling.
**Test (Red):** App-level integration test (extend `src/App.test.tsx`):
- After mounting App and simulating a back-image upload + a programmatic placement change, calling the export path produces a `BackImage` struct whose PNG bytes match what `composeBackImageCanvas` would produce for the same `(image, placement, diameterPx)`. (Mock `pdfDoc.embedPng` or assert against `BackImage.pngBytes` directly.)
- `PrintSettings` no longer renders the "Card back image" upload row.

  Files: `src/App.test.tsx`, `src/components/PrintSettings.test.tsx`.
**Implementation (Green):** Remove the back-image upload row and associated props from `PrintSettings.tsx` (the `backImageFile` field disappears from PrintSettings' surface). In `App.tsx`: replace `backImageFile` state with whatever `CardBack` emits (the composed canvas or the `(image, placement)` pair). Render `<CardBack />` in a new titled card. In the PDF export handler (`App.tsx:339-344`), instead of reading raw upload bytes, call `composeBackImageCanvas(image, placement, cardDiameterPxIncludingBleed)` and convert the canvas to PNG bytes (`canvas.toBlob`/`toDataURL`) before constructing the `BackImage` struct. Update the `BackImage` field name from a raw-bytes meaning to a composed-bytes meaning if helpful.
**Refactor:** If `BackImage`'s name no longer reflects its semantics (raw → composed), rename in the same slice (e.g. `ComposedBackImage`) — single search-and-replace, well-bounded.
**Acceptance:** Integration test passes; `npm run typecheck`, `npm test`, `eslint` clean. Manual browser check via `npm run dev`: upload a non-square back image, drag and wheel-zoom, click Reset, generate PDF, open the PDF and visually confirm: (i) back is clipped to a circle, (ii) image extends to the bleed boundary, (iii) the trimmed back matches what the preview showed.

## Deferred (out of scope)
| Item | Why deferred | Related decision |
|------|--------------|------------------|
| Touch / pinch-zoom support for back-image placement | Desktop creator app; touch is not the primary surface. Avoid the bad-UX middle state of "pan works but zoom doesn't" by deferring both together to a focused follow-up. | Decision 9 |

## Open Questions

_None — all decisions resolved during grilling._
