import 'server-only'
import { google, youtube_v3 } from 'googleapis'

let cached: youtube_v3.Youtube | null = null

/**
 * YouTube Data API v3 singleton (read-only, API key auth).
 * Used for channel ID resolution and video listing.
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
 * List videos published in the last 12 months from a channel's uploads playlist.
 * Uploads playlist ID derived from channel ID via UC→UU prefix swap (verified pattern).
 * Quota cost: 1 unit per page of 50 videos. Stops paging when a video older than 12 months is seen.
 * RESEARCH Pattern 4.
 */
export async function listVideosLast12Months(channelId: string): Promise<VideoItem[]> {
  const yt = getYouTubeClient()
  const uploadsPlaylistId = channelId.replace(/^UC/, 'UU')

  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)

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
