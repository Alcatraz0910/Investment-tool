'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Anthropic from '@anthropic-ai/sdk'
import type { AssetCategory } from '@/types'
import { Decimal } from 'decimal.js'
import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()

// Return type for all mutation actions
type ActionResult = { error?: string }

// ---------------------------------------------------------------------------
// Phase 8: Live Price Data — types and helpers
// ---------------------------------------------------------------------------

export type PriceResult = { ticker: string; price: number | null; error?: string }
export type RefreshPricesResult = { results?: PriceResult[]; error?: string }
export type FetchPricesResult = { prices?: Record<string, number | null>; error?: string }

const TICKER_RE = /^[A-Z0-9.]{1,20}$/
function isValidTicker(t: string): boolean {
  return TICKER_RE.test(t)
}

export async function addHolding(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const ticker = (formData.get('ticker') as string | null)?.trim().toUpperCase() ?? ''
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const quantity = formData.get('quantity') as string | null
  const currentValue = formData.get('currentValue') as string | null
  const category = formData.get('category') as AssetCategory | null

  // Validate
  if (!ticker || ticker.length > 20) return { error: 'Ticker is required.' }
  if (!quantity || parseFloat(quantity) < 0) return { error: 'Quantity is required.' }
  if (!currentValue || parseFloat(currentValue) <= 0) return { error: 'Enter a valid amount greater than £0.' }
  if (!category) return { error: 'Category is required.' }

  const { error } = await supabase.from('holdings').insert({
    user_id: user.id,
    ticker,
    name: name || null,
    category,
    quantity: quantity,
    current_value: currentValue,
  })

  if (error) return { error: 'Something went wrong. Please try again.' }
  revalidatePath('/dashboard')
  return {}
}

export async function updateHolding(holdingId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const ticker = (formData.get('ticker') as string | null)?.trim().toUpperCase() ?? ''
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const quantity = formData.get('quantity') as string | null
  const currentValue = formData.get('currentValue') as string | null
  const category = formData.get('category') as AssetCategory | null

  if (!ticker || ticker.length > 20) return { error: 'Ticker is required.' }
  if (!quantity || parseFloat(quantity) < 0) return { error: 'Quantity is required.' }
  if (!currentValue || parseFloat(currentValue) <= 0) return { error: 'Enter a valid amount greater than £0.' }
  if (!category) return { error: 'Category is required.' }

  const { error } = await supabase.from('holdings')
    .update({ ticker, name: name || null, category, quantity, current_value: currentValue, updated_at: new Date().toISOString() })
    .eq('id', holdingId)
    .eq('user_id', user.id)   // RLS + app-level scope: only update own holdings

  if (error) return { error: 'Something went wrong. Please try again.' }
  revalidatePath('/dashboard')
  return {}
}

export async function deleteHolding(holdingId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const { error } = await supabase.from('holdings')
    .delete()
    .eq('id', holdingId)
    .eq('user_id', user.id)   // app-level scope defence-in-depth (RLS also enforces)

  if (error) return { error: 'Something went wrong. Please try again.' }
  revalidatePath('/dashboard')
  return {}
}

// ---------------------------------------------------------------------------
// importHoldings — bulk import from CSV upload (Phase 7, CSV-05)
// ---------------------------------------------------------------------------

export type ImportRow = {
  ticker: string        // sanitised by client (uppercase, no .L suffix)
  name: string          // display name from CSV name column, or empty string
  quantity: string      // raw string from PapaParse — stored as-is
  value: string         // £ string at 2dp — GBX already converted client-side
  category: AssetCategory  // default 'Stocks' if no category column
}

export type ImportResult = {
  error?: string
  imported?: number
  skipped?: number
}

/**
 * Bulk-imports holdings from a CSV upload.
 * merge: SELECT existing → UPDATE matched (quantity+currentValue only, D-07) → INSERT new
 * replace: DELETE all holdings for user → INSERT all valid rows
 * Invalid rows (empty ticker, non-numeric quantity/value) are pre-filtered client-side
 * and must NOT appear in rows[]. Server validates count > 0 only.
 */
