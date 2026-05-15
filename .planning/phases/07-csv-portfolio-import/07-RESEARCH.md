# Phase 7: CSV Portfolio Import — Research

**Researched:** 2026-05-15
**Confidence:** HIGH (codebase verified; broker CSV formats from CONTEXT.md locked decisions)

---

## 1. PapaParse Integration

**Package not yet installed.** Required install:
```bash
npm install papaparse @types/papaparse
```

**Client-side usage (inside a Client Component):**
```typescript
import Papa from 'papaparse'

Papa.parse<Record<string, string>>(file, {
  header: true,
  bom: true,           // MANDATORY — handles Excel-generated CSVs with UTF-8 BOM on col 1
  skipEmptyLines: true,
  dynamicTyping: false, // INTENTIONAL — keep strings so decimal.js handles GBX conversion
  complete: (results) => {
    const headers = results.meta.fields ?? []
    const rows = results.data
    // results.errors contains per-row parse errors
  },
})
```

**Why `dynamicTyping: false`:** PapaParse would convert "2.50" to the JS number 2.5, losing
precision. Keeping strings and passing to `new Decimal(str)` avoids IEEE 754 float errors.

**Why `bom: true`:** HL CSV exports from Excel include a UTF-8 BOM at the start of the first
column header, causing it to appear as `"Stock"` with a hidden BOM prefix. `bom: true` strips it.

---

## 2. File Drop Zone (No Extra Libraries)

Native HTML5 drag-and-drop — no react-dropzone needed:

```typescript
const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault()
  e.stopPropagation()
  const file = e.dataTransfer.files[0]
  if (file?.name.endsWith('.csv')) processFile(file)
  else setFileError('Please upload a .csv file')
}

const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault() // required to allow drop
}

// Hidden file input connected to drop zone:
const inputRef = useRef<HTMLInputElement>(null)
// <div onDrop={handleDrop} onDragOver={handleDragOver} onClick={() => inputRef.current?.click()}>
// <input ref={inputRef} type="file" accept=".csv" className="hidden"
//   onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }} />
```

---

## 3. Broker Preset Detection

**HL (Hargreaves Lansdown) export column headers** (locked in CONTEXT.md D-03, D-13):
- Stock name: `"Stock"` (BOM-stripped by `bom: true`)
- Units: `"Units Held"`
- Value in pence: `"Value (p)"` — GBX column (divide by 100)

**AJ Bell export column headers** (locked in CONTEXT.md D-03):
- Ticker: `"Ticker/ISIN"`
- Quantity: `"Quantity"`
- Value: `"Market value"` — in £ already

**Recommended `BROKER_PRESETS` constant (goes in `pulse/src/lib/csv/parser.ts`):**
```typescript
type BrokerPreset = {
  name: string
  requiredHeaders: string[]
  tickerCol: string
  quantityCol: string
  valueCol: string
  gbx: boolean
}

const BROKER_PRESETS: BrokerPreset[] = [
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

function detectBroker(headers: string[]): BrokerPreset | null {
  return BROKER_PRESETS.find(p => p.requiredHeaders.every(h => headers.includes(h))) ?? null
}
```

**Ticker sanitisation (CRITICAL — CLAUDE.md: bare tickers only):**
HL sometimes exports tickers with `.L` suffix (e.g. `LLOY.L`). Must strip before import:
```typescript
const sanitiseTicker = (raw: string) => raw.trim().toUpperCase().replace(/\.L$/, '')
```

---

## 4. GBX to £ Conversion (decimal.js)

```typescript
import { Decimal } from 'decimal.js'

// GBX (pence) to £:
const gbpValue = new Decimal(gbxString).div(100)   // .div() is alias for .dividedBy()

// Display in preview:
gbpValue.toFixed(2)  // e.g. "198.00"
```

Both `.div()` and `.dividedBy()` are valid — use `.div()` (matches CONTEXT.md wording).

---

## 5. Holdings Table — UNIQUE Constraint

