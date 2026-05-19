import { describe, it } from 'vitest'
// formatSubscriberCount will be importable after Wave 3 adds it to creator-actions.ts
// or as an exported helper from a shared location.

// SRCH-02: Subscriber count formatting
describe('formatSubscriberCount', () => {
  it.todo('formats 1_200_000 as "1.2M subscribers"')
  it.todo('formats 500_000 as "500K subscribers"')
  it.todo('formats 12_345 as "12K subscribers"')
  it.todo('formats 999 as "999 subscribers"')
  it.todo('returns empty string for null input')
})
