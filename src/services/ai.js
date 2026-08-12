/**
 * AI Service Layer
 * Handles all Gemini API interactions for outline generation,
 * full presentation generation, and per-slide editing.
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.6-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

async function callGemini(prompt, systemInstruction) {
  if (!API_KEY) {
    throw new Error('Please set VITE_GEMINI_API_KEY in your .env file');
  }

  const response = await fetch(`${API_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        { role: 'user', parts: [{ text: prompt }] }
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.7
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return JSON.parse(text);
}

/**
 * Generate a lightweight presentation outline from a prompt or document text.
 */
export async function generateOutline(userPrompt, documentText = '') {
  const systemInstruction = `You are an expert presentation consultant. Given a topic or document content, generate a structured presentation outline.

IMPORTANT: Return ONLY valid JSON in this exact format:
{
  "slides": [
    {
      "title": "Slide title",
      "summary": "One-line summary of what this slide covers"
    }
  ]
}

Guidelines:
- Generate 6-10 slides for a well-structured presentation.
- Always start with a "Title Slide" and end with a "Thank You / Q&A" slide.
- Include an "Agenda / Overview" slide as slide 2.
- Each slide should have a clear, actionable title.
- Summaries should be concise (1 sentence).`;

  const prompt = documentText
    ? `Create a presentation outline based on the following:\n\nUser's idea: ${userPrompt}\n\nDocument content:\n${documentText.substring(0, 8000)}`
    : `Create a presentation outline about: ${userPrompt}`;

  return callGemini(prompt, systemInstruction);
}

/**
 * Regenerate outline with user refinement instructions.
 */
export async function refineOutline(currentOutline, refinementPrompt) {
  const systemInstruction = `You are an expert presentation consultant. The user has an existing presentation outline and wants to modify it.

IMPORTANT: Return ONLY valid JSON in this exact format:
{
  "slides": [
    {
      "title": "Slide title",
      "summary": "One-line summary of what this slide covers"
    }
  ]
}

Apply the user's requested changes to the outline while maintaining a logical flow.`;

  const prompt = `Current outline:\n${JSON.stringify(currentOutline.slides, null, 2)}\n\nUser's changes: ${refinementPrompt}`;

  return callGemini(prompt, systemInstruction);
}

/**
 * Generate full presentation content from an approved outline.
 */
export async function generateFullPresentation(outline) {
  const systemInstruction = `You are an expert presentation designer and content writer. Given a presentation outline, generate complete slide content.

IMPORTANT: Return ONLY valid JSON in this exact format:
{
  "slides": [
    {
      "title": "Slide Title",
      "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
      "speakerNotes": "Detailed speaker notes for this slide. Should be 2-3 sentences that help the presenter deliver this slide effectively.",
      "visualRecommendation": "Describe the ideal visual for this slide, e.g., 'Bar chart comparing market share of top 5 competitors' or 'Full-bleed image of a modern data center'"
    }
  ],
  "audienceQuestions": [
    {
      "question": "A likely question the audience might ask",
      "suggestedAnswer": "A well-thought-out answer to the question"
    }
  ]
}

Guidelines:
- For each slide, provide 3-5 key points that are concise and impactful.
- Speaker notes should be conversational and help the presenter deliver naturally.
- Visual recommendations should be specific and actionable (not vague like "an image").
- Generate 4-6 diverse audience questions covering different aspects of the presentation.
- Suggested answers should be thorough but concise.`;

  const prompt = `Generate full presentation content for this outline:\n${JSON.stringify(outline.slides, null, 2)}`;

  return callGemini(prompt, systemInstruction);
}

/**
 * Edit a single slide based on user instructions.
 */
export async function editSlide(slide, userInstruction) {
  const systemInstruction = `You are an expert presentation editor. The user wants to modify a specific slide. Apply their edit request.

IMPORTANT: Return ONLY valid JSON in this exact format:
{
  "title": "Slide Title",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "speakerNotes": "Updated speaker notes...",
  "visualRecommendation": "Updated visual recommendation..."
}

Maintain the existing structure but apply the requested changes precisely.`;

  const prompt = `Current slide:\n${JSON.stringify(slide, null, 2)}\n\nUser's edit request: ${userInstruction}`;

  return callGemini(prompt, systemInstruction);
}
