import { describe, it } from 'vitest'

// CI-01: listVideosLast4Months cutoff
describe('listVideosLast4Months', () => {
  it.todo('returns videos published within the last 4 months only')
  it.todo('does NOT return videos older than 4 months')
  it.todo('cutoff uses setMonth(month - 4) not setFullYear(year - 1)')
})

// SRCH-01: searchChannels returns correct shape
describe('searchChannels', () => {
  it.todo('returns at most 5 results')
  it.todo('each result has channelId, channelTitle, channelUrl, subscriberCount, thumbnailUrl')
  it.todo('channelUrl is constructed as https://www.youtube.com/channel/{channelId}')
  it.todo('returns empty array when YouTube search returns no items')
})
