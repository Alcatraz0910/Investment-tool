'use client'
import React from 'react'

type BadgeVariant =
  | 'high-conviction'
  | 'medium-conviction'
  | 'low-conviction'
  | 'consensus'
  | 'trending-bullish'
  | 'trending-cautious'
  | 'contradiction'
  | 'no-recent-posts'
  | 'news-count'
  | 'this-month'
  | 'established'
  | 'macro-theme'

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  title?: string
  sentimentDot?: 'positive' | 'negative' | 'neutral'
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  'high-conviction':   'text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 rounded px-1.5 py-0.5',
  'medium-conviction': 'text-xs font-semibold text-zinc-400 bg-zinc-700/50 border border-zinc-600/30 rounded px-1.5 py-0.5',
  'low-conviction':    'text-xs font-semibold text-zinc-500 bg-zinc-800/50 border border-zinc-700/30 rounded px-1.5 py-0.5',
  'consensus':         'text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5',
  'trending-bullish':  'text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/30 rounded-full px-2 py-0.5',
  'trending-cautious': 'text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5',
  'contradiction':     'text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5 cursor-help',
  'no-recent-posts':   'text-xs font-semibold text-zinc-500 bg-zinc-700/40 border border-zinc-600/30 rounded-full px-2 py-0.5',
  'news-count':        'text-xs font-semibold text-zinc-400 bg-zinc-700/50 border border-zinc-600/30 rounded px-1.5 py-0.5',
  'this-month':        'text-xs text-amber-400',
  'established':       'text-xs text-zinc-500',
  'macro-theme':       'flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 bg-zinc-800/60 border border-white/10',
}

const DOT_CLASSES: Record<NonNullable<BadgeProps['sentimentDot']>, string> = {
  positive: 'bg-green-400',
  negative: 'bg-red-400',
  neutral:  'bg-zinc-400',
}

export function Badge({ variant, children, title, sentimentDot }: BadgeProps) {
  if (variant === 'macro-theme') {
    return (
      <span className={VARIANT_CLASSES['macro-theme']} title={title}>
        {sentimentDot && (
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_CLASSES[sentimentDot]}`} aria-hidden="true" />
        )}
        <span className="text-zinc-300">{children}</span>
      </span>
    )
  }
  return (
    <span className={VARIANT_CLASSES[variant]} title={title}>
      {children}
    </span>
  )
}
