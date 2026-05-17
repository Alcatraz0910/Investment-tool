'use client'
import { useEffect, useRef } from 'react'

interface Props {
  symbol: string  // e.g. "LSE:VWRL"
  height?: number
}

export function TradingViewWidget({ symbol, height = 220 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    // Clear prior render — prevents double-chart in React StrictMode (two useEffect calls)
    containerRef.current.innerHTML = ''

    const [exchange, ticker] = symbol.split(':')  // 'LSE', 'VWRL'

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbols: [[ticker, `${exchange}:${ticker}|1D`]],  // [['VWRL', 'LSE:VWRL|1D']]
      chartOnly: false,
      width: '100%',
      height,
      locale: 'en',
      colorTheme: 'dark',
      autosize: false,
      showVolume: false,
      showMA: false,
      hideDateRanges: false,
      hideMarketStatus: false,
      hideSymbolLogo: false,
      scalePosition: 'right',
      scaleMode: 'Normal',
      fontFamily: '-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu',
      fontSize: '10',
      noTimeScale: false,
      valuesTracking: '1',
      changeMode: 'price-and-percent',
      chartType: 'area',
      lineWidth: 2,
      lineType: 0,
    })
    containerRef.current.appendChild(script)
  }, [symbol, height])

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height }}
      aria-label={`TradingView chart for ${symbol}`}
    />
  )
}
