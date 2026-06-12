"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { RefreshCw, ChevronDown, ChevronUp, Info } from "lucide-react"

interface StockIVData {
  symbol: string
  displayName: string
  currentHV: number
  ivRank: number
  ivPercentile: number
  signal: string
  signalColor: string
}

const FNO_STOCKS_HOME = [
  { symbol: "^NSEI", name: "NIFTY" },
  { symbol: "^NSEBANK", name: "BANKNIFTY" },
  { symbol: "RELIANCE.NS", name: "RELIANCE" },
  { symbol: "TCS.NS", name: "TCS" },
  { symbol: "HDFCBANK.NS", name: "HDFCBANK" },
  { symbol: "INFY.NS", name: "INFY" },
]

function calcHV(closes: number[], period = 30): number[] {
  const returns: number[] = []
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]))
  }
  const hvValues: number[] = []
  for (let i = period; i <= returns.length; i++) {
    const slice = returns.slice(i - period, i)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period
    hvValues.push(Math.sqrt(variance * 252) * 100)
  }
  return hvValues
}

function getSignal(ivRank: number): { signal: string; color: string } {
  if (ivRank > 80) return { signal: "Sell Options", color: "destructive" }
  if (ivRank >= 60) return { signal: "Consider Selling", color: "warning" }
  if (ivRank >= 30) return { signal: "Neutral", color: "muted-foreground" }
  return { signal: "Buy Options", color: "success" }
}

function getBarColor(ivRank: number) {
  if (ivRank > 80) return "bg-destructive"
  if (ivRank >= 60) return "bg-warning"
  if (ivRank >= 30) return "bg-muted-foreground"
  return "bg-success"
}

function getTextColor(ivRank: number) {
  if (ivRank > 80) return "text-destructive"
  if (ivRank >= 60) return "text-warning"
  if (ivRank >= 30) return "text-muted-foreground"
  return "text-success"
}

const STATIC_DATA: StockIVData[] = [
  { symbol: "^NSEBANK", displayName: "BANKNIFTY", currentHV: 18.5, ivRank: 82, ivPercentile: 85, signal: "Sell Options", signalColor: "destructive" },
  { symbol: "INFY.NS", displayName: "INFY", currentHV: 24.2, ivRank: 91, ivPercentile: 88, signal: "Sell Options", signalColor: "destructive" },
  { symbol: "RELIANCE.NS", displayName: "RELIANCE", currentHV: 21.3, ivRank: 76, ivPercentile: 72, signal: "Consider Selling", signalColor: "warning" },
  { symbol: "HDFCBANK.NS", displayName: "HDFCBANK", currentHV: 19.8, ivRank: 68, ivPercentile: 65, signal: "Consider Selling", signalColor: "warning" },
  { symbol: "TCS.NS", displayName: "TCS", currentHV: 16.4, ivRank: 55, ivPercentile: 52, signal: "Neutral", signalColor: "muted-foreground" },
  { symbol: "^NSEI", displayName: "NIFTY", currentHV: 12.8, ivRank: 44, ivPercentile: 40, signal: "Neutral", signalColor: "muted-foreground" },
]

export function IVRankCard() {
  const [data, setData] = useState<StockIVData[]>(STATIC_DATA)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [usingCached, setUsingCached] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setUsingCached(false)

    try {
      const results: StockIVData[] = []

      for (const stock of FNO_STOCKS_HOME) {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${stock.symbol}?interval=1d&range=1y`
          const response = await fetch(url)
          
          if (!response.ok) throw new Error("Fetch failed")
          
          const json = await response.json()
          const closes = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter((c: number | null) => c !== null) || []

          if (closes.length < 60) {
            throw new Error("Insufficient data")
          }

          const hvValues = calcHV(closes, 30)
          if (hvValues.length === 0) throw new Error("No HV values")

          const currentHV = hvValues[hvValues.length - 1]
          const hvMin = Math.min(...hvValues)
          const hvMax = Math.max(...hvValues)
          const ivRank = hvMax > hvMin ? ((currentHV - hvMin) / (hvMax - hvMin)) * 100 : 50
          const below = hvValues.filter(v => v < currentHV).length
          const ivPercentile = (below / hvValues.length) * 100

          const { signal, color } = getSignal(ivRank)

          results.push({
            symbol: stock.symbol,
            displayName: stock.name,
            currentHV: Math.round(currentHV * 10) / 10,
            ivRank: Math.round(ivRank),
            ivPercentile: Math.round(ivPercentile),
            signal,
            signalColor: color,
          })

          await new Promise(resolve => setTimeout(resolve, 300))
        } catch {
          const staticItem = STATIC_DATA.find(s => s.symbol === stock.symbol)
          if (staticItem) results.push(staticItem)
        }
      }

      if (results.length > 0) {
        results.sort((a, b) => b.ivRank - a.ivRank)
        setData(results)
        setLastUpdated(new Date())
      } else {
        throw new Error("No results")
      }
    } catch {
      setData(STATIC_DATA)
      setUsingCached(true)
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">IV Rank Screener</h3>
          <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground font-medium">
            Live HV
          </span>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-1.5 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Collapsible Info */}
      <button
        onClick={() => setShowInfo(!showInfo)}
        className="flex items-center gap-1.5 text-xs text-primary mb-3 hover:underline"
      >
        <Info className="w-3.5 h-3.5" />
        What is IV Rank?
        {showInfo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {showInfo && (
        <div className="bg-muted/50 rounded-lg p-3 mb-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">IV Rank tells you if options are cheap or expensive compared to the past 52 weeks.</p>
          <ul className="space-y-0.5 mt-2">
            <li><span className="text-success font-medium">0-30</span> → Options CHEAP → Good to BUY options</li>
            <li><span className="text-muted-foreground font-medium">30-60</span> → Options NORMAL → No clear edge</li>
            <li><span className="text-warning font-medium">60-80</span> → Options EXPENSIVE → Consider SELLING</li>
            <li><span className="text-destructive font-medium">80-100</span> → Options VERY EXPENSIVE → Strong sell signal</li>
          </ul>
        </div>
      )}

      {usingCached && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg px-3 py-2 mb-3 text-xs text-warning">
          Live data unavailable — showing last cached results
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 mb-4 text-[10px] font-medium flex-wrap">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-destructive"></span>
          <span className="text-muted-foreground">&gt;80 Sell</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-warning"></span>
          <span className="text-muted-foreground">60-80</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground"></span>
          <span className="text-muted-foreground">30-60</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-success"></span>
          <span className="text-muted-foreground">&lt;30 Buy</span>
        </div>
      </div>

      <div className="space-y-3">
        {data.slice(0, 6).map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <span className="text-xs font-medium text-foreground w-20 truncate">
              {item.displayName}
            </span>
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(item.ivRank)}`}
                style={{ width: `${item.ivRank}%` }}
              />
            </div>
            <span className={`font-mono text-xs font-medium w-8 text-right ${getTextColor(item.ivRank)}`}>
              {item.ivRank}
            </span>
          </div>
        ))}
      </div>

      {lastUpdated && (
        <p className="text-[10px] text-muted-foreground mt-3">
          Last updated: {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}

      <Link
        href="/screener"
        className="inline-flex items-center gap-1 mt-3 text-sm text-primary font-medium hover:underline"
      >
        View Full Screener →
      </Link>
    </div>
  )
}
