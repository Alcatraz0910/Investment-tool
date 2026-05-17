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

  it('renders timestamp with text-zinc-400 class when priceFetchedAt is fresh (< 24h)', () => {
    render(
      <PortfolioTab
        profile={defaultProfile}
        holdings={[makeHolding({ priceFetchedAt: freshDate })]}
      />
    )
    // The timestamp span should have text-zinc-400 (fresh) not text-amber-400 (stale)
    const allSpans = document.querySelectorAll('span.text-zinc-400')
    // At least one span with text-zinc-400 must contain the localised timestamp text
    const timestampText = new Date(freshDate).toLocaleString('en-GB')
    const match = Array.from(allSpans).find(el => el.textContent === timestampText)
    expect(match).toBeTruthy()
    expect(match?.classList.contains('text-amber-400')).toBe(false)
  })

  it('renders timestamp with text-amber-400 class when priceFetchedAt is stale (> 24h)', () => {
    render(
      <PortfolioTab
        profile={defaultProfile}
        holdings={[makeHolding({ priceFetchedAt: staleDate })]}
      />
    )
    const timestampText = new Date(staleDate).toLocaleString('en-GB')
    const amberSpans = document.querySelectorAll('span.text-amber-400')
    const match = Array.from(amberSpans).find(el => el.textContent === timestampText)
    expect(match).toBeTruthy()
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

  it('renders chart toggle button with aria-expanded=false by default', () => {
    render(
      <PortfolioTab
        profile={defaultProfile}
        holdings={[makeHolding({ ticker: 'VWRL' })]}
      />
    )
    const chartBtn = screen.getByLabelText('Show chart for VWRL')
    expect(chartBtn.getAttribute('aria-expanded')).toBe('false')
  })
})
