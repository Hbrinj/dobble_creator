# TODO

Items deferred as out-of-scope from feature planning. Triage manually.

## From feature/dobble-card-generator
| Item | Why deferred | Related decision | Added | Status |
|------|--------------|------------------|-------|--------|
| Prime-power deck orders (n=4, 8, 9, ...) | Requires GF(p^k) finite-field arithmetic; disproportionate complexity for v1 | Decisions 2, 8 | 2026-05-11 | Open |
| Background removal for uploaded images | Heavy WASM dependency / server call; v1 keeps preprocessing minimal | Decision 7 | 2026-05-11 | Open |
| Built-in card-back patterns / wordmark generator | Out of scope for v1 — user uploads a back image or prints single-sided | Decision 16 | 2026-05-11 | Open |