**Finding: No UNIQUE(user_id, ticker) constraint visible in existing code.**

The existing `addHolding` server action uses `.insert()` not `.upsert()`. The DB likely does NOT
have this constraint today.

**Recommended approach for merge mode — application-level (no migration):**
```typescript
// 1. Fetch existing holdings for user
const { data: existing } = await supabase
  .from('holdings').select('id, ticker').eq('user_id', userId)
const existingMap = new Map(existing?.map(h => [h.ticker, h.id]) ?? [])

// 2. For each valid row:
const toUpdate = validRows.filter(r => existingMap.has(r.ticker))
const toInsert = validRows.filter(r => !existingMap.has(r.ticker))

// 3. UPDATE matched — touch only quantity + current_value; preserve isFillTicker/category (D-07)
for (const row of toUpdate) {
  await supabase.from('holdings')
    .update({ quantity: row.quantity, current_value: row.value,
               updated_at: new Date().toISOString() })
    .eq('id', existingMap.get(row.ticker)!).eq('user_id', userId)
}

// 4. INSERT new
if (toInsert.length > 0) {
  await supabase.from('holdings').insert(
    toInsert.map(r => ({ user_id: userId, ticker: r.ticker,
      quantity: r.quantity, current_value: r.value, category: r.category }))
  )
}
```

---

## 6. Server Action Pattern

New function in `pulse/src/app/dashboard/actions.ts`:

```typescript
export type ImportRow = {
  ticker: string        // sanitised (uppercase, no .L)
  quantity: string      // raw string — decimal.js parses server-side
  value: string         // raw string — already GBX-converted client-side
  category: AssetCategory
}

export type ImportResult = { error?: string; imported?: number; skipped?: number }

export async function importHoldings(
  rows: ImportRow[],
  mode: 'merge' | 'replace'
): Promise<ImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const validRows = rows.filter(r => r.ticker && r.quantity && r.value)
  if (validRows.length === 0) return { error: 'No valid rows to import.' }

  if (mode === 'replace') {
    const { error: delErr } = await supabase.from('holdings').delete().eq('user_id', user.id)
    if (delErr) return { error: 'Something went wrong. Please try again.' }
    const { error: insErr } = await supabase.from('holdings').insert(
      validRows.map(r => ({ user_id: user.id, ticker: r.ticker,
        quantity: r.quantity, current_value: r.value, category: r.category }))
    )
    if (insErr) return { error: 'Something went wrong. Please try again.' }
  } else {
    // merge — application-level SELECT + UPDATE/INSERT (see §5 above)
  }

  revalidatePath('/dashboard')
  return { imported: validRows.length, skipped: rows.length - validRows.length }
}
```

**Calling from client component (within ImportCSVModal):**
```typescript
const [isPending, startTransition] = useTransition()
const [importState, setImportState] = useState<ImportResult>({})

function handleConfirm() {
  startTransition(async () => {
    const result = await importHoldings(previewRows, mergeMode)
    setImportState(result)
    if (!result.error) onClose()
  })
}
```

`revalidatePath('/dashboard')` is sufficient — no `router.refresh()` in the modal.

---

## 7. Existing Codebase Patterns (Verified)

### PortfolioTab.tsx — modal mount pattern
```typescript
const [importModalOpen, setImportModalOpen] = useState(false)

// JSX — alongside existing HoldingModal:
{importModalOpen && <ImportCSVModal onClose={() => setImportModalOpen(false)} />}

// "Import CSV" button in Holdings section header, next to "Add Holding":
<button onClick={() => setImportModalOpen(true)}>Import CSV</button>
```

### HoldingModal.tsx — structure to replicate in ImportCSVModal
- `useRef` captures trigger element; `useEffect` restores focus on close
- `setTimeout(() => firstInputRef.current?.focus(), 50)` for initial focus after mount
- Escape key: `document.addEventListener('keydown', handler)` in `useEffect`
- Focus trap: intercept Tab key, cycle focusable elements
- `useActionState` for server action binding + error state

