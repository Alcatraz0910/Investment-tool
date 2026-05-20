'use client'
import React, { useEffect } from 'react'
import { useMotionValue, useTransform, animate, useReducedMotion, motion } from 'framer-motion'

interface StatTileProps {
  label: string
  value: string          // pre-formatted string e.g. "£12,450.00"
  delta?: string         // optional e.g. "+£320 this month"
  deltaPositive?: boolean // true = text-green-400, false = text-red-400, undefined = text-zinc-400
  animate?: boolean      // enable count-up (default: true)
  className?: string
}

// Extract leading number from formatted string, e.g. "£12,450.00" -> { prefix: "£", numeric: 12450.00, suffix: "" }
function parseValue(v: string): { prefix: string; numeric: number; suffix: string } {
  const match = v.match(/^([^0-9]*)([0-9,]+\.?[0-9]*)(.*)$/)
  if (!match) return { prefix: '', numeric: 0, suffix: v }
  const numeric = parseFloat(match[2].replace(/,/g, ''))
  return { prefix: match[1], numeric: isNaN(numeric) ? 0 : numeric, suffix: match[3] }
}

export function StatTile({ label, value, delta, deltaPositive, animate: shouldAnimate = true, className = '' }: StatTileProps) {
  const shouldReduceMotion = useReducedMotion()
  const { prefix, numeric, suffix } = parseValue(value)
  const count = useMotionValue(0)

  useEffect(() => {
    if (!shouldAnimate || shouldReduceMotion) {
      count.set(numeric)
      return
    }
    const controls = animate(count, numeric, { duration: 0.8, ease: 'easeOut' })
    return controls.stop
  }, [numeric, shouldAnimate, shouldReduceMotion]) // eslint-disable-line react-hooks/exhaustive-deps

  const display = useTransform(count, (v) => {
    // Re-apply formatting: 2 decimal places with thousands separator
    const formatted = v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `${prefix}${formatted}${suffix}`
  })

  const deltaColor = deltaPositive === true
    ? 'text-green-400'
    : deltaPositive === false
      ? 'text-red-400'
      : 'text-zinc-400'

  return (
    <div className={className}>
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">{label}</p>
      <motion.p className="text-2xl font-semibold text-white font-mono">{display}</motion.p>
      {delta && <p className={`text-xs font-semibold ${deltaColor}`}>{delta}</p>}
    </div>
  )
}
