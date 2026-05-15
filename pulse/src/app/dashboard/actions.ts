'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { AssetCategory } from '@/types'

// Return type for all mutation actions
type ActionResult = { error?: string }

export async function addHolding(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const ticker = (formData.get('ticker') as string | null)?.trim().toUpperCase() ?? ''
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const quantity = formData.get('quantity') as string | null
  const currentValue = formData.get('currentValue') as string | null
  const category = formData.get('category') as AssetCategory | null

  // Validate
  if (!ticker || ticker.length > 20) return { error: 'Ticker is required.' }
  if (!quantity || parseFloat(quantity) < 0) return { error: 'Quantity is required.' }
  if (!currentValue || parseFloat(currentValue) <= 0) return { error: 'Enter a valid amount greater than £0.' }
  if (!category) return { error: 'Category is required.' }

  const { error } = await supabase.from('holdings').insert({
    user_id: user.id,
    ticker,
    name: name || null,
    category,
    quantity: quantity,
    current_value: currentValue,
  })

  if (error) return { error: 'Something went wrong. Please try again.' }
  revalidatePath('/dashboard')
  return {}
}

export async function updateHolding(holdingId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const ticker = (formData.get('ticker') as string | null)?.trim().toUpperCase() ?? ''
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const quantity = formData.get('quantity') as string | null
  const currentValue = formData.get('currentValue') as string | null
  const category = formData.get('category') as AssetCategory | null

  if (!ticker || ticker.length > 20) return { error: 'Ticker is required.' }
  if (!quantity || parseFloat(quantity) < 0) return { error: 'Quantity is required.' }
  if (!currentValue || parseFloat(currentValue) <= 0) return { error: 'Enter a valid amount greater than £0.' }
  if (!category) return { error: 'Category is required.' }

  const { error } = await supabase.from('holdings')
    .update({ ticker, name: name || null, category, quantity, current_value: currentValue, updated_at: new Date().toISOString() })
    .eq('id', holdingId)
    .eq('user_id', user.id)   // RLS + app-level scope: only update own holdings

  if (error) return { error: 'Something went wrong. Please try again.' }
  revalidatePath('/dashboard')
  return {}
}

export async function deleteHolding(holdingId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const { error } = await supabase.from('holdings')
    .delete()
    .eq('id', holdingId)
    .eq('user_id', user.id)   // app-level scope defence-in-depth (RLS also enforces)

  if (error) return { error: 'Something went wrong. Please try again.' }
  revalidatePath('/dashboard')
  return {}
}

// ---------------------------------------------------------------------------
// importHoldings — bulk import from CSV upload (Phase 7, CSV-05)
// ---------------------------------------------------------------------------

export type ImportRow = {
  ticker: string        // sanitised by client (uppercase, no .L suffix)
  name: string          // display name from CSV name column, or empty string
  quantity: string      // raw string from PapaParse — stored as-is
  value: string         // £ string at 2dp — GBX already converted client-side
  category: AssetCategory  // default 'Stocks' if no category column
}

export type ImportResult = {
  error?: string
  imported?: number
  skipped?: number
}

/**
 * Bulk-imports holdings from a CSV upload.
 * merge: SELECT existing → UPDATE matched (quantity+currentValue only, D-07) → INSERT new
 * replace: DELETE all holdings for user → INSERT all valid rows
 * Invalid rows (empty ticker, non-numeric quantity/value) are pre-filtered client-side
 * and must NOT appear in rows[]. Server validates count > 0 only.
 */
