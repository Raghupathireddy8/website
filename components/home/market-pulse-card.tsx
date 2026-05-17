"use client"

import { useState, useEffect, useCallback } from "react"

const WATCHLIST = [
  "RELIANCE.NS","TCS.NS","HDFCBANK.NS","INFY.NS","ICICIBANK.NS",
  "HINDUNILVR.NS","SBIN.NS","BHARTIARTL.NS","ITC.NS","KOTAKBANK.NS",
  "LT.NS","AXISBANK.NS","ASIANPAINT.NS","MARUTI.NS","TITAN.NS",
  "SUNPHARMA.NS","ULTRACEMCO.NS","BAJFINANCE.NS","NESTLEIND.NS","WIPRO.NS",
  "HCLTECH.NS","POWERGRID.NS","NTPC.NS","ONGC.NS","COALINDIA.NS",
  "TATAMOTORS.NS","JSWSTEEL.NS","HINDALCO.NS","TATASTEEL.NS","ADANIENT.NS",
  "BAJAJFINSV.NS","DRREDDY.NS","CIPLA.NS","DIVISLAB.NS","APOLLOHOSP.NS",
  "EICHERMOT.NS","HEROMOTOCO.NS","BPCL.NS","TECHM.NS","GRASIM.NS"
]

const COMPANY_NAMES: Record<string, string> = {
  "RELIANCE": "Reliance Industries",
  "TCS": "Tata Consultancy",
  "HDFCBANK": "HDFC Bank",
  "INFY": "Infosys",
  "ICICIBANK": "ICICI Bank",
  "HINDUNILVR": "Hindustan Unilever",
  "SBIN": "State Bank of India",
  "BHARTIARTL": "Bharti Airtel",
  "ITC": "ITC Limited",
  "KOTAKBANK": "Kotak Mahindra Bank",
  "LT": "Larsen & Toubro",
  "AXISBANK": "Axis Bank",
  "ASIANPAINT": "Asian Paints",
  "MARUTI": "Maruti Suzuki",
  "TITAN": "Titan Company",
  "SUNPHARMA": "Sun Pharma",
  "ULTRACEMCO": "UltraTech Cement",
  "BAJFINANCE": "Bajaj Finance",
  "NESTLEIND": "Nestle India",
  "WIPRO": "Wipro",
  "HCLTECH": "HCL Technologies",
  "POWERGRID": "Power Grid Corp",
  "NTPC": "NTPC Limited",
  "ONGC": "ONGC",
  "COALINDIA": "Coal India",
  "TATAMOTORS": "Tata Motors",
  "JSWSTEEL": "JSW Steel",
  "HINDALCO": "Hindalco Industries",
  "TATASTEEL": "Tata Steel",
  "ADANIENT": "Adani Enterprises",
  "BAJAJFINSV": "Bajaj Finserv",
  "DRREDDY": "Dr Reddy's Labs",
  "CIPLA": "Cipla",
  "DIVISLAB": "Divi's Labs",
  "APOLLOHOSP": "Apollo Hospitals",
  "EICHERMOT": "Eicher Motors",
  "HEROMOTOCO": "Hero MotoCorp",
  "BPCL": "BPCL",
  "TECHM": "Tech Mahindra",
  "GRASIM": "Grasim Industries",
}

interface StockData {
  symbol: string
  name: string
  currentPrice: number
  previousClose: number
  change: number
  changePercent: number
  volume: number
  dayHigh: number
  dayLow: number
}

type TabType = "gainers" | "losers" | "volume"

const isMarketOpen = (): boolean => {
  const now = new Date()
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
  const hours = ist.getHours()
  const minutes = ist.getMinutes()
  const day = ist.getDay()
  if (day === 0 || day === 6) return false
  const timeInMin = hours * 60 + minutes
  return timeInMin >= 555 && timeInMin <= 930
}

const getNextMarketOpen = (): string => {
  const now = new Date()
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
  const day = ist.getDay()
  const daysUntilMonday = day === 0 ? 1 : day === 6 ? 2 : 0
  if (daysUntilMonday > 0) {
    return `Next open ${daysUntilMonday === 1 ? "Mon" : "Mon"} 9:15 AM`
  }
  return "Next open 9:15 AM"
}

