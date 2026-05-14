# Architecture

## System Overview
Dobble Card Generator is a fully client-side React + TypeScript single-page application that turns a set of user-uploaded images into a printable Dobble (Spot-It) deck PDF. Image uploads, projective-plane incidence-matrix generation, circle packing, per-card canvas rendering, and PDF assembly all run in the browser; there is no backend. The app is built with Vite, tested with Vitest + React Testing Library and Playwright, and deployed as static assets (GitHub Pages — see `GH_PAGES_BASE` in `vite.config.ts`).

## Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Language | TypeScript | ^6.0.3 |
| UI runtime | React + React DOM | ^19.2.6 |
| Build / dev server | Vite | ^8.0.12 |
| Vite React plugin | @vitejs/plugin-react | ^6.0.1 |
| Styling framework | Tailwind CSS (v4, CSS-first config via `@theme`) | ^4.3.0 |
| Tailwind build integration | @tailwindcss/vite | ^4.3.0 |
| Font | @fontsource-variable/plus-jakarta-sans (self-hosted variable font) | ^5.2.8 |
| Icon set | lucide-react | ^1.16.0 |
| PDF generation | pdf-lib | ^1.17.1 |
| Unit / component tests | Vitest + jsdom + @testing-library/react + @testing-library/user-event + @testing-library/jest-dom | ^4.1.6 / ^29 / ^16 / ^14 / ^6 |
| E2E tests | @playwright/test | ^1.60.0 |
| Lint | ESLint + typescript-eslint + eslint-plugin-react-hooks + eslint-plugin-react-refresh | ^10.3.0 / ^8.59.3 / ^7.1.1 / ^0.5.2 |
| Format | Prettier | ^3.8.3 |

## Directory Structure
| Path | Purpose |
|------|---------|
| `index.html` | Vite entry HTML. Hosts the `#root` mount point. No `<link>` web-font tags — fonts are bundled via npm and imported from `src/main.tsx`. |
| `src/main.tsx` | App bootstrap. Creates the React root, imports `./index.css`, and imports the Plus Jakarta Sans variable font package. |
| `src/index.css` | Global stylesheet. Post-`prettify-ui` contents are `@import 'tailwindcss';` plus an `@theme` block declaring CSS variables (`--font-sans`, optional colour aliases). No hand-rolled per-component CSS files. |
| `src/App.tsx` | Top-level layout shell and orchestration. Owns all top-level state (uploaded images, notices, seed, order override, print settings, back image, rendered cards, isGenerating) and wires the generate / download-PDF pipeline. Renders the sticky-header + max-w-5xl content + sticky-footer page shell. |
| `src/App.test.tsx` | App-level component tests (notices, preview gallery, generate-button loading state). |
| `src/components/` | Presentational + lightly-stateful UI components. Each component is one `.tsx` plus a sibling `.test.tsx`. No per-component `.css` files; styling lives inline as Tailwind utility classes. Non-component shared constants live in sibling `.ts` files (e.g. `printSettingsTypes.ts`) to satisfy `react-refresh/only-export-components`. |
| `src/lib/` | Pure-function deck-math primitives: `orderPicker` (deck-size / supported-prime helpers), `prng` (seeded `mulberry32`), `incidence` (projective-plane incidence-matrix generator), `packer` (circle packing within the card disk). Each has a unit-test sibling. |
| `src/render/` | Browser-rendering pipeline: `drawCard` (canvas card painter) and `buildPdf` (pdf-lib assembly with crop marks, bleed, page-size, optional card back). Each has a unit-test sibling. |
| `e2e/` | Playwright spec(s) and fixture PNGs. `happy-path.spec.ts` drives the full upload → generate → download flow. |
| `tests/` | Additional test scaffolding (when present). |
| `vite.config.ts` | Vite config. Registers `@vitejs/plugin-react` and `@tailwindcss/vite`. Sets `base` from `GH_PAGES_BASE` env var for GitHub Pages deployment. |
| `vitest.config.ts` | Vitest config (jsdom environment, testing-library setup). |
| `playwright.config.ts` | Playwright config (browsers, base URL, dev-server wiring). |
| `tsconfig*.json` | TypeScript project references — `app`, `node`, root. |
| `eslint.config.js` | Flat-config ESLint setup. Enforces `react-refresh/only-export-components`. |
| `tasks/` | Per-feature plan files written by the `/grill-plan` skill. |
| `features/` | Feature log (`all_features.md`) and per-feature checkpoint files. |
| `TODO.md` | Deferred follow-ups consolidated from past grilling sessions. |

