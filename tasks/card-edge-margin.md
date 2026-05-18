# card-edge-margin

Add a configurable inner margin around each card's outer circle so no image content sits within the margin distance of the card's edge. Default `5 mm`.

## Context
_Codebase facts and constraints learned during grilling._
- Card raster resolution is `CARD_RENDER_PX = 1000` (square canvas, 500 px radius) at `src/App.tsx:54`.
- Physical card diameter is user-configurable: `cardDiameterMm` default `85`, range `60–100`, defined in `src/components/printSettingsTypes.ts:19-24`.
- PDF bridge: `cardRadiusPt = mmToPt(settings.cardDiameterMm) / 2` at `src/render/buildPdf.ts:67`; rasterised PNG is placed at `(cardRadiusPt + bleedPt) * 2` in `drawCardImageAtSlot` (`src/render/buildPdf.ts:163-177`). The 1000 px canvas maps geometrically to `cardDiameterMm` mm — no DPI field.
- `drawCard` (`src/render/drawCard.ts`) clips to the card circle via `ctx.clip()` at `radiusPx` (lines 72-76). Slot pixel mapping in `drawSingleSymbol`: `cx = radiusPx + slot.x * radiusPx`, etc. (lines 103-105). Slot coords are in a normalised frame where the parent card has radius 1 centred at origin.
- `PACKING_FRACTION = 0.65` at `src/lib/packer.ts:39` sets the area budget for child seeding via `baseRadius = Math.sqrt(PACKING_FRACTION / k)` (assumes parent of unit radius).
- Packer boundary constraint: `dist <= 1 - c.r` in `resolveBoundaryOverlaps` / `clampInsideParent` (`src/lib/packer.ts:219-244`) — children can touch the parent rim at radius 1.
- Convergence retry path already exists (`PackingDidNotConvergeError`, `MAX_RETRIES = 8`, from `feature/alpha-aware-packing`).
- No existing inset / padding / margin mechanism between image slots and the card edge.
- Silhouette circles (alpha-aware-packing) are fitted inside slot circles, so any constraint on slot circles automatically applies to silhouette extents.
- For an 85 mm card, 5 mm equals `~0.118` of the radius (`5 / 42.5`). The inset fraction varies with `cardDiameterMm` (e.g. `~0.167` at 60 mm, `~0.1` at 100 mm).

## Decisions
1. **Margin scope** — Applies to the card's outer circle (per-card inner margin). Images must stay 5 mm inside the card's circular boundary. NOT a PDF page-level print margin.
2. **Configurability** — Expose as a field in `PrintSettings` (alongside `cardDiameterMm`) with default `5 mm`. UI control follows the existing `cardDiameterMm` pattern.
3. **Visual treatment** — Margin is an invisible no-image zone. No drawn ring, stroke, or trim guide. Pure whitespace from the outermost image silhouette to the card edge.
4. **Implementation point** — Packer-aware. Replace the boundary constant `1` with `1 - insetFraction` in `src/lib/packer.ts` (boundary checks in `resolveBoundaryOverlaps` / `clampInsideParent` and in initial seeding). The packer receives `insetFraction = cardEdgeMarginMm / (cardDiameterMm / 2)` from the caller. Silhouette circles inherit the constraint for free. Scale `PACKING_FRACTION` to `PACKING_FRACTION * (1 - insetFraction)²` so the seeded child total area stays at the tuned 65% of the *inner* disc, preserving convergence behaviour (`MAX_RETRIES = 8` retry path stays as the safety net).
5. **Bounds** — `cardEdgeMarginMm`: min `0`, max `15`, step `1`, default `5`. At 60 mm card with 15 mm margin → 25% effective area, still inside the post-compensation convergence envelope. `0` opts out (current behaviour). Step matches `cardDiameterMm` granularity.
6. **Naming** — TS field: `cardEdgeMarginMm` (mirrors `cardDiameterMm`). UI label: `"Edge margin (mm)"` with helper line `"Keeps images this far from the card's edge"` if existing UI uses helper-text convention, else label only.

## Slices

### Slice 1 — `PrintSettings` gains `cardEdgeMarginMm` with default and bounds
**Outcome:** The `PrintSettings` type carries a new `cardEdgeMarginMm: number` field, default `5`, validated to the inclusive range `[0, 15]`. The rest of the app compiles unchanged because defaults flow through.
**Test (Red):** A unit test asserts that (a) the default-builder returns `cardEdgeMarginMm === 5`, (b) out-of-range values are clamped (or rejected, matching the existing validation style for `cardDiameterMm`), (c) `0` is a valid setting. File: `src/components/printSettingsTypes.test.ts` (create if missing; otherwise extend the existing settings-test file).
**Implementation (Green):** Add `cardEdgeMarginMm: number` to the `PrintSettings` type in `src/components/printSettingsTypes.ts`. Add `DEFAULT_CARD_EDGE_MARGIN_MM = 5` and bounds constants alongside the existing `cardDiameterMm` constants. Wire the default into the same factory/initial-state path used by `cardDiameterMm`. Mirror whatever clamp/validate helper the diameter field uses.
**Refactor:** If existing diameter bounds live as inline literals, extract a `clampSettingsField(value, min, max)` helper only if used by ≥2 fields. Otherwise none.
**Acceptance:** New test passes; `npm run typecheck` clean; no UI changes yet.

