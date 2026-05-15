# Dobble Creator

A static React + Vite web app that turns a set of uploaded images into a printable [Dobble](https://en.wikipedia.org/wiki/Dobble) (Spot It!) deck. Pick the deck order, upload your symbols, and the app generates an in-browser preview plus a print-ready PDF using a prime-order projective-plane construction.

The app runs entirely client-side — no backend, no uploads leave the browser.

## Prerequisites

- **Node 20** (matches the version pinned in `.github/workflows/deploy.yml`)
- **npm** (the repo ships a `package-lock.json`; other package managers are not supported)

## Install

```bash
git clone https://github.com/Hbrinj/dobble_creator.git
cd dobble_creator
npm install
```

## Run

Start the dev server (Vite, with hot reload):

```bash
npm run dev
```

Build a production bundle into `dist/`:

```bash
npm run build
```

Preview the production bundle locally:

```bash
npm run preview
```

## Development scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then produce a production bundle |
| `npm run preview` | Serve the production bundle locally |
| `npm test` | Run the Vitest unit suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint over the whole repo |
| `npm run format:check` | Prettier in check-only mode |
| `npm run e2e` | Playwright end-to-end tests |

## Project layout

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the design overview, module boundaries, and the rationale behind the rendering / packing pipeline.
