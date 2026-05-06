import { Metadata } from 'next'
import Link from 'next/link'
import { signIn } from './actions'

export const metadata: Metadata = {
  title: 'Sign In — Pulse',
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: 'Email address and password are required.',
  invalid_credentials: 'Incorrect email or password. Try again.',
  unknown: 'Something went wrong. Please try again.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const errorMessage = params.error ? (ERROR_MESSAGES[params.error] ?? ERROR_MESSAGES.unknown) : null

  return (
    <main className="min-h-screen bg-zinc-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-zinc-800 border border-zinc-700 rounded-xl p-8">
        <h1 className="text-2xl font-semibold text-white mb-6">Sign in to Pulse</h1>

        <form action={signIn} className="flex flex-col gap-4">
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
              autoComplete="current-password"
              required
              placeholder="••••••••"
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
            Sign in
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-400 text-center">
          Don&apos;t have an account?{' '}
          <Link
            href="/auth/signup"
            className="text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-sm"
          >
            Create one
          </Link>
        </p>
      </div>
    </main>
  )
}