### actions.ts — Supabase client usage
- `createClient()` (session-scoped) for all holding CRUD — use same for `importHoldings`
- `createServiceClient()` only for trust weight updates (RLS bypass not needed for holdings)
- Pattern: auth check → validate → DB operation → `revalidatePath` → return `{}`

### Glassmorphism modal overlay card:
```
backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl
```

---

## 8. Validation Architecture (Nyquist)

### Unit-testable (Jest, no browser):
| Test | Req |
|------|-----|
| `detectBroker(['Stock', 'Units Held', ...])` → `'Hargreaves Lansdown'` | CSV-03 |
| `detectBroker(['Quantity', 'Market value', ...])` → `'AJ Bell'` | CSV-03 |
| `detectBroker(['col1', 'col2'])` → `null` (generic fallback) | CSV-03 |
| `sanitiseTicker('LLOY.L')` → `'LLOY'` | CLAUDE.md |
| `sanitiseTicker('VOO')` → `'VOO'` (no change) | CLAUDE.md |
| GBX conversion: `new Decimal('19800').div(100).toFixed(2)` → `'198.00'` | CSV-06 |
| Row classification: empty ticker → status `'invalid'` | CSV-04 |
| Row classification: duplicate ticker → status `'duplicate'` | CSV-04 |
| Row classification: valid row → status `'valid'` | CSV-04 |
| No category column → defaults to `'Stocks'` | D-11 |

### Manual/visual tests:
| Test | Req |
|------|-----|
| Drag `.csv` → step advances | CSV-01 |
| Drag non-`.csv` → error inline | CSV-01 |
| HL CSV → broker banner + auto-advance to preview | CSV-03 |
| Generic CSV → column mapping table | CSV-02 |
| Preview: Valid (green) / Duplicate (amber) / Invalid (red) | CSV-04 |
| Replace mode warning shows count of holdings not in CSV | CSV-05 |
| Merge: isFillTicker preserved on matched ticker | D-07 |

---

## 9. Pitfalls and Mitigations

| # | Pitfall | Mitigation |
|---|---------|-----------|
| 1 | BOM on first column header | `bom: true` in PapaParse — strips automatically |
| 2 | `.L` suffix in HL ticker exports | `sanitiseTicker()` — strip `.L` before validation |
| 3 | Empty trailing rows in CSV | `skipEmptyLines: true` in PapaParse |
| 4 | Numeric precision with PapaParse | `dynamicTyping: false` — keep strings, use `new Decimal()` |
| 5 | Merge overwrites isFillTicker/category | App-level UPDATE touches only `quantity`+`current_value` |
| 6 | Replace all without user awareness | Step 3 amber warning: "N holding(s) not in this CSV will be removed" |
| 7 | No valid rows in CSV | Step 3 empty state: "No valid rows to import" + Back button |
| 8 | Server action called with 0 rows | Guard in `importHoldings`: `if (validRows.length === 0)` |
| 9 | Required fields unmapped (generic CSV) | Flag Ticker + Quantity as required in D-10 mapping UI |
| 10 | No category column in CSV | Default to `'Stocks'` per D-11 |
| 11 | HL value column is pence, not £ | GBX conversion is silent, tied to HL preset only (D-13) |

---

## 10. Suggested Plan Breakdown

| Plan | File(s) | What |
|------|---------|------|
| Plan 01 | `pulse/src/lib/csv/parser.ts` | Broker detection, row classification, GBX conversion, ticker sanitisation — pure functions, unit-testable |
| Plan 02 | `pulse/src/app/dashboard/actions.ts` | `importHoldings(rows, mode)` server action — merge + replace modes |
| Plan 03 | `pulse/src/components/ImportCSVModal.tsx` | 3-step modal (Upload → Map Columns → Preview+Confirm); reuses HoldingModal patterns |
| Plan 04 | `pulse/src/components/PortfolioTab.tsx` | "Import CSV" button + modal mount; E2E wiring |
