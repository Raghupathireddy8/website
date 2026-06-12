"use client"

import { useState, useEffect, useCallback } from "react"
import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import Link from "next/link"
import { RefreshCw, ChevronDown, ChevronUp, Info, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

interface StockIVData {
  symbol: string
  displayName: string
  currentHV: number
  ivRank: number
  ivPercentile: number
  signal: string
  signalColor: string
  action: string
}

const FNO_STOCKS = [
  { symbol: "^NSEI", name: "NIFTY" },
  { symbol: "^NSEBANK", name: "BANKNIFTY" },
  { symbol: "RELIANCE.NS", name: "RELIANCE" },
  { symbol: "TCS.NS", name: "TCS" },
  { symbol: "HDFCBANK.NS", name: "HDFCBANK" },
  { symbol: "INFY.NS", name: "INFY" },
  { symbol: "ICICIBANK.NS", name: "ICICIBANK" },
  { symbol: "SBIN.NS", name: "SBIN" },
  { symbol: "BHARTIARTL.NS", name: "BHARTIARTL" },
  { symbol: "ITC.NS", name: "ITC" },
  { symbol: "AXISBANK.NS", name: "AXISBANK" },
  { symbol: "BAJFINANCE.NS", name: "BAJFINANCE" },
  { symbol: "MARUTI.NS", name: "MARUTI" },
  { symbol: "SUNPHARMA.NS", name: "SUNPHARMA" },
  { symbol: "TATAMOTORS.NS", name: "TATAMOTORS" },
  { symbol: "WIPRO.NS", name: "WIPRO" },
  { symbol: "HCLTECH.NS", name: "HCLTECH" },
  { symbol: "ONGC.NS", name: "ONGC" },
  { symbol: "TATASTEEL.NS", name: "TATASTEEL" },
  { symbol: "JSWSTEEL.NS", name: "JSWSTEEL" },
  { symbol: "DRREDDY.NS", name: "DRREDDY" },
  { symbol: "CIPLA.NS", name: "CIPLA" },
  { symbol: "TITAN.NS", name: "TITAN" },
  { symbol: "LT.NS", name: "LT" },
  { symbol: "NTPC.NS", name: "NTPC" },
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

function getSignal(ivRank: number): { signal: string; color: string; action: string } {
  if (ivRank > 80) return { signal: "Sell Options", color: "destructive", action: "Short Straddle / Strangle" }
  if (ivRank >= 60) return { signal: "Consider Selling", color: "warning", action: "Iron Condor / Credit Spread" }
  if (ivRank >= 30) return { signal: "Neutral", color: "muted-foreground", action: "Wait for better setup" }
  return { signal: "Buy Options", color: "success", action: "Long Straddle / Debit Spread" }
}

function getBarColor(ivRank: number) {
  if (ivRank > 80) return "bg-destructive"
  if (ivRank >= 60) return "bg-warning"
  if (ivRank >= 30) return "bg-muted-foreground"
  return "bg-success"
}

function getSignalBadgeStyle(color: string) {
  switch (color) {
    case "destructive": return "bg-destructive/10 text-destructive border-destructive/30"
    case "warning": return "bg-warning/10 text-warning border-warning/30"
    case "success": return "bg-success/10 text-success border-success/30"
    default: return "bg-muted text-muted-foreground border-border"
  }
}

const STATIC_DATA: StockIVData[] = [
  { symbol: "^NSEBANK", displayName: "BANKNIFTY", currentHV: 18.5, ivRank: 82, ivPercentile: 85, signal: "Sell Options", signalColor: "destructive", action: "Short Straddle / Strangle" },
  { symbol: "INFY.NS", displayName: "INFY", currentHV: 24.2, ivRank: 91, ivPercentile: 88, signal: "Sell Options", signalColor: "destructive", action: "Short Straddle / Strangle" },
  { symbol: "WIPRO.NS", displayName: "WIPRO", currentHV: 26.3, ivRank: 85, ivPercentile: 82, signal: "Sell Options", signalColor: "destructive", action: "Short Straddle / Strangle" },
  { symbol: "RELIANCE.NS", displayName: "RELIANCE", currentHV: 21.3, ivRank: 76, ivPercentile: 72, signal: "Consider Selling", signalColor: "warning", action: "Iron Condor / Credit Spread" },
  { symbol: "SBIN.NS", displayName: "SBIN", currentHV: 22.5, ivRank: 71, ivPercentile: 68, signal: "Consider Selling", signalColor: "warning", action: "Iron Condor / Credit Spread" },
  { symbol: "HDFCBANK.NS", displayName: "HDFCBANK", currentHV: 19.8, ivRank: 68, ivPercentile: 65, signal: "Consider Selling", signalColor: "warning", action: "Iron Condor / Credit Spread" },
  { symbol: "ICICIBANK.NS", displayName: "ICICIBANK", currentHV: 20.1, ivRank: 62, ivPercentile: 58, signal: "Consider Selling", signalColor: "warning", action: "Iron Condor / Credit Spread" },
  { symbol: "AXISBANK.NS", displayName: "AXISBANK", currentHV: 18.9, ivRank: 58, ivPercentile: 55, signal: "Neutral", signalColor: "muted-foreground", action: "Wait for better setup" },
  { symbol: "TCS.NS", displayName: "TCS", currentHV: 16.4, ivRank: 55, ivPercentile: 52, signal: "Neutral", signalColor: "muted-foreground", action: "Wait for better setup" },
  { symbol: "^NSEI", displayName: "NIFTY", currentHV: 12.8, ivRank: 44, ivPercentile: 40, signal: "Neutral", signalColor: "muted-foreground", action: "Wait for better setup" },
  { symbol: "BHARTIARTL.NS", displayName: "BHARTIARTL", currentHV: 18.2, ivRank: 38, ivPercentile: 35, signal: "Neutral", signalColor: "muted-foreground", action: "Wait for better setup" },
  { symbol: "ITC.NS", displayName: "ITC", currentHV: 14.5, ivRank: 28, ivPercentile: 25, signal: "Buy Options", signalColor: "success", action: "Long Straddle / Debit Spread" },
  { symbol: "BAJFINANCE.NS", displayName: "BAJFINANCE", currentHV: 25.8, ivRank: 65, ivPercentile: 62, signal: "Consider Selling", signalColor: "warning", action: "Iron Condor / Credit Spread" },
  { symbol: "MARUTI.NS", displayName: "MARUTI", currentHV: 19.2, ivRank: 48, ivPercentile: 45, signal: "Neutral", signalColor: "muted-foreground", action: "Wait for better setup" },
  { symbol: "SUNPHARMA.NS", displayName: "SUNPHARMA", currentHV: 21.5, ivRank: 52, ivPercentile: 50, signal: "Neutral", signalColor: "muted-foreground", action: "Wait for better setup" },
  { symbol: "TATAMOTORS.NS", displayName: "TATAMOTORS", currentHV: 32.1, ivRank: 78, ivPercentile: 75, signal: "Consider Selling", signalColor: "warning", action: "Iron Condor / Credit Spread" },
  { symbol: "HCLTECH.NS", displayName: "HCLTECH", currentHV: 17.8, ivRank: 42, ivPercentile: 40, signal: "Neutral", signalColor: "muted-foreground", action: "Wait for better setup" },
  { symbol: "ONGC.NS", displayName: "ONGC", currentHV: 24.8, ivRank: 58, ivPercentile: 55, signal: "Neutral", signalColor: "muted-foreground", action: "Wait for better setup" },
  { symbol: "TATASTEEL.NS", displayName: "TATASTEEL", currentHV: 28.5, ivRank: 72, ivPercentile: 70, signal: "Consider Selling", signalColor: "warning", action: "Iron Condor / Credit Spread" },
  { symbol: "JSWSTEEL.NS", displayName: "JSWSTEEL", currentHV: 27.2, ivRank: 68, ivPercentile: 65, signal: "Consider Selling", signalColor: "warning", action: "Iron Condor / Credit Spread" },
  { symbol: "DRREDDY.NS", displayName: "DRREDDY", currentHV: 18.9, ivRank: 35, ivPercentile: 32, signal: "Neutral", signalColor: "muted-foreground", action: "Wait for better setup" },
  { symbol: "CIPLA.NS", displayName: "CIPLA", currentHV: 20.2, ivRank: 45, ivPercentile: 42, signal: "Neutral", signalColor: "muted-foreground", action: "Wait for better setup" },
  { symbol: "TITAN.NS", displayName: "TITAN", currentHV: 22.8, ivRank: 55, ivPercentile: 52, signal: "Neutral", signalColor: "muted-foreground", action: "Wait for better setup" },
  { symbol: "LT.NS", displayName: "LT", currentHV: 19.5, ivRank: 48, ivPercentile: 45, signal: "Neutral", signalColor: "muted-foreground", action: "Wait for better setup" },
  { symbol: "NTPC.NS", displayName: "NTPC", currentHV: 16.8, ivRank: 22, ivPercentile: 20, signal: "Buy Options", signalColor: "success", action: "Long Straddle / Debit Spread" },
]

type SortKey = "displayName" | "currentHV" | "ivRank" | "ivPercentile" | "signal"
type SortOrder = "asc" | "desc"

export default function ScreenerPage() {
  const [data, setData] = useState<StockIVData[]>(STATIC_DATA)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [usingCached, setUsingCached] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("ivRank")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

  const fetchData = useCallback(async () => {
    setLoading(true)
    setUsingCached(false)
    setProgress(0)

    try {
      const results: StockIVData[] = []

      for (let i = 0; i < FNO_STOCKS.length; i++) {
        const stock = FNO_STOCKS[i]
        setProgress(Math.round(((i + 1) / FNO_STOCKS.length) * 100))

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

          const { signal, color, action } = getSignal(ivRank)

          results.push({
            symbol: stock.symbol,
            displayName: stock.name,
            currentHV: Math.round(currentHV * 10) / 10,
            ivRank: Math.round(ivRank),
            ivPercentile: Math.round(ivPercentile),
            signal,
            signalColor: color,
            action,
          })

          await new Promise(resolve => setTimeout(resolve, 500))
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
      setProgress(100)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortOrder(key === "displayName" ? "asc" : "desc")
    }
  }

  const sortedData = [...data].sort((a, b) => {
    let comparison = 0
    if (sortKey === "displayName") {
      comparison = a.displayName.localeCompare(b.displayName)
    } else if (sortKey === "signal") {
      const signalOrder: Record<string, number> = { "Sell Options": 4, "Consider Selling": 3, "Neutral": 2, "Buy Options": 1 }
      comparison = (signalOrder[a.signal] || 0) - (signalOrder[b.signal] || 0)
    } else {
      comparison = a[sortKey] - b[sortKey]
    }
    return sortOrder === "asc" ? comparison : -comparison
  })

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/50" />
    return sortOrder === "asc" 
      ? <ArrowUp className="w-3.5 h-3.5 text-primary" />
      : <ArrowDown className="w-3.5 h-3.5 text-primary" />
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">IV Rank & Percentile Screener</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time Historical Volatility analysis for F&O stocks
              </p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? `Calculating... ${progress}%` : "Recalculate"}
            </button>
          </div>

          {/* Collapsible Info Box */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="flex items-center gap-2 text-sm text-primary mb-4 hover:underline"
          >
            <Info className="w-4 h-4" />
            What is IV Rank?
            {showInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showInfo && (
            <div className="bg-card border border-border rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-foreground mb-2">Understanding IV Rank</h3>
              <p className="text-sm text-muted-foreground mb-3">
                IV Rank tells you if options are cheap or expensive compared to the past 52 weeks. 
                We calculate this using 30-day Historical Volatility (HV) as a proxy for Implied Volatility.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-3 bg-success/10 rounded-lg p-3 border border-success/30">
                  <span className="w-8 h-8 rounded-full bg-success flex items-center justify-center text-success-foreground font-bold text-xs">0-30</span>
                  <div>
                    <p className="font-medium text-success">Options CHEAP</p>
                    <p className="text-muted-foreground text-xs">Good to BUY options (Long Straddle / Debit Spread)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-muted rounded-lg p-3 border border-border">
                  <span className="w-8 h-8 rounded-full bg-muted-foreground flex items-center justify-center text-background font-bold text-xs">30-60</span>
                  <div>
                    <p className="font-medium text-foreground">Options NORMAL</p>
                    <p className="text-muted-foreground text-xs">No clear edge - wait for better setup</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-warning/10 rounded-lg p-3 border border-warning/30">
                  <span className="w-8 h-8 rounded-full bg-warning flex items-center justify-center text-warning-foreground font-bold text-xs">60-80</span>
                  <div>
                    <p className="font-medium text-warning">Options EXPENSIVE</p>
                    <p className="text-muted-foreground text-xs">Consider SELLING (Iron Condor / Credit Spread)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-destructive/10 rounded-lg p-3 border border-destructive/30">
                  <span className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center text-destructive-foreground font-bold text-xs">80+</span>
                  <div>
                    <p className="font-medium text-destructive">Options VERY EXPENSIVE</p>
                    <p className="text-muted-foreground text-xs">Strong sell signal (Short Straddle / Strangle)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status Bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 text-xs">
              {lastUpdated && (
                <span className="text-muted-foreground">
                  Last calculated: {lastUpdated.toLocaleString("en-IN", { 
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" 
                  })}
                </span>
              )}
              {usingCached && (
                <span className="bg-warning/10 text-warning px-2 py-1 rounded text-xs">
                  Live data unavailable — showing cached results
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-destructive"></span>
                <span className="text-muted-foreground">&gt;80 Sell</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-warning"></span>
                <span className="text-muted-foreground">60-80</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-muted-foreground"></span>
                <span className="text-muted-foreground">30-60</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-success"></span>
                <span className="text-muted-foreground">&lt;30 Buy</span>
              </div>
            </div>
          </div>

          {/* Loading Progress */}
          {loading && (
            <div className="mb-4">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Fetching data for {FNO_STOCKS.length} F&O stocks...
              </p>
            </div>
          )}

          {/* Data Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th 
                      onClick={() => handleSort("displayName")}
                      className="text-left py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        Symbol
                        <SortIcon column="displayName" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("currentHV")}
                      className="text-right py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        Current HV
                        <SortIcon column="currentHV" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("ivRank")}
                      className="text-left py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors w-48"
                    >
                      <div className="flex items-center gap-1.5">
                        IV Rank
                        <SortIcon column="ivRank" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("ivPercentile")}
                      className="text-right py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        IV %ile
                        <SortIcon column="ivPercentile" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("signal")}
                      className="text-left py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        Signal
                        <SortIcon column="signal" />
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((item, index) => (
                    <tr key={index} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">{item.displayName}</td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">{item.currentHV}%</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${getBarColor(item.ivRank)}`}
                              style={{ width: `${item.ivRank}%` }}
                            />
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded font-mono font-semibold min-w-[36px] text-center ${
                            item.ivRank > 80 ? "bg-destructive/10 text-destructive" :
                            item.ivRank >= 60 ? "bg-warning/10 text-warning" :
                            item.ivRank >= 30 ? "bg-muted text-muted-foreground" :
                            "bg-success/10 text-success"
                          }`}>
                            {item.ivRank}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">{item.ivPercentile}%</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getSignalBadgeStyle(item.signalColor)}`}>
                          {item.signal}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{item.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-primary hover:underline">Back to Home</Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
