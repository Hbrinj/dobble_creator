# card-back-drag-drop

Add drag-and-drop file upload to the existing `CardBack` section (single file). The click-to-browse hidden-input path stays as-is; drag-drop is additive and shares validation + load logic with it.

## Context
_Codebase facts and constraints learned during grilling._
- `CardBack.tsx` lives at `src/components/CardBack.tsx`. State: `image: HTMLImageElement | null` (line 50), `placement: BackImagePlacement` (line 51). Refs: `fileInputRef`, `currentObjectUrlRef`.
- File handler `handleFileChange` (line 79): reads `event.target.files?.[0]`, resets input value, revokes prior object URL, mints new via `URL.createObjectURL`, loads into `new Image()` whose `onload` calls `setImage` + `setPlacement(fillDefault(...))`. MIME guarding is at the `<input accept="image/png,image/jpeg,image/webp">` attribute only (line 129) — there is NO explicit `file.type` check inside `handleFileChange`.
- JSX: ternary on `image` — null → `<button>` empty-state dropzone (line 159) with `onClick → handleClickEmptyState`. Loaded → `<BackImagePreview>` + "Reset placement" + "Replace image" buttons.
- The empty-state `<button>` at line 159 currently has zero drag handlers (`onDragOver` / `onDrop` / `onDragEnter` / `onDragLeave` all absent). There is no `isDragOver` state in `CardBack`.
- **Precedent: `UploadDropzone.tsx`** (front-image uploader) is the exact pattern to replicate. Handlers: `onDrop` (line 58 — `preventDefault`, `stopPropagation`, `setIsDragOver(false)`, reads `event.dataTransfer?.files`), `onDragOver` (line 69 — `setIsDragOver(true)`), `onDragLeave` (line 75 — `setIsDragOver(false)`). State: `isDragOver: boolean` (line 25). Visual: split `baseClasses` (border-dashed, min-h-48, transition-all) vs `stateClasses` — active `'border-amber-500 bg-amber-500/10 scale-[1.005]'` vs idle `'border-slate-700 hover:border-slate-500'`. CardBack's empty-state already shares the same `baseClasses` near-verbatim — a conditional swap fits without DOM changes.
- **Testing pattern**: project-local `dispatchWithDataTransfer` helper used in `src/components/UploadDropzone.test.tsx` (line 11). Constructs a plain `new Event(type, { bubbles: true, cancelable: true })` and uses `Object.defineProperty` to attach a fake `dataTransfer` with `files`, `items`, `types: ['Files']`, then dispatches via `element.dispatchEvent`. No `fireEvent` from RTL, no `pointerEvents`. `CardBack.test.tsx:70` already labels the empty-state as a "dropzone" in comments, anticipating this addition.
- `CardBack.test.tsx` already mocks `MockImage` + `URL.createObjectURL` in `beforeEach` — the scaffolding covers both click and drop code paths once we share a handler.
- **Notice system**: App-level only. `const [notices, setNotices] = useState<readonly string[]>([])` (`src/App.tsx:103`) rendered inline in `<main>` (`App.tsx:449-461`) as amber warning banners (`bg-amber-500/10 border-amber-500/30 text-amber-200`). No severity field, no dismiss, permanent for the session (`prettify-ui` Decision 16 — "all notices treated as warnings this pass"). Two stable callbacks: `handleWarning` (`App.tsx:206`) and `handleError` (`App.tsx:209`) — passed as explicit props. Precedent: `UploadDropzone` declares `onWarning: (message: string) => void` + `onError: (message: string) => void` (`UploadDropzone.tsx:15-16`); App passes `handleWarning` / `handleError` at the `<UploadDropzone>` callsite. `CardBack` currently has no notice prop.

