import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

let cached: ReturnType<typeof createSupabaseClient> | null = null

/**
 * Service-role Supabase client. Bypasses RLS.
 * Used for writes to: transcripts, refresh_jobs, creators (channel_id), user_creators (last_refreshed_at).
 * D-12 (Phase 3): refresh API Route uses this client to update last_refreshed_at.
 * NEVER import from a Client Component — `import 'server-only'` enforces this at build time.
 */
export function createServiceClient() {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Add it to .env.local. ' +
      'Find it in Supabase Dashboard → Settings → API → service_role key.'
    )
  }

  cached = createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  return cached
}
