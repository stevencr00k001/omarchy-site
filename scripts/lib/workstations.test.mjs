import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'

const importer = fileURLToPath(
  new URL('../import-workstations.mjs', import.meta.url),
)

test('workstation imports escape titles, deduplicate media, and repeat without originals', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'workstation-test-'))
  try {
    for (const folder of ['scripts/data', 'workstations', 'downloads'])
      await mkdir(path.join(directory, folder), { recursive: true })
    await writeFile(
      path.join(directory, 'scripts/data/workstations-media.json'),
      '[]',
    )
    await writeFile(
      path.join(directory, 'scripts/data/workstations-excluded.json'),
      '[]',
    )
    await writeFile(
      path.join(directory, 'workstations/index.html'),
      '<main></main>',
    )
    const original = await sharp({
      create: { width: 2000, height: 1500, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer()
    const items = ['100', '101'].map((id) => ({
      id,
      content_type: 'image/png',
      title: '<img src=x onerror=alert(1)>',
      post: '10',
      message: '20',
    }))
    for (const item of items)
      await writeFile(path.join(directory, 'downloads', item.id), original)
    await writeFile(
      path.join(directory, 'downloads/manifest.json'),
      JSON.stringify(items),
    )
    const run = () =>
      execFileSync(
        process.execPath,
        [importer, path.join(directory, 'downloads')],
        { cwd: directory },
      )
    run()
    const html = await readFile(
      path.join(directory, 'workstations/index.html'),
      'utf8',
    )
    const metadata = await readFile(
      path.join(directory, 'scripts/data/workstations-media.json'),
      'utf8',
    )
    const parsed = JSON.parse(metadata)
    assert.equal(parsed.length, 1)
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
    assert.doesNotMatch(html, /<figcaption|<img src=x/)
    // Output dimensions must be exactly 640×480 (preview attrs).
    assert.equal(parsed[0].width, 640)
    assert.equal(parsed[0].height, 480)
    // Full-size file must be 1920×1440 WebP.
    const fullMeta = await sharp(
      path.join(directory, parsed[0].file),
    ).metadata()
    assert.equal(fullMeta.width, 1920)
    assert.equal(fullMeta.height, 1440)
    assert.equal(fullMeta.format, 'webp')
    // Preview must be 640×480 WebP.
    const previewMeta = await sharp(
      path.join(directory, parsed[0].preview),
    ).metadata()
    assert.equal(previewMeta.width, 640)
    assert.equal(previewMeta.height, 480)
    assert.equal(previewMeta.format, 'webp')
    const exclusions = JSON.parse(
      await readFile(
        path.join(directory, 'scripts/data/workstations-excluded.json'),
        'utf8',
      ),
    )
    assert.equal(exclusions.length, 1)
    // The next run has no source files: it must reuse published assets.
    for (const item of items)
      await rm(path.join(directory, 'downloads', item.id))
    run()
    assert.equal(
      await readFile(path.join(directory, 'workstations/index.html'), 'utf8'),
      html,
    )
    assert.equal(
      await readFile(
        path.join(directory, 'scripts/data/workstations-media.json'),
        'utf8',
      ),
      metadata,
    )
    // A disappeared Discord message does not remove a published workstation.
    await writeFile(path.join(directory, 'downloads/manifest.json'), '[]')
    run()
    assert.equal(
      await readFile(path.join(directory, 'workstations/index.html'), 'utf8'),
      html,
    )
    // A later review can remove both imported media and legacy gallery files.
    const legacy = {
      file: 'assets/workstations/legacy.png',
      preview: 'assets/workstations/legacy.png',
      width: 80,
      height: 60,
    }
    await writeFile(path.join(directory, legacy.file), original)
    const imported = JSON.parse(metadata)[0]
    await writeFile(
      path.join(directory, 'scripts/data/workstations-media.json'),
      JSON.stringify([imported, legacy]),
    )
    await writeFile(
      path.join(directory, 'scripts/data/workstations-excluded.json'),
      JSON.stringify([
        ...exclusions,
        { attachment: imported.attachment, reason: 'Screenshot' },
        { file: legacy.file, reason: 'Isolated hardware' },
      ]),
    )
    await writeFile(
      path.join(directory, 'downloads/manifest.json'),
      JSON.stringify(items),
    )
    run()
    run()
    assert.deepEqual(
      JSON.parse(
        await readFile(
          path.join(directory, 'scripts/data/workstations-media.json'),
          'utf8',
        ),
      ),
      [],
    )
    assert.doesNotMatch(
      await readFile(path.join(directory, 'workstations/index.html'), 'utf8'),
      /<img/,
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
