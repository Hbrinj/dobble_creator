# prettify-ui

Visual pass on the Dobble Card Generator UI: introduce a design-token system, apply a playful-but-clean aesthetic, and style every BEM hook that currently has no CSS rules.

## Context
_Codebase facts and constraints learned during grilling._
- App shell: `src/App.tsx:269` renders a single unclassed `<main>` containing, in order, an `<h1>` ("Dobble Card Generator"), `<UploadDropzone>`, optional `<ul className="notices">` (App.tsx:279), `<ThumbnailGrid>`, `<DeckSettings>`, `<PrintSettings>`, `<div className="generate-bar">` with two bare `<button>`s (lines 313–328), and an optional `<section className="preview-gallery">` of `<img>` previews (lines 331–341).
- `src/index.css` is 13 lines: `system-ui, -apple-system, sans-serif`, `line-height: 1.5`, `body { margin: 0; min-height: 100vh; }`, `main { padding: 1.5rem; }`. No `<link>` web fonts in `index.html`.
- The only component-level stylesheet is `src/components/ThumbnailGrid.css` (grid + remove-button styles, hard-codes `#c0392b` / `#ccc`).
- Zero CSS custom properties exist anywhere in the codebase.
- BEM classes used in JSX but unstyled: `upload-dropzone`, `upload-dropzone--active`, `upload-dropzone__hint`, `deck-settings`, `deck-settings__row`, `print-settings`, `print-settings__row`, `print-settings__back-name`, `generate-bar`, `notices`, `preview-gallery`.
- `lucide-react` is already a runtime dep (added in `uploads-grid-with-remove`).
- Stack: React 19 + Vite + TypeScript + Vitest + Playwright. ESLint enforces `react-refresh/only-export-components` (non-component shared constants live in sibling `.ts` files).

