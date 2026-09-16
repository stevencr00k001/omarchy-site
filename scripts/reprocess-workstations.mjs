// One-off migration: reprocess all workstation gallery images to uniform
// 1920×1440 (full) and 640×480 (preview) landscape 4:3 WebP.
// Idempotent: skips entries already at target dimensions.
// Usage: node scripts/reprocess-workstations.mjs
import { readFile, writeFile, unlink, rename, access } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import {
  FULL_WIDTH,
  FULL_HEIGHT,
  PREVIEW_WIDTH,
  PREVIEW_HEIGHT,
  resizeFull,
  resizePreview,
  buildCardHtml,
  buildPageHtml,
} from './lib/workstation-media.mjs'

const assetDirectory = 'assets/workstations'
const metadataPath = 'scripts/data/workstations-media.json'
const entries = JSON.parse(await readFile(metadataPath, 'utf8'))

let processed = 0
let skipped = 0
let videoPosters = 0
let errors = 0

for (const entry of entries) {
  if (entry.video) {
    const previewTmp = `${entry.preview}.tmp`
    try {
      await access(entry.preview)
      const meta = await sharp(entry.preview).metadata()
      if (meta.width === PREVIEW_WIDTH && meta.height === PREVIEW_HEIGHT) {
        skipped++
        continue
      }
      await resizePreview(sharp(entry.preview)).toFile(previewTmp)
      await rename(previewTmp, entry.preview)
      entry.width = PREVIEW_WIDTH
      entry.height = PREVIEW_HEIGHT
      videoPosters++
    } catch {
      errors++
      try {
        await unlink(previewTmp)
      } catch {}
    }
    continue
  }

  const fullTmp = `${entry.file}.tmp`
  const previewTmp = `${entry.preview}.tmp`
  try {
    await access(entry.file)
    await access(entry.preview)
    const [fullMeta, previewMeta] = await Promise.all([
      sharp(entry.file).metadata(),
      sharp(entry.preview).metadata(),
    ])
    const fullOk =
      fullMeta.width === FULL_WIDTH &&
      fullMeta.height === FULL_HEIGHT &&
      fullMeta.format === 'webp'
    const previewOk =
      previewMeta.width === PREVIEW_WIDTH &&
      previewMeta.height === PREVIEW_HEIGHT &&
      previewMeta.format === 'webp'
    if (fullOk && previewOk) {
      skipped++
      continue
    }

    const data = await readFile(entry.file)
    if (!fullOk) {
      await resizeFull(sharp(data).rotate()).toFile(fullTmp)
    }
    if (!previewOk) {
      await resizePreview(sharp(data).rotate()).toFile(previewTmp)
    }

    const oldFile = entry.file
    const oldPreview = entry.preview

    if (!fullOk) {
      const newFile = `${path.parse(entry.file).name}.webp`
      entry.file = `${assetDirectory}/${newFile}`
      await rename(fullTmp, entry.file)
      if (oldFile !== entry.file) {
        try {
          await unlink(oldFile)
        } catch {}
      }
    }
    if (!previewOk) {
      const newPreview = `${assetDirectory}/previews/${path.parse(entry.preview).name}.webp`
      entry.preview = newPreview
      await rename(previewTmp, entry.preview)
      if (oldPreview !== entry.preview) {
        try {
          await unlink(oldPreview)
        } catch {}
      }
    }

    entry.width = PREVIEW_WIDTH
    entry.height = PREVIEW_HEIGHT
    processed++
    if (processed % 50 === 0) console.log(`Processed ${processed} images`)
  } catch (err) {
    errors++
    console.error(`Error processing ${entry.file}: ${err.message}`)
    try {
      await unlink(fullTmp)
    } catch {}
    try {
      await unlink(previewTmp)
    } catch {}
  }
}

await writeFile(metadataPath, JSON.stringify(entries, null, 2) + '\n')
const cards = entries.map(buildCardHtml).join('\n\n')
await writeFile('workstations/index.html', buildPageHtml(cards))

console.log(
  JSON.stringify({
    processed,
    skipped,
    videoPosters,
    errors,
    total: entries.length,
  }),
)
