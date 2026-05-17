/**
 * UI-02: BuyListTable disclaimer visible + rationale accordion.
 * TDD RED phase — written for 06-02 implementation.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { BuyListTable } from '@/app/dashboard/components/BuyListTable'
import type { PlanResult } from '@/lib/plan/generator'
import { Decimal } from 'decimal.js'

const noStrategyResult: PlanResult = { type: 'no-strategy' }

const noFillResult: PlanResult = {
  type: 'no-fill-tickers',
  gapRows: [
    { category: 'Index Funds', targetPct: 60, currentPct: 0, gapPct: 60, reason: 'no-fill-ticker' },
  ],
}

const buyListResult: PlanResult = {
  type: 'buy-list',
  isaWarning: false,
  effectiveBudget: new Decimal(500),
  gapRows: [],
  items: [
    {
      ticker: 'VWRL',
      category: 'Index Funds',
      amountGbp: new Decimal(350),
      allocationGapPct: 12.5,
      rationale: 'Index Funds is 40% of portfolio vs 60% target — adding to VWRL closes 12.5% of the gap.',
    },
    {
      ticker: 'AAPL',
      category: 'Stocks',
      amountGbp: new Decimal(150),
      allocationGapPct: 5.0,
      rationale: 'Stocks is 20% of portfolio vs 30% target — adding to AAPL closes 5.0% of the gap.',
    },
  ],
}

const buyListIsaWarning: PlanResult = {
  type: 'buy-list',
  isaWarning: true,
  effectiveBudget: new Decimal(300),
  gapRows: [],
  items: [
    {
      ticker: 'VWRL',
      category: 'Index Funds',
      amountGbp: new Decimal(300),
      allocationGapPct: 10,
      rationale: 'Index Funds closes gap.',
    },
  ],
}

describe('BuyListTable (UI-02)', () => {
  it('renders disclaimer "Creator-derived information — not financial advice" on buy-list result', () => {
    render(<BuyListTable result={buyListResult} />)
    expect(screen.getByText(/Creator-derived information — not financial advice/i)).toBeTruthy()
  })

  it('renders disclaimer on no-fill-tickers result', () => {
    render(<BuyListTable result={noFillResult} />)
    expect(screen.getByText(/Creator-derived information — not financial advice/i)).toBeTruthy()
  })

  it('renders disclaimer on no-strategy result', () => {
    render(<BuyListTable result={noStrategyResult} />)
    expect(screen.getByText(/Creator-derived information — not financial advice/i)).toBeTruthy()
  })

  it('clicking a ticker row expands the rationale accordion', () => {
    render(<BuyListTable result={buyListResult} />)
    const vwrlButton = screen.getByRole('button', { name: /VWRL/i })
    fireEvent.click(vwrlButton)
    expect(screen.getByText('This purchase closes 12.5% of your Index Funds gap.')).toBeInTheDocument()
  })

  it('expanded accordion shows category and closes X% text', () => {
    render(<BuyListTable result={buyListResult} />)
    const vwrlButton = screen.getByRole('button', { name: /VWRL/i })
    fireEvent.click(vwrlButton)
    // Use getAllByText since rationale also contains "closes" — ensure at least one match
    expect(screen.getAllByText(/closes/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Index Funds/i).length).toBeGreaterThanOrEqual(1)
  })

  it('clicking expanded row again collapses it (aria-expanded toggles)', () => {
    render(<BuyListTable result={buyListResult} />)
    const vwrlButton = screen.getByRole('button', { name: /VWRL/i })
    // Before click: collapsed
    expect(vwrlButton).toHaveAttribute('aria-expanded', 'false')
    // Expand
    fireEvent.click(vwrlButton)
    expect(vwrlButton).toHaveAttribute('aria-expanded', 'true')
    // Collapse
    fireEvent.click(vwrlButton)
    expect(vwrlButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('ISA warning is NOT rendered by BuyListTable (owned by PlanTab per UI-SPEC)', () => {
    // CR-03 fix: ISA warning moved to PlanTab — BuyListTable only renders buy rows.
    render(<BuyListTable result={buyListIsaWarning} />)
    expect(screen.queryByText(/remaining ISA allowance/i)).toBeNull()
  })

  it('renders glassmorphism row cards (no table element)', () => {
    const { container } = render(<BuyListTable result={buyListResult} />)
    expect(container.querySelector('table')).toBeNull()
  })
})

describe('BuyListTable — Price column (Phase 8)', () => {
  it('renders £-formatted price when prices prop provides a value', () => {
    const prices = { VWRL: 114.22 }
    render(<BuyListTable result={buyListResult} prices={prices} />)
    expect(screen.getByText('£114.22')).toBeInTheDocument()
  })

  it('renders em dash when price in prices map is null', () => {
    const prices = { VWRL: null }
    render(<BuyListTable result={buyListResult} prices={prices} />)
    // Both VWRL and AAPL have no fetched price — all price cells show em dash
    const emDashes = screen.getAllByText('—')
    expect(emDashes.length).toBeGreaterThanOrEqual(1)
  })

  it('renders em dash when prices prop is not provided', () => {
    render(<BuyListTable result={buyListResult} />)
    // No prices prop — all price cells show em dash (U+2014)
    const emDashes = screen.getAllByText('—')
    expect(emDashes.length).toBeGreaterThanOrEqual(1)
  })

  it('renders em dash when ticker is not present in prices map', () => {
    const prices = {}  // empty map — VWRL not present
    render(<BuyListTable result={buyListResult} prices={prices} />)
    const emDashes = screen.getAllByText('—')
    expect(emDashes.length).toBeGreaterThanOrEqual(1)
  })
})
