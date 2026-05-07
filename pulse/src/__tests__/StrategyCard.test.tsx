/**
 * UI-05: StrategyCard renders confidence score, lastRefreshedAt, contradiction badge.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StrategyCard } from '@/app/dashboard/components/StrategyCard'
import type { CreatorStrategy } from '@/types'

const mockStrategy: CreatorStrategy = {
  id: 's1',
  creatorId: 'c1',
  allocation: { 'Index Funds': 60, Stocks: 30, Cash: 10 },
  confidence: 82,
  sourceVideoIds: ['vid1'],
  hasContradiction: false,
  contradictionNote: null,
  extractedAt: new Date('2026-05-01'),
  createdAt: new Date('2026-05-01'),
}

const mockStrategyWithContradiction: CreatorStrategy = {
  ...mockStrategy,
  id: 's2',
  hasContradiction: true,
  contradictionNote: 'Index Funds: 40% → 60% (+20%)',
}

describe('StrategyCard (UI-05)', () => {
  it('renders confidence score as "Confidence: N%"', () => {
    render(<StrategyCard strategy={mockStrategy} lastRefreshedAt="01/05/2026" />)
    expect(screen.getByText(/Confidence: 82%/i)).toBeInTheDocument()
  })

  it('renders lastRefreshedAt as "Last refreshed {date}"', () => {
    render(<StrategyCard strategy={mockStrategy} lastRefreshedAt="01/05/2026" />)
    expect(screen.getByText(/Last refreshed 01\/05\/2026/i)).toBeInTheDocument()
  })

  it('renders contradiction badge "Strategy conflict detected" when hasContradiction is true', () => {
    render(<StrategyCard strategy={mockStrategyWithContradiction} lastRefreshedAt="01/05/2026" />)
    expect(screen.getByText(/Strategy conflict detected/i)).toBeInTheDocument()
  })

  it('does NOT render contradiction badge when hasContradiction is false', () => {
    render(<StrategyCard strategy={mockStrategy} lastRefreshedAt="01/05/2026" />)
    expect(screen.queryByText(/Strategy conflict detected/i)).toBeNull()
  })

  it('renders allocation categories from strategy', () => {
    render(<StrategyCard strategy={mockStrategy} lastRefreshedAt="01/05/2026" />)
    expect(screen.getByText('Index Funds')).toBeInTheDocument()
    expect(screen.getByText('Stocks')).toBeInTheDocument()
  })

  it('renders "Never" as lastRefreshedAt when no strategy extracted', () => {
    render(<StrategyCard strategy={null} lastRefreshedAt="Never" />)
    expect(screen.getByText(/Last refreshed Never/i)).toBeInTheDocument()
  })
})
