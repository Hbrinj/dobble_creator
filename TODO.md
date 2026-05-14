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