### Slice 2 — Packer accepts an `insetFraction` and shrinks its working disc
**Outcome:** `packCircles` accepts an optional `insetFraction` parameter (default `0`, preserving current behaviour). Internally, every boundary check uses `(1 - insetFraction)` as the effective parent radius, and `PACKING_FRACTION` is scaled by `(1 - insetFraction)²` when computing `baseRadius`.
**Test (Red):** A packer unit test packs N=8 circles with `insetFraction = 0.15` and asserts every returned `(x, y, r)` satisfies `Math.hypot(x, y) + r <= 1 - 0.15 + ε` (small floating-point tolerance). A second assertion checks that with `insetFraction = 0`, results are byte-identical to the no-arg call (regression guard for the no-margin path). File: `src/lib/packer.test.ts` (extend existing).
**Implementation (Green):** Add `insetFraction = 0` parameter to `packCircles` in `src/lib/packer.ts`. Thread an `effectiveBoundary = 1 - insetFraction` through `resolveBoundaryOverlaps`, `clampInsideParent`, and any initial-placement boundary clamp. Change `baseRadius = Math.sqrt(PACKING_FRACTION / k)` to `baseRadius = Math.sqrt(PACKING_FRACTION * (1 - insetFraction) ** 2 / k)`. Convergence-retry loop (`MAX_RETRIES = 8`) is untouched — it is the safety net for the rare hard configurations.
**Refactor:** If `1` appears as the boundary literal in ≥3 spots after the change, extract a local `const boundary = 1 - insetFraction` once at function entry and reuse. Keep semantic naming.
**Acceptance:** Both new tests pass; all existing packer tests pass unchanged; deterministic seed in the no-arg / `insetFraction = 0` path is preserved.

### Slice 3 — `drawCard` computes `insetFraction` from settings and passes it to the packer
**Outcome:** When rendering a card, the inset fraction is derived from the active `PrintSettings` as `cardEdgeMarginMm / (cardDiameterMm / 2)` and threaded into `packCircles`. Slots returned by the packer therefore respect the margin in normalised coordinates, and `drawCard`'s existing slot-to-pixel mapping naturally yields a no-image margin ring on the rendered card.
**Test (Red):** A render-layer test calls the card-drawing pipeline with `cardDiameterMm = 80`, `cardEdgeMarginMm = 5` (insetFraction = 0.125), inspects the packed slots (either through a packer call spy or by exposing the computed insetFraction in a small pure helper), and asserts the fraction passed in is `5 / 40 = 0.125 ± 1e-9`. File: `src/render/drawCard.test.ts` (create or extend).
**Implementation (Green):** Introduce a pure helper `function computeInsetFraction(diameterMm: number, marginMm: number): number` that returns `marginMm / (diameterMm / 2)`, guarded for `diameterMm <= 0` (returns `0` defensively). Export it from `src/render/drawCard.ts`; thread it into `packCircles` at the existing call site in `src/App.tsx`. Default behaviour when `cardEdgeMarginMm === 0` matches Slice 2's regression guard exactly.

**Implementation note (post-ship):** Shipped as positional `packCircles(k, rng, insetFraction)` to stay consistent with the existing `(k, rng)` signature, rather than the options-object form sketched above. Functionally equivalent; flagged as non-blocking MINOR in code review.
**Refactor:** If `computeInsetFraction` is the only mm→fraction helper, leave it co-located. If a similar conversion exists elsewhere, consolidate.
**Acceptance:** Test passes; visual check is deferred to Slice 4 wiring. `npm run test` and `npm run typecheck` clean.

### Slice 4 — `PrintSettings` UI exposes the margin field
**Outcome:** The print-settings UI gains a numeric input for `cardEdgeMarginMm` (range `0–15`, step `1`, default `5`) labelled `"Edge margin (mm)"`. Changing the value re-renders cards with the updated margin.
**Test (Red):** A React Testing Library component test on the `PrintSettings` UI asserts (a) the new input renders with the default value `5`, (b) `min`, `max`, `step` attributes are `0`, `15`, `1`, (c) changing the value fires the same `onChange` / setter mechanism used by `cardDiameterMm`. File: `src/components/PrintSettings.test.tsx` (create or extend).
**Implementation (Green):** Add the input control to the existing `PrintSettings` component, mirroring the `cardDiameterMm` row exactly (same label/input layout, same change handler shape). Add the helper-text line only if the existing UI uses helper-text convention; otherwise label only.
**Refactor:** If the diameter and margin rows are now near-identical JSX, extract a `<NumericMmField label min max step value onChange />` only if both rows simplify materially. Otherwise leave inline — two near-twins is fine.
**Acceptance:** Component test passes. Manual browser check via `npm run dev`: change the margin slider/input, generate cards, confirm the no-image ring around each card grows/shrinks correspondingly. Setting margin to `0` reproduces pre-feature output.

## Deferred (out of scope)
| Item | Why deferred | Related decision |
|------|--------------|------------------|

## Open Questions

_None — all decisions resolved during grilling._
