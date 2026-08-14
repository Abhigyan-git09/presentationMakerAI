/**
 * Finds reusable, semantically relevant slide photos through Wikimedia Commons.
 * Attribution is preserved for the workspace and exported PowerPoint.
 */

import { buildSearchQueries, scorePhotoRelevance } from './imageRelevance.js'

const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php'
const PHOTO_LIMIT = 12

function stripHtml(value = '') {
  const plainText = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (typeof document === 'undefined') return plainText
  const element = document.createElement('textarea')
  element.innerHTML = plainText
  return element.value
}

function metadataValue(metadata, key) {
  return stripHtml(metadata?.[key]?.value || '')
}

function visualQualityScore(photo) {
  const aspectRatio = photo.width / photo.height
  const landscapeBonus = aspectRatio >= 1.25 && aspectRatio <= 2.1 ? 3 : 0
  const resolutionBonus = photo.width >= 1200 ? 2 : 0
  const licenseBonus = /cc0|public domain/i.test(photo.license) ? 1 : 0
  return landscapeBonus + resolutionBonus + licenseBonus
}

function hasStrongTopicMatch(relevance) {
  if (!relevance.requiredTermCount) return true
  if (relevance.requiredTermCount === 1) return relevance.matchedRequiredTerms.length === 1
  return relevance.matchedRequiredTitleTerms.length > 0 || relevance.matchedRequiredTerms.length >= 2
}

function normalizePhoto(page) {
  const info = page.imageinfo?.[0]
  if (!info?.thumburl || info.mime !== 'image/jpeg') return null

  const metadata = info.extmetadata || {}
  return {
    url: info.thumburl,
    sourceUrl: info.descriptionurl,
    title: page.title.replace(/^File:/, '').replace(/\.[^.]+$/, ''),
    alt: metadataValue(metadata, 'ImageDescription') || page.title.replace(/^File:/, ''),
    creator: metadataValue(metadata, 'Artist') || info.user || 'Wikimedia Commons contributor',
    license: metadataValue(metadata, 'LicenseShortName') || 'See source for license',
    licenseUrl: metadataValue(metadata, 'LicenseUrl'),
    width: info.thumbwidth || info.width,
    height: info.thumbheight || info.height
  }
}

async function searchCommons(query, context, excludedUrls) {
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
  if (!response.ok) return []

  const data = await response.json()
  return (data.query?.pages || [])
    .map(normalizePhoto)
    .filter(Boolean)
    .filter(photo => photo.width >= 800 && photo.height >= 450)
    .filter(photo => photo.width / photo.height >= 1.15 && photo.width / photo.height <= 2.4)
    .filter(photo => !excludedUrls.has(photo.url))
    .map(photo => {
      const relevance = scorePhotoRelevance(
        photo,
        query,
        context.keywords || [],
        context.presentationTitle || ''
      )
      const slideRelevance = scorePhotoRelevance(
        photo,
        context.slideTitle || query,
        context.keywords || []
      )
      return {
        ...photo,
        relevanceScore: Number(relevance.score.toFixed(2)),
        relevanceCoverage: Number(relevance.coverage.toFixed(2)),
        coreCoverage: Number(relevance.coreCoverage.toFixed(2)),
        matchedKeywords: relevance.matchedTerms,
        matchedTopicTerms: relevance.matchedRequiredTerms,
        topicTitleMatches: relevance.matchedRequiredTitleTerms,
        strongTopicMatch: hasStrongTopicMatch(relevance),
        matchedSlideTerms: slideRelevance.matchedCoreTerms,
        totalScore: relevance.score + visualQualityScore(photo)
      }
    })
    .filter(photo => photo.coreCoverage >= 0.45 && photo.relevanceCoverage >= 0.4)
    .filter(photo => photo.strongTopicMatch)
    .filter(photo => !context.slideTitle || photo.matchedSlideTerms.length > 0)
    .sort((a, b) => b.totalScore - a.totalScore)
}

export async function findPhoto(searchQuery, context = {}) {
  if (!searchQuery?.trim()) return null

  const queries = buildSearchQueries(searchQuery, context)
  const excludedUrls = new Set(context.excludeUrls || [])

  try {
    const results = await Promise.allSettled(
      queries.map(query => searchCommons(query, context, excludedUrls))
    )
    const candidates = results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => result.value)
      .sort((a, b) => b.totalScore - a.totalScore)

    return candidates[0] || null
  } catch (error) {
    console.warn('Wikimedia Commons photo lookup failed.', error)
    return null
  }
}

export function isPhotoRelevant(photo, searchQuery, context = {}) {
  if (!photo || !searchQuery) return false
  const aspectRatio = photo.width / photo.height
  if (!Number.isFinite(aspectRatio) || aspectRatio < 1.15 || aspectRatio > 2.4) return false
  const relevance = scorePhotoRelevance(
    photo,
    searchQuery,
    context.keywords || [],
    context.presentationTitle || ''
  )
  const slideRelevance = scorePhotoRelevance(
    photo,
    context.slideTitle || searchQuery,
    context.keywords || []
  )
  return relevance.coreCoverage >= 0.45 &&
    relevance.coverage >= 0.4 &&
    hasStrongTopicMatch(relevance) &&
    (!context.slideTitle || slideRelevance.matchedCoreTerms.length > 0)
}

export async function addPhotosToPresentation(presentation) {
  const usedUrls = new Set()
  const slides = []

  for (const slide of presentation.slides) {
    const deckTopic = presentation.topic || presentation.title
    const primaryQuery = slide.photoSearchQuery || `${deckTopic || ''} ${slide.title}`
    const context = {
      keywords: slide.photoKeywords,
      slideTitle: slide.title,
      presentationTitle: deckTopic
    }
    const existingPhotoIsRelevant = isPhotoRelevant(slide.photo, primaryQuery, context)

    if (slide.photo && existingPhotoIsRelevant && !usedUrls.has(slide.photo.url)) {
      usedUrls.add(slide.photo.url)
      slides.push(slide)
      continue
    }

    const photo = await findPhoto(primaryQuery, {
      ...context,
      excludeUrls: [...usedUrls, slide.photo?.url].filter(Boolean)
    })

    if (photo) usedUrls.add(photo.url)
    slides.push({ ...slide, photo })
  }

  return { ...presentation, slides }
}
