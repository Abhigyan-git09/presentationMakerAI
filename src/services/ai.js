/**
 * AI service layer for outline generation, full slide generation, and editing.
 */

import { addPhotosToPresentation } from './imageService.js'
import { getAccessToken } from './auth.js'
import {
  getDensity,
  normalizePreferences
} from '../config/presentationOptions.js'

async function callGemini(prompt, systemInstruction) {
  const accessToken = await getAccessToken()
  if (!accessToken) throw new Error('Your session has expired. Please log in again.')

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ prompt, systemInstruction }),
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json() : null
  if (!response.ok) {
    throw new Error(data?.error || `Presentation request failed (${response.status})`)
  }
  if (!data?.result) throw new Error('The server returned an empty presentation. Please try again.')
  return data.result
}

function cleanString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function cleanStringArray(value, maxItems = 6) {
  if (!Array.isArray(value)) return []
  return value
    .map(item => cleanString(item))
    .filter(Boolean)
    .slice(0, maxItems)
}

function densityInstructions(preferences) {
  const density = getDensity(preferences)
  return `${density.minPoints}-${density.maxPoints} key points per content slide, ` +
    `${density.wordsPerPoint} words per point, and ${density.notesLength} of speaker notes`
}

function normalizeOutline(outline, topic = '') {
  const slides = Array.isArray(outline?.slides)
    ? outline.slides.map((slide, index) => ({
        title: cleanString(slide?.title, `Slide ${index + 1}`),
        summary: cleanString(slide?.summary, 'Key ideas for this section')
      }))
    : []

  if (!slides.length) throw new Error('Gemini did not return any slides. Please try again.')
  return { slides, topic: cleanString(topic) }
}

function normalizeSlide(slide, index, preferences) {
  const density = getDensity(preferences)
  return {
    title: cleanString(slide?.title, `Slide ${index + 1}`),
    takeaway: cleanString(slide?.takeaway),
    keyPoints: cleanStringArray(slide?.keyPoints, density.maxPoints),
    speakerNotes: cleanString(slide?.speakerNotes),
    visualRecommendation: cleanString(slide?.visualRecommendation),
    photoSearchQuery: cleanString(slide?.photoSearchQuery),
    photoKeywords: cleanStringArray(slide?.photoKeywords, 5)
  }
}

function normalizePresentation(presentation, preferences, topic = '') {
  const normalizedPreferences = normalizePreferences(preferences)
  const slides = Array.isArray(presentation?.slides)
    ? presentation.slides.map((slide, index) => normalizeSlide(slide, index, normalizedPreferences))
    : []

  if (!slides.length) throw new Error('Gemini did not return any slide content. Please try again.')

  const audienceQuestions = Array.isArray(presentation?.audienceQuestions)
    ? presentation.audienceQuestions
        .map(item => ({
          question: cleanString(item?.question),
          suggestedAnswer: cleanString(item?.suggestedAnswer)
        }))
        .filter(item => item.question && item.suggestedAnswer)
        .slice(0, 6)
    : []

  return {
    title: cleanString(presentation?.title, slides[0].title),
    topic: cleanString(topic, presentation?.title),
    slides,
    audienceQuestions,
    preferences: normalizedPreferences
  }
}

export async function generateOutline(userPrompt, documentText = '', preferences = {}) {
  const normalizedPreferences = normalizePreferences(preferences)
  const systemInstruction = `You are an expert presentation strategist. Create a logical presentation outline.

Return only valid JSON in this exact shape:
{"slides":[{"title":"Slide title","summary":"One-sentence purpose of the slide"}]}

Requirements:
- Create 6-10 slides.
- Start with a title slide, use an agenda or overview as slide 2, and finish with a clear closing/Q&A slide.
- Use specific, takeaway-oriented titles instead of generic labels whenever possible.
- Build a coherent story: context, core ideas, evidence/examples, action or conclusion.
- The final content density will be ${densityInstructions(normalizedPreferences)}.`

  const prompt = documentText
    ? `Create an outline from this idea and source document.\n\nIdea: ${userPrompt || 'Use the document topic'}\n\nDocument:\n${documentText.substring(0, 12000)}`
    : `Create a presentation outline about: ${userPrompt}`

  return normalizeOutline(await callGemini(prompt, systemInstruction), userPrompt)
}

