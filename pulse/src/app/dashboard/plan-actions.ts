'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { AssetCategory } from '@/types'
import type { PlanResult } from '@/lib/plan/generator'

// Return type for all mutation actions
type ActionResult = { error?: string }

/**
 * Persists a generated buy list to buy_lists table.
 *
 * Upsert on (user_id, month) — D-07: always overwrite, one plan per user per month.
 * Decimal amounts serialized to strings via .toFixed(2) before JSONB insert (Pitfall 1).
 *
 * Only persists result.type === 'buy-list'. Returns silently for no-strategy / no-fill-tickers.
 */
export async function upsertBuyList(result: PlanResult): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  // Only persist full buy lists — silently ignore non-buy-list states
  if (result.type !== 'buy-list') return {}

  // 'YYYY-MM' format — one plan per user per month
  const month = new Date().toISOString().slice(0, 7)

  // Serialize items before JSONB insert — Decimal is not JSON-serializable (Pitfall 1)
  const serializedItems = result.items.map(item => ({
    ticker: item.ticker,
    category: item.category,
    amount_gbp: item.amountGbp.toFixed(2),       // string, not Decimal
    allocation_gap_pct: item.allocationGapPct,
    rationale: item.rationale,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any

  const { error } = await svc.from('buy_lists').upsert(
    {
      user_id: user.id,
      month,
      budget_gbp: result.effectiveBudget.toFixed(2),   // string, not Decimal
      items: serializedItems,
      unified_allocation: {},   // placeholder — Wave 3 will pass blended strategy
    },
    { onConflict: 'user_id,month' },
  )

  if (error) return { error: 'Something went wrong. Please try again.' }
  revalidatePath('/dashboard')
  return {}
}

/**
 * Marks a holding as the preferred buy target (fill ticker) for its category.
 *
 * D-01: Only one fill ticker per (user_id, category). Enforced by:
 *   1. Partial unique index: holdings_one_fill_ticker_per_category
 *   2. This action: clears old fill ticker first, then sets new one
 *
 * T-05-03-01 mitigation: .eq('user_id', user.id) scopes updates to own holdings.
 */
export async function setFillTicker(holdingId: string, category: AssetCategory): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  if (!holdingId || !category) return { error: 'Something went wrong. Please try again.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any

  // Step 1: Clear any existing fill ticker for this user+category
  // Must run before setting new one to avoid partial unique index violation
  await svc.from('holdings')
    .update({ is_fill_ticker: false, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('category', category)
    .eq('is_fill_ticker', true)

  // Step 2: Set the new fill ticker — scoped to user's own holdings (T-05-03-01)
  const { error } = await svc.from('holdings')
    .update({ is_fill_ticker: true, updated_at: new Date().toISOString() })
    .eq('id', holdingId)
    .eq('user_id', user.id)

  if (error) return { error: 'Something went wrong. Please try again.' }
  revalidatePath('/dashboard')
  return {}
}