export async function importHoldings(
  rows: ImportRow[],
  mode: 'merge' | 'replace'
): Promise<ImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  // Only import rows the client classified as valid (status === 'valid' or 'duplicate')
  const validRows = rows.filter(r => r.ticker && r.quantity && r.value)
  if (validRows.length === 0) return { error: 'No valid rows to import.' }

  // Build a row payload — only include `name` when non-empty so that rows
  // without a name don't fail if the migration hasn't been applied yet.
  const buildPayload = (r: ImportRow, userId: string) => ({
    user_id: userId,
    ticker: r.ticker,
    ...(r.name ? { name: r.name } : {}),
    quantity: r.quantity,
    current_value: r.value,
    category: r.category,
  })

  const dbError = (err: { message?: string; code?: string }) => {
    console.error('[importHoldings]', err)
    if (err.code === '42703') {
      return { error: 'Database schema is out of date. Run this in your Supabase SQL editor: ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS name TEXT;' }
    }
    return { error: `Import failed: ${err.message ?? 'unknown error'}` }
  }

  if (mode === 'replace') {
    // Delete all current holdings for this user, then insert all valid rows
    const { error: delErr } = await supabase
      .from('holdings')
      .delete()
      .eq('user_id', user.id)
    if (delErr) return dbError(delErr)

    const { error: insErr } = await supabase
      .from('holdings')
      .insert(validRows.map(r => buildPayload(r, user.id)))
    if (insErr) return dbError(insErr)
  } else {
    // merge: SELECT existing → build ticker→id map → UPDATE matched, INSERT new
    const { data: existing, error: fetchErr } = await supabase
      .from('holdings')
      .select('id, ticker')
      .eq('user_id', user.id)
    if (fetchErr) return dbError(fetchErr)

    const existingMap = new Map<string, string>(
      (existing ?? []).map(h => [h.ticker as string, h.id as string])
    )

    for (const row of validRows) {
      const existingId = existingMap.get(row.ticker)
      if (existingId) {
        // UPDATE quantity + current_value only — preserve isFillTicker and category (D-07)
        const { error: updErr } = await supabase
          .from('holdings')
          .update({
            quantity: row.quantity,
            current_value: row.value,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId)
          .eq('user_id', user.id)
        if (updErr) return dbError(updErr)
      } else {
        // INSERT new holding
        const { error: insErr } = await supabase
          .from('holdings')
          .insert(buildPayload(row, user.id))
        if (insErr) return dbError(insErr)
      }
    }
  }

  revalidatePath('/dashboard')
  return { imported: validRows.length, skipped: rows.length - validRows.length }
}

// ---------------------------------------------------------------------------
// suggestColumnMapping — AI-powered first-pass column suggestion (Phase 7 AI)
// ---------------------------------------------------------------------------

const VALID_FIELD_LABELS = ['Ticker *', 'Quantity *', 'Value (£)', 'Name', 'Category', 'Skip'] as const
type FieldLabel = typeof VALID_FIELD_LABELS[number]

function normaliseAiLabel(label: string): FieldLabel {
  if (label === 'Value') return 'Value (£)'
  return VALID_FIELD_LABELS.includes(label as FieldLabel) ? (label as FieldLabel) : 'Skip'
}

/**
 * Calls Claude to suggest CSV column → field mappings for an unknown CSV.
 * Returns a best-effort mapping; caller must validate and let user override.
 * Silently returns empty mapping on failure — UI falls back to manual entry.
 */
