import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/login/actions'
import type { UserProfile, Holding, Creator, ISAContribution, Transcript, CreatorStrategy, UserCreator, UserCreatorCategoryWeight } from '@/types'
import { Decimal } from '@/types'
import { PortfolioTab } from '@/components/PortfolioTab'
import { CreatorsTab } from '@/app/dashboard/creators-tab'
import { getCurrentTaxYear } from '@/lib/tax-year'
import { blendStrategies } from '@/lib/strategy/blender'
import type { BlendedStrategy, BlendInput } from '@/lib/strategy/blender'
import { BlendSummary } from '@/app/dashboard/components/BlendSummary'
import { generatePlan } from '@/lib/plan/generator'
import { upsertBuyList } from '@/app/dashboard/plan-actions'
import { PlanTab } from '@/app/dashboard/components/PlanTab'
import { AnimatedTabPanel } from '@/app/dashboard/components/AnimatedTabPanel'
import { GettingStartedGuide } from '@/components/GettingStartedGuide'
import { ISATab } from '@/app/dashboard/isa-tab'

export const metadata: Metadata = {
  title: 'Dashboard — Pulse',
}

type Tab = 'portfolio' | 'isa' | 'plan'

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
  const activeTab: Tab = ['portfolio', 'isa', 'plan'].includes(rawTab)
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

  // Fetch holdings — always fetched (plan generation needs holdings regardless of active tab)
  let holdings: Holding[] = []
  const { data: rows } = await supabase
    .from('holdings')
    .select('id, user_id, ticker, name, category, quantity, current_value, is_fill_ticker, created_at, updated_at')
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
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }))

  // Fetch ISA contributions for current tax year — always fetched (plan needs isaRemaining)
  let contributions: ISAContribution[] = []
  const currentTaxYear = getCurrentTaxYear()

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

  // Always-on counts for the Getting Started guide
  const { count: trackedCreatorCount, data: ucGuideRows } = await supabase
    .from('user_creators')
    .select('creator_id, last_refreshed_at', { count: 'exact' })
    .eq('user_id', user.id)
  // A creator has a strategy if it has ever been refreshed (last_refreshed_at is set during refresh)
  const hasAnyStrategy = (ucGuideRows ?? []).some(r => r.last_refreshed_at !== null)

  // Fetch creators, tracked IDs, last_refreshed_at, and transcripts (only if Creators tab)
  let creators: Creator[] = []
  let lastRefreshedMap = new Map<string, Date | null>()
  let transcriptsByCreator = new Map<string, Transcript[]>()
  let strategiesByCreator = new Map<string, CreatorStrategy | null>()
  let userCreatorMap = new Map<string, UserCreator>()
  let blend: BlendedStrategy | null = null
  let creatorNameMap: Record<string, string> = {}

  if (activeTab === 'plan') {
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

    if (trackedIds.length > 0) {
      // Fetch latest strategy per creator (ORDER BY created_at DESC; take first per creator)
      const { data: stratRows } = await supabase
        .from('creator_strategies')
        .select('id, creator_id, allocation, confidence, source_video_ids, has_contradiction, contradiction_note, extracted_at, created_at')
        .in('creator_id', trackedIds)
        .order('created_at', { ascending: false })

      // Group by creator_id, keep only the latest (first row after desc ordering)
      const seenCreators = new Set<string>()
      for (const row of stratRows ?? []) {
        const cid = row.creator_id as string
        if (!seenCreators.has(cid)) {
          seenCreators.add(cid)
          strategiesByCreator.set(cid, {
            id: row.id as string,
            creatorId: cid,
            allocation: row.allocation ?? {},
            confidence: row.confidence as number,
            sourceVideoIds: (row.source_video_ids as string[]) ?? [],
            hasContradiction: row.has_contradiction as boolean,
            contradictionNote: (row.contradiction_note as string | null) ?? null,
            extractedAt: new Date(row.extracted_at as string),
            createdAt: new Date(row.created_at as string),
          })
        }
      }
      // Ensure all tracked creators have an entry (null = no strategy yet)
      for (const cid of trackedIds) {
        if (!strategiesByCreator.has(cid)) strategiesByCreator.set(cid, null)
      }

      // Fetch UserCreator rows with category weights
      const { data: ucRows } = await supabase
        .from('user_creators')
        .select('id, creator_id, trust_weight')
        .eq('user_id', user.id)
        .in('creator_id', trackedIds)

      const ucIds = (ucRows ?? []).map((r) => r.id as string)
      let catWeightRows: Array<{ user_creator_id: string; category: string; weight: number; created_at: string; updated_at: string }> = []

      if (ucIds.length > 0) {
        const { data: cwRows } = await supabase
          .from('user_creator_category_weights')
          .select('user_creator_id, category, weight, created_at, updated_at')
          .in('user_creator_id', ucIds)
        catWeightRows = (cwRows ?? []) as typeof catWeightRows
      }

      for (const uc of ucRows ?? []) {
        const cid = uc.creator_id as string
        const ucId = uc.id as string
        const catWeights = catWeightRows
          .filter((cw) => cw.user_creator_id === ucId)
          .map((cw): UserCreatorCategoryWeight => ({
            id: `${ucId}-${cw.category}`,
            userCreatorId: ucId,
            category: cw.category as import('@/types').AssetCategory,
            weight: Number(cw.weight),
            createdAt: new Date(cw.created_at),
            updatedAt: new Date(cw.updated_at),
          }))

        userCreatorMap.set(cid, {
          id: ucId,
          userId: user.id,
          creatorId: cid,
          trustWeight: Number(uc.trust_weight ?? 50),
          lastRefreshedAt: lastRefreshedMap.get(cid) ?? null,
          createdAt: new Date(),
          categoryWeights: catWeights,
        })
      }

      // Build creator name map for BlendSummary
      creatorNameMap = Object.fromEntries(
        creators.map((c) => [c.id, c.displayName])
      )

      // Compute blend (BLEND-02/03)
      const blendInput: BlendInput = {
        creators: trackedIds.map((cid) => ({
          userCreator: userCreatorMap.get(cid) ?? {
            id: '',
            userId: user.id,
            creatorId: cid,
            trustWeight: 50,
            lastRefreshedAt: null,
            createdAt: new Date(),
            categoryWeights: [],
          },
          latestStrategy: strategiesByCreator.get(cid) ?? null,
        })),
      }
      if (blendInput.creators.length > 0) {
        blend = blendStrategies(blendInput)
      }
    }
  }

  // Serialize Decimal fields at the RSC→client boundary (Next.js 15 requirement:
  // class instances like Decimal cannot cross the server/client boundary).
  const holdingsPlain = holdings.map(h => ({
    ...h,
    currentValue: h.currentValue.toNumber(),
    quantity: h.quantity.toNumber(),
  }))

  // Server-side plan generation (D-05: auto-generate on page load)
  const monthlyBudgetNumber = profile?.monthlyBudget.toNumber() ?? 500   // D-11: fallback to 500
  const profilePlain = profile ? { ...profile, monthlyBudget: monthlyBudgetNumber } : null
  const totalContributed = contributions.reduce(
    (sum, c) => sum.plus(c.amount),
    new Decimal(0),
  )
  const ISA_ANNUAL_LIMIT = new Decimal(20000)
  const isaRemaining = Decimal.max(ISA_ANNUAL_LIMIT.minus(totalContributed), new Decimal(0))
  const isaRemainingNumber = isaRemaining.toNumber()

  const serverPlanResult = generatePlan(
    holdingsPlain,
    monthlyBudgetNumber,
    blend,
    isaRemainingNumber,
  )

  // Persist plan (D-07: always overwrite) — fire and forget (non-blocking)
  upsertBuyList(serverPlanResult).catch((err) =>
    console.error('[DashboardPage] upsertBuyList failed:', err)
  )

  const tabs: { id: Tab; label: string }[] = [
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'isa', label: 'ISA' },
    { id: 'plan', label: 'Plan' },
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
              className="px-4 py-2 min-h-[44px] border border-accent/40 rounded-md text-sm font-medium text-accent hover:bg-accent/10 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent flex items-center"
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
              {activeTab === 'isa' && (
                <ISATab
                  contributions={contributions}
                  currentTaxYear={currentTaxYear}
                />
              )}
              {activeTab === 'plan' && (
                <PlanTab
                  portfolio={holdingsPlain}
                  strategy={blend}
                  isaRemaining={isaRemainingNumber}
                  initialBudget={monthlyBudgetNumber}
                />
              )}
            </AnimatedTabPanel>
          </div>
        </div>
      </div>
    </main>
  )
}
