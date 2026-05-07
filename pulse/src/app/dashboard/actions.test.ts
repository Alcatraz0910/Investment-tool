/**
 * Tests for saveCreatorWeight() — covers BLEND-01.
 * Wave 0: stubs only. Wave 1 (plan 04-04) fills in implementations.
 *
 * Mocking approach:
 * - Mock @/lib/supabase/server: createClient returns fake auth session
 * - Mock @/lib/supabase/service: createServiceClient returns fake Supabase client
 */
import { describe, it } from 'vitest'

describe('saveCreatorWeight (BLEND-01)', () => {
  it.todo('category=null: updates user_creators.trust_weight column')
  it.todo('category="Tech": upserts user_creator_category_weights with correct category + weight')
  it.todo('category="Dividends": upserts user_creator_category_weights with correct category + weight')
  it.todo('throws if no authenticated session (unauthorized call)')
  it.todo('upsert uses onConflict: user_creator_id,category to avoid duplicates')
})
