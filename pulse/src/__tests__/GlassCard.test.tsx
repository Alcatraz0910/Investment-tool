/**
 * UI-01: AnimatedTabPanel renders children.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnimatedTabPanel } from '@/app/dashboard/components/AnimatedTabPanel'

describe('AnimatedTabPanel (UI-01)', () => {
  it('renders children with the provided tabKey', () => {
    render(
      <AnimatedTabPanel tabKey="plan">
        <div>Tab content</div>
      </AnimatedTabPanel>
    )
    expect(screen.getByText('Tab content')).toBeInTheDocument()
  })

  it('renders children with a different tabKey', () => {
    render(
      <AnimatedTabPanel tabKey="portfolio">
        <p>Portfolio panel</p>
      </AnimatedTabPanel>
    )
    expect(screen.getByText('Portfolio panel')).toBeInTheDocument()
  })

  it.todo('wraps children in motion.div with correct initial/animate props (visual — manual verify)')
})
