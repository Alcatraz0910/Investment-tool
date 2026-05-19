'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { searchChannels, type SearchResult } from '@/lib/youtube/client'

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

type SearchActionResult = { data?: SearchResult[]; error?: string }
type TrackSearchedResult = { error?: string }

/**
 * Search YouTube channels by query string.
 * Validates query is non-empty before calling YouTube API (quota protection — D-19).
 * search.list costs 100 quota units per call; only fires on explicit submit.
 */
export async function searchCreators(query: string): Promise<SearchActionResult> {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  // Quota protection: never call YouTube API with empty query (D-19)
  const trimmed = query.trim()
  if (!trimmed) return { error: 'Please enter a channel name to search.' }

  try {
    const results = await searchChannels(trimmed)
    return { data: results }
  } catch (err) {
    console.error('searchCreators error:', err)
    return { error: 'Search failed. Check your connection and try again.' }
  }
}

/**
 * Track a creator found via YouTube search.
 * Inserts directly into creators with channel_id pre-set (D-18).
 * Bypasses URL validation and channel_id resolution step.
 * channelUrl is constructed server-side from channelId — not user-supplied (security).
 *
 * Security: channelId validated against YouTube UC-format regex before any DB insert.
 */
export async function trackSearchedCreator(
  channelId: string,
  channelTitle: string,
  thumbnailUrl: string | null,
): Promise<TrackSearchedResult> {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  // Security: validate channelId is a legitimate YouTube UC-format ID (T-11-04-02)
  if (!channelId.match(/^UC[A-Za-z0-9_-]{22}$/)) {
    return { error: 'Invalid channel ID.' }
  }

  // channelUrl constructed server-side — never use user-supplied URL (D-18)
  const channelUrl = `https://www.youtube.com/channel/${channelId}`

  // thumbnailUrl accepted but not stored — creators table has no thumbnail_url column yet
  // TODO: Add thumbnail_url column to creators table, then store thumbnailUrl here
  void thumbnailUrl

  // Check if creator already exists
  const { data: existing } = await supabase
    .from('creators')
    .select('id')
    .eq('channel_id', channelId)
    .single()

  let creatorId: string

  if (existing) {
    creatorId = existing.id
  } else {
    // Insert new creator with channel_id pre-set (D-18 — bypasses URL resolution)
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceClient = createServiceClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newCreator, error: insertError } = await (serviceClient as any)
      .from('creators')
      .insert({
        channel_id: channelId,
        channel_url: channelUrl,
        display_name: channelTitle,
        is_active: true,
        // TODO: Add thumbnail_url column to creators table (not in Phase 11 schema)
      })
      .select('id')
      .single()

    if (insertError || !newCreator) {
      return { error: 'Something went wrong. Please try again.' }
    }
    creatorId = (newCreator as { id: string }).id
  }

  // Insert user_creators row
  const { error: trackSearchError } = await supabase.from('user_creators').insert({
    user_id: user.id,
    creator_id: creatorId,
    trust_weight: 100,
  })

  if (trackSearchError && !trackSearchError.message.includes('duplicate key')) {
    return { error: 'Something went wrong. Please try again.' }
  }

  revalidatePath('/dashboard')
  return {}
}
