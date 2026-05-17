import { Decimal } from 'decimal.js'
import type { AssetCategory } from '@/types'

// ---------------------------------------------------------------------------
// Broker preset registry
// ---------------------------------------------------------------------------

export type BrokerPreset = {
  name: string
  requiredHeaders: string[]
  tickerCol: string
  nameCol?: string            // Optional column containing the holding's display name
  quantityCol: string
  valueCol: string
  gbx: boolean  // true = values are in GBX (pence); divide by 100 for £
}

export const BROKER_PRESETS: BrokerPreset[] = [
  {
    name: 'Hargreaves Lansdown',
    // HL account summary CSV has metadata rows above the data table.
    // The data table starts with "Code" as the first column header.
    // Actual HL export columns verified from live export: Code, Stock, Units held, Value (£)
    requiredHeaders: ['Code', 'Units held'],
    tickerCol: 'Code',
    nameCol: 'Stock',
    quantityCol: 'Units held',
    valueCol: 'Value (£)',
    gbx: false,  // Value (£) column is already in pounds
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
  name: string          // display name from nameCol, or empty string
  quantity: string      // raw string (decimal.js parses in server action)
  value: string         // £ string at 2dp (GBX already converted client-side)
  category: AssetCategory
  status: RowStatus
  rawTicker: string     // original value before sanitisation (display only)
}

export type ColumnMapping = {
  tickerCol: string
  nameCol: string | null
  quantityCol: string
  valueCol: string
  categoryCol: string | null
  gbx: boolean
}

// ---------------------------------------------------------------------------
// detectBroker
// ---------------------------------------------------------------------------

/**
 * Strips metadata rows that precede the actual data table in multi-section
 * broker exports (e.g. HL account summary). Scans lines until it finds one
 * whose first cell matches a known data-table header, then returns the CSV
 * from that line onwards. Falls back to the original text when not found.
 */
export function extractDataSection(csvText: string): string {
  const DATA_MARKERS = ['Code']   // HL: first column of the holdings table
  const lines = csvText.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const firstCell = lines[i].split(',')[0].replace(/^"(.*)"$/, '$1').trim()
    if (DATA_MARKERS.includes(firstCell)) {
      return lines.slice(i).join('\n')
    }
  }
  return csvText
}

/**
 * Returns the first matching BrokerPreset whose requiredHeaders are ALL present
 * in the CSV header array, or null (generic CSV — show column mapping step).
 * Caller MUST have parsed with bom: true to avoid BOM on first header.
 * Headers are normalised (trimmed, lowercased) for comparison.
 */
export function detectBroker(headers: string[]): BrokerPreset | null {
  const normalised = headers.map(h => h.trim().toLowerCase())
  return (
    BROKER_PRESETS.find(preset =>
      preset.requiredHeaders.every(h => normalised.includes(h.trim().toLowerCase()))
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

  const qty = parseFloat(rawQuantity.replace(/,/g, ''))
  const val = parseFloat(rawValue.replace(/[,£]/g, ''))
  if (isNaN(qty) || qty < 0) return 'invalid'
  if (isNaN(val) || val < 0) return 'invalid'

  if (existingTickers.has(ticker)) return 'duplicate'
  return 'valid'
}

// ---------------------------------------------------------------------------
// parseRows
// ---------------------------------------------------------------------------

/**
 * Case-insensitive column lookup — handles minor encoding or spacing differences
 * between preset column names and what PapaParse returns from the actual file.
 */
function getCol(row: Record<string, string>, colName: string): string {
  if (colName in row) return row[colName] ?? ''
  const lower = colName.trim().toLowerCase()
  for (const [k, v] of Object.entries(row)) {
    if (k.trim().toLowerCase() === lower) return v ?? ''
  }
  // Encoding fallback: HL CSVs are Windows-1252; £ becomes a replacement character
  // when read as UTF-8. Strip non-ASCII before comparing so Value(£) still resolves.
  const asciiOnly = (s: string) => s.replace(/[^\x00-\x7F]/g, '')
  const lowerAscii = asciiOnly(lower)
  for (const [k, v] of Object.entries(row)) {
    if (asciiOnly(k.trim().toLowerCase()) === lowerAscii) return v ?? ''
  }
  return ''
}

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
    const rawTicker = getCol(row, mapping.tickerCol)
    const rawQty = getCol(row, mapping.quantityCol)
    const rawVal = getCol(row, mapping.valueCol)
    const ticker = sanitiseTicker(rawTicker)
    const name = (mapping.nameCol ? getCol(row, mapping.nameCol) : '').trim()
    // Strip thousands commas and £ prefix before numeric parsing.
    // HL exports format values as "4,250.00" which breaks NUMERIC casts in Supabase.
    const cleanedVal = rawVal.replace(/[,£]/g, '').trim()
    const valueStr = mapping.gbx ? convertGbxToGbp(cleanedVal || '0') : cleanedVal || '0'
    const categoryRaw = mapping.categoryCol ? getCol(row, mapping.categoryCol) : ''
    const category: AssetCategory = categoryRaw.trim()
      ? (categoryRaw.trim() as AssetCategory)
      : 'Stocks'
    const cleanedQty = rawQty.replace(/,/g, '').trim()
    const status = classifyRow(rawTicker, cleanedQty, valueStr, existingTickers)
    return { ticker, name, quantity: cleanedQty, value: valueStr, category, status, rawTicker }
  })
}
