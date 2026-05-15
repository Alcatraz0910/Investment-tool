import { Decimal } from 'decimal.js'
import type { AssetCategory } from '@/types'

// ---------------------------------------------------------------------------
// Broker preset registry
// ---------------------------------------------------------------------------

export type BrokerPreset = {
  name: string
  requiredHeaders: string[]
  tickerCol: string
  quantityCol: string
  valueCol: string
  gbx: boolean  // true = values are in GBX (pence); divide by 100 for £
}

export const BROKER_PRESETS: BrokerPreset[] = [
  {
    name: 'Hargreaves Lansdown',
    requiredHeaders: ['Stock', 'Units Held'],
    tickerCol: 'Stock',
    quantityCol: 'Units Held',
    valueCol: 'Value (p)',
    gbx: true,
  },
  {
    name: 'AJ Bell',
    requiredHeaders: ['Quantity', 'Market value'],
    tickerCol: 'Ticker/ISIN',
    quantityCol: 'Quantity',
    valueCol: 'Market value',
    gbx: false,
  },
]

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type RowStatus = 'valid' | 'duplicate' | 'invalid'

export type ParsedRow = {
  ticker: string        // sanitised: uppercase, no .L suffix
  quantity: string      // raw string (decimal.js parses in server action)
  value: string         // £ string at 2dp (GBX already converted client-side)
  category: AssetCategory
  status: RowStatus
  rawTicker: string     // original value before sanitisation (display only)
}

export type ColumnMapping = {
  tickerCol: string
  quantityCol: string
  valueCol: string
  categoryCol: string | null
  gbx: boolean
}

// ---------------------------------------------------------------------------
// detectBroker
// ---------------------------------------------------------------------------

/**
 * Returns the first matching BrokerPreset whose requiredHeaders are ALL present
 * in the CSV header array, or null (generic CSV — show column mapping step).
 * Caller MUST have parsed with bom: true to avoid BOM on first header.
 */
export function detectBroker(headers: string[]): BrokerPreset | null {
  return (
    BROKER_PRESETS.find(preset =>
      preset.requiredHeaders.every(h => headers.includes(h))
    ) ?? null
  )
}

// ---------------------------------------------------------------------------
// sanitiseTicker
// ---------------------------------------------------------------------------

/**
 * Normalises a raw ticker string: trim, uppercase, strip trailing .L.
 * CLAUDE.md: bare tickers only — .L suffix must never reach the DB.
 */
export function sanitiseTicker(raw: string): string {
  return raw.trim().toUpperCase().replace(/\.L$/, '')
}

// ---------------------------------------------------------------------------
// convertGbxToGbp
// ---------------------------------------------------------------------------

/**
 * Converts a GBX (pence) string to a £ string at 2 decimal places.
 * Uses decimal.js to avoid IEEE 754 float errors (CLAUDE.md mandate).
 */
export function convertGbxToGbp(gbxStr: string): string {
  return new Decimal(gbxStr.trim()).div(100).toFixed(2)
}

// ---------------------------------------------------------------------------
// classifyRow
// ---------------------------------------------------------------------------

/**
 * Classifies a parsed row's status:
 * - 'invalid': empty ticker, non-numeric quantity, or non-numeric value
 * - 'duplicate': ticker (post-sanitise) already in existingTickers set
 * - 'valid': all fields present and ticker is new
 */
export function classifyRow(
  rawTicker: string,
  rawQuantity: string,
  rawValue: string,
  existingTickers: Set<string>
): RowStatus {
  const ticker = sanitiseTicker(rawTicker)
  if (!ticker) return 'invalid'

  const qty = parseFloat(rawQuantity)
  const val = parseFloat(rawValue)
  if (isNaN(qty) || qty < 0) return 'invalid'
  if (isNaN(val) || val < 0) return 'invalid'

  if (existingTickers.has(ticker)) return 'duplicate'
  return 'valid'
}

// ---------------------------------------------------------------------------
// parseRows
// ---------------------------------------------------------------------------

/**
 * Converts raw PapaParse rows into typed ParsedRow[] using a column mapping.
 * Applies GBX→£ conversion when mapping.gbx is true.
 * Rows with missing required columns default to category 'Stocks' (D-11).
 */
export function parseRows(
  rawRows: Record<string, string>[],
  mapping: ColumnMapping,
  existingTickers: Set<string>
): ParsedRow[] {
  return rawRows.map(row => {
    const rawTicker = row[mapping.tickerCol] ?? ''
    const rawQty = row[mapping.quantityCol] ?? ''
    const rawVal = row[mapping.valueCol] ?? ''
    const ticker = sanitiseTicker(rawTicker)
    const valueStr = mapping.gbx ? convertGbxToGbp(rawVal || '0') : rawVal.trim()
    const category: AssetCategory =
      mapping.categoryCol && row[mapping.categoryCol]
        ? (row[mapping.categoryCol].trim() as AssetCategory)
        : 'Stocks'
    const status = classifyRow(rawTicker, rawQty, valueStr, existingTickers)
    return { ticker, quantity: rawQty.trim(), value: valueStr, category, status, rawTicker }
  })
}
