'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signIn(formData: FormData): Promise<void> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Basic guard — HTML required attributes provide first line of defence;
  // server action validates before touching Supabase (T-1-06)
  if (!email || !password) {
    redirect('/auth/login?error=missing_fields')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Map Supabase error codes to user-safe copy per UI-SPEC copywriting contract
    if (
      error.message.toLowerCase().includes('invalid login credentials') ||
      error.message.toLowerCase().includes('invalid credentials')
    ) {
      redirect('/auth/login?error=invalid_credentials')
    }
    redirect('/auth/login?error=unknown')
  }

  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
