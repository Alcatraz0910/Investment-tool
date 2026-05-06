import { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signUp } from './actions'

export const metadata: Metadata = {
  title: 'Create Account — Pulse',
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_email: 'Email address is required.',
  missing_password: 'Password is required.',
  password_too_short: 'Password must be at least 6 characters.',
  passwords_mismatch: 'Passwords do not match.',
  email_taken: 'An account with this email already exists. Sign in instead.',
  unknown: 'Something went wrong. Please try again.',
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')
  const params = await searchParams
  const errorMessage = params.error ? (ERROR_MESSAGES[params.error] ?? ERROR_MESSAGES.unknown) : null

  return (
    <main className="min-h-screen bg-zinc-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-zinc-800 border border-zinc-700 rounded-xl p-8">
        <h1 className="text-2xl font-semibold text-white mb-6">Create your account</h1>

        <form action={signUp} className="flex flex-col gap-4">
          {/* Email field */}
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-white">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="w-full px-4 py-3 min-h-[44px] bg-zinc-800 border border-zinc-700 rounded-md text-base text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Password field */}
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-white">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="w-full px-4 py-3 min-h-[44px] bg-zinc-800 border border-zinc-700 rounded-md text-base text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Confirm password field */}
          <div className="flex flex-col gap-1">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-white">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="w-full px-4 py-3 min-h-[44px] bg-zinc-800 border border-zinc-700 rounded-md text-base text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Global error message */}
          {errorMessage && (
            <p
              role="alert"
              aria-live="polite"
              className="text-sm text-red-400"
            >
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            className="mt-2 w-full px-4 py-3 min-h-[44px] bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-base font-semibold text-white rounded-md cursor-pointer transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
          >
            Create account
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-400 text-center">
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-sm"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
