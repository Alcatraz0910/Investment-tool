/**
 * Tests for saveCreatorWeight() — BLEND-01.
 * Mocks: @/lib/supabase/server (auth), @/lib/supabase/service (DB writes).
 *
 * Pattern: vi.hoisted() ensures mocks are available when vi.mock factories run
 * (vi.mock calls are hoisted above variable declarations by vitest's transform).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mock refs — must use vi.hoisted() so they exist when vi.mock runs
// ---------------------------------------------------------------------------

const { mockUpdate, mockUpsert, mockCreateClient } = vi.hoisted(() => {
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })
  const mockUpsert = vi.fn().mockResolvedValue({ error: null })
  const mockCreateClient = vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-uuid-1' } },
      }),
    },
  })
  return { mockUpdate, mockUpsert, mockCreateClient }
})

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (_table: string) => ({
      update: mockUpdate,
      upsert: mockUpsert,
    }),
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { saveCreatorWeight } from './actions'

const UC_ID = 'user-creator-uuid-1'

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdate.mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })
  mockUpsert.mockResolvedValue({ error: null })
  // Reset createClient to default authenticated user
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-uuid-1' } },
      }),
    },
  })
})

describe('saveCreatorWeight (BLEND-01)', () => {
  it('category=null: calls update on user_creators table', async () => {
    await saveCreatorWeight({ userCreatorId: UC_ID, category: null, weight: 75 })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ trust_weight: 75 }),
    )
  })

  it('category="Tech": calls upsert on user_creator_category_weights', async () => {
    await saveCreatorWeight({ userCreatorId: UC_ID, category: 'Tech', weight: 60 })
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_creator_id: UC_ID,
        category: 'Tech',
        weight: 60,
      }),
      expect.objectContaining({ onConflict: 'user_creator_id,category' }),
    )
  })

  it('category="Dividends": upserts with correct category', async () => {
    await saveCreatorWeight({ userCreatorId: UC_ID, category: 'Dividends', weight: 40 })
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Dividends', weight: 40 }),
      expect.anything(),
    )
  })

  it('returns error if no authenticated session', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    })
    const result = await saveCreatorWeight({ userCreatorId: UC_ID, category: null, weight: 50 })
    expect(result.error).toBeDefined()
  })

  it('upsert uses onConflict: user_creator_id,category to avoid duplicates', async () => {
    await saveCreatorWeight({ userCreatorId: UC_ID, category: 'Bonds', weight: 20 })
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ onConflict: 'user_creator_id,category' }),
    )
  })
})
