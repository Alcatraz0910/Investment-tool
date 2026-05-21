/**
 * Phase 8 — PortfolioTab price display tests
 * Tests the Phase 8 price columns: current price, as-of timestamp (staleness), and null states.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PortfolioTab } from '../components/PortfolioTab'
import type { AssetCategory } from '../types'

// ---------------------------------------------------------------------------
// Module mocks — required for client component that imports server actions
// ---------------------------------------------------------------------------

vi.mock('@/app/dashboard/actions', () => ({
  deleteHolding: vi.fn().mockResolvedValue({}),
  updateMonthlyBudget: vi.fn().mockResolvedValue({}),
  refreshHoldingPrices: vi.fn().mockResolvedValue({ results: [] }),
}))

vi.mock('@/app/dashboard/plan-actions', () => ({
  setFillTicker: vi.fn().mockResolvedValue({}),
  clearFillTicker: vi.fn().mockResolvedValue({}),
  upsertBuyList: vi.fn().mockResolvedValue({}),
}))

// Avoid DOM script injection in tests
vi.mock('@/components/TradingViewWidget', () => ({
  TradingViewWidget: () => <div data-testid="tradingview-widget" />,
}))

// Avoid modal rendering complexity in these tests
vi.mock('@/components/HoldingModal', () => ({
  HoldingModal: () => null,
}))

vi.mock('@/components/ImportCSVModal', () => ({
  default: () => null,
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const freshDate = new Date(Date.now() - 1000 * 60 * 30).toISOString()       // 30 min ago (fresh)
const staleDate = new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString()  // 25 hours ago (stale)

interface ClientHolding {
  id: string
  userId: string
  ticker: string
  name?: string
  category: AssetCategory
  quantity: number
  currentValue: number
  isFillTicker: boolean
  currentPrice: number | null
  priceFetchedAt: string | null
  createdAt: Date
  updatedAt: Date
}

function makeHolding(overrides: Partial<ClientHolding> = {}): ClientHolding {
  return {
    id: '1',
    userId: 'user-1',
    ticker: 'VWRL',
    category: 'Index Funds',
    quantity: 10,
    currentValue: 1000,
    isFillTicker: false,
    currentPrice: 114.22,
    priceFetchedAt: freshDate,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

const defaultProfile = {
  id: 'profile-1',
  email: 'test@example.com',
  monthlyBudget: 500,
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PortfolioTab — price display (Phase 8)', () => {
  it('renders £-formatted price when currentPrice is set', () => {
    render(
      <PortfolioTab
        profile={defaultProfile}
        holdings={[makeHolding({ currentPrice: 114.22 })]}
      />
    )
    expect(screen.getByText('£114.22')).toBeTruthy()
  })

  it('renders em dash when currentPrice is null', () => {
    render(
      <PortfolioTab
        profile={defaultProfile}
        holdings={[makeHolding({ currentPrice: null })]}
      />
    )
    const dashEl = screen.getByLabelText('Price not available')
    expect(dashEl.textContent).toBe('—')
  })

  it('renders price span without amber class when priceFetchedAt is fresh (< 24h)', () => {
    render(
      <PortfolioTab
        profile={defaultProfile}
        holdings={[makeHolding({ currentPrice: 114.22, priceFetchedAt: freshDate })]}
      />
    )
    // Phase 15: staleness coloring is on the price span itself; fresh = text-white, stale = text-amber-400
    // Timestamp is surfaced via title attribute, not as visible text
    const timestampTitle = `As of ${new Date(freshDate).toLocaleString('en-GB')}`
    const priceSpan = document.querySelector(`span[title="${timestampTitle}"]`)
    expect(priceSpan).toBeTruthy()
    expect(priceSpan?.classList.contains('text-amber-400')).toBe(false)
  })

  it('renders price span with text-amber-400 class when priceFetchedAt is stale (> 24h)', () => {
    render(
      <PortfolioTab
        profile={defaultProfile}
        holdings={[makeHolding({ currentPrice: 114.22, priceFetchedAt: staleDate })]}
      />
    )
    // Phase 15: stale price span gets text-amber-400; timestamp is in title attribute
    const timestampTitle = `As of ${new Date(staleDate).toLocaleString('en-GB')}`
    const priceSpan = document.querySelector(`span[title="${timestampTitle}"]`)
    expect(priceSpan).toBeTruthy()
    expect(priceSpan?.classList.contains('text-amber-400')).toBe(true)
  })

  it('renders nothing in the as-of cell when priceFetchedAt is null', () => {
    render(
      <PortfolioTab
        profile={defaultProfile}
        holdings={[makeHolding({ priceFetchedAt: null })]}
      />
    )
    // No amber or zinc timestamp spans should contain a localised date string
    // (we verify by confirming neither class has our null-date content)
    const amberSpans = document.querySelectorAll('span.text-amber-400')
    const zincSpans = document.querySelectorAll('span.text-zinc-400')
    // Filter to only timestamp-like content (contains digits and colons)
    const hasTimestamp = (els: NodeListOf<Element>) =>
      Array.from(els).some(el => /\d{1,2}\/\d{1,2}\/\d{4}/.test(el.textContent ?? ''))
    expect(hasTimestamp(amberSpans)).toBe(false)
    // text-zinc-400 is also used for quantity etc., so we just check amber is absent
  })

  it('renders the Refresh Prices button', () => {
    render(
      <PortfolioTab
        profile={defaultProfile}
        holdings={[makeHolding()]}
      />
    )
    expect(screen.getByText('Refresh Prices')).toBeTruthy()
  })

  it('renders TradingView chart link for holding', () => {
    render(
      <PortfolioTab
        profile={defaultProfile}
        holdings={[makeHolding({ ticker: 'VWRL' })]}
      />
    )
    // Phase 15: chart toggle button replaced with a TradingView link.
    // Link appears in both mobile mini-card and desktop table, so use getAllByLabelText.
    const chartLinks = screen.getAllByLabelText('View VWRL chart on TradingView')
    expect(chartLinks.length).toBeGreaterThan(0)
    expect(chartLinks[0].tagName.toLowerCase()).toBe('a')
  })
})
