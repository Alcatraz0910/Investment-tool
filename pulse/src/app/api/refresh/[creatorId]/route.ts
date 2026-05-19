import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runRefreshPipeline } from '@/lib/pipeline/transcript-pipeline'
import { extractCreatorStrategy } from '@/lib/strategy/extractor'

/**
 * Vercel function timeout — required for transcript pipeline (30-120s).
 * RESEARCH Pitfall 1. Requires Vercel Pro plan or self-hosted.
 */
export const maxDuration = 300

// RFC 4122 v4 UUID — broadly tolerant (any version) per Postgres uuid format
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/refresh/[creatorId]
 * Runs the transcript pipeline synchronously for the (current user, creatorId) pair.
 * Auth: getUser() must return a session. Ownership: user must track creator.
 * Returns 200 with PipelineResult summary on success, 500 with D-05 copy on pipeline error.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> },
) {
  const { creatorId } = await params

  if (!UUID_RE.test(creatorId)) {
    return NextResponse.json(
      { error: 'Invalid creator id' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // defence-in-depth: scope ownership check explicitly even though RLS already filters
  const { data: ownership } = await supabase
    .from('user_creators')
    .select('id')
    .eq('user_id', user.id)
    .eq('creator_id', creatorId)
    .maybeSingle()
  if (!ownership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const result = await runRefreshPipeline(creatorId, user.id)

    // D-01: auto-extract at end of Refresh (no separate button)
    // D-02: non-blocking — extraction failure does not fail the Refresh
    let extractionStatus: 'ok' | 'warning' = 'ok'
    let extractionWarning: string | undefined

    try {
      await extractCreatorStrategy(creatorId, user.id)
    } catch (extractionErr) {
      const errMsg = extractionErr instanceof Error ? extractionErr.message : String(extractionErr)
      console.warn('[refresh] extraction failed (non-blocking):', errMsg)
      extractionStatus = 'warning'
      extractionWarning = `Transcripts refreshed. Strategy extraction failed: ${errMsg}`
    }

    return NextResponse.json(
      {
        status: 'done',
        summary: result.summary,
        fetched: result.fetched,
        total: result.total,
        pending: result.pending,
        extractionStatus,
        ...(extractionWarning ? { extractionWarning } : {}),
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[refresh] pipeline error:', err)
    // D-05 copy
    return NextResponse.json(
      { error: 'YouTube API error — partial progress saved' },
      { status: 500 },
    )
  }
}

/**
 * GET /api/refresh/[creatorId]
 * Returns the latest refresh_jobs row for the (current user, creatorId) pair.
 * Used by the Refresh button client component for 2s status polling.
 * RLS allows authenticated users to SELECT only their own rows (auth.uid() = user_id).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> },
) {
  const { creatorId } = await params

  if (!UUID_RE.test(creatorId)) {
    return NextResponse.json(
      { error: 'Invalid creator id' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: row } = await supabase
    .from('refresh_jobs')
    .select('status, step, summary, error')
    .eq('user_id', user.id) // defence-in-depth scope (RLS already filters)
    .eq('creator_id', creatorId)
    .maybeSingle()

  if (!row) {
    // No prior refresh attempt — return idle defaults
    return NextResponse.json(
      { status: 'idle', step: null, summary: null, error: null },
      { status: 200 },
    )
  }

  return NextResponse.json(
    {
      status: row.status,
      step: row.step,
      summary: row.summary,
      error: row.error,
    },
    { status: 200 },
  )
}
