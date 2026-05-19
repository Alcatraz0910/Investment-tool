/**
 * Phase 3 transcript pipeline orchestrator.
 *
 * runRefreshPipeline(creatorId, userId) drives the full 8-step chain:
 *   1. Mark refresh_jobs row status='running' (upsert by user_id+creator_id)
 *   2. Load creator row (channel_url + channel_id)
 *   3. Resolve channel_id if NULL (D-13) — write back via service role
 *   4. List videos from last 4 months
 *   5. For each video: apply idempotency rules (D-07/08/09/10);
 *      attempt fetchTranscript and upsert transcript row (raw_text or NULL per D-04)
 *   6. For each transcript with raw_text NOT NULL and is_embedded=FALSE:
 *      chunk → embed → upsert vectors → mark is_embedded=TRUE
 *   7. UPDATE user_creators SET last_refreshed_at = NOW (D-12)
 *   8. UPDATE refresh_jobs status='done' with summary
 *
 * On any caught error: refresh_jobs.status='error' with error.message; re-throws to caller.
 * On per-video transcript fetch failure: insert row with raw_text=NULL (D-04) and continue.
 *
 * Design invariants:
 * - All DB writes use createServiceClient() (RLS bypass per D-12)
 * - All transcripts upserts use onConflict: 'video_id' (RESEARCH Pitfall 4)
 * - Sequential transcript fetches — no Promise.all (RESEARCH Anti-Patterns / T-03-04-05)
 * - Pinecone vector IDs: `${videoId}-chunk-${idx}` — deterministic, upsert is idempotent
 * - Pinecone metadata: creator_id, video_id, title, chunk_index, published_at, text
 * - user_creators.last_refreshed_at update scoped to (user_id, creator_id) pair (T-03-04-01)
 *
 * Note on Supabase typing: This project does not have generated Database types (no
 * supabase gen types). All .from() calls are cast via (svc as any) to avoid TS2353/TS2339
 * errors — the same pattern as the pre-existing creator-actions.ts in this codebase.
 */

import { YoutubeTranscript } from 'youtube-transcript'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveChannelId, listVideosLast4Months, type VideoItem } from '@/lib/youtube/client'
import { embedChunks } from '@/lib/openai/client'
import { getPineconeNamespace } from '@/lib/pinecone/client'
import { chunkText } from '@/lib/pipeline/chunker'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

interface TranscriptRow {
  id: string
  creator_id: string
  video_id: string
  title: string
  published_at: string
  raw_text: string | null
  word_count: number | null
  is_embedded: boolean
  last_fetched: string | null
}

export interface PipelineResult {
  summary: string
  fetched: number
  total: number
  pending: number
}

/**
 * Update refresh_jobs.step (and optionally status) for the (userId, creatorId) pair.
 * Always uses upsert with onConflict on the (user_id, creator_id) UNIQUE constraint.
 */
