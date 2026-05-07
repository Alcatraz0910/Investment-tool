import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/login/actions'
import type { UserProfile, Holding } from '@/types'
import { Decimal } from '@/types'
import { PortfolioTab } from '@/components/PortfolioTab'

export const metadata: Metadata = {
  title: 'Dashboard — Pulse',
}

type Tab = 'portfolio' | 'creators' | 'isa'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const params = await searchParams
  const rawTab = params.tab ?? 'portfolio'
  const activeTab: Tab = ['portfolio', 'creators', 'isa'].includes(rawTab)
    ? (rawTab as Tab)
    : 'portfolio'

  // Fetch user profile (monthly_budget)
  const { data: profileRow } = await supabase
    .from('users')
    .select('id, email, monthly_budget, created_at, updated_at')
    .eq('id', user.id)
    .single()

  const profile: UserProfile | null = profileRow
    ? {
        id: profileRow.id,
        email: profileRow.email,
        monthlyBudget: new Decimal(profileRow.monthly_budget ?? 0),
        createdAt: new Date(profileRow.created_at),
        updatedAt: new Date(profileRow.updated_at),
      }
    : null

  // Fetch holdings (only if Portfolio tab)
  let holdings: Holding[] = []
  if (activeTab === 'portfolio') {
    const { data: rows } = await supabase
      .from('holdings')
      .select('id, user_id, ticker, category, quantity, current_value, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    holdings = (rows ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      ticker: row.ticker,
      category: row.category,
      quantity: new Decimal(row.quantity),
      currentValue: new Decimal(row.current_value),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }))
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'creators', label: 'Creators' },
    { id: 'isa', label: 'ISA' },
  ]

  return (
    <main className="min-h-screen bg-zinc-900 px-6 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
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

        {/* Content card */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl">
          {/* Tab bar */}
          <div className="border-b border-zinc-700 mb-0">
            <nav className="flex px-8 pt-6" aria-label="Dashboard tabs">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <a
                    key={tab.id}
                    href={`?tab=${tab.id}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={
                      isActive
                        ? 'px-4 py-2 text-sm font-semibold text-white border-b-2 border-indigo-500 -mb-px focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-t-sm'
                        : 'px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-t-sm'
                    }
                  >
                    {tab.label}
                  </a>
                )
              })}
            </nav>
          </div>

          {/* Tab panels */}
          <div className="p-8 pt-6">
            {activeTab === 'portfolio' && (
              <PortfolioTab
                profile={profile}
                holdings={holdings}
              />
            )}
            {activeTab === 'creators' && (
              <p className="text-zinc-400 text-sm">Creator management coming in this phase.</p>
            )}
            {activeTab === 'isa' && (
              <p className="text-zinc-400 text-sm">ISA tracker coming in this phase.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
