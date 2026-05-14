# uploads-grid-with-remove

Add a responsive CSS grid layout to the existing `ThumbnailGrid` and a per-item bin-icon remove button wired to drop images from the upload set.

## Context
_Codebase facts and constraints learned during grilling._
- `ThumbnailGrid` already exists at `src/components/ThumbnailGrid.tsx` with props `{ thumbnails, includedCount, onReorder, onToggleInclude }`. `Thumbnail = { id, name, url }`.
- Each item is currently a `<li>` containing a single `<button class="thumbnail-grid__toggle">` that wraps the `<img>` and an Included/Excluded `<span class="thumbnail-grid__badge">`. Clicking the button toggles inclusion (swaps order). Drag-and-drop reorder is also supported.
- BEM classes (`thumbnail-grid`, `thumbnail-grid__item`, `thumbnail-grid__item--excluded`, `thumbnail-grid__toggle`, `thumbnail-grid__badge`) are applied in JSX but **no CSS rules exist** for them anywhere — `src/index.css` is 14 lines of element resets.
- Upload state lives in `App.tsx` as `useState<readonly UploadedImage[]>` where `UploadedImage = { id, file, url, name }` (App.tsx:29-34). `url` is a `URL.createObjectURL` blob URL; revocation on unmount is at App.tsx:107-127.
- The "Min 7 images" gate is enforced indirectly by `pickOrder` returning `null` when `imageCount < 7` (`src/lib/orderPicker.ts:20-21`), which disables Generate (App.tsx:259). The "max 200" is hint-text only.
- No icon library in `package.json`. Inline SVG is the precedent (now superseded by Decision 3).
- Tests: Vitest + React Testing Library + `@testing-library/user-event`. ThumbnailGrid tests at `src/components/ThumbnailGrid.test.tsx`. App tests at `src/App.test.tsx`.
- ESLint enforces `react-refresh/only-export-components` (warn, `allowConstantExport: true`). Non-component shared types/constants go in sibling `.ts` files (precedent: `printSettingsTypes.ts`).
- Playwright E2E exists (commit `9e1ebd7`); preferred channel for CSS grid layout verification since jsdom does not faithfully compute `grid-template-columns` / `aspect-ratio`.

## Decisions
_Resolved through grilling. Each entry references the question that produced it._
1. **Scope** — both (A) add CSS to lay `.thumbnail-grid` out as a responsive grid and (B) add a bin-icon remove button per item wired to drop the image from the upload set. Without A the bin would sit in an unstyled list; without B the grid stays display-only.
2. **Grid layout** — `display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px;` on `.thumbnail-grid`. Each `.thumbnail-grid__item` is a vertical stack of [square thumbnail cell with `aspect-ratio: 1/1`] + [bin-button row]. Image uses `object-fit: contain` to preserve transparent/non-square artwork.
3. **Bin icon** — add `lucide-react` as a runtime dep and render `<Trash2 />` inside the remove button. Establishes an icon library for future iconography; tree-shaken so the cost of a single import is small.
4. **Bin button placement** — sibling button below the existing toggle button (no nesting). Per-item DOM becomes `<li>` containing two sibling `<button>`s: the toggle (unchanged, wraps image + badge) and a new `.thumbnail-grid__remove` with `aria-label="Remove <name>"`. Preserves drag-reorder and include/exclude untouched.
5. **Removal interaction** — single click on bin removes the image immediately. No confirmation modal, no undo toast. Re-uploading is cheap; matches conventional thumbnail-picker UX.
6. **Callback shape** — `onRemove: (event: { id: string }) => void` on `ThumbnailGrid`. Matches the event-object style of `onReorder` and `onToggleInclude`; id-based (not index-based) since removal mutates the array.
7. **Object-URL cleanup on remove** — App.tsx's removal handler calls `URL.revokeObjectURL(image.url)` for the removed item, then `setImages(prev => prev.filter(i => i.id !== id))`. Prevents blob leaks for the lifetime of the session; safe because the `<img>` bitmap is already painted.
8. **Slice plan** — three slices: (1) `ThumbnailGrid` exposes `onRemove` + renders bin button; (2) App.tsx wires removal + URL revocation; (3) CSS grid layout + remove-button styles, verified via Playwright E2E smoke (jsdom unsuitable for grid computed styles).

## Slices