## Decisions
_Resolved through grilling. Each entry references the question that produced it._
1. **Aesthetic direction — Playful but clean.** Single bright accent, rounded corners (8–12px), friendly sans, generous spacing. Acknowledges the game-tool nature without going kid-app loud. Rejects clinical-minimal (under-sells the product) and game-themed-maximal (ages badly, high effort).
2. **Scope — Comprehensive.** Style every BEM hook that currently has no CSS, plus introduce a design-token system, page shell (header + max-width container), and typography. Retrofit `ThumbnailGrid.css` to consume tokens, folding in the deferred hard-coded-hex follow-up. Rejected the high-impact-subset because every surface except `ThumbnailGrid` is currently unstyled — half-doing it would still read as unfinished.
3. **Styling approach — atomic utility framework (Tailwind / UnoCSS).** Tokens and styling will be expressed as utility classes in JSX rather than hand-rolled CSS files. Trades: bigger tooling shift mid-project, JSX rewrite across every component, and existing BEM hooks need a fate decision; gains: standard token system, no bespoke CSS to maintain, design-token consistency comes for free. Specific tool and BEM-class coexistence resolved in Decision 4.
4. **Tool — Tailwind v4, remove all BEM hooks.** Install `tailwindcss@4` + `@tailwindcss/vite`. Every JSX `className` is replaced with Tailwind utilities. `src/components/ThumbnailGrid.css` is deleted; all BEM class names (`thumbnail-grid__*`, `upload-dropzone*`, `deck-settings*`, `print-settings*`, `generate-bar`, `notices`, `preview-gallery`) are removed from JSX. Tests that query by class will need to migrate to semantic queries — flagged as implementation concern in Slice 1. Tailwind v4 was preferred over UnoCSS for community/longevity; "remove BEM" was preferred over "keep as semantic anchors" for clean end-state.
5. **Accent colour — amber (`amber-500` `#F59E0B`).** Energetic and playful, matches the party-game feel. Because amber-500 on white fails WCAG AA for normal text (contrast ~2.0:1), the token system distinguishes three amber roles: filled surface (amber-500 background with `slate-900` text — buttons, badges), strong/hover (amber-600 `#D97706`), and accessible text/icon on white (amber-700 `#B45309`). Focus ring uses amber-500 with offset.
6. **Typography — Plus Jakarta Sans, self-hosted via `@fontsource-variable/plus-jakarta-sans`.** Variable npm font package imported from `src/main.tsx`; sets `--font-sans: 'Plus Jakarta Sans Variable', system-ui, sans-serif`. No CDN runtime request, no GDPR-CDN concern, tracked as a normal dep. Single font family across the app (no display/body pairing).
7. **Theme — dark only.** No light-mode tokens, no `prefers-color-scheme` switching, no toggle. App background: `slate-950` (`#020617`). Primary surface (cards, dropzone idle): `slate-900` (`#0F172A`). Elevated surface (inputs, hover): `slate-800` (`#1E293B`). Borders: `slate-700`. Body text: `slate-100`. Muted text: `slate-400`. The amber-on-white contrast pain from Decision 5 inverts to amber-on-slate: amber-400 (`#FBBF24`) becomes the WCAG-AA-passing role for accent text/icons on `slate-900` (~10.8:1), amber-500 remains the filled-surface role (with `slate-900` text), amber-600/700 are unused. Uploaded thumbnails and generated card previews are inherently light artwork — they'll read as bright tiles against the dark shell, which is consistent with a photo-gallery aesthetic. Trade-off accepted: clashes mildly with "playful but clean" warmth, and any future light-mode work is a separate feature.
8. **Page layout — sticky header + max-w-5xl content + sticky bottom action bar.** A `<header>` at the top carries the `<h1>` "Dobble Card Generator" title and stays sticky on scroll. Content wraps in a centered `max-w-5xl` (~1024px) container with horizontal padding. The existing `<div class="generate-bar">` becomes a sticky bottom bar carrying Generate + Download PDF, always reachable. The sticky bar is hidden when no images are uploaded yet (no useful action available). Rejected single-column-only (A — no anchor for primary actions), two-column (C — too much layout work for prettify), and stepper (D — heavier paradigm than needed).
9. **Responsive scope — desktop only.** Style at `≥md` defaults; narrow viewports get no mobile-specific overrides. Form rows, thumbnail grid, sticky bars, and dropzone may wrap or behave awkwardly below ~768px and that is accepted. A future mobile-polish pass is out of scope for this feature.
10. **Dropzone — dashed-border drop target with cloud icon.** `<UploadDropzone>` becomes a tall (`min-h-48`) padded card: `border-2 border-dashed border-slate-700 rounded-xl bg-slate-900`, centered `lucide-react` cloud-upload icon above the existing two `<p>` lines. Hover swaps border to `slate-500`. The existing `upload-dropzone--active` JSX flag (set on drag-over) maps to `border-amber-500 bg-amber-500/10`. Focus-visible ring uses `amber-500`. The hidden `<input type="file">` stays as-is.
11. **Form controls — style natives only, no wrappers.** Native `<input type="range">` and `<input type="checkbox">` use `accent-amber-500` so the OS picker honours the accent. Native `<select>` keeps its OS chevron — slight cross-browser drift accepted. The visible card-back `<input type="file">` keeps its OS-rendered "Choose File" button — ugly on macOS, accepted as the cheapest option. Text input gets a slate-800 background, slate-700 border, slate-100 text, amber-500 focus ring. No custom Radix or HeadlessUI components introduced.
12. **Buttons — three tiers, `rounded-lg`.** Shape: `rounded-lg` (10px), `px-4 py-2`, `font-medium`, `transition-colors`. **Primary** (Generate): `bg-amber-500 text-slate-900 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500`. **Secondary** (Download PDF): `bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700 disabled:opacity-50`. **Ghost** (Re-roll, card-back Remove): `text-slate-300 hover:bg-slate-800 hover:text-slate-100`. **Ghost-destructive** (`thumbnail-grid__remove` replacement): `text-rose-400 hover:bg-rose-500/10 hover:text-rose-300`. All buttons share `focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:outline-offset-2`. The rounded-lg + rounded-xl dropzone pair gives a coherent shape language.
13. **Section grouping — card per `<section>`.** Each top-level concern is a card: `bg-slate-900 rounded-xl p-6 border border-slate-800`. The existing `<UploadDropzone>` card stays as a card. The two settings `<section>` elements each gain an `<h2>` heading at the top: **"Deck Options"** inside `<DeckSettings>` and **"Print Options"** inside `<PrintSettings>`. Preview gallery, when present, also wraps in a card with an h2 ("Preview"). Page reads as a vertical stack of titled cards. Section spacing: `space-y-6` (24px) on the content container.
14. **Sticky chrome — solid surfaces with hairline borders.** Header: `bg-slate-900 border-b border-slate-800`. Sticky action bar: `bg-slate-900 border-t border-slate-800`. Both sit at full viewport width (not max-w-5xl) so the borders read as edge-to-edge dividers; the inner content of each respects `max-w-5xl` centering. No backdrop-blur, no transparency — rejected the trendy frosted-glass look in favour of crisp predictable bars.
15. **Header content — title only.** The sticky header shows just `<h1>Dobble Card Generator</h1>`. No leading icon, no subtitle, no GitHub link. Keeps the sticky bar short and predictable; any future header furniture (theme toggle, repo link) is a follow-up.
16. **Notices — banner-style alerts.** Each `<li>` in the notices list becomes a rounded banner: `rounded-md border px-3 py-2 flex items-center gap-2 text-sm`, with a leading `lucide-react` icon. Severity roles: error = `bg-rose-500/10 border-rose-500/30 text-rose-200` + `AlertCircle`; warning = `bg-amber-500/10 border-amber-500/30 text-amber-200` + `AlertTriangle`; info = `bg-slate-800 border-slate-700 text-slate-300` + `Info`. If notice data does not currently carry a severity field, treat every row as a warning (the typical role for "min 7 images" hints); introducing a `severity` field on the notice type is out of scope.
17. **Preview gallery — larger output grid.** `grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4`. Each preview cell: `bg-slate-800 rounded-lg p-3 border border-slate-700 aspect-square` with the `<img>` inside set to `object-contain w-full h-full`. White circular card art reads cleanly against the slate cell. h2 heading "Preview" at the top of the section card (per Decision 13). Bigger cells chosen because previews exist for visual verification before PDF download, not browsing.
18. **Micro-interactions — light.** `transition-colors duration-150` on all interactive elements (buttons, ghost-toggle thumbnails, banner-icon hovers). Dropzone gets `transition-transform` and `hover:scale-[1.005]` on drag-over for a subtle "this is receptive" pulse. Notices fade in via `animate-in fade-in-50`. Thumbnail-remove fades the cell out before state-filter (lightweight CSS transition on opacity, not Framer Motion). Rejected heavier scale-on-click and page-load stagger as over-engineered for a prettify pass.
19. **Generate-button loading state — spinner + disabled.** While `pickOrder` / `buildPdf` are running, the Generate button shows `<Loader2 className="animate-spin" />` + label "Generating…" and is `disabled`. State lives as a `useState<boolean>` in `App.tsx`, wrapped around the existing generate handler (set true at start, false in `finally`). Cheap to wire; converts perceived latency into a confidence signal.