export async function refineOutline(currentOutline, refinementPrompt, preferences = {}) {
  const systemInstruction = `You are an expert presentation strategist. Modify the supplied outline while preserving a strong narrative.

Return only valid JSON in this exact shape:
{"slides":[{"title":"Slide title","summary":"One-sentence purpose of the slide"}]}

Apply the user's request precisely. Keep slide titles specific and takeaway-oriented. The eventual slide content should follow ${densityInstructions(preferences)}.`

  const prompt = `Current outline:\n${JSON.stringify(currentOutline.slides, null, 2)}\n\nRequested changes: ${refinementPrompt}`
  return normalizeOutline(await callGemini(prompt, systemInstruction), currentOutline.topic)
}

export async function generateFullPresentation(outline, preferences = {}) {
  const normalizedPreferences = normalizePreferences(preferences)
  const density = getDensity(normalizedPreferences)
  const systemInstruction = `You are an expert presentation designer, researcher, and content writer. Turn the outline into complete, presentation-ready content.

Return only valid JSON in this exact shape:
{
  "title":"Deck title",
  "slides":[{
    "title":"Specific takeaway title",
    "takeaway":"One sentence stating the central message",
    "keyPoints":["Short label: supporting explanation"],
    "speakerNotes":"Natural presenter guidance",
    "visualRecommendation":"A specific visual treatment",
    "photoSearchQuery":"concrete visible subject search phrase",
    "photoKeywords":["distinctive noun","place or object","topic term"]
  }],
  "audienceQuestions":[{"question":"Likely question","suggestedAnswer":"Useful answer"}]
}

Content requirements:
- Use ${density.minPoints}-${density.maxPoints} points on normal content slides and ${density.wordsPerPoint} words per point.
- Use "Label: explanation" phrasing when it improves scanning; do not repeat the title in every bullet.
- Write ${density.notesLength} of practical, conversational speaker notes.
- The title and closing slides may use fewer points when appropriate.
- Use defensible facts; do not invent precise statistics or citations.
- Generate 4-6 diverse audience questions with concise but complete answers.

Photo relevance requirements:
- Search queries must name a literal, photographable subject: visible people, places, infrastructure, equipment, or an event.
- Preserve the core topic, location, technology, or organization name that makes the slide distinctive.
- Use 3-7 concrete English words. Never use "photo", "image", abstract metaphors, or generic office-team imagery unless the topic is actually workplace collaboration.
- Provide 3-5 photoKeywords that must plausibly appear in a matching photo title or description.`

  const prompt = `Generate the complete presentation for this outline:\n${JSON.stringify(outline.slides, null, 2)}`
  const generated = await callGemini(prompt, systemInstruction)
  return addPhotosToPresentation(
    normalizePresentation(generated, normalizedPreferences, outline.topic)
  )
}

export async function editSlide(slide, userInstruction, preferences = {}) {
  const normalizedPreferences = normalizePreferences(preferences)
  const systemInstruction = `You are an expert presentation editor. Apply the requested edit while keeping the slide coherent and presentation-ready.

Return only valid JSON in this exact shape:
{"title":"Slide title","takeaway":"Central message","keyPoints":["Label: explanation"],"speakerNotes":"Updated notes","visualRecommendation":"Specific visual","photoSearchQuery":"concrete visible subject","photoKeywords":["keyword"]}

Keep the result within ${densityInstructions(normalizedPreferences)}. The photo query must remain literal, topic-specific, and photographable.`

  const prompt = `Current slide:\n${JSON.stringify(slide, null, 2)}\n\nRequested edit: ${userInstruction}`
  const edited = await callGemini(prompt, systemInstruction)
  return normalizeSlide(edited, 0, normalizedPreferences)
}