## Data Flow
1. User drags-or-clicks images into `<UploadDropzone>` (`src/components/UploadDropzone.tsx`), which validates and forwards files to `App` via `onImagesAdded` / `onWarning` / `onError`.
2. `App` stores uploads as `UploadedImage[]` with `URL.createObjectURL`-backed previews, and surfaces a notices `<ul>` for any warnings (e.g. "min 7 images") or errors.
3. `<ThumbnailGrid>` (`src/components/ThumbnailGrid.tsx`) renders the current uploads, allowing reorder / include-toggle / remove. State changes flow back through `App`'s callbacks; `URL.revokeObjectURL` runs on remove and on unmount via two `useRef`-tracked URL-list effects.
4. `<DeckSettings>` exposes the current `order` (projective-plane order, must be prime — see `SUPPORTED_PRIMES` in `src/lib/orderPicker.ts`) and the PRNG seed. `App` derives the effective order from `pickOrder(images.length)` plus an optional manual override.
5. `<PrintSettings>` owns page-size / card-diameter / crop-marks / bleed / background / card-back-image. State lives in `App` (`printSettings`, `backImageFile`).
6. On Generate (handler in `App.handleGenerate`): `App` sets `isGenerating=true`, seeds `mulberry32`, calls `generateIncidence(order, rng)` to get the incidence matrix, then for each card calls `packCircles` to lay out symbol positions, builds an offscreen `<canvas>` at `CARD_RENDER_PX=1000`, calls `drawCard` to render, and `canvas.toBlob` → `Uint8Array` to produce PNG bytes. Each card produces a `RenderedCard { id, previewUrl, pngBytes }`. Previous preview object-URLs are revoked before replacement. `finally` clears `isGenerating`.
7. Rendered cards display in the preview gallery section. On Download PDF (`App.handleDownloadPdf`): `App` calls `buildPdf(cards, settings, backImage?)` from `src/render/buildPdf.ts`, which uses `pdf-lib` to assemble a printable PDF, then triggers a browser download via a temporary `<a>` element and revokes the blob URL on the next macrotask.

