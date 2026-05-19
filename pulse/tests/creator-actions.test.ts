import { describe, it, expect } from 'vitest'

// Extract and test the channelId validation regex in isolation.
// This mirrors the guard in trackSearchedCreator.
const CHANNEL_ID_REGEX = /^UC[A-Za-z0-9_-]{22}$/

describe('trackSearchedCreator — channelId validation regex', () => {
  it('accepts a valid UC channel ID (24 chars total)', () => {
    // 'UC' + 22 alphanumeric/dash/underscore chars = 24 chars total
    expect(CHANNEL_ID_REGEX.test('UCxxxxxxxxxxxxxxxxxxxxxx')).toBe(true)
    expect(CHANNEL_ID_REGEX.test('UCabcdefghijklmnopqrstuv')).toBe(true)
    expect(CHANNEL_ID_REGEX.test('UC_A-Zabcdefghijklmnopqr')).toBe(true)
  })

  it('rejects a channelId that does not start with UC', () => {
    expect(CHANNEL_ID_REGEX.test('UBxxxxxxxxxxxxxxxxxxxxxx')).toBe(false)
    expect(CHANNEL_ID_REGEX.test('xxxxxxxxxxxxxxxxxxxxxxxxxxxx')).toBe(false)
  })

  it('rejects a channelId that is too short', () => {
    expect(CHANNEL_ID_REGEX.test('UCshort')).toBe(false)
    expect(CHANNEL_ID_REGEX.test('UC')).toBe(false)
  })

  it('rejects a channelId that is too long', () => {
    // 'UC' + 23 chars = 25 total — too long
    expect(CHANNEL_ID_REGEX.test('UCxxxxxxxxxxxxxxxxxxxxxxx')).toBe(false)
  })

  it('rejects an empty channelId', () => {
    expect(CHANNEL_ID_REGEX.test('')).toBe(false)
  })

  it('rejects a channelId with special characters outside [A-Za-z0-9_-]', () => {
    // Contains + and / (base64 chars but not allowed)
    expect(CHANNEL_ID_REGEX.test('UCxxxxxxxxxxxxxxxxxxxxx+')).toBe(false)
    expect(CHANNEL_ID_REGEX.test('UCxxxxxxxxxxxxxxxxxxxxx/')).toBe(false)
    expect(CHANNEL_ID_REGEX.test('UCxxxxxxxxxxxxxxxxxxxxx!')).toBe(false)
  })
})
