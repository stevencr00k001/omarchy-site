# Standardise Workstation Photos to Uniform Size & Format

## Product decision

Steven's decision (2026-09-16): every uploaded image — new uploads and the
existing gallery — is centre-cropped to a uniform landscape **4:3**. Both the
grid thumbnails and the lightbox show the same cropped 1920×1440 frame.
Portrait and ultrawide originals lose their original framing (e.g. ~80
portrait photos keep ~56% of height). Do **not** revert full-size to
`fit: 'inside'`; the full-size cover-crop is intended.

## Target specs

|              | Dimensions  | Format   | Crop                       |
| ------------ | ----------- | -------- | -------------------------- |
| **Full-size** | 1920×1440   | WebP q80 | Centre crop, `fit: cover`  |
| **Preview**   | 640×480     | WebP q72 | Centre crop, `fit: cover`  |

- JSON/HTML `width`/`height` are **preview** attributes → always **640×480**.
- Videos (`.webm`) are **skipped** by the sharp loop; only their posters are
  recoded to 640×480 WebP. Video `width`/`height` stay at poster size.
- Exact canvas size wins over never-enlarge: a small source is upscaled to
  the uniform canvas (intended).
- CSS stays as-is — files are already 4:3, matching `aspect-ratio: 4/3`
  (grid) and `object-fit: contain` (lightbox).

## Current state (verified on disk)

- **351 JSON entries**: 348 images + 3 videos.
- Full-size: 348 WebP + 11 JPG + 3 WebM → now all **348 WebP** (after fix).
- Previews: **351 WebP** (0 JPG).
- Existing resize was `fit: 'inside', withoutEnlargement` → varied dimensions
  (1920×1440, 1440×1920, 1920×1080, 640×480, 480×640, …).
- Orphans not in JSON: `20250730_154811.jpg`, `rose-pine-dark.webp` → deleted.

## Files created/modified

| File                                       | Action                                         |
| ------------------------------------------ | ---------------------------------------------- |
| `scripts/lib/workstation-media.mjs`        | **Create** — shared resize + HTML helpers      |
| `scripts/reprocess-workstations.mjs`       | **Create** — one-off migration script          |
| `scripts/import-workstations.mjs`          | **Modify** — use shared helpers, new params    |
| `scripts/lib/workstations.test.mjs`        | **Modify** — assert 1920×1440 / 640×480        |
| `assets/workstations/*`                    | **Overwrite** — 1920×1440 WebP                 |
| `assets/workstations/previews/*`           | **Overwrite** — 640×480 WebP                   |
| `scripts/data/workstations-media.json`     | **Update** — `width`/`height` = 640×480        |
| `workstations/index.html`                  | **Regenerate** from JSON via shared helper     |
| `workstations/README.md`                   | **Update** — 4:3 crop documentation            |

## Implementation

### Shared module `scripts/lib/workstation-media.mjs`

Constants: `FULL_WIDTH=1920`, `FULL_HEIGHT=1440`, `PREVIEW_WIDTH=640`,
`PREVIEW_HEIGHT=480`, `FULL_QUALITY=80`, `PREVIEW_QUALITY=72`,
`fit:'cover'`, `position:'centre'`.

Helpers:
- `resizeFull(input)` → `.resize({1920×1440, cover, centre}).webp(q80)`
- `resizePreview(input)` → `.resize({640×480, cover, centre}).webp(q72)`
- `escape(value)` — HTML escape (moved from importer)
- `buildCardHtml(entry)` — `<figure>` HTML (moved from importer)
- `buildPageHtml(cards)` — full page template (moved from importer)

Import and reprocess both use these so they cannot drift.

### Importer `scripts/import-workstations.mjs`

- Import shared helpers; delete inline `escape`/card/page code.
- Image encode: `resizeFull(sharp(data).rotate())` / `resizePreview(...)` —
  `.rotate()` for EXIF, exact 640×480 recorded in JSON, no `info.width`.
- Video poster: `resizePreview(sharp(frame))` (no rotate needed).
- Legacy fallback preview: `resizePreview(sharp(data).rotate())`.

### Migration `scripts/reprocess-workstations.mjs` (one-off)

For each JSON entry:
- **Video**: recode poster to 640×480 if not already (`skip` if correct);
  never pass `.webm` to sharp.
- **Image**: read full-size source → `.rotate()` → write tmp full + tmp
  preview beside originals. Skip when already 1920×1440 WebP + 640×480 WebP
  (no second-generation re-encode).
- Crash-safe order: write tmp files → rename into place → update JSON entry →
  delete old files only after JSON path is committed (JSON written once at
  the end).
- Regenerate `index.html` from JSON.
- Idempotent: re-running reports `processed: 0`.

### Tests

`scripts/lib/workstations.test.mjs`: source image changed 80×60 → 2000×1500.
Asserts JSON `width`/`height` = 640/480, full-size file = 1920×1440 WebP,
preview = 640×480 WebP, plus existing dedup/idempotency/exclusion checks.

### README

`workstations/README.md`: "up to 1920 pixels" → fixed 1920×1440 full /
640×480 preview, uniform 4:3 landscape crop for grid and lightbox.

## Verification (performed)

1. `node scripts/reprocess-workstations.mjs` — `{processed:239, skipped:112,
   errors:0}` then re-run `{processed:0, skipped:351}` (idempotent).
2. No `*.jpg` or `*.tmp` remain in `assets/workstations/`.
3. All 348 full-size = `1920x1440` WebP; all 351 previews = `640x480` WebP.
4. `node --test scripts/lib/workstations.test.mjs` — pass.
5. `npm run lint` — clean. `npm run typecheck` — clean. Prettier clean on
   changed files.
6. Orphans `20250730_154811.jpg` / `rose-pine-dark.webp` deleted.