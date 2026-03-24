import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _anonClient: SupabaseClient | null = null
let _serviceClient: SupabaseClient | null = null

/** Anon client — only for client-side use (limited by RLS) */
export function getSupabase(): SupabaseClient {
  if (!_anonClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Supabase env vars not set')
    _anonClient = createClient(url, key)
  }
  return _anonClient
}

/** Service role client — for API routes only (bypasses RLS) */
export function getServiceSupabase(): SupabaseClient {
  if (!_serviceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Supabase env vars not set')
    _serviceClient = createClient(url, key)
  }
  return _serviceClient
}