## Decisions
1. **Drop surface** — Drag-drop binds to the entire `CardBack` section wrapper, active in BOTH empty and loaded states. Dropping a file when an image is already loaded replaces it (same code path as Reset + new upload). Whole section gets the amber drag-over outline. The empty/loaded ternary inside is untouched.
2. **Non-image file types** — Explicit `file.type` check against allow-list `['image/png', 'image/jpeg', 'image/webp']`. On mismatch, reject the drop with a banner-style notice via the existing notice system. The same `validateBackImageFile(file)` helper guards BOTH the drop AND the click path (the latter as belt-and-braces; the `<input accept>` attribute remains the picker's first line of defence). Constants colocated with the file handler.
3. **Multi-file drop** — Silently take `files[0]`, ignore the rest. Mirrors the click path's `event.target.files?.[0]`. No "ignored N others" notice — would clutter the notice bar for negligible benefit on a clearly single-target zone.
4. **Notice prop** — `CardBack` gains a single new prop `onWarning: (message: string) => void`, wired in `App.tsx` to the existing `handleWarning` callback (`App.tsx:206`). No `onError` — wrong-file-type is user-correctable input, not a system failure. Mirrors `UploadDropzone`'s use of the same callback for the same condition.

### Sensible defaults (not grilled, baked into slices)
- `onDragOver` sets `event.dataTransfer.dropEffect = 'copy'` so the cursor shows "copy" rather than "not allowed".
- Drag-over visual feedback reuses the `UploadDropzone` styling verbatim: active classes `'border-amber-500 bg-amber-500/10 scale-[1.005]'`, idle classes `'border-slate-700 hover:border-slate-500'`. Toggled by a new `isDragOver: boolean` state in `CardBack`.
- DO NOT extract a shared `<Dropzone>` abstraction across `UploadDropzone` and `CardBack`. The project convention noted in prior slices ("two near-twins is fine") applies. Abstraction is premature; revisit only if a third dropzone appears.
- Single internal `loadFileIntoState(file: File)` helper in `CardBack` so click and drop share the validate → revoke-prior-URL → `URL.createObjectURL` → `new Image()` sequence verbatim. The validator runs at the top of this helper, so invalid files never reach the URL/Image steps.
- Notice message text: `"Card back must be a PNG, JPEG, or WebP image"` (matches the existing `<input accept>` list).

## Slices

### Slice 1 — `validateBackImageFile` + `loadFileIntoState` refactor
**Outcome:** Validation logic exists as a pure helper, and `CardBack`'s existing click path is refactored onto a shared `loadFileIntoState(file)` internal helper. No new behaviour visible — but the internal structure is ready for drag-drop in Slice 2.

**Test (Red):** Two test additions:
- Pure-function tests on `validateBackImageFile(file: File): { ok: true } | { ok: false, reason: string }`:
  - `image/png`, `image/jpeg`, `image/webp` → `{ ok: true }`.
  - `application/pdf`, `text/plain`, `image/gif`, empty-string MIME → `{ ok: false }` with a `reason` string equal to `"Card back must be a PNG, JPEG, or WebP image"`.
- Regression test in `src/components/CardBack.test.tsx`: existing "uploads a file via the hidden input" test must still pass after the refactor (proving `handleFileChange` still works via the new shared helper).

Files: `src/components/CardBack.test.tsx` (existing + extend), `src/render/backImageValidation.test.ts` (new) — or colocated near `CardBack` if the project prefers; match nearest existing convention.

**Implementation (Green):** Create `validateBackImageFile` as a pure exported helper. Either (a) co-locate inside `src/components/CardBack.tsx` if the file stays under ~250 lines, or (b) extract to `src/render/backImageValidation.ts` next to `composeBackImageCanvas.ts` if extraction reads cleaner. Refactor `handleFileChange` to: read `event.target.files?.[0]` → reset input value → delegate to a new private `loadFileIntoState(file)` that calls the validator first, returns early (emits via `onWarning` if a warning prop exists; this slice does NOT yet add the prop — so the warning emission is gated on `onWarning ?? undefined`-style optional call OR deferred to Slice 2), then performs the existing revoke + URL + Image sequence.

**Refactor:** None expected beyond the explicit extraction the slice describes.

**Acceptance:** All existing CardBack tests pass; new validator tests pass; `npm run typecheck` clean.

### Slice 2 — Drag-and-drop on the `CardBack` section
**Outcome:** A user can drop a single image file onto any part of the `CardBack` section (empty or loaded state) and it loads the same way as clicking. Wrong MIME → amber drag-over outline fades, no image change, a warning notice is emitted via the new `onWarning` prop. Multi-file drop takes the first file silently.

**Test (Red):** Add a `dispatchWithDataTransfer` helper (copied from `UploadDropzone.test.tsx`) and four new tests in `src/components/CardBack.test.tsx`:
- "drop a valid PNG calls onChange with the loaded image" — drop a `File([],"x.png",{type:"image/png"})` onto the section, assert `onChange` fires with a non-null image and a `fillDefault` placement.
- "drop a PDF emits onWarning and does NOT call onChange" — drop `File([],"x.pdf",{type:"application/pdf"})`; assert `onWarning` called once with the exact message string, `onChange` not called.
- "drop with multiple files uses files[0] only" — drop two files; assert `onChange` fires once with the first.
- "drop on loaded-state section replaces the image" — pre-load an image via the click path, then drop a different valid file; assert `onChange` fires again with the new image.
- "isDragOver toggles the amber classes" — dispatch `dragover` on the section, assert the className contains `'border-amber-500'`; dispatch `dragleave`, assert the class is removed; dispatch `drop`, assert the class is also removed.

Files: `src/components/CardBack.test.tsx`.

**Implementation (Green):** Add to `CardBack.tsx`:
- New prop on `CardBackProps`: `onWarning: (message: string) => void`.
- New state: `const [isDragOver, setIsDragOver] = useState(false)`.
- New handlers on the outer section wrapper element (the same `<section>` that titles the card-back area):
  - `onDragOver(e)`: `e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; if (!isDragOver) setIsDragOver(true);`
  - `onDragLeave(e)`: `e.preventDefault(); e.stopPropagation(); setIsDragOver(false);`
  - `onDrop(e)`: `e.preventDefault(); e.stopPropagation(); setIsDragOver(false); const file = e.dataTransfer?.files?.[0]; if (file) loadFileIntoState(file);` — `loadFileIntoState` (from Slice 1) handles validation + `onWarning` emit + load.
- Conditional classes on the section wrapper that depend on `isDragOver`, mirroring `UploadDropzone`'s `stateClasses` pattern (active vs idle styling).
- `loadFileIntoState`: wire the `onWarning` call now (Slice 1's gate becomes "always emit"); validator failure → `onWarning(reason); return;` BEFORE any URL/Image side effects.

**Refactor:** If `dispatchWithDataTransfer` is identical to the one in `UploadDropzone.test.tsx`, extract to `src/test/dragDropTestUtils.ts` (or whatever the project's test-utils convention is). Otherwise leave duplicated per the "two near-twins is fine" rule.

**Acceptance:** All new tests pass; existing CardBack tests pass; drag-over visual styling matches `UploadDropzone` exactly; `npm run typecheck` clean.

### Slice 3 — Wire `onWarning` from App; manual smoke
**Outcome:** End-to-end: dropping a PDF on the Card-back section surfaces a banner notice in the App's notice strip ("Card back must be a PNG, JPEG, or WebP image"). Dropping a valid image works as in Slice 2.

**Test (Red):** Extend `src/App.test.tsx`:
- Render `<App />`, locate the Card-back section, dispatch a drop with a non-image file, assert that a new `<li>` appears in the notice list with the expected message text.
- Render `<App />`, drop a valid PNG on the Card-back section, assert no new notices appear and the section moves to loaded state.

Files: `src/App.test.tsx`.

**Implementation (Green):** In `src/App.tsx`, at the `<CardBack ... />` callsite, add `onWarning={handleWarning}` (mirroring how `<UploadDropzone onWarning={handleWarning} ... />` is already wired at `App.tsx:447`). Update the `CardBack` callsite props ordering to match the existing convention if needed.

**Refactor:** None expected.

**Acceptance:** Both new App-level tests pass; `npm run typecheck`, `npm test`, `npx eslint .`, `npx prettier --check` on touched files all clean. Manual `npm run dev` smoke check: drop a `.pdf` on the Card-back section → amber notice appears; drop a `.png` → section moves to loaded state with the dropped image; drop a `.png` while in loaded state → replaces the current image; the cursor during drag-over shows the "copy" affordance.

## Deferred (out of scope)

_None — all in-scope work fit into the 3 slices._

## Open Questions

_None — all decisions resolved during grilling._
