import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_PRESENTATION_PREFERENCES,
  getDensity,
  normalizePreferences,
  splitBulletPoint,
  themeCssVariables
} from '../src/config/presentationOptions.js'

test('normalizes unknown presentation options to safe defaults', () => {
  assert.deepEqual(
    normalizePreferences({ textDensity: 'huge', template: 'unknown', colorTheme: 'neon' }),
    DEFAULT_PRESENTATION_PREFERENCES
  )
})

test('retains valid independent presentation options', () => {
  const preferences = normalizePreferences({
    textDensity: 'detailed',
    template: 'editorial',
    colorTheme: 'forest'
  })
  assert.equal(getDensity(preferences).maxPoints, 6)
  assert.equal(themeCssVariables(preferences)['--slide-accent'], '#4ADE80')
})

test('splits labelled bullets without breaking ordinary sentences', () => {
  assert.deepEqual(splitBulletPoint('Impact: Reduces municipal water demand'), {
    label: 'Impact',
    detail: 'Reduces municipal water demand'
  })
  assert.deepEqual(splitBulletPoint('A sentence without a label'), {
    label: '',
    detail: 'A sentence without a label'
  })
})
