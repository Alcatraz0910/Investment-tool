import { describe, it } from 'vitest'

// CI-02: Two-call extraction pattern
describe('extractCreatorStrategy — two-call pattern', () => {
  it.todo('calls Claude twice when 30-day chunks exist (stable + latest)')
  it.todo('calls Claude once when 30-day chunks are empty (stable only)')
  it.todo('sets profile_latest = null when latestChunks.length === 0 (D-09)')
  it.todo('does NOT call Claude when stableChunks.length === 0 — throws instead')
  it.todo('stable call uses published_at >= (now - 4 months) filter')
  it.todo('latest call uses published_at >= (now - 30 days) filter')
  it.todo('stable call fires before latest call (sequential, not Promise.all)')
})

// CI-02: DB insert shape
describe('extractCreatorStrategy — DB insert', () => {
  it.todo('inserts profile_stable as JSONB (not null) after successful stable extraction')
  it.todo('inserts profile_latest as JSONB when 30-day chunks exist')
  it.todo('inserts profile_latest as null when 30-day chunks are empty')
  it.todo('inserts allocation = null (old column unused by new extraction path)')
})
