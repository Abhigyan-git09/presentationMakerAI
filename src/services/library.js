import { getSupabase } from './supabase.js'

function requestError(error, fallback = 'Presentation library request failed') {
  const message = error?.message || fallback
  if (/row-level security/i.test(message)) {
    return new Error('Your session cannot access this presentation. Please log in again.')
  }
  return new Error(message)
}

export function mapPresentationRow(row, includePresentation = false) {
  const presentation = row.presentation || {}
  const slides = Array.isArray(presentation.slides) ? presentation.slides : []
  const result = {
    id: row.id,
    name: row.name,
    title: presentation.title || row.name,
    topic: presentation.topic || presentation.title || row.name,
    slideCount: row.slide_count ?? slides.length,
    firstSlideTitle: slides[0]?.title || 'Untitled slide',
    preferences: presentation.preferences || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
  return includePresentation ? { ...result, presentation } : result
}

async function currentUserId() {
  const client = getSupabase()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Authentication required')
  return data.user.id
}

export async function listSavedPresentations() {
  const client = getSupabase()
  const { data, error } = await client
    .from('presentations')
    .select('id,name,presentation,slide_count,created_at,updated_at')
    .order('updated_at', { ascending: false })

  if (error) throw requestError(error)
  return (data || []).map(row => mapPresentationRow(row))
}

export async function getSavedPresentation(id) {
  const client = getSupabase()
  const { data, error } = await client
    .from('presentations')
    .select('id,name,presentation,slide_count,created_at,updated_at')
    .eq('id', id)
    .maybeSingle()

  if (error) throw requestError(error)
  if (!data) throw new Error('Presentation not found')
  return mapPresentationRow(data, true)
}

export async function createSavedPresentation({ name, presentation }) {
  const client = getSupabase()
  const userId = await currentUserId()
  const { data, error } = await client
    .from('presentations')
    .insert({ user_id: userId, name: name.trim(), presentation })
    .select('id,name,presentation,slide_count,created_at,updated_at')
    .single()

  if (error) throw requestError(error)
  return mapPresentationRow(data, true)
}

export async function updateSavedPresentation(id, { name, presentation }) {
  const client = getSupabase()
  const { data, error } = await client
    .from('presentations')
    .update({ name: name.trim(), presentation })
    .eq('id', id)
    .select('id,name,presentation,slide_count,created_at,updated_at')
    .maybeSingle()

  if (error) throw requestError(error)
  if (!data) throw new Error('Presentation not found')
  return mapPresentationRow(data, true)
}

export async function renameSavedPresentation(id, name) {
  const client = getSupabase()
  const { data, error } = await client
    .from('presentations')
    .update({ name: name.trim() })
    .eq('id', id)
    .select('id,name,presentation,slide_count,created_at,updated_at')
    .maybeSingle()

  if (error) throw requestError(error)
  if (!data) throw new Error('Presentation not found')
  return mapPresentationRow(data)
}

export async function deleteSavedPresentation(id) {
  const client = getSupabase()
  const { data, error } = await client
    .from('presentations')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) throw requestError(error)
  if (!data) throw new Error('Presentation not found')
}