## Slices

### Slice 1 — Foundation: Tailwind v4 + tokens + font + page shell + sticky bars + primary buttons
**Outcome:** App renders inside the new sticky-header + max-w-5xl + sticky-bottom-action-bar layout, in the dark Plus Jakarta Sans theme. Generate and Download PDF buttons carry the new primary/secondary styling. Component internals (UploadDropzone, ThumbnailGrid, settings sections, notices, preview gallery) retain their pre-prettify visuals — those migrate in later slices.
**Test (Red):** Extend `e2e/happy-path.spec.ts` with three assertions after the initial page load: (i) `body` computed `font-family` contains `'Plus Jakarta Sans'`; (ii) `header` has `position: sticky`; (iii) `body` background colour resolves to `rgb(2, 6, 23)` (slate-950). Playwright is user-run — spec must typecheck.
**Implementation (Green):**
- `npm install tailwindcss@^4 @tailwindcss/vite @fontsource-variable/plus-jakarta-sans`.
- Wire `@tailwindcss/vite` into `vite.config.ts`.
- Replace `src/index.css` contents with `@import 'tailwindcss';` plus an `@theme` block declaring `--font-sans: 'Plus Jakarta Sans Variable', system-ui, sans-serif` and any custom colour aliases the team prefers (Tailwind ships slate-* and amber-* by default, so explicit aliases are optional). Keep `body { margin: 0; min-height: 100vh; }` if Tailwind preflight doesn't already cover it.
- Import the font package once from `src/main.tsx`.
- In `src/App.tsx`: wrap return in `<div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">`. Promote the `<h1>` into `<header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800"><div className="mx-auto max-w-5xl px-6 py-4"><h1 className="text-2xl font-semibold">Dobble Card Generator</h1></div></header>`. Wrap the remaining content in `<main className="mx-auto max-w-5xl w-full px-6 py-6 space-y-6 flex-1">`. Replace the `<div className="generate-bar">` with `<footer className="sticky bottom-0 bg-slate-900 border-t border-slate-800"><div className="mx-auto max-w-5xl px-6 py-3 flex gap-3 justify-end">…</div></footer>`, rendered only when images are present. Restyle Generate (primary) and Download PDF (secondary) per Decision 12.
- Strip the `generate-bar` className. If any existing test queries by `.generate-bar` or `.notices`, migrate to `getByRole`/`getByText` before stripping (developer agent verifies during Red).
- Files: `package.json`, `package-lock.json`, `vite.config.ts`, `src/index.css`, `src/main.tsx`, `src/App.tsx`, `src/App.test.tsx` (only if BEM-querying tests exist), `e2e/happy-path.spec.ts`.
**Refactor:** None expected.
**Acceptance:** Playwright assertions pass when user runs `npm run e2e`; full Vitest suite green; `npm run lint` clean; spec compiles via `tsc -p e2e/tsconfig.json`.

