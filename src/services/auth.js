import { getSupabase } from './supabase.js'

function publicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'PitchPilot user',
  }
}

function authError(error, fallback) {
  const requestError = new Error(error?.message || fallback)
  requestError.status = error?.status
  return requestError
}

export async function signup({ name, email, password }) {
  const client = getSupabase()
  const redirectBase = typeof window === 'undefined' ? undefined : window.location.origin
  const { data, error } = await client.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { name: name.trim() },
      ...(redirectBase ? { emailRedirectTo: redirectBase } : {}),
    },
  })

  if (error) throw authError(error, 'Unable to create your account')
  return {
    user: publicUser(data.user),
    requiresEmailConfirmation: Boolean(data.user && !data.session),
  }
}

export async function login({ email, password }) {
  const client = getSupabase()
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) throw authError(error, 'Unable to log in')
  return publicUser(data.user)
}

export async function getCurrentUser() {
  const client = getSupabase()
  const { data, error } = await client.auth.getSession()
  if (error) throw authError(error, 'Unable to restore your session')
  return publicUser(data.session?.user)
}

export function onAuthStateChange(callback) {
  const client = getSupabase()
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    callback(publicUser(session?.user))
  })
  return () => data.subscription.unsubscribe()
}

export async function getAccessToken() {
  const client = getSupabase()
  const { data, error } = await client.auth.getSession()
  if (error) throw authError(error, 'Unable to read your session')
  return data.session?.access_token || ''
}

export async function logout() {
  const client = getSupabase()
  const { error } = await client.auth.signOut()
  if (error) throw authError(error, 'Unable to log out')
}
