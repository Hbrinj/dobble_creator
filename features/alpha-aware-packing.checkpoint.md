# Checkpoint: alpha-aware-packing

## Status
MERGED 2026-05-15 (PR #4 → main, merge commit `c700526`)

## Completed steps
- [x] Step 1 — Plan
- [x] Step 2 — Implement (now includes Slice 4 — added 2026-05-15 after live-print regression)

## Resumption notes
- Merged via PR #4 (merge commit `c700526`) on 2026-05-15. No follow-up actions required on this branch.
- Commits on branch (ordered):
  - `c62b82a` Plan: alpha-aware-packing task brief + TODO entry
  - `f0d664c` Slice 1 — Pure silhouette helper (`computeSilhouetteCircle` + `EmptySilhouetteError`)
  - `105d59b` Slice 2 — Wire upload pipeline to silhouette compute
  - `6b84c1c` Slice 3 — drawCard silhouette consumption + `PACKING_FRACTION` 0.55 → 0.65
  - `bdcb72d` Review fix: guard drawCard against degenerate (`sil.r === 0`) silhouette
  - `ebc64f9` Feature log + checkpoint: alpha-aware-packing in review (Slices 1–3)
  - `1b47241` Slice 4 — Packer convergence detection + retry-with-fresh-seed
  - `<plan-revision SHA>` Plan revision + TODO update for Slice 4 (this commit)
- Why Slice 4 was added: the original Decision 10 claim that `PACKING_FRACTION = 0.65` was the "safe ceiling" turned out to be wrong. The existing packer test only exercised one fixed seed per k so the silent over-pack went undetected. A live deck print on 2026-05-15 surfaced visible overlap on ~1-in-8 cards. Empirical probe confirmed ~12 % failure rate at k=8 and ~10 % at k=13. Slice 4 adds convergence detection + retry-with-fresh-seed (named `PackingDidNotConvergeError`, `MAX_RETRIES = 8`, `OVERLAP_TOLERANCE = 1e-4`) and replaces the lucky-single-seed packer test with a 200-seed sweep so the regression class can't return.
- Reviewer status:
  - `code-reviewer` (via developer self-review): Slices 1–3 APPROVE after 2 cycles; Slice 4 APPROVE on cycle 1.
  - `general-reviewer`: Slices 1–3 APPROVE (0 Critical / 0 Major). Slice 4 plan revision required two review cycles — first pass surfaced 3 MAJORs (k-vs-card-count confusion in Decision 10, "57-card / k=58" inconsistency, TODO.md drift) all of which were addressed; second pass APPROVE.
- Test/lint/typecheck: `npx vitest run` 120 passed (13 files); `npx tsc --noEmit` clean; `npm run lint` clean.
- Slice 4 perf: k=8 200-seed sweep test 31 ms; k=13 sweep 55 ms; single-call k=8 still well under the existing 100 ms budget.
- Non-blocking reviewer notes (deferrable; do not block PR):
  - `src/App.tsx:226` mutates HTMLImageElement via `Object.assign` to pass silhouette into the renderer (SUGGESTION: consider a WeakMap).
  - `src/App.tsx:173` ID generation pattern can theoretically collide if two `handleImagesAdded` batches resolve in the same millisecond before either commits state (pre-existing pattern).
  - Slice 4 introduces a documented test-only `__testing.setAttemptPacking` seam on `packer.ts`'s public surface. Needed because a pathological caller-RNG isn't sufficient to force retry exhaustion (the retry chain re-randomises via `mulberry32`). Gated by `__` prefix and JSDoc `@internal`.
  - Plan-clarity nits from earlier reviews (Decision 4 lists 3 fixtures while Slice 1 has 5; Decision 8's `r/naturalWidth` asymmetry deserves a one-line clarifier; threshold comparison operator implicit) — track on the next plan touch.
- Out-of-scope items routed to `TODO.md`: card-back silhouette geometry; follow-on density tuning above 0.65 (the convergence-detection half is now shipped by Slice 4); per-image silhouette debug overlay.

## Last updated
2026-05-15
