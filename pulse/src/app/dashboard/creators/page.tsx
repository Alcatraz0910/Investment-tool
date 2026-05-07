import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Creator, Transcript, CreatorStrategy, UserCreator, UserCreatorCategoryWeight } from '@/types'
import { CreatorsTab } from '@/app/dashboard/creators-tab'
import { BlendSummary } from '@/app/dashboard/components/BlendSummary'
import { blendStrategies } from '@/lib/strategy/blender'
import type { BlendInput } from '@/lib/strategy/blender'

export const metadata: Metadata = { title: 'Creators — Pulse' }

export default async function CreatorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: creatorRows }, { data: trackRows }] = await Promise.all([
    supabase.from('creators').select('*').eq('is_active', true).order('display_name'),
    supabase.from('user_creators').select('creator_id, last_refreshed_at').eq('user_id', user.id),
  ])

  const creators: Creator[] = (creatorRows ?? []).map((row) => ({
    id: row.id, channelUrl: row.channel_url, displayName: row.display_name,
    channelId: row.channel_id ?? null, isActive: row.is_active,
    createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at),
  }))

  const lastRefreshedMap = new Map<string, Date | null>(
    (trackRows ?? []).map((r) => [r.creator_id as string, r.last_refreshed_at ? new Date(r.last_refreshed_at as string) : null])
  )
  const trackedIds = Array.from(lastRefreshedMap.keys())

  let transcriptsByCreator = new Map<string, Transcript[]>()
  let strategiesByCreator = new Map<string, CreatorStrategy | null>()
  let userCreatorMap = new Map<string, UserCreator>()
  let creatorNameMap: Record<string, string> = {}

  if (trackedIds.length > 0) {
    const { data: transcriptRows } = await supabase
      .from('transcripts')
      .select('id, creator_id, video_id, title, published_at, raw_text, word_count, is_embedded, last_fetched, created_at, updated_at')
      .in('creator_id', trackedIds).order('published_at', { ascending: false })

    const all: Transcript[] = (transcriptRows ?? []).map((row) => ({
      id: row.id as string, creatorId: row.creator_id as string, videoId: row.video_id as string,
      title: row.title as string, publishedAt: new Date(row.published_at as string),
      rawText: (row.raw_text as string | null) ?? null, wordCount: (row.word_count as number | null) ?? null,
      isEmbedded: row.is_embedded as boolean, lastFetched: row.last_fetched ? new Date(row.last_fetched as string) : null,
      createdAt: new Date(row.created_at as string), updatedAt: new Date(row.updated_at as string),
    }))
    transcriptsByCreator = all.reduce((acc, t) => {
      acc.set(t.creatorId, [...(acc.get(t.creatorId) ?? []), t]); return acc
    }, new Map<string, Transcript[]>())

    const { data: stratRows } = await supabase
      .from('creator_strategies')
      .select('id, creator_id, allocation, confidence, source_video_ids, has_contradiction, contradiction_note, extracted_at, created_at')
      .in('creator_id', trackedIds).order('created_at', { ascending: false })

    const seen = new Set<string>()
    for (const row of stratRows ?? []) {
      const cid = row.creator_id as string
      if (!seen.has(cid)) {
        seen.add(cid)
        strategiesByCreator.set(cid, {
          id: row.id as string, creatorId: cid, allocation: row.allocation ?? {},
          confidence: row.confidence as number, sourceVideoIds: (row.source_video_ids as string[]) ?? [],
          hasContradiction: row.has_contradiction as boolean,
          contradictionNote: (row.contradiction_note as string | null) ?? null,
          extractedAt: new Date(row.extracted_at as string), createdAt: new Date(row.created_at as string),
        })
      }
    }
    for (const cid of trackedIds) if (!strategiesByCreator.has(cid)) strategiesByCreator.set(cid, null)

    const { data: ucRows } = await supabase
      .from('user_creators').select('id, creator_id, trust_weight')
      .eq('user_id', user.id).in('creator_id', trackedIds)
    const ucIds = (ucRows ?? []).map((r) => r.id as string)
    let catWeightRows: Array<{ user_creator_id: string; category: string; weight: number; created_at: string; updated_at: string }> = []
    if (ucIds.length > 0) {
      const { data: cwRows } = await supabase.from('user_creator_category_weights')
        .select('user_creator_id, category, weight, created_at, updated_at').in('user_creator_id', ucIds)
      catWeightRows = (cwRows ?? []) as typeof catWeightRows
    }
    for (const uc of ucRows ?? []) {
      const cid = uc.creator_id as string, ucId = uc.id as string
      userCreatorMap.set(cid, {
        id: ucId, userId: user.id, creatorId: cid,
        trustWeight: Number(uc.trust_weight ?? 50),
        lastRefreshedAt: lastRefreshedMap.get(cid) ?? null, createdAt: new Date(),
        categoryWeights: catWeightRows.filter(cw => cw.user_creator_id === ucId).map((cw): UserCreatorCategoryWeight => ({
          id: `${ucId}-${cw.category}`, userCreatorId: ucId,
          category: cw.category as import('@/types').AssetCategory, weight: Number(cw.weight),
          createdAt: new Date(cw.created_at), updatedAt: new Date(cw.updated_at),
        })),
      })
    }
    creatorNameMap = Object.fromEntries(creators.map((c) => [c.id, c.displayName]))
  }

  const blendInput: BlendInput = {
    creators: trackedIds.map((cid) => ({
      userCreator: userCreatorMap.get(cid) ?? { id: '', userId: user.id, creatorId: cid, trustWeight: 50, lastRefreshedAt: null, createdAt: new Date(), categoryWeights: [] },
      latestStrategy: strategiesByCreator.get(cid) ?? null,
    })),
  }
  const blend = blendInput.creators.length > 0 ? blendStrategies(blendInput) : null

  return (
    <main className="min-h-screen bg-base px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <a href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300 mb-1 block">← Dashboard</a>
            <h1 className="text-2xl font-semibold text-white">Creators</h1>
            <p className="text-sm text-zinc-400 mt-1">Track creators and extract their investment strategy</p>
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-8">
          <CreatorsTab
            creators={creators}
            initialTracked={trackedIds}
            lastRefreshedMap={lastRefreshedMap}
            transcriptsByCreator={transcriptsByCreator}
            strategiesByCreator={strategiesByCreator}
            userCreatorMap={userCreatorMap}
          />
          <BlendSummary blend={blend} creatorNameMap={creatorNameMap} />
        </div>
      </div>
    </main>
  )
}
