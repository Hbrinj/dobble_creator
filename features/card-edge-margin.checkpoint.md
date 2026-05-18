# Checkpoint: card-edge-margin

## Status
Step 2 — Implement — COMPLETE (awaiting user approval at post-implementation review gate before push + PR)

## Completed steps
- [x] Step 1 — Plan (`tasks/card-edge-margin.md` finalised: 6 Decisions, 4 Slices, 0 Open Questions, 0 Deferred)
- [x] Step 2 — Implement

## Resumption notes
- Branch `feature/card-edge-margin` is implemented and ready to push. PR not yet opened.
- Commits on branch (oldest → newest):
  - `cbaa13a` Slice 1: PrintSettings gains cardEdgeMarginMm field
  - `c537b95` Slice 2: packer accepts insetFraction and shrinks its working disc
  - `ce6bf24` Slice 3: drawCard exposes computeInsetFraction; App threads it into packCircles
  - `829f8dc` Slice 4: PrintSettings UI exposes the card-edge margin field
  - `8a93759` Self-review: simplify seedCircles signature (drop redundant insetFraction param)
  - `<this commit>` Bookkeeping: feature log + checkpoint + task plan
- Reviewer status: `code-reviewer` APPROVE on cycle 1 — 0 CRITICAL, 0 MAJOR, 2 MINOR, 3 SUGGESTION. Non-blocking items surfaced but not applied:
  - MINOR: `seedCircles` could rewrite `Math.sqrt((PACKING_FRACTION * boundary ** 2) / k)` as `boundary * Math.sqrt(PACKING_FRACTION / k)` for clarity.
  - MINOR: `packCircles` uses positional `(k, rng, insetFraction)` rather than the options-object shape sketched in Slice 3. Positional choice is consistent with existing signature; call site: `src/App.tsx:252`.
  - SUGGESTIONS: tighter `insetFraction` validation upper bound; explicit `Number.isFinite` guard in `computeInsetFraction`; per-iteration failure message in `packer.test.ts` boundary loop.
- Plan held with one minor deviation: Slice 3's call signature uses positional `(k, rng, insetFraction)` not options-object (see MINOR above).
- Quality gates: `npm run typecheck` clean, `npm test` 14 files / 135 tests pass (new: 4 in `printSettingsTypes.test.ts`, 2 in `packer.test.ts`, 4 in `drawCard.test.ts`, 4 in `PrintSettings.test.tsx`), `eslint` clean, `prettier --check` clean on touched files, `npm run dev` smoke-started cleanly.
- Branch is based on `origin/main` (not local `main`) so the prior unpushed bookkeeping commit (`3143fcd` marking readme-install Merged) stays out of this PR.

## Last updated
2026-05-18
