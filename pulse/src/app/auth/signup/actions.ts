'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signUp(formData: FormData): Promise<void> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  // Server-side validation guards (T-1-09: confirm-password bypass prevention)
  if (!email) redirect('/auth/signup?error=missing_email')
  if (!password) redirect('/auth/signup?error=missing_password')
  if (password.length < 6) redirect('/auth/signup?error=password_too_short')
  if (password !== confirmPassword) redirect('/auth/signup?error=passwords_mismatch')

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    if (
      error.message.toLowerCase().includes('already registered') ||
      error.message.toLowerCase().includes('already in use') ||
      error.message.toLowerCase().includes('user already')
    ) {
      redirect('/auth/signup?error=email_taken')
    }
    redirect('/auth/signup?error=unknown')
  }

  // Supabase may auto-confirm or send email verification depending on project settings.
  // Redirect to login in both cases — user can log in once confirmed.
  redirect('/auth/login')
}
