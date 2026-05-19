import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))

// saveCreatorMonthlyBudget is created in Wave 1 (12-02-PLAN.md)
// import { saveCreatorMonthlyBudget } from '@/app/dashboard/watchlist-actions'

describe('saveCreatorMonthlyBudget', () => {
  it.todo('returns success when budget is 0')
  it.todo('returns success when budget is 20000')
  it.todo('returns error when budget is negative')
  it.todo('returns error when budget exceeds 20000')
  it.todo('returns error when user is not authenticated')
})