### Slice 2 — UploadDropzone: Tailwind migration + dashed-border + cloud icon + drag-over scale
**Outcome:** Dropzone reads as a dashed-border drop target with a centred `UploadCloud` icon above the existing two `<p>` lines. Drag-over swaps the border to amber, tints the background, and applies a subtle scale-up. BEM classes are gone.
**Test (Red):** Extend `src/components/UploadDropzone.test.tsx` with a test "renders a cloud-upload icon and a dashed-border drop target": render the component, assert the wrapper element (`getByRole('button')` or the document-bound `getByLabelText`) has `className` containing `border-dashed`, and a child `<svg>` (the `UploadCloud` lucide icon) is present in the DOM. Existing drag/drop and click-to-pick tests must continue passing.
**Implementation (Green):**
- Rewrite `src/components/UploadDropzone.tsx` JSX with Tailwind utilities per Decision 10: `min-h-48`, `border-2 border-dashed rounded-xl bg-slate-900`, conditional `border-slate-700` (idle) or `border-amber-500 bg-amber-500/10 scale-[1.005]` (drag-over), `transition-transform transition-colors duration-150`, focus-visible ring on amber-500. Add `<UploadCloud aria-hidden="true" className="size-8 text-slate-400" />` above the two `<p>`s.
- Strip `upload-dropzone`, `upload-dropzone--active`, `upload-dropzone__hint` classes from JSX.
- Files: `src/components/UploadDropzone.tsx`, `src/components/UploadDropzone.test.tsx`.
**Refactor:** None expected.
**Acceptance:** New + existing dropzone tests pass; lint clean.

### Slice 3 — ThumbnailGrid: Tailwind migration, delete ThumbnailGrid.css, dark-theme badge re-skin
**Outcome:** Thumbnail grid renders with the same behaviour (responsive grid, square cells, include/exclude toggle, remove bin, excluded opacity) but expressed entirely via Tailwind utilities. `ThumbnailGrid.css` is deleted. The "Included"/"Excluded" badge re-skins from black-pill to slate-amber pill for dark-theme harmony.
**Test (Red):** Extend `src/components/ThumbnailGrid.test.tsx` with a test "renders the grid with Tailwind utility classes and no legacy BEM classes": assert the `<ul>` element's `className` contains `grid` and does NOT contain `thumbnail-grid`. Existing role/text-based tests continue passing unchanged.
**Implementation (Green):**
- Rewrite `src/components/ThumbnailGrid.tsx` JSX: `<ul className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 list-none p-0">` for the container. Each `<li>`: `flex flex-col gap-1 relative` plus `opacity-50` when excluded. Toggle `<button>`: `aspect-square w-full rounded-lg overflow-hidden bg-slate-900 border border-slate-800 focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:outline-offset-2`. `<img>`: `w-full h-full object-contain`. Badge: `absolute top-2 left-2 bg-slate-900/80 text-amber-300 border border-amber-500/40 rounded-full text-xs px-2 py-0.5`. Remove button: ghost-destructive utilities per Decision 12 (`text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-lg p-1 self-end`).
- Strip every `thumbnail-grid*` class.
- Delete `src/components/ThumbnailGrid.css` and remove its `import` line.
- Update `e2e/happy-path.spec.ts` if its `display: grid` assertion targets the BEM selector `.thumbnail-grid` — switch to `[role="list"]` or a `data-testid` (developer agent's call based on what's least brittle).
- Files: `src/components/ThumbnailGrid.tsx`, `src/components/ThumbnailGrid.test.tsx`, `src/components/ThumbnailGrid.css` (DELETE), `e2e/happy-path.spec.ts` (UPDATE only if needed).
**Refactor:** None expected.
**Acceptance:** All ThumbnailGrid tests pass; Playwright spec still typechecks (and passes on user run); lint clean.