export async function importHoldings(
  rows: ImportRow[],
  mode: 'merge' | 'replace'
): Promise<ImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  // Only import rows the client classified as valid (status === 'valid' or 'duplicate')
  const validRows = rows.filter(r => r.ticker && r.quantity && r.value)
  if (validRows.length === 0) return { error: 'No valid rows to import.' }

  if (mode === 'replace') {
    // Delete all current holdings for this user, then insert all valid rows
    const { error: delErr } = await supabase
      .from('holdings')
      .delete()
      .eq('user_id', user.id)
    if (delErr) return { error: 'Something went wrong. Please try again.' }

    const { error: insErr } = await supabase
      .from('holdings')
      .insert(
        validRows.map(r => ({
          user_id: user.id,
          ticker: r.ticker,
          name: r.name || null,
          quantity: r.quantity,
          current_value: r.value,
          category: r.category,
        }))
      )
    if (insErr) return { error: 'Something went wrong. Please try again.' }
  } else {
    // merge: SELECT existing → build ticker→id map → UPDATE matched, INSERT new
    const { data: existing, error: fetchErr } = await supabase
      .from('holdings')
      .select('id, ticker')
      .eq('user_id', user.id)
    if (fetchErr) return { error: 'Something went wrong. Please try again.' }

    const existingMap = new Map<string, string>(
      (existing ?? []).map(h => [h.ticker as string, h.id as string])
    )

    for (const row of validRows) {
      const existingId = existingMap.get(row.ticker)
      if (existingId) {
        // UPDATE quantity + current_value only — preserve isFillTicker and category (D-07)
        const { error: updErr } = await supabase
          .from('holdings')
          .update({
            quantity: row.quantity,
            current_value: row.value,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId)
          .eq('user_id', user.id)
        if (updErr) return { error: 'Something went wrong. Please try again.' }
      } else {
        // INSERT new holding
        const { error: insErr } = await supabase
          .from('holdings')
          .insert({
            user_id: user.id,
            ticker: row.ticker,
            name: row.name || null,
            quantity: row.quantity,
            current_value: row.value,
            category: row.category,
          })
        if (insErr) return { error: 'Something went wrong. Please try again.' }
      }
    }
  }

  revalidatePath('/dashboard')
  return { imported: validRows.length, skipped: rows.length - validRows.length }
}

export async function updateMonthlyBudget(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const rawAmount = formData.get('monthlyBudget') as string | null
  const amount = rawAmount ? parseFloat(rawAmount) : -1
  if (isNaN(amount) || amount < 0) return { error: 'Enter a valid amount greater than £0.' }

  const { error } = await supabase.from('users')
    .update({ monthly_budget: amount, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: 'Something went wrong. Please try again.' }
  revalidatePath('/dashboard')
  return {}
}

/**
 * Auto-save trust weight from slider release (D-10).
 * category = null  → global weight → UPDATE user_creators.trust_weight
 * category = 'Tech' etc → per-category → UPSERT user_creator_category_weights
 *
 * Auth: uses createClient() to verify session (user must be logged in).
 * Write: uses createServiceClient() to bypass RLS for the weight update.
 *
 * Pitfall 6 mitigation: upsert is idempotent — rapid slider releases are safe.
 */
export async function saveCreatorWeight({
  userCreatorId,
  category,
  weight,
}: {
  userCreatorId: string
  category: string | null  // null = global; string = per-category (must be AssetCategory value)
  weight: number           // 0–100
}): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  // Validate weight is in 0–100 range (DB CHECK constraint also enforces)
  if (typeof weight !== 'number' || weight < 0 || weight > 100) {
    return { error: 'Weight must be between 0 and 100.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any

  if (category === null) {
    // Global trust weight → user_creators.trust_weight
    // Note: user_creators has no updated_at column — update trust_weight only
    const { error } = await svc
      .from('user_creators')
      .update({ trust_weight: weight })
      .eq('id', userCreatorId)

    if (error) return { error: 'Something went wrong. Please try again.' }
  } else {
    // Per-category override → user_creator_category_weights (upsert)
    const { error } = await svc
      .from('user_creator_category_weights')
      .upsert(
        {
          user_creator_id: userCreatorId,
          category,
          weight,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_creator_id,category' },
      )

    if (error) return { error: 'Something went wrong. Please try again.' }
  }

  revalidatePath('/dashboard')
  return {}
}
