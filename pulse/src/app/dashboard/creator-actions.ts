'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type ActionResult = { error?: string }

/** Track a curated creator: insert user_creators row */
export async function trackCreator(creatorId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const { error } = await supabase.from('user_creators').insert({
    user_id: user.id,
    creator_id: creatorId,
    trust_weight: 100,
  })

  // UNIQUE constraint violation means already tracking — treat as success
  if (error && !error.message.includes('duplicate key')) {
    return { error: 'Something went wrong. Please try again.' }
  }

  revalidatePath('/dashboard')
  return {}
}

/** Untrack a creator: hard-delete user_creators row (D-13) */
export async function untrackCreator(creatorId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const { error } = await supabase.from('user_creators')
    .delete()
    .eq('creator_id', creatorId)
    .eq('user_id', user.id)   // defence-in-depth: scope to current user beyond RLS

  if (error) return { error: 'Something went wrong. Please try again.' }

  revalidatePath('/dashboard')
  return {}
}

/**
 * Add a custom creator:
 * 1. Validate URL matches youtube.com pattern
 * 2. Check if channel_url already in creators (SELECT)
 * 3a. If exists: use existing creator_id → insert user_creators (ON CONFLICT DO NOTHING)
 * 3b. If new: insert into creators (service-role bypass via RLS-exempt insert), then insert user_creators
 *
 * Note: The Supabase anon/auth client cannot INSERT into creators (no policy).
 * The workaround for custom creators in v1: use the service role client.
 * If SUPABASE_SERVICE_ROLE_KEY is not set, fall back to returning an error with instructions.
 */
export async function addCustomCreator(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const rawUrl = (formData.get('channelUrl') as string | null)?.trim() ?? ''
  const displayName = (formData.get('displayName') as string | null)?.trim() ?? ''

  // Validate display name
  if (!displayName) return { error: 'Display name is required.' }

  // Validate URL — must contain youtube.com
  const youtubePattern = /^https?:\/\/(www\.)?youtube\.com\//i
  if (!rawUrl || !youtubePattern.test(rawUrl)) {
    return { error: 'Enter a valid YouTube channel URL (e.g. youtube.com/c/channelname).' }
  }

  // Check if creator already exists in curated list
  const { data: existing } = await supabase
    .from('creators')
    .select('id')
    .eq('channel_url', rawUrl)
    .single()

  let creatorId: string

  if (existing) {
    // Creator already in DB — just track it
    creatorId = existing.id
  } else {
    // Need to insert a new creators row
    // creators table has no authenticated INSERT policy — requires service role
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceClient = createServiceClient()

    const { data: newCreator, error: insertError } = await serviceClient
      .from('creators')
      .insert({ channel_url: rawUrl, display_name: displayName, is_active: true })
      .select('id')
      .single()

    if (insertError || !newCreator) {
      return { error: 'Something went wrong. Please try again.' }
    }
    creatorId = newCreator.id
  }

  // Insert user_creators row (ON CONFLICT = already tracking, treat as success)
  const { error: trackError } = await supabase.from('user_creators').insert({
    user_id: user.id,
    creator_id: creatorId,
    trust_weight: 100,
  })

  if (trackError && !trackError.message.includes('duplicate key')) {
    return { error: 'Something went wrong. Please try again.' }
  }

  revalidatePath('/dashboard')
  return {}
}
