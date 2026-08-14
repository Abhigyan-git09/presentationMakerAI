import { accountRequest } from './auth.js'

export async function listSavedPresentations() {
  const result = await accountRequest('/library')
  return result.presentations
}

export async function getSavedPresentation(id) {
  const result = await accountRequest(`/library/${encodeURIComponent(id)}`)
  return result.presentation
}

export async function createSavedPresentation({ name, presentation }) {
  const result = await accountRequest('/library', {
    method: 'POST',
    body: JSON.stringify({ name, presentation }),
  })
  return result.presentation
}

export async function updateSavedPresentation(id, { name, presentation }) {
  const result = await accountRequest(`/library/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ name, presentation }),
  })
  return result.presentation
}

export async function renameSavedPresentation(id, name) {
  const result = await accountRequest(`/library/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
  return result.presentation
}

export function deleteSavedPresentation(id) {
  return accountRequest(`/library/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
