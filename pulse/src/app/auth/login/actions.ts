'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signIn(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Client-side guard: prevent empty submissions reaching Supabase
  if (!email) return { error: 'Email address is required.' }
  if (!password) return { error: 'Password is required.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Map Supabase error codes to user-safe copy per UI-SPEC copywriting contract
    if (
      error.message.toLowerCase().includes('invalid login credentials') ||
      error.message.toLowerCase().includes('invalid credentials')
    ) {
      return { error: 'Incorrect email or password. Try again.' }
    }
    return { error: 'Something went wrong. Please try again.' }
  }

  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
