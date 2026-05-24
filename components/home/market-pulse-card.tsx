"use client"

import { useState, useEffect, useCallback } from "react"
import { TrendingUp, TrendingDown, BarChart2, RefreshCw, Wifi, WifiOff } from "lucide-react"

// ── All 50 Nifty 50 symbols ──────────────────────────────────────────────────
const NIFTY50 = [
  "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","HINDUNILVR","SBIN","BHARTIARTL",
  "ITC","KOTAKBANK","LT","AXISBANK","ASIANPAINT","MARUTI","TITAN","SUNPHARMA",
  "ULTRACEMCO","BAJFINANCE","NESTLEIND","WIPRO","HCLTECH","POWERGRID","NTPC",
  "ONGC","COALINDIA","TATAMOTORS","JSWSTEEL","HINDALCO","TATASTEEL","ADANIENT",
  "BAJAJFINSV","DRREDDY","CIPLA","DIVISLAB","APOLLOHOSP","EICHERMOT","HEROMOTOCO",
  "BPCL","TECHM","GRASIM","INDUSINDBK","TATACONSUM","BRITANNIA","SHREECEM",
  "ADANIPORTS","SBILIFE","HDFCLIFE","UPL","VEDL","PIDILITIND"
]

const NAMES: Record<string, string> = {
  RELIANCE:"Reliance",TCS:"TCS",HDFCBANK:"HDFC Bank",INFY:"Infosys",
  ICICIBANK:"ICICI Bank",HINDUNILVR:"HUL",SBIN:"SBI",BHARTIARTL:"Airtel",
  ITC:"ITC",KOTAKBANK:"Kotak Bank",LT:"L&T",AXISBANK:"Axis Bank",
  ASIANPAINT:"Asian Paints",MARUTI:"Maruti",TITAN:"Titan",SUNPHARMA:"Sun Pharma",
  ULTRACEMCO:"UltraTech",BAJFINANCE:"Bajaj Finance",NESTLEIND:"Nestle",WIPRO:"Wipro",
  HCLTECH:"HCL Tech",POWERGRID:"Power Grid",NTPC:"NTPC",ONGC:"ONGC",
  COALINDIA:"Coal India",TATAMOTORS:"Tata Motors",JSWSTEEL:"JSW Steel",
  HINDALCO:"Hindalco",TATASTEEL:"Tata Steel",ADANIENT:"Adani Ent.",
  BAJAJFINSV:"Bajaj Finserv",DRREDDY:"Dr Reddy's",CIPLA:"Cipla",
  DIVISLAB:"Divi's Labs",APOLLOHOSP:"Apollo Hosp",EICHERMOT:"Eicher Motors",
  HEROMOTOCO:"Hero Moto",BPCL:"BPCL",TECHM:"Tech Mahindra",GRASIM:"Grasim",
  INDUSINDBK:"IndusInd Bank",TATACONSUM:"Tata Consumer",BRITANNIA:"Britannia",
  SHREECEM:"Shree Cement",ADANIPORTS:"Adani Ports",SBILIFE:"SBI Life",
  HDFCLIFE:"HDFC Life",UPL:"UPL",VEDL:"Vedanta",PIDILITIND:"Pidilite",
}

interface Stock {
  symbol: string
  name: string
  price: number
  change: number
  changePct: number
  volume: number
  high: number
  low: number
}

type Tab = "gainers" | "losers" | "volume"

const isMarketOpen = () => {
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
  const day = ist.getDay()
  if (day === 0 || day === 6) return false
  const t = ist.getHours() * 60 + ist.getMinutes()
  return t >= 555 && t <= 930
}