export async function suggestColumnMapping(
  headers: string[],
  sampleRows: Record<string, string>[]
): Promise<{ mapping: Record<string, FieldLabel> }> {
  if (headers.length === 0) return { mapping: {} }

  const client = new Anthropic()
  const FIELD_OPTIONS = ['Ticker *', 'Quantity *', 'Value', 'Name', 'Category', 'Skip']
  const prompt = `You are analyzing a CSV export from a stock brokerage or portfolio tracker.
Map each CSV column to exactly one label from this list:
${FIELD_OPTIONS.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Definitions:
- "Ticker *": stock ticker or code (e.g. AAPL, TSCO, LLOY, Code)
- "Quantity *": number of shares or units held
- "Value": current market value (any currency — pounds, pence, or other)
- "Name": human-readable company or fund name
- "Category": asset type (Stocks / Index Funds / Cash)
- "Skip": not needed

CSV headers: ${headers.join(', ')}

Sample rows (up to 3):
${JSON.stringify(sampleRows.slice(0, 3), null, 2)}

Return ONLY valid JSON where every header is a key and every value is one of: ${FIELD_OPTIONS.map(f => `"${f}"`).join(', ')}.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { mapping: {} }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>
    const mapping: Record<string, FieldLabel> = {}
    for (const [col, label] of Object.entries(parsed)) {
      if (headers.includes(col)) {
        mapping[col] = normaliseAiLabel(label)
      }
    }
    return { mapping }
  } catch {
    return { mapping: {} }
  }
}

export async function updateMonthlyBudget(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const rawAmount = formData.get('monthlyBudget') as string | null
  const amount = rawAmount ? parseFloat(rawAmount) : -1
  if (isNaN(amount) || amount < 0) return { error: 'Enter a valid amount greater than £0.' }

  const { error } = await supabase.from('users')
    .update({ monthly_budget: amount, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: 'Something went wrong. Please try again.' }
  revalidatePath('/dashboard')
  return {}
}

/**
 * Auto-save trust weight from slider release (D-10).
 * category = null  → global weight → UPDATE user_creators.trust_weight
 * category = 'Tech' etc → per-category → UPSERT user_creator_category_weights
 *
 * Auth: uses createClient() to verify session (user must be logged in).
 * Write: uses createServiceClient() to bypass RLS for the weight update.
 *
 * Pitfall 6 mitigation: upsert is idempotent — rapid slider releases are safe.
 */
export async function saveCreatorWeight({
  userCreatorId,
  category,
  weight,
}: {
  userCreatorId: string
  category: string | null  // null = global; string = per-category (must be AssetCategory value)
  weight: number           // 0–100
}): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  // Validate weight is in 0–100 range (DB CHECK constraint also enforces)
  if (typeof weight !== 'number' || weight < 0 || weight > 100) {
    return { error: 'Weight must be between 0 and 100.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any

  if (category === null) {
    // Global trust weight → user_creators.trust_weight
    // Note: user_creators has no updated_at column — update trust_weight only
    const { error } = await svc
      .from('user_creators')
      .update({ trust_weight: weight })
      .eq('id', userCreatorId)

    if (error) return { error: 'Something went wrong. Please try again.' }
  } else {
    // Per-category override → user_creator_category_weights (upsert)
    const { error } = await svc
      .from('user_creator_category_weights')
      .upsert(
        {
          user_creator_id: userCreatorId,
          category,
          weight,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_creator_id,category' },
      )

    if (error) return { error: 'Something went wrong. Please try again.' }
  }

  revalidatePath('/dashboard')
  return {}
}

// ---------------------------------------------------------------------------
// refreshHoldingPrices — batch-fetch LSE prices and persist to holdings table
// ---------------------------------------------------------------------------

export async function refreshHoldingPrices(): Promise<RefreshPricesResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const { data: holdingRows, error: fetchErr } = await supabase
    .from('holdings')
    .select('id, ticker')
    .eq('user_id', user.id)

  if (fetchErr) return { error: 'Could not load holdings.' }
  if (!holdingRows || holdingRows.length === 0) return { results: [] }

  const results: PriceResult[] = await Promise.all(
    holdingRows.map(async ({ ticker }) => {
      if (!isValidTicker(ticker)) return { ticker, price: null, error: 'invalid ticker' }
      try {
        const q = await yahooFinance.quote(`${ticker}.L`, {}, { validateResult: false })
        let price = q.regularMarketPrice ?? null
        if (price !== null && q.currency === 'GBp') {
          price = new Decimal(price).div(100).toNumber()
        }
        return { ticker, price }
      } catch {
        return { ticker, price: null, error: 'fetch failed' }
      }
    })
  )

  const now = new Date().toISOString()
  for (const { ticker, price } of results) {
    if (price === null) continue
    const { error: updateErr } = await supabase
      .from('holdings')
      .update({
        current_price: price.toString(),
        price_fetched_at: now,
      })
      .eq('user_id', user.id)
      .eq('ticker', ticker)
    if (updateErr?.code === '42703') {
      return { error: 'Database schema is out of date. Run the Phase 8 migration in Supabase SQL Editor.' }
    }
  }

  revalidatePath('/dashboard')
  return { results }
}

// ---------------------------------------------------------------------------
// fetchTickerPrices — ephemeral price fetch for Buy List (no DB write)
// ---------------------------------------------------------------------------

export async function fetchTickerPrices(tickers: string[]): Promise<FetchPricesResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  if (tickers.length > 50) return { error: 'Too many tickers requested.' }

  const prices: Record<string, number | null> = {}
  await Promise.all(
    tickers.map(async (ticker) => {
      if (!isValidTicker(ticker)) {
        prices[ticker] = null
        return
      }
      try {
        const q = await yahooFinance.quote(`${ticker}.L`, {}, { validateResult: false })
        let price = q.regularMarketPrice ?? null
        if (price !== null && q.currency === 'GBp') {
          price = new Decimal(price).div(100).toNumber()
        }
        prices[ticker] = price
      } catch {
        prices[ticker] = null
      }
    })
  )

  return { prices }
}
