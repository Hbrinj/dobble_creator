# Checkpoint: back-image-placement

## Status
Step 2 — Implement — COMPLETE (awaiting user approval at post-implementation review gate before push + PR)

## Completed steps
- [x] Step 1 — Plan (`tasks/back-image-placement.md` finalised: 11 Decisions, 5 Slices, 0 Open Questions, 1 Deferred consolidated to `/TODO.md`)
- [x] Step 2 — Implement

## Resumption notes
- Branch `feature/back-image-placement` is implemented and ready to push. PR not yet opened.
- Commits on branch (oldest → newest):
  - `ce0db24` Slice 1: composeBackImageCanvas pure helper
  - `70c575f` Slice 2: BackImagePlacement type and pan/scale clamp helpers
  - `6eb37ce` Slice 3: BackImagePreview component with mouse drag + wheel zoom
  - `978e475` Slice 4: CardBack section with empty state, file input, preview, and Reset
  - `28fef22` Slice 5: wire CardBack into App, remove back-image row from PrintSettings, route composed PNG to PDF
  - `b638aa3` Self-review: bleed-aware PDF composer + hoist PREVIEW_DIAMETER_PX
  - `34a6083` Address code-review findings: native wheel listener + pointer-capture drag (+ optional cleanups: drop unused clampPan diameterPx, guard CardBack mount-time emit, reorder file-input reset, export BLEED_MM from buildPdf)
  - Plus a bookkeeping commit (this checkpoint, feature-log row, task plan, TODO.md deferred row) — committed alongside this checkpoint.
- Reviewer status: `code-reviewer` REQUEST_CHANGES → APPROVE across 2 cycles.
  - Cycle 1: 0 CRITICAL, 1 MAJOR (React synthetic `onWheel` is passive — page scrolls during zoom), 4 MINOR, 3 SUGGESTION.
  - Cycle 2 (after `34a6083`): 0 CRITICAL, 0 MAJOR, 0 MINOR, 3 SUGGESTION (all non-blocking).
- Non-applied SUGGESTIONs surfaced for future awareness:
  - Wheel `useEffect` rebinds on every `placement` change — could use a ref for latest values so the listener registers once per image lifetime.
  - Pointer-capture regression test stubs `setPointerCapture` as a no-op; would benefit from an explicit `toHaveBeenCalledWith` assertion or an `e2e` follow-up.
  - `composeBackImageCanvas` allocates a fresh canvas on each preview redraw — could accept an optional reusable canvas param. (Skipped as YAGNI without a measured perf bug.)
  - Test-file `beforeEach` blocks could be consolidated (cosmetic).
- Plan held: no decisions were violated by the final state; one Decision-11 bleed bug surfaced in cycle-1 self-review and was fixed in `b638aa3` before reaching code-reviewer.
- Quality gates: `npm run typecheck` clean, `npx vitest run` 178/178 across 18 files, `npx eslint .` clean, `npx prettier --check` clean on touched files, `npm run dev` smoke-started cleanly.
- Branch is based on `origin/main` (not local `main`) so the prior unpushed bookkeeping commit (`5ba130e` marking readme-install + card-edge-margin Merged) stays out of this PR.

## Last updated
2026-05-18
