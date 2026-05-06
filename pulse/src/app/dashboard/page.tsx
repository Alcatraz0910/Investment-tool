import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/login/actions'

export const metadata: Metadata = {
  title: 'Dashboard — Pulse',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware should catch this, but defence-in-depth: redirect if no user
  if (!user) {
    redirect('/auth/login')
  }

  return (
    <main className="min-h-screen bg-zinc-900 px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
            <p className="text-base text-zinc-400 mt-1">Welcome, {user.email}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="px-4 py-2 min-h-[44px] border border-zinc-700 rounded-md text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              Sign out
            </button>
          </form>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-8">
          <p className="text-zinc-400 text-base">
            Phase 1 placeholder. Portfolio features coming in Phase 2.
          </p>
        </div>
      </div>
    </main>
  )
}
