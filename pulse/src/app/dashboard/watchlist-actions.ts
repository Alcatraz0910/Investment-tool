'use server'

import { createClient } from '@/lib/supabase/server'

type ActionResult = { success: true } | { success: false; error: string }

export async function saveCreatorMonthlyBudget(
  userCreatorId: string,
  budgetGbp: number
): Promise<ActionResult> {
  // Validate range — server-side guard (WL-03)
  if (budgetGbp < 0) {
    return { success: false, error: 'Budget must be £0 or more' }
  }
  if (budgetGbp > 20000) {
    return { success: false, error: 'Budget cannot exceed £20,000' }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Not authenticated' }

  // IDOR protection: verify userCreatorId belongs to the requesting user (T-12-02)
  const { data: uc } = await supabase
    .from('user_creators')
    .select('id')
    .eq('id', userCreatorId)
    .eq('user_id', user.id)
    .single()
  if (!uc) return { success: false, error: 'Not found' }

  const { error } = await supabase
    .from('user_creators')
    .update({ monthly_budget_gbp: budgetGbp })
    .eq('id', userCreatorId)
  if (error) return { success: false, error: error.message }

  return { success: true }
}
