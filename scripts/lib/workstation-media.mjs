export const FULL_WIDTH = 1920
export const FULL_HEIGHT = 1440
export const PREVIEW_WIDTH = 640
export const PREVIEW_HEIGHT = 480
export const FULL_QUALITY = 80
export const PREVIEW_QUALITY = 72

export function resizeFull(input) {
  return input
    .resize({
      width: FULL_WIDTH,
      height: FULL_HEIGHT,
      fit: 'cover',
      position: 'centre',
    })
    .webp({ quality: FULL_QUALITY })
}

export function resizePreview(input) {
  return input
    .resize({
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      fit: 'cover',
      position: 'centre',
    })
    .webp({ quality: PREVIEW_QUALITY })
}

export function escape(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  )
}

export function buildCardHtml(entry) {
  const title = escape(entry.title || 'Omarchy workstation')
  const media = entry.video
    ? `<video controls preload="none" playsinline poster="/${escape(entry.preview)}" aria-label="${title}" width="${entry.width}" height="${entry.height}"><source src="/${escape(entry.file)}" type="video/webm"></video>`
    : `<a href="/${escape(entry.file)}" aria-label="View workstation photo: ${title}"><img src="/${escape(entry.preview)}" alt="${title}" width="${entry.width}" height="${entry.height}" loading="lazy" decoding="async"></a>`
  return `          <figure>\n            ${media}\n          </figure>`
}

export function buildPageHtml(cards) {
  return `<!doctype html>
<!-- Content source for the React site; edit the article here, preview with npm run dev. -->
<html lang="en">
<head><meta charset="utf-8"><title>#omarchy-workstations</title></head>
<body>
<main>
      <div class="workstations">
        <div class="workstations__images">
${cards}
        </div>
      </div>
</main>
</body>
</html>
`
}
