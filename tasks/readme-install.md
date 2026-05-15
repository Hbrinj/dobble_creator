# readme-install

Create a top-level `README.md` that orients a first-time contributor and gives them the install / run commands they need to build, develop, and test the app locally.

## Context
- No `README.md` exists in the repo today (`ls README*` returns nothing).
- `package.json` defines the script surface: `dev`, `build`, `preview`, `test`, `test:watch`, `typecheck`, `lint`, `format:check`, `e2e`.
- `.github/workflows/deploy.yml` pins Node 20 (`actions/setup-node@v4` with `node-version: '20'`) and uses `npm ci` + `npm run build` to deploy to GitHub Pages on push-to-main.
- `ARCHITECTURE.md` already exists at the repo root and covers the design overview.

## Decisions
1. **Scope confirmed with user 2026-05-15** — create a single `README.md` at the repo root with: (1) project description, (2) install / run, (3) development scripts, (4) pointer to `ARCHITECTURE.md`. Deploy and contributing sections are out of scope this pass.
2. **Node version pinned to 20** in the prerequisites to match the GitHub Actions workflow. Avoids ambient mismatch when contributors test the deploy locally.
3. **No `.nvmrc` introduced** — out of scope; the README states the version inline.
4. **No package-manager fork** — `npm` only (matches `package-lock.json` + workflow). No yarn / pnpm aliases.

## Steps
1. Create `README.md` at the repo root with the agreed structure.
2. Run `general-reviewer` on the new file (general allowlist covers `*.md`).
3. Append the feature-log row + write the checkpoint.
4. Push, present review gate, open PR after approval.

## Deferred (out of scope)
| Item | Why deferred |
|------|--------------|
| Deploy / hosting section (GitHub Pages base path quirks, `GH_PAGES_BASE`) | User asked for install instructions only; add later if a contributor hits the deploy path |
| Contributing / workflow section (feature-branch policy, TDD slice convention, review gates) | All captured in `CLAUDE.md`; cross-link only when there is a real second contributor |
| `.nvmrc` / `engines` field | Adds drift risk vs. the workflow pin; revisit if Node mismatches become a real problem |

## Open Questions
- _None._
