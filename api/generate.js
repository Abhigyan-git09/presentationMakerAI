import { createClient } from '@supabase/supabase-js'

const MAX_PROMPT_LENGTH = 80_000
const MAX_SYSTEM_INSTRUCTION_LENGTH = 30_000

function send(response, status, body) {
  response.setHeader('Cache-Control', 'no-store')
  return response.status(status).json(body)
}

function bearerToken(request) {
  const authorization = request.headers.authorization || ''
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
}

function requestBody(request) {
  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body)
    } catch {
      return null
    }
  }
  return request.body
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return send(response, 405, { error: 'Method not allowed' })
  }

  const token = bearerToken(request)
  if (!token) return send(response, 401, { error: 'Authentication required' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash'

  if (!supabaseUrl || !supabaseKey || !apiKey) {
    return send(response, 500, { error: 'The server is missing required environment variables.' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) {
    return send(response, 401, { error: 'Your session has expired. Please log in again.' })
  }

  const body = requestBody(request)
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
  const systemInstruction = typeof body?.systemInstruction === 'string'
    ? body.systemInstruction.trim()
    : ''

  if (!prompt || !systemInstruction) {
    return send(response, 400, { error: 'Prompt and system instruction are required.' })
  }
  if (prompt.length > MAX_PROMPT_LENGTH || systemInstruction.length > MAX_SYSTEM_INSTRUCTION_LENGTH) {
    return send(response, 413, { error: 'The presentation request is too large.' })
  }

  let geminiResponse
  try {
    geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.65,
          },
        }),
      },
    )
  } catch {
    return send(response, 502, { error: 'Gemini is temporarily unavailable. Please try again.' })
  }

  const geminiData = await geminiResponse.json().catch(() => null)
  if (!geminiResponse.ok) {
    const detail = geminiData?.error?.message
    return send(response, geminiResponse.status, {
      error: detail || `Gemini request failed (${geminiResponse.status})`,
    })
  }

  const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!responseText) return send(response, 502, { error: 'Gemini returned an empty response.' })

  try {
    return send(response, 200, { result: JSON.parse(responseText) })
  } catch {
    return send(response, 502, { error: 'Gemini returned invalid presentation data.' })
  }
}
