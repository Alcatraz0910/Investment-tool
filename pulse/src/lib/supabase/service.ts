import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client — bypasses RLS.
 * Use ONLY for operations that require service-role access (e.g. inserting into creators).
 * Never expose this client to the browser.
 * Requires SUPABASE_SERVICE_ROLE_KEY env var (server-side only — never prefix with NEXT_PUBLIC_).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Add it to .env.local to enable custom creator creation. ' +
      'Find it in Supabase Dashboard → Settings → API → service_role key.'
    )
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}