### Slice 4 — DeckSettings: card wrapper + "Deck Options" h2 + form-control restyling
**Outcome:** Deck Settings renders as a titled card with restyled native form controls and a ghost Re-roll button. BEM classes gone.
**Test (Red):** Extend `src/components/DeckSettings.test.tsx` with a test "renders within a titled card": assert `getByRole('heading', { level: 2, name: /deck options/i })` is in the document.
**Implementation (Green):**
- Wrap the `<section>` in `bg-slate-900 rounded-xl p-6 border border-slate-800`. Add `<h2 className="text-lg font-semibold mb-4">Deck Options</h2>` as the first child.
- Replace `deck-settings*` classes with Tailwind row utilities: each row is `flex items-center gap-3` (label/control). Style `<select>` with `bg-slate-800 border border-slate-700 rounded-md text-slate-100 px-2 py-1`. Style the seed `<input type="text">` with `bg-slate-800 border border-slate-700 rounded-md text-slate-100 px-2 py-1 font-mono focus:outline-2 focus:outline-amber-500 focus:outline-offset-1`. Re-roll button: ghost utilities per Decision 12.
- Files: `src/components/DeckSettings.tsx`, `src/components/DeckSettings.test.tsx`.
**Refactor:** None expected.
**Acceptance:** New + existing DeckSettings tests pass; lint clean.

### Slice 5 — PrintSettings: card wrapper + "Print Options" h2 + form-control restyling
**Outcome:** Print Settings renders as a titled card. Range slider and checkboxes adopt amber accent; card-back Remove button is a ghost. BEM classes gone.
**Test (Red):** Extend `src/components/PrintSettings.test.tsx` with a test "renders within a titled card": assert `getByRole('heading', { level: 2, name: /print options/i })` is in the document.
**Implementation (Green):**
- Wrap the `<section>` in card classes; add `<h2 className="text-lg font-semibold mb-4">Print Options</h2>`.
- Replace `print-settings*` classes with Tailwind row utilities. Apply `accent-amber-500` to the range and the two checkboxes. Style the two `<select>`s identically to DeckSettings. The visible card-back `<input type="file">` keeps its OS-rendered "Choose File" button per Decision 11. The card-back filename display (`.print-settings__back-name`) becomes a `text-slate-300 text-sm` span. Card-back Remove button: ghost utilities.
- Files: `src/components/PrintSettings.tsx`, `src/components/PrintSettings.test.tsx`.
**Refactor:** None expected.
**Acceptance:** New + existing PrintSettings tests pass; lint clean.

### Slice 6 — Notices: banner-style alerts with icon + warning colours + fade-in
**Outcome:** The notices `<ul>` renders each row as a coloured banner with a leading `lucide-react` icon. All rows treated as warnings (amber) since the notice data has no severity field today.
**Test (Red):** Extend `src/App.test.tsx` with a test "notices render as warning banners with an alert icon": drive the app into a state that produces a notice (e.g. upload fewer than 7 images), assert the rendered `<li>` has `className` containing `border-amber-500/30` AND contains an `<svg>` (the `AlertTriangle` icon).
**Implementation (Green):**
- In `src/App.tsx`, rewrite the `<ul className="notices">` block: container becomes `<ul className="space-y-2">`; each `<li>` becomes `<li className="flex items-center gap-2 rounded-md border bg-amber-500/10 border-amber-500/30 text-amber-200 text-sm px-3 py-2"><AlertTriangle aria-hidden="true" className="size-4 shrink-0" /><span>{message}</span></li>`. Add `animate-in fade-in-50 duration-200` (works with `tw-animate-css` plugin or a small hand-rolled `@keyframes` declaration in `src/index.css` — developer agent picks the cheapest available route).
- Strip the `notices` class.
- Files: `src/App.tsx`, `src/App.test.tsx`. Optionally `src/index.css` if a hand-rolled keyframe is used.
**Refactor:** None expected.
**Acceptance:** New + existing App tests pass; lint clean.

