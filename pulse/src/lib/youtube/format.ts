export interface SearchResult {
  channelId: string
  channelTitle: string
  channelUrl: string
  subscriberCount: number | null
  thumbnailUrl: string | null
}

export function formatSubscriberCount(count: number | null): string {
  if (count === null) return ''
  if (count >= 1_000_000) {
    const val = (count / 1_000_000).toFixed(1)
    return `${val.endsWith('.0') ? val.slice(0, -2) : val}M subscribers`
  }
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K subscribers`
  return `${count} subscribers`
}
