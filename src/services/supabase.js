import { createClient } from '@supabase/supabase-js'

const env = import.meta.env || {}
const supabaseUrl = env.VITE_SUPABASE_URL || ''
const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || ''

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function getSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
  }
  return supabase
}