### Slice 7 — Preview gallery: card wrapper + "Preview" h2 + larger output grid
**Outcome:** Generated card previews render in a titled card with a larger grid of square cells holding each rendered card image.
**Test (Red):** Extend `src/App.test.tsx` with a test "preview gallery renders within a titled card once previews exist": drive the app through a full generate flow until `previews.length > 0`, assert `getByRole('heading', { level: 2, name: /preview/i })` is in the document.
**Implementation (Green):**
- Replace `<section className="preview-gallery">` with `<section className="bg-slate-900 rounded-xl p-6 border border-slate-800"><h2 className="text-lg font-semibold mb-4">Preview</h2><div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">…</div></section>`. Each preview becomes `<div className="bg-slate-800 rounded-lg p-3 border border-slate-700 aspect-square"><img className="w-full h-full object-contain" … /></div>`.
- Strip the `preview-gallery` class.
- Files: `src/App.tsx`, `src/App.test.tsx`.
**Refactor:** None expected.
**Acceptance:** New + existing App tests pass; lint clean.

### Slice 8 — Generate-button loading state
**Outcome:** While Generate is computing, the button is `disabled` and shows `<Loader2 className="animate-spin" />` + "Generating…"; it restores to "Generate" after completion (or failure).
**Test (Red):** Extend `src/App.test.tsx` with a test "Generate button shows a loading state while a generate is in flight": render the app with `vi.useFakeTimers()` (or a controlled `Promise` returned by a mocked generate handler), upload sufficient images to enable Generate, click Generate, assert the button is `disabled` and its text is `/generating/i`; resolve the pending promise; assert the button returns to "Generate" and is enabled again.
**Implementation (Green):**
- In `src/App.tsx`: introduce `const [isGenerating, setIsGenerating] = useState(false)`. Make the existing generate handler `async` if not already; wrap the body in `try { setIsGenerating(true); …existing work… } finally { setIsGenerating(false); }`. Add `isGenerating` to the button's `disabled` conditions. Render the button content conditionally: when `isGenerating`, show `<Loader2 className="size-4 animate-spin" aria-hidden="true" />` + the literal "Generating…"; otherwise, show "Generate".
- Files: `src/App.tsx`, `src/App.test.tsx`.
**Refactor:** None expected; the async wrap is the minimum intrusion.
**Acceptance:** New test passes; existing tests pass; lint clean.

## Deferred (out of scope)
_Items resolved as "not this feature" during grilling. Consolidated to `/TODO.md` at termination._

| Item | Why deferred | Related decision |
|------|--------------|------------------|
| Mobile-responsive polish (form-row stack, sticky-bar compaction, thumbnail-grid touch-targets) | Decision 9 — desktop only this pass | Decision 9 |
| Light-mode tokens / `prefers-color-scheme` switching / manual theme toggle | Decision 7 — dark only this pass | Decision 7 |
| Header furniture: leading icon, subtitle, GitHub repo link, version pill, theme toggle | Decision 15 — title only this pass | Decision 15 |
| Introduce a `severity` field on the notice type so info/error variants can render distinctly | Decision 16 — all notices treated as warnings this pass | Decision 16 |
| Replace the visible card-back `<input type="file">` OS-rendered button with a hidden input + styled button + filename display | Decision 11 — natives only this pass | Decision 11 |
| Empty-state copy / illustration when zero thumbnails have been uploaded yet | Out of scope — relies on existing conditional rendering | — |
| Sticky bottom-bar internal layout fine-tuning (Generate left / Download right, split, or both right) | Cosmetic-leaf — developer agent picks in Slice 1 | Decision 8 |

## Open Questions
- _None._
