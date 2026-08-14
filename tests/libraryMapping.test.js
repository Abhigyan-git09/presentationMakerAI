import test from 'node:test'
import assert from 'node:assert/strict'
import { mapPresentationRow } from '../src/services/library.js'

const row = {
  id: 'presentation-id',
  name: 'Saved deck',
  slide_count: 2,
  created_at: '2026-08-15T00:00:00.000Z',
  updated_at: '2026-08-15T01:00:00.000Z',
  presentation: {
    title: 'Rainwater Harvesting',
    topic: 'Urban rainwater harvesting',
    preferences: { colorTheme: 'ocean' },
    slides: [
      { title: 'Capturing a valuable resource' },
      { title: 'Collection and filtration' },
    ],
  },
}

test('maps Supabase presentation rows to the library card contract', () => {
  assert.deepEqual(mapPresentationRow(row), {
    id: 'presentation-id',
    name: 'Saved deck',
    title: 'Rainwater Harvesting',
    topic: 'Urban rainwater harvesting',
    slideCount: 2,
    firstSlideTitle: 'Capturing a valuable resource',
    preferences: { colorTheme: 'ocean' },
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T01:00:00.000Z',
  })
})

test('includes the complete presentation only when requested', () => {
  const mapped = mapPresentationRow(row, true)
  assert.equal(mapped.presentation, row.presentation)
})