### Slice 1 — `ThumbnailGrid` exposes `onRemove` and renders a bin button per item
**Outcome:** Consumers can wire a callback that fires with `{ id }` when the bin button next to a thumbnail is clicked. Each thumbnail visibly carries a `<Trash2 />` icon button with `aria-label="Remove <name>"`.
**Test (Red):** Extend `src/components/ThumbnailGrid.test.tsx` with a test "fires onRemove with the correct id when the per-item remove button is clicked". Render with three thumbnails and a `vi.fn()` `onRemove`. Use `within(item).getByRole('button', { name: /remove .+/i })` to locate the bin button, `userEvent.click()` it, and assert `onRemove` was called with `{ id: '<thumb-id>' }` exactly once.
**Implementation (Green):**
- Add `lucide-react` to `dependencies` in `package.json` (run `npm install lucide-react`).
- Add `onRemove: (event: { id: string }) => void` to `ThumbnailGridProps` in `src/components/ThumbnailGrid.tsx`.
- Inside each `<li>`, after the existing toggle button, render a sibling `<button type="button" className="thumbnail-grid__remove" aria-label={\`Remove ${thumb.name}\`} onClick={() => onRemove({ id: thumb.id })}><Trash2 aria-hidden="true" /></button>`.
- Files: `src/components/ThumbnailGrid.tsx` (UPDATE), `src/components/ThumbnailGrid.test.tsx` (UPDATE), `package.json` + `package-lock.json` (UPDATE).
**Refactor:** None expected.
**Acceptance:** New test passes; all existing `ThumbnailGrid` tests still pass; `npm run lint` clean.

### Slice 2 — App.tsx wires removal: drop from state + revoke object URL
**Outcome:** Clicking the bin on a thumbnail removes that image from the upload set and revokes its blob URL.
**Test (Red):** Extend `src/App.test.tsx` with a test "clicking remove on a thumbnail removes it from the gallery and revokes its blob URL". Upload three images via the existing file-input pattern used in other App tests, spy on `URL.revokeObjectURL` with `vi.spyOn`, click the second item's remove button, assert (a) only two thumbnails remain in the document and the removed name is gone, (b) `URL.revokeObjectURL` was called with the removed image's blob URL.
**Implementation (Green):**
- In `src/App.tsx`, add `handleRemoveImage = useCallback(({ id }: { id: string }) => { ... }, [])` that finds the image, calls `URL.revokeObjectURL(image.url)`, then `setImages(prev => prev.filter(i => i.id !== id))`.
- Pass `onRemove={handleRemoveImage}` to `<ThumbnailGrid />`.
- Files: `src/App.tsx` (UPDATE), `src/App.test.tsx` (UPDATE).
**Refactor:** None expected. (Possible follow-up: extract the URL-revoke + filter pair into the existing unmount-cleanup module if duplication appears — defer until duplication exists.)
**Acceptance:** New test passes; existing App tests still pass; `npm run lint` clean.

### Slice 3 — CSS grid layout for `.thumbnail-grid` + remove-button styles
**Outcome:** Uploaded thumbnails render in a responsive grid (≥2 columns at typical widths) with square cells and a clearly distinct destructive bin button below each.
**Test (Red):** Extend the existing Playwright happy-path spec (added in commit `9e1ebd7`) with one assertion after uploading the test image set: locate `.thumbnail-grid` and assert it has `display: grid` via `await expect(grid).toHaveCSS('display', 'grid')`. (jsdom is unsuitable for computing grid columns; Playwright drives a real Chromium and resolves real computed styles.)
**Implementation (Green):**
- Create `src/components/ThumbnailGrid.css` with rules for `.thumbnail-grid` (`display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; list-style: none; padding: 0;`), `.thumbnail-grid__item` (vertical flex stack, gap 4px), `.thumbnail-grid__toggle` (reset button styles, `aspect-ratio: 1/1`, `img` inside uses `object-fit: contain; width: 100%; height: 100%`), `.thumbnail-grid__item--excluded` (reduced opacity), and `.thumbnail-grid__remove` (small destructive-styled button with `Trash2` sized ~16px, hover/focus states).
- Import the stylesheet from `src/components/ThumbnailGrid.tsx` (`import './ThumbnailGrid.css';`).
- Files: `src/components/ThumbnailGrid.css` (CREATE), `src/components/ThumbnailGrid.tsx` (UPDATE — add import), Playwright spec (UPDATE).
**Refactor:** None expected.
**Acceptance:** New Playwright assertion passes; visual inspection at typical viewport widths shows ≥2 columns with square cells, a visible bin button beneath each thumbnail, and excluded items remain visually distinguishable; `npm run lint` clean.

## Deferred (out of scope)
| Item | Why deferred | Related decision |
|------|--------------|------------------|

## Open Questions
- _None._