async function setStep(
  svc: AnySupabase,
  userId: string,
  creatorId: string,
  step: string,
  status: 'running' | 'done' | 'error' = 'running',
  extras: { summary?: string; error?: string } = {},
) {
  await svc
    .from('refresh_jobs')
    .upsert(
      {
        user_id: userId,
        creator_id: creatorId,
        status,
        step,
        summary: extras.summary ?? null,
        error: extras.error ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,creator_id' },
    )
}

export async function runRefreshPipeline(
  creatorId: string,
  userId: string,
): Promise<PipelineResult> {
  // Cast to any to bypass missing generated Database types (no supabase gen types in project)
  const svc: AnySupabase = createServiceClient()

  try {
    // Step 1: mark running, reset prior state
    await svc
      .from('refresh_jobs')
      .upsert(
        {
          user_id: userId,
          creator_id: creatorId,
          status: 'running',
          step: 'Resolving channel...',
          summary: null,
          error: null,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,creator_id' },
      )

    // Step 2: load creator row
    const { data: creator, error: cErr } = await svc
      .from('creators')
      .select('id, channel_url, channel_id')
      .eq('id', creatorId)
      .single()
    if (cErr || !creator) {
      throw new Error('Creator not found')
    }

    // Step 3: resolve channel_id if NULL (D-13)
    let channelId = creator.channel_id as string | null
    if (!channelId) {
      channelId = await resolveChannelId(creator.channel_url as string)
      if (!channelId) {
        throw new Error('Could not resolve YouTube channel ID from URL')
      }
      await svc
        .from('creators')
        .update({ channel_id: channelId, updated_at: new Date().toISOString() })
        .eq('id', creatorId)
    }

    // Step 4: list videos from last 4 months
    await setStep(svc, userId, creatorId, 'Fetching videos...')
    const videos: VideoItem[] = await listVideosLast4Months(channelId)
    const total = videos.length

    if (total === 0) {
      const noVideosSummary = 'No videos found in the last 4 months'
      await setStep(svc, userId, creatorId, 'Done', 'done', {
        summary: noVideosSummary,
      })
      await svc
        .from('user_creators')
        .update({ last_refreshed_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('creator_id', creatorId)
      return { summary: noVideosSummary, fetched: 0, total: 0, pending: 0 }
    }

    // Step 5: idempotency-aware transcript ingestion
    // Load existing transcript rows for these video IDs to apply D-07/D-08/D-09/D-10
    const videoIds = videos.map((v) => v.videoId)
    const { data: existingRowsRaw } = await svc
      .from('transcripts')
      .select(
        'id, creator_id, video_id, title, published_at, raw_text, word_count, is_embedded, last_fetched',
      )
      .in('video_id', videoIds)
    const existingRows: TranscriptRow[] = (existingRowsRaw ?? []) as TranscriptRow[]
    const byVideoId = new Map(existingRows.map((r) => [r.video_id, r]))

    let fetchedOk = 0
    let pending = 0

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i]
      await setStep(
        svc,
        userId,
        creatorId,
        `Fetching transcripts... ${i + 1}/${total}`,
      )

      const existing = byVideoId.get(v.videoId)

      // D-07: already embedded → skip entirely (no re-fetch, no re-embed)
      if (existing && existing.is_embedded) {
        fetchedOk += 1
        continue
      }

      // D-08: have raw_text but not embedded → keep raw_text, embed later. Skip fetch.
      if (existing && existing.raw_text != null) {
        fetchedOk += 1
        continue
      }

      // D-09 (existing row, raw_text NULL) OR D-10 (no existing row): fetch fresh
      let rawText: string | null = null
      try {
        const segments = await YoutubeTranscript.fetchTranscript(v.videoId)
        rawText = segments.map((s) => s.text).join(' ')
      } catch (err) {
        // D-04: insert/upsert with raw_text = NULL; continue pipeline for other videos
        console.warn(`Transcript fetch failed for ${v.videoId}:`, err)
        rawText = null
      }

      const wordCount = rawText ? rawText.split(/\s+/).filter(Boolean).length : null
      const nowIso = new Date().toISOString()

      // Pitfall 4: onConflict: 'video_id' prevents duplicate-key 409s on re-run
      const { error: upErr } = await svc
        .from('transcripts')
        .upsert(
          {
            creator_id: creatorId,
            video_id: v.videoId,
            title: v.title,
            published_at: v.publishedAt.toISOString(),
            raw_text: rawText,
            word_count: wordCount,
            last_fetched: nowIso,
            updated_at: nowIso,
          },
          { onConflict: 'video_id' },
        )
      if (upErr) {
        // Hard DB error — abort pipeline (partial progress already saved per D-05)
        throw new Error(`Failed to save transcript for ${v.videoId}: ${upErr.message}`)
      }

      if (rawText != null) fetchedOk += 1
      else pending += 1
    }

    // Step 6: embed all transcripts where raw_text NOT NULL AND is_embedded=FALSE
    // Covers D-08 retries (previous partial failures) AND newly fetched rows from this run
    const { data: toEmbedRaw } = await svc
      .from('transcripts')
      .select(
        'id, creator_id, video_id, title, published_at, raw_text, word_count, is_embedded, last_fetched',
      )
      .eq('creator_id', creatorId)
      .not('raw_text', 'is', null)
      .eq('is_embedded', false)
    const toEmbed: TranscriptRow[] = (toEmbedRaw ?? []) as TranscriptRow[]
    const embedTotal = toEmbed.length

    if (embedTotal > 0) {
      const ns = getPineconeNamespace(creatorId)

      for (let i = 0; i < toEmbed.length; i++) {
        const row = toEmbed[i]
        await setStep(
          svc,
          userId,
          creatorId,
          `Embedding chunks... ${i + 1}/${embedTotal} videos`,
        )

        if (row.raw_text == null) continue
        const chunks = chunkText(row.raw_text, 500, 50)

        if (chunks.length === 0) {
          // Empty transcript — mark embedded to prevent infinite retry loops
          await svc
            .from('transcripts')
            .update({ is_embedded: true, updated_at: new Date().toISOString() })
            .eq('id', row.id)
          continue
        }

        const vectors = await embedChunks(chunks)
        if (vectors.length === 0) continue

        // Batch upsert to Pinecone (max 100 vectors per call — RESEARCH Pattern 8)
        const PUSH_BATCH = 100
        const records = vectors.map((values, idx) => ({
          id: `${row.video_id}-chunk-${idx}`,
          values,
          metadata: {
            creator_id: row.creator_id,
            video_id: row.video_id,
            title: row.title,
            chunk_index: idx,
            published_at: row.published_at,
            text: chunks[idx] ?? '',   // Phase 4: required for RAG context string (Pitfall 1)
          },
        }))
        for (let b = 0; b < records.length; b += PUSH_BATCH) {
          // Pinecone SDK v7: upsert expects { records: [...] }, not a bare array
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (ns as any).upsert({ records: records.slice(b, b + PUSH_BATCH) })
        }

        // Mark embedded in Supabase — application-layer idempotency gate (D-07)
        await svc
          .from('transcripts')
          .update({ is_embedded: true, updated_at: new Date().toISOString() })
          .eq('id', row.id)
      }
    }

    // Step 7: update user_creators.last_refreshed_at (D-12)
    // Scoped to (user_id, creator_id) — defence-in-depth against T-03-04-01
    await svc
      .from('user_creators')
      .update({ last_refreshed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('creator_id', creatorId)

    // Step 8: completion summary
    const summary =
      pending === 0
        ? `${fetchedOk}/${total} transcripts fetched`
        : `${fetchedOk}/${total} transcripts fetched, ${pending} pending retry`
    await setStep(svc, userId, creatorId, 'Done', 'done', { summary })

    return { summary, fetched: fetchedOk, total, pending }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Pipeline failed'
    try {
      await setStep(svc, userId, creatorId, 'Error', 'error', { error: msg })
    } catch {
      // best-effort error persistence; ignore secondary failures (T-03-04-06)
    }
    throw err
  }
}