## Key Design Decisions
| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| Pure client-side; no backend | Deck generation is fully deterministic from `(images, seed, order, printSettings)`; no user accounts, no persistence needed. Cheap GitHub-Pages hosting. | All compute (canvas rendering, PDF assembly) happens in the user's tab — large decks can be slow on weak devices. |
| Seeded PRNG (`mulberry32` in `src/lib/prng.ts`) | Reproducible deck output from a numeric seed — same `(images, seed, order)` always yields the same deck. Trivial to test deterministically. | Not cryptographic; users may want a UI affordance to share / re-roll seeds (Re-roll button is part of `DeckSettings`). |
| Deck math split into pure modules (`src/lib/*`) | Each of `orderPicker`, `incidence`, `packer`, `prng` is a pure function with a unit test sibling. Easy to refactor and verify mathematically. | Adds a tiny amount of indirection compared to inlining inside `App`. |
| Rendering split between `src/render/drawCard.ts` (canvas) and `src/render/buildPdf.ts` (pdf-lib) | Canvas output doubles as both on-screen preview source and the PNG bytes embedded into the PDF — single render path, two consumers. | Couples PDF visuals to canvas-rendering fidelity. |
| TDD per slice (RED → GREEN → REFACTOR) | Enforced by the coordinator workflow in `~/.claude/CLAUDE.md`. Plans in `tasks/<feature>.md` ship with explicit `## Slices` and a Red test for each. | Each slice must produce a buildable, test-green commit — slower for small drive-by changes. |
| Tailwind CSS v4 utility-first styling, no per-component `.css` files | One source of truth for spacing / colour / typography via `@theme` tokens in `src/index.css`. No bespoke CSS to maintain. Standard ecosystem, good longevity. | Project-wide convention change: every `className` in JSX is Tailwind utilities, not BEM. Hand-rolled CSS files are not added going forward. Tests that previously queried by class (`.thumbnail-grid`, `.notices`, etc.) migrated to role/text/testid selectors. |
| Dark-only theme (slate-950 / slate-900 / amber-400 + amber-500), no light mode | Single token set, no `prefers-color-scheme` switching, no toggle. Amber-on-slate clears WCAG AA for accent text (amber-400 ≈10.8:1 on slate-900). | Clashes mildly with "playful but clean" warmth; any future light-mode work is a separate feature. |
| Self-hosted variable font via `@fontsource-variable/plus-jakarta-sans` | Imported from `src/main.tsx`. No CDN runtime request, no GDPR concern, font tracked as a normal npm dep. | Adds bundled font bytes to the deploy; weight not measured but variable axes give one file across weights. |
| Page shell: sticky header (`<h1>`) + `max-w-5xl` content + sticky bottom action bar (Generate / Download PDF) | Primary actions always reachable; content stays within a comfortable reading width. | Sticky bars take vertical space — accepted on desktop; mobile-narrow polish deferred. |
| Section grouping: each top-level concern is a titled card (`bg-slate-900 rounded-xl p-6 border border-slate-800` + `<h2>`) | Vertical stack of titled cards reads as a self-explanatory form, no separate nav needed. | Adds heading levels (`<h2>`) tests must account for — a desirable accessibility change. |
| Native form controls only (`<input type="range">`, `<input type="checkbox">`, `<select>`, `<input type="file">`) with `accent-amber-500` | No Radix / HeadlessUI / custom-select complexity. OS chevrons and "Choose File" buttons are accepted cosmetic drift. | Cross-browser visual inconsistency on `<select>` and the visible card-back `<input type="file">`. |
| Desktop-only responsive scope | Mobile polish deferred to a future feature. Style at `≥md` defaults; narrow viewports may wrap awkwardly. | Below ~768px the sticky bars, form rows, and thumbnail grid may behave poorly — accepted. |
| Plan-then-implement coordinator workflow (`~/.claude/CLAUDE.md`) | Each feature has a `/grill-plan`-produced plan in `tasks/<slug>.md`, a checkpoint in `features/<slug>.checkpoint.md`, and a row in `features/all_features.md`. Developer agents own a self-review loop before push. | Adds process overhead per feature; payoff is reviewable, resumable, reproducible work. |

## Constraints
- The app MUST remain fully client-side. No backend, no remote API calls for the core flow. The only network use is the initial static-asset fetch from the host.
- All deck output MUST be reproducible from `(images, seed, order, printSettings)`. PRNG seeding via `mulberry32` is the contract — do not introduce non-deterministic sources (Math.random, Date.now in render math, etc.) into `src/lib/*` or `src/render/*`.
- Object URLs created via `URL.createObjectURL` (for both uploads and rendered-card previews) MUST be revoked on replacement and on unmount. The two `useRef`-tracked URL-list effects in `src/App.tsx` are load-bearing.
- Pure deck-math primitives live in `src/lib/*` and rendering primitives in `src/render/*` — each has a unit-test sibling. New algorithms should follow the same pattern (one pure module + one sibling test).
- Styling: the project is Tailwind-utility-first. New components MUST NOT introduce per-component `.css` files. Use Tailwind utilities in JSX and, when a genuinely new shared token is needed, extend the `@theme` block in `src/index.css`.
- ESLint rule `react-refresh/only-export-components` is enforced — non-component shared exports MUST live in sibling `.ts` files (precedent: `src/components/printSettingsTypes.ts`).
- TDD per slice: every slice in `tasks/<feature>.md` must commit a failing test first, then the minimum implementation, then any refactor. Each commit must be buildable and test-green.
- Pre-PR gates (per `~/.claude/CLAUDE.md`): developer-agent self-review must APPROVE; the coordinator file-type routing gate must run `prompt-definition-reviewer` for any `agents/` or `skills/` diff and `general-reviewer` for the general allowlist before push.
- `features/all_features.md` MUST receive a row before any PR is opened.

## Open Questions
- _None._

## Last Updated
2026-05-14 | Mode: implement (prettify-ui landed)
