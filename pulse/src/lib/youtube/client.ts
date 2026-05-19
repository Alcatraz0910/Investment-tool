import 'server-only'
import { google, youtube_v3 } from 'googleapis'

let cached: youtube_v3.Youtube | null = null

/**
 * YouTube Data API v3 singleton (read-only, API key auth).
 * Used for channel ID resolution, video listing, and channel search.
 * RESEARCH Pattern 3 + Pattern 4.
 */
export function getYouTubeClient(): youtube_v3.Youtube {
  if (cached) return cached
  const key = process.env.YOUTUBE_API_KEY
  if (!key) {
    throw new Error(
      'YOUTUBE_API_KEY is not set. ' +
      'Add it to .env.local. ' +
      'Get one from Google Cloud Console → APIs & Services → Credentials → Create API key. ' +
      'Enable "YouTube Data API v3" under APIs & Services → Library.'
    )
  }
  cached = google.youtube({ version: 'v3', auth: key })
  return cached
}

/**
 * Resolve a channel URL to its UC* channel ID.
 * Strategies (in order):
 *   1. /channel/UCxxxx URLs — extract directly, zero quota.
 *   2. /@handle URLs — channels.list?forHandle=@handle (1 quota unit).
 *   3. /c/Custom or /user/Name — channels.list?forUsername=Name (1 quota unit).
 * Returns null if none of the strategies resolve. Caller (pipeline) writes resolved ID
 * back to creators.channel_id via service role per D-13.
 */
export async function resolveChannelId(channelUrl: string): Promise<string | null> {
  // Strategy 1: /channel/UCxxxx
  const channelMatch = channelUrl.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/)
  if (channelMatch) return channelMatch[1]

  const yt = getYouTubeClient()

  // Strategy 2: /@handle
  const handleMatch = channelUrl.match(/youtube\.com\/(@[A-Za-z0-9_.-]+)/)
  if (handleMatch) {
    const res = await yt.channels.list({
      part: ['id'],
      forHandle: handleMatch[1],
    })
    const id = res.data.items?.[0]?.id
    if (id) return id
  }

  // Strategy 3: /c/Name or /user/Name
  const userMatch = channelUrl.match(/youtube\.com\/(?:c|user)\/([A-Za-z0-9_-]+)/)
  if (userMatch) {
    const res = await yt.channels.list({
      part: ['id'],
      forUsername: userMatch[1],
    })
    const id = res.data.items?.[0]?.id
    if (id) return id
  }

  return null
}

export interface VideoItem {
  videoId: string
  title: string
  publishedAt: Date
}

/**
 * List videos published in the last 4 months from a channel's uploads playlist.
 * Uploads playlist ID derived from channel ID via UC→UU prefix swap (verified pattern).
 * Quota cost: 1 unit per page of 50 videos. Stops paging when a video older than 4 months is seen.
 * CI-01: 4-month window replaces previous 12-month window.
 * RESEARCH Pattern 6.
 */
export async function listVideosLast4Months(channelId: string): Promise<VideoItem[]> {
  const yt = getYouTubeClient()
  const uploadsPlaylistId = channelId.replace(/^UC/, 'UU')

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 4)  // 4 months, not 12; JS handles year rollover

  const videos: VideoItem[] = []
  let pageToken: string | undefined = undefined

  do {
    const res: { data: youtube_v3.Schema$PlaylistItemListResponse } = await yt.playlistItems.list({
      part: ['snippet'],
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken,
    })

    let stop = false
    for (const item of res.data.items ?? []) {
      const snippet = item.snippet
      if (!snippet?.publishedAt || !snippet.resourceId?.videoId || !snippet.title) continue
      const publishedAt = new Date(snippet.publishedAt)
      if (publishedAt < cutoff) {
        stop = true
        break
      }
      videos.push({
        videoId: snippet.resourceId.videoId,
        title: snippet.title,
        publishedAt,
      })
    }
    if (stop) break
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  return videos
}

export interface SearchResult {
  channelId: string
  channelTitle: string
  channelUrl: string
  subscriberCount: number | null
  thumbnailUrl: string | null
}

/**
 * Format a raw subscriber count number into a human-readable string.
 * Examples: 1_200_000 → "1.2M subscribers", 500_000 → "500K subscribers",
 *           12_345 → "12K subscribers", 999 → "999 subscribers", null → "".
 * SRCH-02. Used in the UI layer — not included in SearchResult interface (keep raw).
 */
export function formatSubscriberCount(count: number | null): string {
  if (count === null) return ''
  if (count >= 1_000_000) {
    const val = (count / 1_000_000).toFixed(1)
    return `${val.endsWith('.0') ? val.slice(0, -2) : val}M subscribers`
  }
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K subscribers`
  return `${count} subscribers`
}

/**
 * Search YouTube channels by query string.
 * Step 1: search.list (100 quota units) — returns channel metadata without subscriber counts.
 * Step 2: channels.list batch (1 quota unit) — fetches subscriber counts for all result IDs.
 * Returns at most 5 results. Never auto-called; only fires on explicit user submit (D-19).
 * RESEARCH Pattern 4.
 */
export async function searchChannels(query: string): Promise<SearchResult[]> {
  const yt = getYouTubeClient()

  // Step 1: search — 100 quota units
  const searchRes = await yt.search.list({
    part: ['snippet'],
    q: query,
    type: ['channel'],
    maxResults: 5,
  })

  // Use item.snippet.channelId for channel-type search results (not item.id)
  // See RESEARCH.md A2 — verify against real API response if IDs come back empty
  const channelIds = searchRes.data.items
    ?.map(item => item.snippet?.channelId)
    .filter((id): id is string => Boolean(id)) ?? []

  if (channelIds.length === 0) return []

  // Step 2: subscriber counts — 1 quota unit (batch all IDs in one call)
  const statsRes = await yt.channels.list({
    part: ['snippet', 'statistics'],
    id: channelIds,
  })

  const statsMap = new Map(
    statsRes.data.items?.map(item => [
      item.id!,
      item.statistics?.subscriberCount ?? null,
    ]) ?? []
  )

  // Build a Map upfront to avoid O(n) .find() per result
  const searchItemMap = new Map(
    searchRes.data.items?.map(i => [i.snippet?.channelId, i]) ?? []
  )

  return channelIds.map(id => {
    const searchItem = searchItemMap.get(id)
    const rawCount = statsMap.get(id)
    return {
      channelId: id,
      channelTitle: searchItem?.snippet?.channelTitle ?? '',
      channelUrl: `https://www.youtube.com/channel/${id}`,
      subscriberCount: rawCount ? Number(rawCount) : null,
      thumbnailUrl: searchItem?.snippet?.thumbnails?.default?.url ?? null,
    }
  })
}
