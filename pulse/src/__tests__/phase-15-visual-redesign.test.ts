/**
 * Phase 15 — Visual Redesign: Nyquist gap-fill tests
 *
 * FILE-SCAN pattern (same as design-system.test.tsx): uses fs.readFileSync
 * to assert structural properties in source files. No React rendering needed.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ── file paths ──────────────────────────────────────────────────────────────
const tabBarPath     = path.resolve(__dirname, '../app/dashboard/TabBar.tsx')
const watchListPath  = path.resolve(__dirname, '../app/dashboard/components/WatchListTab.tsx')
const portfolioPath  = path.resolve(__dirname, '../components/PortfolioTab.tsx')

let tabBar:    string
let watchList: string
let portfolio: string

beforeAll(() => {
  tabBar    = fs.readFileSync(tabBarPath,    'utf8')
  watchList = fs.readFileSync(watchListPath, 'utf8')
  portfolio = fs.readFileSync(portfolioPath, 'utf8')
})

// ── G1 · VIS-04 — no hardcoded indigo-500 button classes ────────────────────
describe('VIS-04: no hardcoded bg-indigo-500 or focus:ring-indigo-500 on buttons', () => {
  it('WatchListTab.tsx does not contain bg-indigo-500', () => {
    expect(watchList).not.toContain('bg-indigo-500')
  })

  it('WatchListTab.tsx does not contain focus:ring-indigo-500', () => {
    expect(watchList).not.toContain('focus:ring-indigo-500')
  })

  it('PortfolioTab.tsx does not contain bg-indigo-500', () => {
    expect(portfolio).not.toContain('bg-indigo-500')
  })

  it('PortfolioTab.tsx does not contain focus:ring-indigo-500', () => {
    expect(portfolio).not.toContain('focus:ring-indigo-500')
  })

  it('TabBar.tsx does not contain bg-indigo-500', () => {
    expect(tabBar).not.toContain('bg-indigo-500')
  })

  it('TabBar.tsx does not contain focus:ring-indigo-500', () => {
    expect(tabBar).not.toContain('focus:ring-indigo-500')
  })
})

// ── G2 · VIS-01 — TabBar glass container + sliding indicator ────────────────
describe('VIS-01: TabBar has glass container and layoutId sliding indicator', () => {
  it('TabBar.tsx contains backdrop-blur (glass effect)', () => {
    expect(tabBar).toContain('backdrop-blur')
  })

  it('TabBar.tsx contains layoutId="tab-indicator" (animated sliding pill)', () => {
    expect(tabBar).toContain('layoutId="tab-indicator"')
  })

  it('TabBar.tsx uses bg-accent token for active indicator (not hardcoded colour)', () => {
    expect(tabBar).toContain('bg-accent')
  })

  it('TabBar.tsx imports useRouter (tab navigation via router)', () => {
    expect(tabBar).toContain('useRouter')
  })
})

// ── G3 · MOB-03 — PortfolioTab mobile card layout ───────────────────────────
describe('MOB-03: PortfolioTab has sm:hidden mini-card container and hidden desktop table', () => {
  it('PortfolioTab.tsx contains sm:hidden (mobile-only card block)', () => {
    expect(portfolio).toContain('sm:hidden')
  })

  it('PortfolioTab.tsx contains hidden sm:table or hidden sm: (table hidden on mobile)', () => {
    const hasHiddenSmTable = portfolio.includes('hidden sm:table') || portfolio.includes('hidden sm:')
    expect(hasHiddenSmTable).toBe(true)
  })
})

// ── G4 · MOB-01 — WatchListTab ticker toggle aria-expanded ──────────────────
describe('MOB-01: WatchListTab ticker expand toggle has aria-expanded for accessibility', () => {
  it('WatchListTab.tsx contains aria-expanded attribute', () => {
    expect(watchList).toContain('aria-expanded')
  })

  it('WatchListTab.tsx contains tickersExpanded state variable', () => {
    expect(watchList).toContain('tickersExpanded')
  })
})

// ── G5 · MOB-02 — WatchListTab touch targets 44 px minimum ─────────────────
describe('MOB-02: WatchListTab touch targets meet 44px minimum height', () => {
  it('WatchListTab.tsx contains at least 2 min-h-[44px] touch target instances', () => {
    // Count occurrences of min-h-[44px] in the file
    const occurrences = (watchList.match(/min-h-\[44px\]/g) ?? []).length
    expect(occurrences).toBeGreaterThanOrEqual(2)
  })
})
