'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTaxYearForDate } from '@/lib/tax-year'

type ActionResult = { error?: string }

export async function logContribution(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const rawDate = formData.get('contributionDate') as string | null
  const rawAmount = formData.get('amount') as string | null

  // Validate date
  if (!rawDate) return { error: 'Contribution date is required.' }
  const dateObj = new Date(rawDate)
  if (isNaN(dateObj.getTime())) return { error: 'Contribution date is required.' }

  // Validate amount
  const amount = rawAmount ? parseFloat(rawAmount) : 0
  if (!rawAmount || isNaN(amount) || amount <= 0) {
    return { error: 'Enter a valid amount greater than £0.' }
  }

  // Compute tax year server-side (D-15: 6 April boundary)
  const taxYear = getTaxYearForDate(dateObj)

  const { error } = await supabase.from('isa_contributions').insert({
    user_id: user.id,
    amount: amount.toFixed(2),
    contribution_date: rawDate,   // DATE column: 'YYYY-MM-DD' string
    tax_year: taxYear,
    notes: null,
  })

  if (error) return { error: 'Something went wrong. Please try again.' }
  revalidatePath('/dashboard')
  return {}
}

export async function deleteContribution(contributionId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const { error } = await supabase.from('isa_contributions')
    .delete()
    .eq('id', contributionId)
    .eq('user_id', user.id)   // defence-in-depth: scope to current user beyond RLS

  if (error) return { error: 'Something went wrong. Please try again.' }
  revalidatePath('/dashboard')
  return {}
}
