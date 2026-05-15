# All Features

| Feature | Branch | Summary | Status | Merged |
|---------|--------|---------|--------|--------|
| dobble-card-generator | feature/dobble-card-generator | Static web app that takes uploaded images and outputs printable Dobble cards (preview + PDF) via prime-order projective-plane construction | In Review | — |
| uploads-grid-with-remove | feature/uploads-grid-with-remove | Responsive CSS grid layout for ThumbnailGrid plus a per-item bin-icon remove button that drops the image from the upload set and revokes its blob URL | Merged | 2026-05-14 |
| prettify-ui | feature/prettify-ui | Dark-theme visual pass: Tailwind v4 + Plus Jakarta Sans, sticky-header / max-w-5xl / sticky-footer page shell, titled cards per section, dashed-border dropzone, banner notices, larger preview grid, Generate-button loading state | Merged | 2026-05-14 |
| alpha-aware-packing | feature/alpha-aware-packing | Compute per-upload silhouette circle (Welzl's SEC over alpha-mask contour) and map it to each slot circle in `drawCard`; bump `PACKING_FRACTION` 0.55 → 0.65 with packer convergence detection + retry-with-fresh-seed (`PackingDidNotConvergeError`, `MAX_RETRIES = 8`) so the higher density stays reliable — stops adjacent card images from overlapping or clipping | Merged | 2026-05-15 |
