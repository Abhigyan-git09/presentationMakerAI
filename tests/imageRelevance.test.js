import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSearchQueries,
  meaningfulTerms,
  scorePhotoRelevance
} from '../src/services/imageRelevance.js'
import { isPhotoRelevant } from '../src/services/imageService.js'

test('builds concrete, deduplicated queries from slide context', () => {
  const queries = buildSearchQueries('Rainwater harvesting rooftop tank', {
    keywords: ['water conservation', 'storage tank'],
    slideTitle: 'How rooftop collection works',
    presentationTitle: 'Rainwater Harvesting'
  })
  assert.ok(queries.length >= 2)
  assert.match(queries[0], /rainwater/)
  assert.ok(queries.some(query => /tank/.test(query)))
  assert.ok(queries.every(query => query.split(' ').length <= 4))
  assert.equal(new Set(queries).size, queries.length)
})

test('topic-specific photo strongly outranks an unrelated stock image', () => {
  const query = 'rainwater harvesting rooftop tank'
  const relevant = scorePhotoRelevance({
    title: 'Rainwater harvesting tank beside a house',
    alt: 'Rooftop gutters collect water in a storage tank'
  }, query)
  const unrelated = scorePhotoRelevance({
    title: 'Corporate team meeting',
    alt: 'People talking around an office table'
  }, query)

  assert.ok(relevant.coverage >= 0.75)
  assert.ok(relevant.score > unrelated.score + 10)
  assert.equal(unrelated.coverage, 0)
})

test('tracks required deck-topic terms separately from generic visual matches', () => {
  const genericHouse = scorePhotoRelevance({
    title: 'Modern residential architecture',
    alt: 'A suburban house with a pitched roof'
  }, 'modern residential rainwater', ['architecture', 'roof'], 'rainwater harvesting')

  assert.equal(genericHouse.matchedCoreTerms.length, 0)
  assert.equal(genericHouse.matchedRequiredTerms.length, 0)
})

test('rejects a visually generic photo that misses the deck topic', () => {
  assert.equal(isPhotoRelevant({
    title: 'Modern residential architecture',
    alt: 'A suburban home and chimney'
  }, 'modern residential rainwater', {
    keywords: ['architecture', 'roof'],
    presentationTitle: 'Rainwater harvesting'
  }), false)
})

test('rejects an incidental topic mention buried in a generic description', () => {
  assert.equal(isPhotoRelevant({
    title: 'Historic Dutch Colonial house',
    alt: 'A historic home whose roof shape helps slow rainwater and retain snow'
  }, 'modern residential rainwater', {
    keywords: ['architecture', 'roof'],
    presentationTitle: 'Rainwater harvesting'
  }), false)
})

test('accepts a landscape photo with strong slide and topic evidence', () => {
  assert.equal(isPhotoRelevant({
    title: 'Rainwater harvesting tank and rooftop gutters',
    alt: 'A rainwater storage barrel connected to a house gutter',
    width: 1600,
    height: 1000
  }, 'rainwater harvesting rooftop', {
    keywords: ['storage tank', 'gutter'],
    presentationTitle: 'Rainwater harvesting'
  }), true)
})

test('rejects a deck-relevant photo that misses the specific slide subject', () => {
  assert.equal(isPhotoRelevant({
    title: 'Rainwater tank beside a household bathing bench',
    alt: 'A rainwater harvesting tank used for washing clothes',
    width: 1600,
    height: 1000
  }, 'rainwater harvesting storage tank', {
    keywords: ['rainwater', 'tank'],
    slideTitle: 'Rooftop Catchment and First-Flush Filtration',
    presentationTitle: 'Rainwater harvesting'
  }), false)
})

test('removes generic presentation words from image matching', () => {
  assert.deepEqual(meaningfulTerms('Overview photo showing the questions slide'), [])
})
