/**
 * TrustWeightSlider — Phase 4 (D-08, D-09, D-10, BLEND-01).
 *
 * Shows a global trust weight slider (0–100%) for a creator.
 * "Customize per category" toggle reveals 3 per-category sliders.
 * Auto-saves on onMouseUp / onTouchEnd. Green tick confirmation (1.5s).
 *
 * Client component — interactive slider.
 */
'use client'
import { useState, useRef, useEffect } from 'react'
import { saveCreatorWeight } from '@/app/dashboard/actions'

const CATEGORIES = [
  'Index Funds',
  'Stocks',
  'Cash',
] as const

interface CategoryWeight {
  category: string
  weight: number
}

interface TrustWeightSliderProps {
  userCreatorId: string
  initialGlobalWeight: number
  initialCategoryWeights: CategoryWeight[]
}

function SingleSlider({
  label,
  initialValue,
  onSave,
}: {
  label: string
  initialValue: number
  onSave: (value: number) => Promise<void>
}) {
  const [value, setValue] = useState(initialValue)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const handleRelease = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(value)
      setSaved(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setSaved(false), 1500)
    } catch {
      setSaveError('Save failed — try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 min-h-[44px]" style={{ touchAction: 'manipulation' }}>
        <span className="text-sm text-zinc-400 w-32 shrink-0">{label}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          onMouseUp={handleRelease}
          onTouchEnd={handleRelease}
          disabled={saving}
          aria-label={`${label} trust weight: ${value}%`}
          className="flex-1 accent-accent disabled:opacity-60"
        />
        <span className="text-sm text-zinc-400 w-8 text-right">{value}%</span>
        {saved && (
          <span className="text-green-400 text-sm" aria-label="Saved">
            ✓
          </span>
        )}
        {!saved && <span className="w-4" />}
      </div>
      {saveError && (
        <span className="text-red-400 text-xs pl-32">{saveError}</span>
      )}
    </div>
  )
}

export function TrustWeightSlider({
  userCreatorId,
  initialGlobalWeight,
  initialCategoryWeights,
}: TrustWeightSliderProps) {
  const [showCategories, setShowCategories] = useState(false)

  const getCategoryInitial = (cat: string): number => {
    return initialCategoryWeights.find((w) => w.category === cat)?.weight ?? initialGlobalWeight
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      {/* Global slider */}
      <SingleSlider
        label="Trust weight"
        initialValue={initialGlobalWeight}
        onSave={(value) =>
          saveCreatorWeight({ userCreatorId, category: null, weight: value })
            .then(() => {})
        }
      />

      {/* Customize per category toggle */}
      <button
        type="button"
        onClick={() => setShowCategories((v) => !v)}
        className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-accent rounded"
      >
        {showCategories ? 'Hide per-category' : 'Customize per category'}
      </button>

      {/* Per-category sliders (collapsed by default) */}
      {showCategories && (
        <div className="mt-3 flex flex-col gap-2">
          {CATEGORIES.map((cat) => (
            <SingleSlider
              key={cat}
              label={cat}
              initialValue={getCategoryInitial(cat)}
              onSave={(value) =>
                saveCreatorWeight({ userCreatorId, category: cat, weight: value })
                  .then(() => {})
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
