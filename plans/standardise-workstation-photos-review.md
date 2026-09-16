# Design Document Review: Standardise Workstation Photos to Uniform Size & Format

**Round:** 2 (re-review of the revised plan and the implementation already on disk)
**Reviewed:** `plans/standardise-workstation-photos.md`
**Against:** `scripts/lib/workstation-media.mjs`, `scripts/reprocess-workstations.mjs`, `scripts/import-workstations.mjs`, `scripts/lib/workstations.test.mjs`, `scripts/data/workstations-media.json`, `workstations/index.html`, `workstations/README.md`, and `assets/workstations/`.

## Product decision (unchanged)

Steven wants every uploaded image converted to a uniform professional landscape 4:3. Full-size 1920×1440 WebP q80 `fit: 'cover'` and preview 640×480 WebP q72 are intended for both grid and lightbox. Do not revert full-size to `fit: 'inside'`.

## Summary

**Approve, with nits.** Round-1 issues are addressed in the plan and in the code. The gallery on disk matches the spec: 348 full-size WebP at 1920×1440, 351 previews at 640×480, JSON and HTML `width`/`height` all 640×480, no leftover JPEGs/orphans/tmp files, videos skipped (posters only). Importer test passes. Remaining items are non-blocking: the migration still deletes old JPEGs before the JSON write (the plan claims otherwise), tests do not cover portrait sources or videos, and there was no visual/`npm run build` check in this review.

## Round-1 issues

| # | Topic | Status |
| --- | --- | --- |
| 1 | Document 4:3 lightbox crop as a product decision | addressed |
| 2 | Skip `.webm` in sharp; posters 640×480; video attrs = poster size | addressed |
| 3 | JSON/HTML `width`/`height` are preview 640×480, not 1920×1440 | addressed |
| 4 | `.rotate()` on legacy JPEGs | addressed |
| 5 | Exact canvas size wins over never-enlarge; realistic test source | addressed |
| 6 | Skip already-correct WebPs; crash-safe write order | **partial** — skip is in; delete-before-JSON remains (Issue A) |
| 7 | Correct inventory; handle orphans | addressed |
| 8 | README, shared helper, dimension assertions | addressed (video/portrait tests still missing — Issue B) |

## Independent verification (round 2)

- JSON: 351 entries, 3 videos, every `width`/`height` is 640×480, extensions 348 `.webp` + 3 `.webm`.
- Disk: 348 full-size WebP all 1920×1440; 351 preview WebP all 640×480; 0 JPEG, 0 tmp, 0 orphans, 0 missing files.
- `workstations/index.html`: 351 `width="640" height="480"`; three `<video>` tags use posters and 640×480.
- `node --test scripts/lib/workstations.test.mjs`: pass.
- Shared module is used by both import and reprocess.

## Issues

### Issue A -- Severity: suggestion
- **Section**: Migration crash-safe order
- **Description**: The plan says write tmp → rename → update JSON → delete old files only after the JSON path is committed, with JSON written once at the end. `scripts/reprocess-workstations.mjs` still `unlink`s the old JPEG immediately after `rename` into the `.webp` path, then writes JSON after the loop. A crash between `unlink(oldFile)` and `writeFile(metadataPath)` leaves JSON pointing at a deleted `.jpg`. The one-off already completed successfully (`processed: 0` on re-run), so this is not a gallery regression — it is a plan/code mismatch if the script is kept.
- **Suggestion**: Defer `unlink(oldFile)` until after `writeFile(metadataPath)`, or write JSON after each successful path change before deleting. On skip, still set `entry.width/height` to the preview constants so stale metadata cannot survive a files-already-ok run.
- **Status**: open

### Issue B -- Severity: nit
- **Section**: Tests
- **Description**: The importer test now uses 2000×1500 and asserts 1920×1440 / 640×480. It does not cover a portrait source (the cover-crop that matters for ~80 photos) or a video attachment (sharp must not see `.webm`; poster 640×480). There is no test for the reprocess skip/idempotency path.
- **Suggestion**: Add a 1500×2000 image case and a tiny `video/` manifest item (ffmpeg is already required for local sync). Optional: unit-test “already 1920×1440 → processed 0”.
- **Status**: open

### Issue C -- Severity: nit
- **Section**: Current state / Verification
- **Description**: “Full-size: 348 WebP + 11 JPG + 3 WebM → now all **348 WebP** (after fix)” mixes before and after. After the migration it is 348 WebP + 3 WebM. Verification lists lint/typecheck/test but not `npm run build` or a look at `/workstations/` (lightbox crop). This review also did not load the page in a browser.
- **Suggestion**: Split inventory into before vs after. Before merge, spot-check the lightbox on a former portrait (e.g. `discord-1546242687592824902.webp`) and a former ultrawide so the crop looks acceptable.
- **Status**: open

## Strengths

- Product decision is now at the top of the plan; an implementer cannot “fix” it back to `fit: 'inside'`.
- Shared `workstation-media.mjs` constants and HTML helpers are the right split.
- Skip-if-already-correct avoids second-generation WebP loss; re-run is a no-op.
- README matches the new pipeline.

## Verdict

Plan + implementation match the requested uniform 4:3 gallery. Round-1 blockers are gone. Issue A is worth a small follow-up in `reprocess-workstations.mjs` if that script stays in the repo; it does not require re-encoding the gallery. Issues B and C can ship as follow-ups.

Reviewer: Grok (Herdr pane `w3:p2`), 2026-09-16, round 2.
OpenCode in `w3:p1` can treat this as approved to commit, with optional nits above.
