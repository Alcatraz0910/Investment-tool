import { describe, it } from 'vitest'

// SRCH-01 / Security: channelId validation in trackSearchedCreator
describe('trackSearchedCreator — channelId validation', () => {
  it.todo('accepts a valid UC channel ID matching /^UC[A-Za-z0-9_-]{22}$/')
  it.todo('rejects a channelId that does not start with UC')
  it.todo('rejects a channelId that is too short')
  it.todo('rejects an empty channelId')
  it.todo('rejects a channelId with special characters outside [A-Za-z0-9_-]')
})
