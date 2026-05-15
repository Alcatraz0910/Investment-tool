# Phase 7 — Pattern Map

**Generated:** 2026-05-15

---

## File Roles

| New/Modified File | Role | Closest Analog |
|-------------------|------|----------------|
| `pulse/src/lib/csv/parser.ts` | Pure utility — broker detection, row classification, GBX conversion | `pulse/src/lib/tax-year.ts`, `pulse/src/lib/plan/generator.ts` |
| `pulse/src/components/ImportCSVModal.tsx` | Multi-step modal (Upload → Map → Preview+Confirm) | `pulse/src/components/HoldingModal.tsx` (exact analog) |
| `pulse/src/app/dashboard/actions.ts` | Add `importHoldings` server action | Self — existing addHolding / deleteHolding |
| `pulse/src/components/PortfolioTab.tsx` | Add "Import CSV" button + mount modal | Self — existing HoldingModal mount |

---

## Extracted Code Patterns

### 1. Modal Open/Close in PortfolioTab (PortfolioTab.tsx:34-61)
```typescript
const [modalOpen, setModalOpen] = useState(false)
const [editingHolding, setEditingHolding] = useState<ClientHolding | undefined>(undefined)

function openAddModal() {
  setEditingHolding(undefined)
  setModalOpen(true)
}

// JSX — render alongside existing HoldingModal:
{modalOpen && (
  <HoldingModal isOpen={modalOpen} onClose={() => setModalOpen(false)} holding={editingHolding} />
)}
```
ImportCSVModal uses same pattern: `const [importModalOpen, setImportModalOpen] = useState(false)`

### 2. Focus Trap + Escape Key (HoldingModal.tsx:30-70)
```typescript
const firstInputRef = useRef<HTMLInputElement>(null)
const triggerRef = useRef<HTMLElement | null>(null)

useEffect(() => {
  if (isOpen) {
    triggerRef.current = document.activeElement as HTMLElement
    setTimeout(() => firstInputRef.current?.focus(), 50)  // delay lets overlay render
  } else if (triggerRef.current) {
    triggerRef.current.focus()
    triggerRef.current = null
  }
}, [isOpen])

useEffect(() => {
  if (!isOpen) return
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    // Tab: cycle between focusable elements within modal
  }
  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [isOpen, onClose])
```

### 3. Server Action Pattern (actions.ts:10-37)
```typescript
export async function addHolding(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }
  // validate...
  const { error } = await supabase.from('holdings').insert({ user_id: user.id, ... })
  if (error) return { error: 'Something went wrong. Please try again.' }
  revalidatePath('/dashboard')
  return {}
}
```
`importHoldings` follows exact same shape. User-facing errors always use the generic string.

### 4. Button-triggered Action (useTransition, NOT useActionState)
`useActionState` is for form.action bindings. `ImportCSVModal` confirm is a button click:
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

### 5. Button Accessibility Baseline
```
min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500
```

### 6. Pure Utility File (no directive — importable from both sides)
```typescript
// No 'use client' or 'use server' — importable from client or server
export function detectBroker(headers: string[]): BrokerPreset | null { ... }
export function sanitiseTicker(raw: string): string { ... }
export function classifyRow(row: ParsedRow, existingTickers: Set<string>): RowStatus { ... }
```

---

## No-Analog Sub-Patterns (Must Implement Fresh)

| Sub-pattern | Notes |
|-------------|-------|
| Drop zone (onDrop + hidden input) | Step 1 — native HTML5, no library |
| Step indicator "Step N of 3" | Modal header — derive from `currentStep` state |
| Column mapping table (CSV col → dropdown) | Step 2 — no existing analog |
| Broker auto-detect banner | Shown momentarily before auto-advancing to step 3 |
| Preview table with Valid/Duplicate/Invalid status | Step 3 — status colors: text-green-400 / text-amber-400 / text-red-400 |
