/**
 * UI-04: ContributionCalculator slider and real-time update tests.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { ContributionCalculator } from '@/app/dashboard/components/ContributionCalculator'
import type { HoldingWithFillTicker } from '@/lib/plan/generator'
import { generatePlan } from '@/lib/plan/generator'

const mockHolding: HoldingWithFillTicker = {
  id: 'h1',
  userId: 'u1',
  ticker: 'VUSA',
  category: 'Index Funds',
  currentValue: new Decimal(1000),
  isFillTicker: true,
}

describe('ContributionCalculator (UI-04)', () => {
  it('generatePlan is a function (import check)', () => {
    expect(typeof generatePlan).toBe('function')
  })

  it('renders slider with min=200 and max=1000', () => {
    render(
      <ContributionCalculator
        portfolio={[mockHolding]}
        strategy={null}
        isaRemaining={20000}
        budget={500}
        onBudgetChange={() => {}}
      />
    )
    const slider = screen.getByRole('slider', { name: /monthly contribution budget/i })
    expect(slider).toHaveAttribute('min', '200')
    expect(slider).toHaveAttribute('max', '1000')
  })

  it('renders the current budget value in the number input', () => {
    render(
      <ContributionCalculator
        portfolio={[mockHolding]}
        strategy={null}
        isaRemaining={20000}
        budget={750}
        onBudgetChange={() => {}}
      />
    )
    const numberInput = screen.getByRole('spinbutton', { name: /monthly contribution amount/i })
    expect(numberInput).toHaveValue(750)
  })

  it.todo('changing slider value calls onBudgetChange with new value')
  it.todo('changing slider value re-renders BuyListTable with updated amounts (integration — requires PlanTab context)')
})
