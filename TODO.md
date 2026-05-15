# TODO

Items deferred as out-of-scope from feature planning. Triage manually.

## From feature/dobble-card-generator
| Item | Why deferred | Related decision | Added | Status |
|------|--------------|------------------|-------|--------|
| Prime-power deck orders (n=4, 8, 9, ...) | Requires GF(p^k) finite-field arithmetic; disproportionate complexity for v1 | Decisions 2, 8 | 2026-05-11 | Open |
| Background removal for uploaded images | Heavy WASM dependency / server call; v1 keeps preprocessing minimal | Decision 7 | 2026-05-11 | Open |
| Built-in card-back patterns / wordmark generator | Out of scope for v1 — user uploads a back image or prints single-sided | Decision 16 | 2026-05-11 | Open |

## From feature/prettify-ui
| Item | Why deferred | Related decision | Added | Status |
|------|--------------|------------------|-------|--------|
| Mobile-responsive polish (form-row stack, sticky-bar compaction, thumbnail-grid touch-targets) | Decision 9 — desktop only this pass | Decision 9 | 2026-05-14 | Open |
| Light-mode tokens / `prefers-color-scheme` switching / manual theme toggle | Decision 7 — dark only this pass | Decision 7 | 2026-05-14 | Open |
| Header furniture: leading icon, subtitle, GitHub repo link, version pill, theme toggle | Decision 15 — title only this pass | Decision 15 | 2026-05-14 | Open |
| Introduce a `severity` field on the notice type so info/error variants can render distinctly | Decision 16 — all notices treated as warnings this pass | Decision 16 | 2026-05-14 | Open |
| Replace the visible card-back `<input type="file">` OS-rendered button with a hidden input + styled button + filename display | Decision 11 — natives only this pass | Decision 11 | 2026-05-14 | Open |
| Empty-state copy / illustration when zero thumbnails have been uploaded yet | Out of scope — relies on existing conditional rendering | — | 2026-05-14 | Open |
| Sticky bottom-bar internal layout fine-tuning (Generate left / Download right, split, or both right) | Cosmetic-leaf — developer agent picks in Slice 1 | Decision 8 | 2026-05-14 | Open |

## From card-packing investigation
| Item | Why deferred | Related decision | Added | Status |
|------|--------------|------------------|-------|--------|
| Silhouette-polygon packing with no-fit-polygon (NFP) solver — compute convex/alpha hull per image and use simulated annealing or gravity relaxation to pack actual shapes rather than bounding circles | Heavy: NFP is NP-hard, needs an iterative solver, real runtime/complexity cost per card. Try the cheap auto-crop + true-radius-circle pass first; revisit only if it isn't enough | — | 2026-05-14 | Open |

## From feature/alpha-aware-packing
| Item | Why deferred | Related decision | Added | Status |
|------|--------------|------------------|-------|--------|
| Card-back image silhouette geometry | Card-back is drawn full-bleed by `buildPdf` and never passes through `packCircles` or `drawCard`'s slot loop — no consumer for silhouette data | Decision 12 | 2026-05-14 | Open |
| Follow-on tuning of `PACKING_FRACTION` from 0.65 toward 0.70 / 0.75 | Slice 4 of feature/alpha-aware-packing (2026-05-15) introduces convergence detection + retry-with-fresh-seed (named `PackingDidNotConvergeError`, `MAX_RETRIES = 8`, `OVERLAP_TOLERANCE = 1e-4`); pushing density past 0.65 is now an isolated experiment with its own perf / retry-budget analysis | Decision 10 | 2026-05-14 | Open |
| Per-image silhouette debug overlay (visualise the silhouette circle on each thumbnail or rendered card) | Useful for sanity-checking Welzl results visually but not necessary for the user-facing fix; can land later if silhouette quality regressions appear | — | 2026-05-14 | Open |