const formatVolume = (vol: number): string => {
  if (vol >= 10000000) return `${(vol / 10000000).toFixed(1)} Cr`
  if (vol >= 100000) return `${(vol / 100000).toFixed(1)} L`
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)} K`
  return vol.toString()
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function MarketPulseCard() {
  const [activeTab, setActiveTab] = useState<TabType>("gainers")
  const [stocks, setStocks] = useState<StockData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [fetchProgress, setFetchProgress] = useState(0)
  const [countdown, setCountdown] = useState(300)

  const fetchStockData = useCallback(async () => {
    setLoading(true)
    setError(false)
    setFetchProgress(0)

    const results: StockData[] = []
    const batchSize = 5
    const batches = []

    for (let i = 0; i < WATCHLIST.length; i += batchSize) {
      batches.push(WATCHLIST.slice(i, i + batchSize))
    }

    try {
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        const batchResults = await Promise.all(
          batch.map(async (symbol) => {
            try {
              const url = `https://api.allorigins.win/get?url=${encodeURIComponent(
                `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
              )}`
              const response = await fetch(url)
              const data = await response.json()
              const parsed = JSON.parse(data.contents)
              const meta = parsed?.chart?.result?.[0]?.meta

              if (meta) {
                const sym = symbol.replace(".NS", "")
                const currentPrice = meta.regularMarketPrice || 0
                const previousClose = meta.chartPreviousClose || meta.previousClose || 0
                const change = currentPrice - previousClose
                const changePercent = previousClose ? (change / previousClose) * 100 : 0

                return {
                  symbol: sym,
                  name: COMPANY_NAMES[sym] || sym,
                  currentPrice,
                  previousClose,
                  change,
                  changePercent,
                  volume: meta.regularMarketVolume || 0,
                  dayHigh: meta.regularMarketDayHigh || currentPrice,
                  dayLow: meta.regularMarketDayLow || currentPrice,
                }
              }
              return null
            } catch {
              return null
            }
          })
        )

        results.push(...batchResults.filter((r): r is StockData => r !== null))
        setFetchProgress(Math.round(((batchIndex + 1) / batches.length) * 100))

        if (batchIndex < batches.length - 1) {
          await delay(500)
        }
      }

      if (results.length > 0) {
        setStocks(results)
        setLastUpdated(new Date())
        setError(false)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setCountdown(300)
    }
  }, [])

  useEffect(() => {
    fetchStockData()
  }, [fetchStockData])

  useEffect(() => {
    if (!isMarketOpen()) return

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchStockData()
          return 300
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [fetchStockData])

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getDisplayedStocks = (): StockData[] => {
    const sorted = [...stocks]
    switch (activeTab) {
      case "gainers":
        return sorted.sort((a, b) => b.changePercent - a.changePercent).slice(0, 8)
      case "losers":
        return sorted.sort((a, b) => a.changePercent - b.changePercent).slice(0, 8)
      case "volume":
        return sorted.sort((a, b) => b.volume - a.volume).slice(0, 8)
      default:
        return []
    }
  }

  const maxVolume = Math.max(...stocks.map((s) => s.volume), 1)

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "gainers", label: "Top Gainers", icon: "🟢" },
    { id: "losers", label: "Top Losers", icon: "🔴" },
    { id: "volume", label: "Top Volume", icon: "🔵" },
  ]

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">Market Pulse</h3>
          {isMarketOpen() ? (
            <span className="text-[10px] px-2 py-0.5 bg-success/10 text-success rounded-full font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-success rounded-full animate-pulse" />
              Live
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground rounded-full font-medium">
              Market Closed
            </span>
          )}
        </div>
        <button
          onClick={fetchStockData}
          disabled={loading}
          className="text-xs text-primary hover:text-primary/80 font-medium disabled:opacity-50 flex items-center gap-1"
        >
          <svg className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-muted/50 p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center mb-3">
            Fetching {WATCHLIST.length} stocks... {fetchProgress}%
          </p>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2 animate-pulse">
              <div className="w-5 h-4 bg-muted rounded" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-32 mb-1" />
                <div className="h-3 bg-muted rounded w-16" />
              </div>
              <div className="h-4 bg-muted rounded w-16" />
              <div className="h-5 bg-muted rounded-full w-14" />
            </div>
          ))}
        </div>
      ) : error && stocks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">Failed to load data</p>
          <button
            onClick={fetchStockData}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {error && (
            <p className="text-[11px] text-warning mb-2 flex items-center gap-1">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Live data unavailable - Showing data from {lastUpdated?.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}

          <div className="space-y-1">
            {getDisplayedStocks().map((stock, index) => (
              <div
                key={stock.symbol}
                className="flex items-center gap-2 py-2 border-b border-border/50 last:border-0"
              >
                <span className="w-5 text-xs text-muted-foreground font-mono">
                  {index + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {stock.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{stock.symbol}</p>
                </div>

                <div className="text-right">
                  <p className="font-mono text-sm text-foreground">
                    ₹{stock.currentPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </p>
                  {activeTab === "volume" ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${stock.changePercent >= 0 ? "bg-success" : "bg-destructive"}`}
                          style={{ width: `${(stock.volume / maxVolume) * 100}%` }}
                        />
                      </div>
                      <span className={`text-[11px] font-medium ${stock.changePercent >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatVolume(stock.volume)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-mono ${stock.change >= 0 ? "text-success" : "text-destructive"}`}>
                        {stock.change >= 0 ? "+" : ""}₹{Math.abs(stock.change).toFixed(2)}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          stock.changePercent >= 0
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>

                {activeTab !== "volume" && (
                  <div className="w-10 flex-shrink-0">
                    <div className="h-1.5 bg-muted rounded-full relative">
                      <div
                        className={`absolute h-2 w-2 rounded-full top-1/2 -translate-y-1/2 ${
                          stock.changePercent >= 0 ? "bg-success" : "bg-destructive"
                        }`}
                        style={{
                          left: `${Math.min(
                            100,
                            Math.max(
                              0,
                              ((stock.currentPrice - stock.dayLow) /
                                (stock.dayHigh - stock.dayLow || 1)) *
                                100
                            )
                          )}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                      <span>L</span>
                      <span>H</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="text-[11px] text-muted-foreground">
          {lastUpdated && (
            <span>Last updated: {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {isMarketOpen() ? (
            <span>Refreshes in {formatCountdown(countdown)}</span>
          ) : (
            <span>Market closed - {getNextMarketOpen()}</span>
          )}
        </div>
      </div>
    </div>
  )
}