const fmtVol = (v: number) =>
  v >= 1e7 ? `${(v/1e7).toFixed(1)}Cr` : v >= 1e5 ? `${(v/1e5).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : `${v}`

const fmtPrice = (p: number) =>
  p.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function MarketPulseCard() {
  const [tab,         setTab]         = useState<Tab>("gainers")
  const [stocks,      setStocks]      = useState<Stock[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(false)
  const [updatedAt,   setUpdatedAt]   = useState<Date | null>(null)
  const [countdown,   setCountdown]   = useState(300)

  // ── Single-request fetch: all symbols at once via Yahoo v7/quote ─────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      // Yahoo Finance v7 accepts comma-separated symbols — one round trip for all 50
      const symbols = NIFTY50.map(s => `${s}.NS`).join(",")
      const url = `https://api.allorigins.win/get?url=${encodeURIComponent(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,regularMarketDayHigh,regularMarketDayLow`
      )}`

      const res  = await fetch(url, { signal: AbortSignal.timeout(10000) })
      const data = await res.json()
      const parsed = JSON.parse(data.contents)
      const quotes = parsed?.quoteResponse?.result ?? []

      if (quotes.length === 0) throw new Error("No data")

      const result: Stock[] = quotes
        .map((q: any) => {
          const sym = (q.symbol as string).replace(".NS", "")
          return {
            symbol:    sym,
            name:      NAMES[sym] ?? sym,
            price:     q.regularMarketPrice       ?? 0,
            change:    q.regularMarketChange      ?? 0,
            changePct: q.regularMarketChangePercent ?? 0,
            volume:    q.regularMarketVolume      ?? 0,
            high:      q.regularMarketDayHigh     ?? 0,
            low:       q.regularMarketDayLow      ?? 0,
          } as Stock
        })
        .filter((s: Stock) => s.price > 0)

      setStocks(result)
      setUpdatedAt(new Date())
      setError(false)
    } catch {
      // On error keep last data if available, just flag it
      setError(true)
    } finally {
      setLoading(false)
      setCountdown(300)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Auto-refresh countdown (market hours only)
  useEffect(() => {
    if (!isMarketOpen()) return
    const iv = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { fetchAll(); return 300 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [fetchAll])

  // ── Compute top 5 per tab ─────────────────────────────────────────────────
  const displayed: Stock[] = (() => {
    if (stocks.length === 0) return []
    const s = [...stocks]
    if (tab === "gainers") return s.sort((a,b) => b.changePct - a.changePct).slice(0, 5)
    if (tab === "losers")  return s.sort((a,b) => a.changePct - b.changePct).slice(0, 5)
    return s.sort((a,b) => b.volume - a.volume).slice(0, 5)
  })()

  const maxVol = Math.max(...stocks.map(s => s.volume), 1)

  const tabs: { id: Tab; label: string }[] = [
    { id: "gainers", label: "Top Gainers" },
    { id: "losers",  label: "Top Losers"  },
    { id: "volume",  label: "Top Volume"  },
  ]

  const tabIcon = tab === "gainers"
    ? <TrendingUp  className="w-3.5 h-3.5 text-success" />
    : tab === "losers"
    ? <TrendingDown className="w-3.5 h-3.5 text-destructive" />
    : <BarChart2    className="w-3.5 h-3.5 text-primary" />

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">Market Pulse</span>
          {isMarketOpen() ? (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-success/10 text-success rounded-full font-semibold">
              <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
              Live
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-muted text-muted-foreground rounded-full font-medium">
              <WifiOff className="w-2.5 h-2.5" /> Closed
            </span>
          )}
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          title="Refresh"
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
              tab === t.id
                ? "text-foreground border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="px-3 py-2">

        {/* Loading skeleton */}
        {loading && stocks.length === 0 && (
          <div className="space-y-2 py-1">
            <p className="text-[11px] text-muted-foreground text-center py-1">Fetching Nifty 50…</p>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2 animate-pulse">
                <div className="w-4 h-3 bg-muted rounded" />
                <div className="flex-1 space-y-1">
                  <div className="h-3.5 bg-muted rounded w-24" />
                  <div className="h-2.5 bg-muted rounded w-12" />
                </div>
                <div className="space-y-1 text-right">
                  <div className="h-3.5 bg-muted rounded w-16" />
                  <div className="h-3 bg-muted rounded w-12 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error with no data */}
        {error && stocks.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <WifiOff className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Couldn't load market data</p>
            <button onClick={fetchAll} className="text-xs text-primary hover:underline font-medium">Try again</button>
          </div>
        )}

        {/* Stale data warning */}
        {error && stocks.length > 0 && (
          <p className="text-[10px] text-warning flex items-center gap-1 mb-2 px-1">
            <Wifi className="w-3 h-3" />
            Live feed unavailable — showing last snapshot
          </p>
        )}

        {/* Stock rows */}
        {!loading && stocks.length > 0 && (
          <div className="space-y-0">
            {displayed.map((s, i) => {
              const isUp  = s.changePct >= 0
              const rangePct = s.high !== s.low
                ? Math.max(0, Math.min(100, ((s.price - s.low) / (s.high - s.low)) * 100))
                : 50

              return (
                <div
                  key={s.symbol}
                  className="flex items-center gap-2.5 py-2.5 border-b border-border/40 last:border-0"
                >
                  {/* Rank */}
                  <span className="w-4 text-[11px] text-muted-foreground font-mono flex-shrink-0">{i + 1}</span>

                  {/* Name + symbol */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground leading-tight truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">{s.symbol}</p>
                  </div>

                  {/* Price + change */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-[13px] font-mono font-semibold text-foreground">₹{fmtPrice(s.price)}</p>

                    {tab === "volume" ? (
                      <div className="flex items-center gap-1.5 justify-end mt-0.5">
                        {/* Volume bar */}
                        <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/60 rounded-full"
                            style={{ width: `${(s.volume / maxVol) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-primary">{fmtVol(s.volume)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <span className={`text-[10px] font-mono ${isUp ? "text-success" : "text-destructive"}`}>
                          {isUp ? "▲" : "▼"} {Math.abs(s.changePct).toFixed(2)}%
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                          isUp ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                        }`}>
                          {isUp ? "+" : ""}₹{Math.abs(s.change).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Day range dot (gainers/losers only) */}
                  {tab !== "volume" && (
                    <div className="w-8 flex-shrink-0">
                      <div className="relative h-1.5 bg-muted rounded-full">
                        <div
                          className={`absolute w-2 h-2 rounded-full -top-[2px] -translate-x-1/2 ${isUp ? "bg-success" : "bg-destructive"}`}
                          style={{ left: `${rangePct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] text-muted-foreground mt-1">
                        <span>L</span><span>H</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      {stocks.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/20">
          <span className="text-[10px] text-muted-foreground">
            Nifty 50 · {stocks.length} stocks
            {updatedAt && ` · ${updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {isMarketOpen()
              ? `Refresh in ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}`
              : "Market closed"}
          </span>
        </div>
      )}
    </div>
  )
}
