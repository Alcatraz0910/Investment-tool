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
  const quantity = formData.get('quantity') as string | null
  const currentValue = formData.get('currentValue') as string | null
  const category = formData.get('category') as AssetCategory | null

  if (!ticker || ticker.length > 20) return { error: 'Ticker is required.' }
  if (!quantity || parseFloat(quantity) < 0) return { error: 'Quantity is required.' }
  if (!currentValue || parseFloat(currentValue) <= 0) return { error: 'Enter a valid amount greater than £0.' }
  if (!category) return { error: 'Category is required.' }

  const { error } = await supabase.from('holdings')
    .update({ ticker, category, quantity, current_value: currentValue, updated_at: new Date().toISOString() })
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
