const STOP_WORDS = new Set([
  'about', 'across', 'after', 'against', 'along', 'among', 'around', 'from', 'the',
  'and', 'for', 'how', 'why', 'who', 'what', 'where', 'when', 'can', 'could',
  'into', 'near', 'over', 'photo', 'photograph', 'picture', 'showing', 'through',
  'under', 'with', 'without', 'that', 'this', 'these', 'those', 'their', 'there', 'show',
  'overview', 'agenda', 'introduction', 'conclusion', 'summary', 'slide', 'thank',
  'thanks', 'question', 'questions', 'using', 'used', 'system', 'solution',
  'modern', 'residential', 'architecture', 'infrastructure', 'strategic'
])

function stem(term) {
  if (term.length > 5 && term.endsWith('ies')) return `${term.slice(0, -3)}y`
  if (term.length > 5 && term.endsWith('ing')) return term.slice(0, -3)
  if (term.length > 3 && term.endsWith('s') && !term.endsWith('ss')) return term.slice(0, -1)
  return term
}

export function meaningfulTerms(value = '') {
  const values = Array.isArray(value) ? value : [value]
  const terms = values
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .map(term => stem(term.trim()))
    .filter(term => term.length > 2 && !STOP_WORDS.has(term))

  return [...new Set(terms)]
}

function queryFromTerms(terms, max = 7) {
  return [...new Set(terms)].slice(0, max).join(' ')
}

export function buildSearchQueries(searchQuery, context = {}) {
  const primary = meaningfulTerms(searchQuery)
  const keywords = meaningfulTerms(context.keywords || [])
  const slide = meaningfulTerms(context.slideTitle)
  const deck = meaningfulTerms(context.presentationTitle)

  const variants = [
    queryFromTerms(primary, 3),
    queryFromTerms([...deck.slice(0, 2), ...primary.slice(-1)], 3),
    queryFromTerms([...deck.slice(0, 2), ...keywords.slice(0, 1), ...slide.slice(0, 1)], 4)
  ].filter(Boolean)

  return [...new Set(variants)].slice(0, 3)
}

export function scorePhotoRelevance(photo, query, keywords = [], requiredTerms = []) {
  const coreTerms = meaningfulTerms(query)
  const queryTerms = [...new Set([...coreTerms, ...meaningfulTerms(keywords)])]
  const required = meaningfulTerms(requiredTerms)
  const titleTerms = new Set(meaningfulTerms(photo.title))
  const descriptionTerms = new Set(meaningfulTerms(photo.alt))
  const matchedTerms = queryTerms.filter(term => titleTerms.has(term) || descriptionTerms.has(term))
  const matchedCoreTerms = coreTerms.filter(term => titleTerms.has(term) || descriptionTerms.has(term))
  const matchedRequiredTerms = required.filter(term => titleTerms.has(term) || descriptionTerms.has(term))
  const matchedRequiredTitleTerms = required.filter(term => titleTerms.has(term))
  const titleMatches = queryTerms.filter(term => titleTerms.has(term)).length
  const coverage = queryTerms.length ? matchedTerms.length / queryTerms.length : 0
  const normalizedPhrase = meaningfulTerms(query).join(' ')
  const normalizedText = meaningfulTerms(`${photo.title} ${photo.alt}`).join(' ')
  const exactPhrase = normalizedPhrase.length > 5 && normalizedText.includes(normalizedPhrase)

  return {
    score: (coverage * 12) + (matchedTerms.length * 2.5) + (titleMatches * 1.5) + (exactPhrase ? 8 : 0),
    coverage,
    coreCoverage: coreTerms.length ? matchedCoreTerms.length / coreTerms.length : 0,
    matchedTerms,
    matchedCoreTerms,
    matchedRequiredTerms,
    matchedRequiredTitleTerms,
    requiredTermCount: required.length
  }
}
