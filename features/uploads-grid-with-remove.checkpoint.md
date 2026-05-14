# Checkpoint: uploads-grid-with-remove

## Status
Step 2 — Implement — COMPLETE

## Completed steps
- [x] Step 1 — Plan
- [x] Step 2 — Implement

## Resumption notes
Three TDD slices committed in order:
1. `65a5bc8` — Slice 1: `ThumbnailGrid` exposes `onRemove`, renders `<Trash2 />` bin button per item; `lucide-react` added to `dependencies`.
2. `de705e9` — Slice 2: `App.tsx` wires removal — revokes blob URL then filters state.
3. `2e08789` — Slice 3: `ThumbnailGrid.css` grid layout + remove-button styles; Playwright `display: grid` assertion appended to `e2e/happy-path.spec.ts`.

Reviewers: `code-reviewer` APPROVE (1 cycle, 0 CRITICAL / 0 MAJOR); `general-reviewer` APPROVE on `package.json` / `package-lock.json` (0 findings).

Deferred MINOR/SUGGESTION (non-blocking):
- `src/App.tsx` `handleRemoveImage` performs `URL.revokeObjectURL` inside the `setImages` updater — under StrictMode the updater runs twice in dev, so revoke fires twice on the same URL (spec no-op, zero functional impact). Clean fix would mirror `images` in a ref and revoke outside the updater.
- `src/components/ThumbnailGrid.css` hard-codes `#c0392b` / `#ccc` — matches existing project precedent (no design-token system).
- `e2e/happy-path.spec.ts:34` — `toBeVisible()` before `toHaveCSS('display', 'grid')` is mildly redundant.

Deviations from plan:
- Slice 1 temporarily passed `onRemove={() => undefined}` from `App.tsx` so the suite compiled mid-slice; replaced with `handleRemoveImage` in Slice 2.
- Slice 1 disambiguated two existing `getByRole('button')` queries in `ThumbnailGrid.test.tsx` with explicit `name:` matchers (a second sibling button per `<li>` made the unscoped queries ambiguous).

Playwright was NOT executed — user runs `npm run e2e` locally. Spec compiles cleanly under `e2e/tsconfig.json`.

## Last updated
2026-05-14
