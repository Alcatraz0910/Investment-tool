import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/login/actions'
import type { UserProfile, Holding, Creator, ISAContribution, Transcript } from '@/types'
import { Decimal } from '@/types'
import { PortfolioTab } from '@/components/PortfolioTab'
import { CreatorsTab } from '@/app/dashboard/creators-tab'
import { ISATab } from '@/app/dashboard/isa-tab'
import { getCurrentTaxYear } from '@/lib/tax-year'

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

  // Fetch ISA contributions for current tax year (only if ISA tab)
  let contributions: ISAContribution[] = []
  const currentTaxYear = getCurrentTaxYear()

  if (activeTab === 'isa') {
    const { data: contribRows } = await supabase
      .from('isa_contributions')
      .select('id, user_id, amount, contribution_date, tax_year, notes, created_at')
      .eq('user_id', user.id)
      .eq('tax_year', currentTaxYear)
      .order('contribution_date', { ascending: false })

    contributions = (contribRows ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      amount: new Decimal(row.amount),
      contributionDate: new Date(row.contribution_date),
      taxYear: row.tax_year,
      notes: row.notes ?? null,
      createdAt: new Date(row.created_at),
    }))
  }

  // Fetch creators, tracked IDs, last_refreshed_at, and transcripts (only if Creators tab)
  let creators: Creator[] = []
  let lastRefreshedMap = new Map<string, Date | null>()
  let transcriptsByCreator = new Map<string, Transcript[]>()

  if (activeTab === 'creators') {
    const [{ data: creatorRows }, { data: trackRows }] = await Promise.all([
      supabase.from('creators').select('*').eq('is_active', true).order('display_name'),
      supabase.from('user_creators').select('creator_id, last_refreshed_at').eq('user_id', user.id),
    ])

    creators = (creatorRows ?? []).map((row) => ({
      id: row.id,
      channelUrl: row.channel_url,
      displayName: row.display_name,
      channelId: row.channel_id ?? null,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }))

    lastRefreshedMap = new Map<string, Date | null>(
      (trackRows ?? []).map((r) => [
        r.creator_id as string,
        r.last_refreshed_at ? new Date(r.last_refreshed_at as string) : null,
      ]),
    )

    const trackedIds = Array.from(lastRefreshedMap.keys())
    if (trackedIds.length > 0) {
      const { data: transcriptRows } = await supabase
        .from('transcripts')
        .select('id, creator_id, video_id, title, published_at, raw_text, word_count, is_embedded, last_fetched, created_at, updated_at')
        .in('creator_id', trackedIds)
        .order('published_at', { ascending: false })

      const all: Transcript[] = (transcriptRows ?? []).map((row) => ({
        id: row.id as string,
        creatorId: row.creator_id as string,
        videoId: row.video_id as string,
        title: row.title as string,
        publishedAt: new Date(row.published_at as string),
        rawText: (row.raw_text as string | null) ?? null,
        wordCount: (row.word_count as number | null) ?? null,
        isEmbedded: row.is_embedded as boolean,
        lastFetched: row.last_fetched ? new Date(row.last_fetched as string) : null,
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
      }))

      transcriptsByCreator = all.reduce((acc, t) => {
        const list = acc.get(t.creatorId) ?? []
        list.push(t)
        acc.set(t.creatorId, list)
        return acc
      }, new Map<string, Transcript[]>())
    }
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
              <CreatorsTab
                creators={creators}
                initialTracked={Array.from(lastRefreshedMap.keys())}
                lastRefreshedMap={lastRefreshedMap}
                transcriptsByCreator={transcriptsByCreator}
              />
            )}
            {activeTab === 'isa' && (
              <ISATab contributions={contributions} currentTaxYear={currentTaxYear} />
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
