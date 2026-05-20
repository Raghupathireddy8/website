"use client"

import { useEffect, useRef } from "react"

// TradingView widget — loads from their CDN directly, no proxy, instant

function TradingViewTicker() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = ""

    const script = document.createElement("script")
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"
    script.async = true
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: "NSE:NIFTY",    title: "NIFTY 50"   },
        { proName: "NSE:BANKNIFTY",title: "BANK NIFTY" },
        { proName: "NSE:SENSEX",   title: "SENSEX"     },
        { proName: "NSE:INDIAVIX", title: "INDIA VIX"  },
        { proName: "FX:USDINR",    title: "USD/INR"    },
        { proName: "MCX:GOLD1!",   title: "GOLD"       },
        { proName: "MCX:CRUDEOIL1!",title:"CRUDE OIL"  },
        { proName: "NASDAQ:AAPL",  title: "GIFT NIFTY" },
      ],
      showSymbolLogo: false,
      isTransparent: true,
      displayMode: "adaptive",
      colorTheme: "dark",
      locale: "en",
    })

    ref.current.appendChild(script)
  }, [])

  return (
    <div className="tradingview-widget-container" ref={ref}>
      <div className="tradingview-widget-container__widget" />
    </div>
  )
}

function TradingViewMiniChart({ symbol, label }: { symbol: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = ""

    const script = document.createElement("script")
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js"
    script.async = true
    script.innerHTML = JSON.stringify({
      symbol,
      width: "100%",
      height: 160,
      locale: "en",
      dateRange: "1D",
      colorTheme: "dark",
      isTransparent: true,
      autosize: true,
      largeChartUrl: "",
      noTimeScale: false,
    })

    ref.current.appendChild(script)
  }, [])

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground px-4 pt-3 pb-1">{label}</p>
      <div className="tradingview-widget-container" ref={ref}>
        <div className="tradingview-widget-container__widget" />
      </div>
    </div>
  )
}

export function LiveIndicesBar() {
  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Market Overview</h2>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <span className="text-xs font-medium text-success">LIVE</span>
        </div>
      </div>

      {/* Scrolling ticker tape — all symbols */}
      <div className="bg-card border border-border rounded-xl overflow-hidden px-2 py-1">
        <TradingViewTicker />
      </div>

      {/* Mini charts — Nifty + Bank Nifty */}
      <div className="grid grid-cols-2 gap-3">
        <TradingViewMiniChart symbol="NSE:NIFTY"     label="NIFTY 50"   />
        <TradingViewMiniChart symbol="NSE:BANKNIFTY" label="BANK NIFTY" />
      </div>

    </div>
  )
}
