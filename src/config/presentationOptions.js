export const TEXT_DENSITIES = {
  concise: {
    id: 'concise',
    label: 'Concise',
    description: '3-4 short points for visual, fast-paced talks',
    minPoints: 3,
    maxPoints: 4,
    wordsPerPoint: '8-13',
    notesLength: '50-80 words',
    bodyFontSize: 20
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    description: '4-5 explained points with comfortable detail',
    minPoints: 4,
    maxPoints: 5,
    wordsPerPoint: '12-18',
    notesLength: '80-120 words',
    bodyFontSize: 18
  },
  detailed: {
    id: 'detailed',
    label: 'Detailed',
    description: '5-6 fuller points for information-rich decks',
    minPoints: 5,
    maxPoints: 6,
    wordsPerPoint: '16-24',
    notesLength: '120-170 words',
    bodyFontSize: 16
  }
}

export const PRESENTATION_TEMPLATES = {
  spotlight: {
    id: 'spotlight',
    label: 'Spotlight',
    description: 'Bold, image-forward split layout'
  },
  editorial: {
    id: 'editorial',
    label: 'Editorial',
    description: 'Alternating visual storytelling layout'
  },
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean, text-led layout with restrained visuals'
  }
}

export const COLOR_THEMES = {
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    background: '0F172A',
    surface: '1E293B',
    text: 'F8FAFC',
    muted: 'CBD5E1',
    accent: '5B7CFF',
    accent2: 'A78BFA'
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean',
    background: '082F49',
    surface: '0C4A6E',
    text: 'F0F9FF',
    muted: 'BAE6FD',
    accent: '38BDF8',
    accent2: '2DD4BF'
  },
  forest: {
    id: 'forest',
    label: 'Forest',
    background: '132A24',
    surface: '1F3B32',
    text: 'F0FDF4',
    muted: 'BBF7D0',
    accent: '4ADE80',
    accent2: 'FACC15'
  },
  ember: {
    id: 'ember',
    label: 'Ember',
    background: '321313',
    surface: '4A1D1D',
    text: 'FFF7ED',
    muted: 'FED7AA',
    accent: 'FB923C',
    accent2: 'F472B6'
  }
}

export const DEFAULT_PRESENTATION_PREFERENCES = Object.freeze({
  textDensity: 'balanced',
  template: 'spotlight',
  colorTheme: 'midnight'
})

export function normalizePreferences(preferences = {}) {
  return {
    textDensity: TEXT_DENSITIES[preferences.textDensity]
      ? preferences.textDensity
      : DEFAULT_PRESENTATION_PREFERENCES.textDensity,
    template: PRESENTATION_TEMPLATES[preferences.template]
      ? preferences.template
      : DEFAULT_PRESENTATION_PREFERENCES.template,
    colorTheme: COLOR_THEMES[preferences.colorTheme]
      ? preferences.colorTheme
      : DEFAULT_PRESENTATION_PREFERENCES.colorTheme
  }
}

export function getDensity(preferences) {
  return TEXT_DENSITIES[normalizePreferences(preferences).textDensity]
}

export function getTemplate(preferences) {
  return PRESENTATION_TEMPLATES[normalizePreferences(preferences).template]
}

export function getTheme(preferences) {
  return COLOR_THEMES[normalizePreferences(preferences).colorTheme]
}

export function themeCssVariables(preferences) {
  const theme = getTheme(preferences)
  return {
    '--slide-bg': `#${theme.background}`,
    '--slide-surface': `#${theme.surface}`,
    '--slide-text': `#${theme.text}`,
    '--slide-muted': `#${theme.muted}`,
    '--slide-accent': `#${theme.accent}`,
    '--slide-accent-2': `#${theme.accent2}`
  }
}

export function splitBulletPoint(point = '') {
  const text = String(point).trim()
  const colonIndex = text.indexOf(':')
  if (colonIndex > 0 && colonIndex <= 42) {
    return {
      label: text.slice(0, colonIndex).trim(),
      detail: text.slice(colonIndex + 1).trim()
    }
  }
  return { label: '', detail: text }
}
