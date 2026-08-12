/**
 * Finds reusable slide photos through Wikimedia Commons.
 * Commons returns creator and license metadata alongside each image so the
 * app can preserve attribution in both the workspace and exported decks.
 */

const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php'
const PHOTO_LIMIT = 8
const SEARCH_STOP_WORDS = new Set([
  'about', 'across', 'after', 'against', 'along', 'among', 'around', 'from',
  'into', 'near', 'over', 'photo', 'photograph', 'showing', 'through', 'under',
  'with', 'without'
])

function stripHtml(value = '') {
  const element = document.createElement('textarea')
  element.innerHTML = value.replace(/<[^>]*>/g, ' ')
  return element.value.replace(/\s+/g, ' ').trim()
}

function metadataValue(metadata, key) {
  return stripHtml(metadata?.[key]?.value || '')
}

function photoScore(photo) {
  const aspectRatio = photo.width / photo.height
  const landscapeBonus = aspectRatio >= 1.25 && aspectRatio <= 2.1 ? 3 : 0
  const resolutionBonus = photo.width >= 1200 ? 2 : 0
  const licenseBonus = /cc0|public domain/i.test(photo.license) ? 1 : 0
  return landscapeBonus + resolutionBonus + licenseBonus
}

function searchVariants(searchQuery) {
  const words = searchQuery
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length > 2 && !SEARCH_STOP_WORDS.has(word.toLowerCase()))

  return [words.slice(0, 5), words.slice(0, 3)]
    .filter(wordsForQuery => wordsForQuery.length > 0)
    .map(wordsForQuery => wordsForQuery.join(' '))
    .filter((query, index, queries) => queries.indexOf(query) === index)
}

function normalizePhoto(page) {
  const info = page.imageinfo?.[0]
  if (!info?.thumburl || info.mime !== 'image/jpeg') return null

  const metadata = info.extmetadata || {}
  const creator = metadataValue(metadata, 'Artist') || info.user || 'Wikimedia Commons contributor'
  const license = metadataValue(metadata, 'LicenseShortName') || 'See source for license'

  return {
    url: info.thumburl,
    sourceUrl: info.descriptionurl,
    title: page.title.replace(/^File:/, '').replace(/\.[^.]+$/, ''),
    alt: metadataValue(metadata, 'ImageDescription') || page.title.replace(/^File:/, ''),
    creator,
    license,
    licenseUrl: metadataValue(metadata, 'LicenseUrl'),
    width: info.thumbwidth || info.width,
    height: info.thumbheight || info.height
  }
}

/**
 * Return the strongest landscape-oriented Commons photo for a search phrase.
 * Photo lookup is deliberately non-blocking: callers can keep the generated
 * slide when Commons is unavailable or has no relevant JPEG result.
 */
async function searchCommons(query) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: `${query} filemime:jpeg`,
    gsrnamespace: '6',
    gsrlimit: String(PHOTO_LIMIT),
    prop: 'imageinfo',
    iiprop: 'url|mime|size|user|extmetadata',
    iiurlwidth: '1600',
    iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|ImageDescription',
    origin: '*'
  })

  const response = await fetch(`${COMMONS_API_URL}?${params}`)
  if (!response.ok) return null

  const data = await response.json()
  const photos = (data.query?.pages || [])
    .map(normalizePhoto)
    .filter(Boolean)
    .filter(photo => photo.width >= 800 && photo.height >= 450)
    .sort((a, b) => photoScore(b) - photoScore(a))

  return photos[0] || null
}

export async function findPhoto(searchQuery) {
  if (!searchQuery?.trim()) return null

  try {
    for (const query of searchVariants(searchQuery)) {
      const photo = await searchCommons(query)
      if (photo) return photo
    }
  } catch (error) {
    console.warn('Wikimedia Commons photo lookup failed.', error)
  }

  return null
}

export async function addPhotosToPresentation(presentation) {
  const slides = await Promise.all(
    presentation.slides.map(async slide => {
      if (slide.photo) return slide

      const photo = await findPhoto(slide.photoSearchQuery || slide.title)
      const fallbackPhoto = photo || (
        slide.photoSearchQuery ? await findPhoto(slide.title) : null
      )

      return { ...slide, photo: fallbackPhoto }
    })
  )

  return { ...presentation, slides }
}
