import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mock refs
// ---------------------------------------------------------------------------

const { mockUpdate, mockSingle, mockCreateClient } = vi.hoisted(() => {
  const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'uc-123' } })
  const mockEqChain = { eq: vi.fn(), single: mockSingle }
  mockEqChain.eq.mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) })

  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })

  const mockCreateClient = vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-uuid-1' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      }),
      update: mockUpdate,
    }),
  })
  return { mockUpdate, mockSingle, mockCreateClient }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))

import { saveCreatorMonthlyBudget } from '@/app/dashboard/watchlist-actions'

const UC_ID = 'user-creator-uuid-1'

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: { id: 'uc-123' } })
  mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-uuid-1' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      }),
      update: mockUpdate,
    }),
  })
})

describe('saveCreatorMonthlyBudget', () => {
  it('returns success when budget is 0', async () => {
    const result = await saveCreatorMonthlyBudget(UC_ID, 0)
    expect(result.success).toBe(true)
  })

  it('returns success when budget is 20000', async () => {
    const result = await saveCreatorMonthlyBudget(UC_ID, 20000)
    expect(result.success).toBe(true)
  })

  it('returns error when budget is negative', async () => {
    const result = await saveCreatorMonthlyBudget(UC_ID, -1)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Budget must be £0 or more')
    }
  })

  it('returns error when budget exceeds 20000', async () => {
    const result = await saveCreatorMonthlyBudget(UC_ID, 20001)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Budget cannot exceed £20,000')
    }
  })

  it('returns error when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn(),
    })
    const result = await saveCreatorMonthlyBudget(UC_ID, 500)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Not authenticated')
    }
  })
})
