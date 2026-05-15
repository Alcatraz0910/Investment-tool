'use client'
import { useRef, useEffect, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Papa from 'papaparse'
import {
  detectBroker,
  extractDataSection,
  parseRows,
  type BrokerPreset,
  type ParsedRow,
  type ColumnMapping,
} from '@/lib/csv/parser'
import { importHoldings } from '@/app/dashboard/actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3

interface ImportCSVModalProps {
  onClose: () => void
  existingTickers: Set<string>
}

// ---------------------------------------------------------------------------
// Step-transition variants (matches AnimatedTabPanel from Phase 6)
// ---------------------------------------------------------------------------

const stepVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
}

const stepTransition = { duration: 0.2, ease: 'easeOut' as const }

// ---------------------------------------------------------------------------
// Modal title per step
// ---------------------------------------------------------------------------

function modalTitle(step: Step, detectedBroker: BrokerPreset | null): string {
  if (step === 1) return 'Import CSV'
  if (step === 2 && detectedBroker === null) return 'Map Columns'
  return 'Review Import'
}

// ---------------------------------------------------------------------------
// ImportCSVModal
// ---------------------------------------------------------------------------

export default function ImportCSVModal({ onClose, existingTickers }: ImportCSVModalProps) {
  // ── Step state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1)
  const [totalSteps, setTotalSteps] = useState(3)

  // ── File + parse state ───────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [detectedBroker, setDetectedBroker] = useState<BrokerPreset | null>(null)
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])

  // ── Column mapping (step 2) ──────────────────────────────────────────────
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})  // csvCol → field
  const [mappingError, setMappingError] = useState('')

  // ── Preview (step 3) ────────────────────────────────────────────────────
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([])
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge')
  const [importError, setImportError] = useState('')

  // ── Transition ───────────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition()

  // ── Refs ─────────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  // ── Focus trap: capture trigger on mount, restore on close ───────────────
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement
    return () => {
      if (triggerRef.current) {
        triggerRef.current.focus()
        triggerRef.current = null
      }
    }
  }, [])

  // ── Escape key close ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // ── Build preview rows from rawRows + mapping ────────────────────────────
  function buildPreview(
    rows: Record<string, string>[],
    _headers: string[],
    mapping: ColumnMapping,
    tickers: Set<string>
  ) {
    const parsed = parseRows(rows, mapping, tickers)
    setPreviewRows(parsed)
  }

  // ── Process selected/dropped file ────────────────────────────────────────
  async function processFile(selectedFile: File) {
    if (!selectedFile.name.endsWith('.csv')) {
      setFileError('Please upload a .csv file')
      return
    }
    setFileError('')
    setFile(selectedFile)
    setDetectedBroker(null)

    // Pre-process: strip broker metadata rows (e.g. HL account summary header)
    // before PapaParse so the first line it sees is the actual column header row.
    const rawText = await selectedFile.text()
    const csvText = extractDataSection(rawText)

    // @types/papaparse omits `bom` from ParseLocalConfig — cast to bypass
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseConfig: any = {
      header: true,
      bom: true,           // MANDATORY — strips Excel UTF-8 BOM from first header
      skipEmptyLines: true,
      dynamicTyping: false, // INTENTIONAL — keep strings for decimal.js in server action
      complete: (results: Papa.ParseResult<Record<string, string>>) => {
        const headers = results.meta.fields ?? []
        const rows = results.data
        setParsedHeaders(headers)
        setRawRows(rows)
        const broker = detectBroker(headers)
        setDetectedBroker(broker)
        if (broker) {
          setTotalSteps(2)
          // auto-advance to preview after 1.5s (banner shows during delay)
          setTimeout(() => {
            const mapping: ColumnMapping = {
              tickerCol: broker.tickerCol,
              quantityCol: broker.quantityCol,
              valueCol: broker.valueCol,
              categoryCol: null,
              gbx: broker.gbx,
            }
            buildPreview(rows, headers, mapping, existingTickers)
            setStep(2)  // step 2 of 2 = preview for auto-detected
          }, 1500)
        } else {
          setTotalSteps(3)
          setStep(2)  // step 2 of 3 = column mapping
        }
      },
    }
    Papa.parse<Record<string, string>>(csvText, parseConfig)
  }

  // ── Drag-and-drop handlers ───────────────────────────────────────────────
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) processFile(droppedFile)
  }

  // ── Step 2: column mapping validation + advance ───────────────────────────
  function handleMappingNext() {
    const tickerMapped = Object.values(columnMapping).includes('Ticker *')
    const quantityMapped = Object.values(columnMapping).includes('Quantity *')
    if (!tickerMapped || !quantityMapped) {
      setMappingError('Ticker and Quantity columns are required')
      return
    }
    setMappingError('')
    const tickerCol = Object.entries(columnMapping).find(([, v]) => v === 'Ticker *')?.[0] ?? ''
    const quantityCol = Object.entries(columnMapping).find(([, v]) => v === 'Quantity *')?.[0] ?? ''
    const valueCol = Object.entries(columnMapping).find(([, v]) => v === 'Value (£)')?.[0] ?? ''
    const categoryCol = Object.entries(columnMapping).find(([, v]) => v === 'Category')?.[0] ?? null
    const mapping: ColumnMapping = {
      tickerCol,
      quantityCol,
      valueCol,
      categoryCol,
      gbx: false,
    }
    buildPreview(rawRows, parsedHeaders, mapping, existingTickers)
    setStep(3)
  }

  // ── Step 3: Confirm Import ────────────────────────────────────────────────
  function handleConfirm() {
    const importRows = previewRows
      .filter(r => r.status !== 'invalid')
      .map(r => ({ ticker: r.ticker, quantity: r.quantity, value: r.value, category: r.category }))
    startTransition(async () => {
      const result = await importHoldings(importRows, mergeMode)
      if (result.error) {
        setImportError(result.error)
      } else {
        onClose()
      }
    })
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const validRowCount = previewRows.filter(r => r.status !== 'invalid').length
  const duplicateCount = previewRows.filter(r => r.status === 'duplicate').length
  const nonCsvCount = Math.max(0, existingTickers.size - duplicateCount)

  // ── Step 1: canAdvance (file selected and no parse error) ─────────────────
  const canAdvanceStep1 = file !== null && fileError === ''

  // ── Step 1 Next button (only for non-auto-detected path, but we may show it) ──
  function handleStep1Next() {
    if (!file) return
    // If broker was auto-detected the timeout handles advance; but if still on step 1
    // (no broker yet) and file is loaded, go to mapping.
    if (!detectedBroker) {
      setStep(2)
    }
    // If broker detected, auto-advance already handled via setTimeout
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      {/* Backdrop — closes modal on click */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal card */}
      <motion.div
        className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto mx-4"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        role="dialog"
        aria-modal="true"
        aria-label={modalTitle(step, detectedBroker)}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            {modalTitle(step, detectedBroker)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xl leading-none -mr-1 min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent rounded"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Step indicator */}
        <div className="mt-4 mb-6">
          <p className="text-zinc-500 text-xs mb-2">Step {step} of {totalSteps}</p>
          <div className="h-1 w-full bg-white/10 rounded-full">
            <motion.div
              className="h-1 bg-accent rounded-full"
              animate={{ width: `${(step / totalSteps) * 100}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">

          {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step-1"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={stepTransition}
            >
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 min-h-[120px] cursor-pointer transition-colors duration-150 ${
                  isDragOver ? 'border-accent bg-accent/5' : file ? 'border-green-500/40 bg-green-500/5' : 'border-zinc-600'
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <>
                    {/* File accepted icon */}
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-green-400" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-white text-sm">{file.name}</span>
                    <span className="text-zinc-500 text-xs">Click to choose a different file</span>
                  </>
                ) : (
                  <>
                    {/* Upload icon */}
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-zinc-400" aria-hidden="true">
                      <polyline points="16 16 12 12 8 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="12" y1="12" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-zinc-300 text-sm">Drag CSV here or click to browse</span>
                    <span className="text-zinc-500 text-xs">.csv files only</span>
                  </>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }}
              />

              {/* File type error */}
              {fileError && <p className="mt-2 text-red-400 text-sm">{fileError}</p>}

              {/* Auto-detect banner */}
              <AnimatePresence>
                {detectedBroker && (
                  <motion.div
                    className="mt-3 rounded-lg px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-300 text-xs"
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    {detectedBroker.name === 'Hargreaves Lansdown'
                      ? 'Hargreaves Lansdown format detected'
                      : 'AJ Bell format detected'}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer */}
              <div className="flex justify-end mt-6">
                <button
                  type="button"
                  onClick={handleStep1Next}
                  disabled={!canAdvanceStep1 || !!detectedBroker}
                  className="bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  Next
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Map Columns (generic CSV only) ────────────────────── */}
          {step === 2 && detectedBroker === null && (
            <motion.div
              key="step-2"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={stepTransition}
            >
              <p className="text-zinc-300 text-sm font-semibold mb-4">Assign CSV columns</p>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-zinc-500 text-xs font-medium uppercase tracking-wide pb-2 border-b border-white/10">
                    <th className="text-left pb-2">CSV Column</th>
                    <th className="text-left pb-2">Assign To</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedHeaders.map(header => (
                    <tr key={header} className="border-b border-white/5 last:border-0">
                      <td className="py-3 pr-4 text-white text-sm">{header}</td>
                      <td className="py-3">
                        <select
                          className="bg-surface border border-border rounded-md px-3 py-2 text-sm text-white w-40 focus:outline-none focus:ring-2 focus:ring-accent"
                          value={columnMapping[header] ?? 'Skip'}
                          onChange={(e) => setColumnMapping(prev => ({ ...prev, [header]: e.target.value }))}
                        >
                          <option value="Ticker *">Ticker *</option>
                          <option value="Quantity *">Quantity *</option>
                          <option value="Value (£)">Value (£)</option>
                          <option value="Category">Category</option>
                          <option value="Skip">Skip</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-zinc-500 text-xs mt-2">* Required</p>
              {mappingError && <p className="text-red-400 text-xs mt-2">{mappingError}</p>}

              {/* Footer */}
              <div className="flex justify-between mt-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="bg-transparent border border-border text-zinc-300 hover:text-white px-4 py-2 rounded-lg text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleMappingNext}
                  className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  Next
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2 of 2 / Step 3: Preview + Confirm ──────────────────── */}
          {((step === 2 && detectedBroker !== null) || step === 3) && (
            <motion.div
              key="step-preview"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={stepTransition}
            >
              {previewRows.length === 0 || validRowCount === 0 ? (
                <p className="py-8 text-center text-zinc-500 text-sm">No valid rows to import</p>
              ) : (
                <>
                  <p className="text-zinc-300 text-sm font-semibold mb-3">
                    Review {validRowCount} rows
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-zinc-500 text-xs font-medium uppercase tracking-wide pb-2 border-b border-white/10">
                          <th className="text-left pb-2 pr-2">Ticker</th>
                          <th className="text-left pb-2 pr-2">Qty</th>
                          <th className="text-left pb-2 pr-2">Value (£)</th>
                          <th className="text-left pb-2 pr-2">Category</th>
                          <th className="text-left pb-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr
                            key={i}
                            className={`border-b border-white/5 last:border-0 ${row.status === 'invalid' ? 'opacity-60' : ''}`}
                          >
                            <td className="py-3 pr-2 text-white">{row.ticker}</td>
                            <td className="py-3 pr-2 text-white">{row.quantity}</td>
                            <td className="py-3 pr-2 text-white">£{row.value}</td>
                            <td className="py-3 pr-2 text-white">{row.category}</td>
                            <td className={`py-3 ${
                              row.status === 'valid'
                                ? 'text-green-400'
                                : row.status === 'duplicate'
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }`}>
                              {row.status === 'invalid' && (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="inline mr-1 align-middle" aria-hidden="true">
                                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                  <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                              )}
                              {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Merge / Replace toggle */}
              <div className="mt-4">
                <p className="text-zinc-500 text-xs mb-2">Import mode</p>
                <div className="flex gap-2">
                  {(['merge', 'replace'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      title={mode === 'merge' ? 'Updates existing tickers; adds new ones' : 'Deletes all current holdings, then imports this CSV'}
                      onClick={() => setMergeMode(mode)}
                      className={`px-4 py-2 rounded-lg text-sm border cursor-pointer min-h-[44px] focus:outline-none focus:ring-2 focus:ring-accent ${
                        mergeMode === mode
                          ? 'bg-accent/20 border-accent text-white'
                          : 'bg-transparent border-border text-zinc-400 hover:border-zinc-500'
                      }`}
                    >
                      {mode === 'merge' ? 'Merge' : 'Replace all'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Replace-all warning banner */}
              {mergeMode === 'replace' && (
                <div className="rounded-lg px-4 py-3 mt-3 mb-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                  {nonCsvCount} holding(s) not in this CSV will be removed from your portfolio.
                </div>
              )}

              {/* Server error */}
              {importError && (
                <p className="mt-3 text-red-400 text-sm">{importError}</p>
              )}

              {/* Footer */}
              <div className="flex justify-between mt-6">
                <button
                  type="button"
                  onClick={() => {
                    if (detectedBroker !== null) {
                      setStep(1)
                    } else {
                      setStep(2)
                    }
                  }}
                  className="bg-transparent border border-border text-zinc-300 hover:text-white px-4 py-2 rounded-lg text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  Back
                </button>

                {validRowCount > 0 && (
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isPending}
                    className="bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {isPending ? 'Importing…' : 'Confirm Import'}
                  </button>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
