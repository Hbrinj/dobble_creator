# Checkpoint: card-back-drag-drop

## Status
Step 2 — Implement — COMPLETE (awaiting user approval at post-implementation review gate before push + PR)

## Completed steps
- [x] Step 1 — Plan (`tasks/card-back-drag-drop.md` finalised: 4 Decisions, 3 Slices, 0 Open Questions, 0 Deferred)
- [x] Step 2 — Implement

## Resumption notes
- Branch `feature/card-back-drag-drop` is implemented and ready to push. PR not yet opened.
- Commits on branch (oldest → newest):
  - `f6e3691` Slice 1: validateBackImageFile + loadFileIntoState refactor
  - `ca98cdf` Slice 2: drag-and-drop on the CardBack section
  - `a86b8dd` Slice 3: wire onWarning from App; end-to-end notice
  - Plus a bookkeeping commit (this checkpoint, feature-log row, task plan) committed alongside this checkpoint.
- Reviewer status: `code-reviewer` APPROVE on cycle 1 — 0 CRITICAL, 0 MAJOR, 4 MINOR, 2 SUGGESTION (all non-blocking).
- Non-applied items surfaced for future awareness:
  - (MINOR) `handleDragOver` deps include `isDragOver`, churning handler identity each toggle. Quick fix: functional setter + `[]` deps.
  - (MINOR) `handleDragLeave` flickers the amber outline when cursor crosses any inner child element (h2, button, preview-div). Same quirk as `UploadDropzone` — could gate with `event.currentTarget.contains(event.relatedTarget as Node)`.
  - (MINOR) Outer section idle border colour shifted from `border-slate-800` → `border-slate-700` to match `UploadDropzone`'s idle palette. Visually perceptible.
  - (MINOR) `dispatchWithDataTransfer` test helper near-duplicates `UploadDropzone.test.tsx`'s version (this branch's adds `dropEffect: 'none'` for the new `dropEffect = 'copy'` assignment). When a third dropzone arrives, extract to shared utils.
  - (SUGGESTION) App-level loaded-state assertion uses `getAllByRole('button').length > 0` redundantly with a `canvas` query — could simplify to `getByRole('button', { name: /reset placement/i })`.
  - (SUGGESTION) Outer section's `transition-[transform,background-color,border-color]` now runs permanently — cost negligible.
- Plan held: no decisions were violated, no deviations.
- Quality gates: `npm run typecheck` clean, `npx vitest run` 193/193 across 19 files, `npm run lint` clean, `npx prettier --check` clean on touched files, `npm run dev` smoke-started cleanly on `:5174`.
- Branch is based on `origin/main`.

## Last updated
2026-05-18
