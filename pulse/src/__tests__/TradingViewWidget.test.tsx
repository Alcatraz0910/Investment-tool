/**
 * Phase 8 — TradingViewWidget component tests
 * Tests DOM structure and script injection behaviour (jsdom does NOT execute injected scripts)
 */
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TradingViewWidget } from '../components/TradingViewWidget'

describe('TradingViewWidget', () => {
  it('renders a container div with the tradingview-widget-container class', () => {
    const { container } = render(<TradingViewWidget symbol="LSE:VWRL" />)
    expect(container.querySelector('.tradingview-widget-container')).toBeTruthy()
  })

  it('injects a script tag pointing to the TradingView CDN', () => {
    const { container } = render(<TradingViewWidget symbol="LSE:VWRL" />)
    const script = container.querySelector('script')
    expect(script?.src).toContain('s3.tradingview.com')
    expect(script?.src).toContain('embed-widget-symbol-overview')
  })

  it('uses [[bareTicker, "EXCHANGE:TICKER|1D"]] symbols format — NOT [[fullSymbol, fullSymbol|1D]]', () => {
    const { container } = render(<TradingViewWidget symbol="LSE:VWRL" />)
    const script = container.querySelector('script')
    const config = JSON.parse(script?.innerHTML ?? '{}')
    // bareTicker must be 'VWRL' (not 'LSE:VWRL')
    expect(config.symbols).toEqual([['VWRL', 'LSE:VWRL|1D']])
  })

  it('applies the default height (220) to the container style', () => {
    const { container } = render(<TradingViewWidget symbol="LSE:VWRL" />)
    const div = container.querySelector('.tradingview-widget-container') as HTMLElement
    expect(div?.style.height).toBe('220px')
  })

  it('applies a custom height prop to the container style', () => {
    const { container } = render(<TradingViewWidget symbol="LSE:VWRL" height={300} />)
    const div = container.querySelector('.tradingview-widget-container') as HTMLElement
    expect(div?.style.height).toBe('300px')
  })

  it('sets the aria-label on the container div', () => {
    const { container } = render(<TradingViewWidget symbol="LSE:VWRL" />)
    const div = container.querySelector('.tradingview-widget-container')
    expect(div?.getAttribute('aria-label')).toBe('TradingView chart for LSE:VWRL')
  })

  it('encodes the correct exchange and ticker in the script JSON', () => {
    const { container } = render(<TradingViewWidget symbol="LSE:AAPL" />)
    const script = container.querySelector('script')
    const config = JSON.parse(script?.innerHTML ?? '{}')
    expect(config.symbols).toEqual([['AAPL', 'LSE:AAPL|1D']])
  })
})
