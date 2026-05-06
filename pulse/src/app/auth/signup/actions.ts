'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signUp(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  // Server-side validation guards
  if (!email) return { error: 'Email address is required.' }
  if (!password) return { error: 'Password is required.' }
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' }
  if (password !== confirmPassword) return { error: 'Passwords do not match.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    if (
      error.message.toLowerCase().includes('already registered') ||
      error.message.toLowerCase().includes('already in use') ||
      error.message.toLowerCase().includes('user already')
    ) {
      return { error: 'An account with this email already exists. Sign in instead.' }
    }
    return { error: 'Something went wrong. Please try again.' }
  }

  // Supabase may auto-confirm or send email verification depending on project settings.
  // Redirect to login in both cases — user can log in once confirmed.
  redirect('/auth/login')
}
