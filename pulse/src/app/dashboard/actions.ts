'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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
