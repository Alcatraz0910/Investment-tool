import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/login/actions'
import type { UserProfile, Holding } from '@/types'
import { Decimal } from '@/types'
import { PortfolioTab } from '@/components/PortfolioTab'
import { buildWatchLists } from '@/lib/watchlist/generator'
import type { CreatorWatchList } from '@/lib/watchlist/generator'
import { WatchListTab } from '@/app/dashboard/components/WatchListTab'
import { AnimatedTabPanel } from '@/app/dashboard/components/AnimatedTabPanel'
import { GettingStartedGuide } from '@/components/GettingStartedGuide'

export const metadata: Metadata = {
  title: 'Dashboard — Pulse',
}

type Tab = 'portfolio' | 'watchlist'

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
  const activeTab: Tab = ['portfolio', 'watchlist'].includes(rawTab)
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

  // Fetch holdings — always fetched for Portfolio tab
  let holdings: Holding[] = []
  const { data: rows } = await supabase
    .from('holdings')
    .select('id, user_id, ticker, name, category, quantity, current_value, is_fill_ticker, current_price, price_fetched_at, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  holdings = (rows ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    ticker: row.ticker,
    name: row.name ?? undefined,
    category: row.category,
    quantity: new Decimal(row.quantity),
    currentValue: new Decimal(row.current_value),
    isFillTicker: row.is_fill_ticker as boolean,
    currentPrice: row.current_price ? new Decimal(row.current_price) : null,
    priceFetchedAt: row.price_fetched_at ? new Date(row.price_fetched_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }))

  // Always-on counts for the Getting Started guide
  const { count: trackedCreatorCount, data: ucGuideRows } = await supabase
    .from('user_creators')
    .select('creator_id, last_refreshed_at', { count: 'exact' })
    .eq('user_id', user.id)
  const hasAnyStrategy = (ucGuideRows ?? []).some(r => r.last_refreshed_at !== null)

  // ---------------------------------------------------------------------------
  // Watch List tab data
  // ---------------------------------------------------------------------------
  let watchLists: CreatorWatchList[] = []
  let userCreatorIdMap: Record<string, string> = {}

  if (activeTab === 'watchlist') {
    const { data: ucRows } = await supabase
      .from('user_creators')
      .select('id, creator_id, monthly_budget_gbp')
      .eq('user_id', user.id)

    const trackedIds = (ucRows ?? []).map((uc) => uc.creator_id as string)

    const { data: creatorNameRows } = trackedIds.length > 0
      ? await supabase.from('creators').select('id, display_name').in('id', trackedIds)
      : { data: [] }
    const creatorNameMap = Object.fromEntries(
      (creatorNameRows ?? []).map((c) => [c.id as string, c.display_name as string])
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type StratRow = { creator_id: string; profile_stable: any; profile_latest: any }
    const { data: stratRows } = trackedIds.length > 0
      ? await supabase
          .from('creator_strategies')
          .select('creator_id, profile_stable, profile_latest')
          .in('creator_id', trackedIds)
          .order('created_at', { ascending: false })
      : { data: null as StratRow[] | null }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type StratEntry = { creator_id: string; profile_stable: any; profile_latest: any }
    const latestStratByCreator = new Map<string, StratEntry>()
    for (const row of stratRows ?? []) {
      if (!latestStratByCreator.has(row.creator_id as string)) {
        latestStratByCreator.set(row.creator_id as string, row)
      }
    }

    watchLists = buildWatchLists(
      (ucRows ?? []).map((uc) => {
        const strat = latestStratByCreator.get(uc.creator_id as string)
        return {
          creatorId: uc.creator_id as string,
          creatorName: creatorNameMap[uc.creator_id as string] ?? 'Unknown',
          monthlyBudgetGbp: (uc.monthly_budget_gbp as number) ?? 0,
          profileStable: strat?.profile_stable ?? null,
          profileLatest: strat?.profile_latest ?? null,
        }
      })
    )

    userCreatorIdMap = Object.fromEntries(
      (ucRows ?? []).map((uc) => [uc.creator_id as string, uc.id as string])
    )
  }

  // ---------------------------------------------------------------------------
  // Serialize Decimal fields at RSC→client boundary
  // ---------------------------------------------------------------------------
  const holdingsPlain = holdings.map(h => ({
    ...h,
    currentValue: h.currentValue.toNumber(),
    quantity: h.quantity.toNumber(),
    currentPrice: h.currentPrice ? new Decimal(h.currentPrice).toNumber() : null,
    priceFetchedAt: h.priceFetchedAt?.toISOString() ?? null,
  }))

  const monthlyBudgetNumber = profile?.monthlyBudget.toNumber() ?? 500
  const profilePlain = profile ? { ...profile, monthlyBudget: monthlyBudgetNumber } : null

  const tabs: { id: Tab; label: string }[] = [
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'watchlist', label: 'Watch List' },
  ]

  return (
    <main className="min-h-screen bg-base px-6 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
            <p className="text-base text-zinc-400 mt-1">Welcome, {user.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/dashboard/creators"
              className="px-4 py-2 min-h-[44px] inline-flex items-center border border-border rounded-md text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              Creators
            </a>
            <form action={signOut}>
              <button
                type="submit"
                className="px-4 py-2 min-h-[44px] border border-border rounded-md text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/* Getting Started guide — visible until all 4 steps complete */}
        <GettingStartedGuide
          hasHoldings={holdings.length > 0}
          hasFillTicker={holdings.some(h => h.isFillTicker)}
          hasTrackedCreator={(trackedCreatorCount ?? 0) > 0}
          hasStrategy={hasAnyStrategy}
        />

        {/* Content card */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl">
          {/* Tab bar */}
          <div className="border-b border-border mb-0">
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
                        ? 'px-4 py-2 text-sm font-semibold text-accent border-b-2 border-accent -mb-px focus:outline-none focus:ring-2 focus:ring-accent rounded-t-sm'
                        : 'px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent rounded-t-sm'
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
            <AnimatedTabPanel tabKey={activeTab}>
              {activeTab === 'portfolio' && (
                <PortfolioTab
                  profile={profilePlain}
                  holdings={holdingsPlain}
                />
              )}
              {activeTab === 'watchlist' && (
                <WatchListTab
                  initialWatchLists={watchLists}
                  userCreatorIdMap={userCreatorIdMap}
                />
              )}
            </AnimatedTabPanel>
          </div>
        </div>
      </div>
    </main>
  )
}
