"use client"

import { useEffect, useState, useCallback, useRef } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Quote {
  symbol: string
  name: string
  group: string
  price: number | null
  change: number | null
  changePercent: number | null
  prevClose: number | null
  open: number | null
  high: number | null
  low: number | null
  volume: number | null
  marketState: string | null
  decimals: number
  prefix?: string
  isINR?: boolean
  error: boolean
}

interface FiiDiiEntry { date: string; fiiNet: number; diiNet: number }
interface FiiDiiPayload {
  today: FiiDiiEntry
  mtd: { fiiNet: number; diiNet: number }
  entries: FiiDiiEntry[]
}

interface MarketData {
  quotes: Quote[]
  fiiDii: FiiDiiPayload | null
  timestamp: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(price: number, decimals: number, prefix = "", isINR = false) {
  if (isINR) {
    return (prefix || "") + price.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }
  return (prefix || "") + price.toFixed(decimals)
}

function fmtCr(n: number) {
  const abs = Math.abs(n)
  const sign = n >= 0 ? "+" : "−"
  if (abs >= 10000) return `${sign}₹${(abs / 10000).toFixed(2)}K Cr`
  return `${sign}₹${abs.toFixed(2)} Cr`
}

function ago(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 10) return "just now"
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Pulse({ w, h, className = "" }: { w?: string; h?: string; className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted/60 ${className}`}
      style={{ width: w ?? "100%", height: h ?? "1rem" }}
    />
  )
}

// ─── Ticker Card ─────────────────────────────────────────────────────────────

function TickerCard({ q, compact = false }: { q: Quote; compact?: boolean }) {
  const up = (q.change ?? 0) >= 0
  const isFlat = q.change === 0

  const arrow = isFlat ? "─" : up ? "▲" : "▼"
  const changeColor = isFlat
    ? "text-muted-foreground"
    : up
    ? "text-emerald-500 dark:text-emerald-400"
    : "text-red-500 dark:text-red-400"

  const badgeBg = isFlat
    ? "bg-muted/40"
    : up
    ? "bg-emerald-500/10"
    : "bg-red-500/10"

  const borderAccent = isFlat
    ? "border-border"
    : up
    ? "border-emerald-500/20"
    : "border-red-500/20"

  if (q.error && q.price === null) {
    return (
      <div className={`rounded-xl border ${borderAccent} bg-card p-3 flex flex-col gap-2`}>
        <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">{q.name}</span>
        <Pulse w="70%" h="1.25rem" />
        <Pulse w="50%" h="0.75rem" />
      </div>
    )
  }

  if (q.price === null) {
    return (
      <div className={`rounded-xl border border-border bg-card p-3 flex flex-col gap-2`}>
        <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">{q.name}</span>
        <Pulse w="70%" h="1.25rem" />
        <Pulse w="50%" h="0.75rem" />
      </div>
    )
  }

  return (
    <div className={`rounded-xl border ${borderAccent} bg-card hover:bg-muted/20 transition-colors p-3 flex flex-col gap-1.5 group`}>
      {/* Name + market state */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">{q.name}</span>
        {q.marketState === "REGULAR" && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Market open" />
        )}
      </div>

      {/* Price */}
      <span className="font-mono text-[15px] font-bold text-foreground leading-none">
        {fmtPrice(q.price, q.decimals, q.prefix, q.isINR)}
      </span>

      {/* Change badge */}
      <span className={`inline-flex items-center gap-1 self-start text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${changeColor} ${badgeBg}`}>
        <span className="text-[9px]">{arrow}</span>
        {Math.abs(q.change ?? 0).toFixed(q.decimals === 4 ? 4 : 2)}
        <span className="opacity-60">({Math.abs(q.changePercent ?? 0).toFixed(2)}%)</span>
      </span>

      {/* OHLC row — shown on hover only on larger cards */}
      {!compact && q.high !== null && q.low !== null && (
        <div className="hidden group-hover:flex items-center gap-2 mt-0.5 flex-wrap">
          {[
            { label: "H", val: q.high },
            { label: "L", val: q.low },
            { label: "O", val: q.open },
          ].map(({ label, val }) => val !== null ? (
            <span key={label} className="text-[9px] text-muted-foreground font-mono">
              <span className="text-muted-foreground/50">{label} </span>
              {fmtPrice(val, q.decimals, q.prefix, q.isINR)}
            </span>
          ) : null)}
        </div>
      )}
    </div>
  )
}

// ─── FII/DII Panel ────────────────────────────────────────────────────────────

function FlowBar({ val, max }: { val: number; max: number }) {
  const up = val >= 0
  const pct = Math.min((Math.abs(val) / Math.max(max, 1)) * 100, 100)
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${up ? "bg-emerald-500" : "bg-red-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`font-mono text-xs font-semibold w-28 text-right shrink-0 ${up ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
        {fmtCr(val)}
      </span>
    </div>
  )
}

function FiiDiiPanel({ data, loading }: { data: FiiDiiPayload | null; loading: boolean }) {
  if (loading && !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 mt-3">
        <div className="flex items-center justify-between mb-4">
          <Pulse w="40%" h="0.875rem" />
          <Pulse w="10%" h="0.75rem" />
        </div>
        <div className="grid grid-cols-2 gap-6">
          {[0, 1].map(i => (
            <div key={i} className="space-y-3">
              <Pulse w="60%" h="0.75rem" />
              <Pulse w="100%" h="0.75rem" />
              <Pulse w="100%" h="0.75rem" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 mt-3 flex items-start gap-3">
        <div className="mt-0.5 w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center text-sm shrink-0">📡</div>
        <div>
          <p className="text-sm font-semibold text-foreground">FII / DII data unavailable</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            NSE India is rate-limiting the request. This auto-retries every 5 minutes.
            Data will appear once the server responds.
          </p>
        </div>
      </div>
    )
  }

  const todayFii = data.today.fiiNet
  const todayDii = data.today.diiNet
  const mtdFii = data.mtd.fiiNet
  const mtdDii = data.mtd.diiNet
  const maxAbs = Math.max(Math.abs(todayFii), Math.abs(todayDii), Math.abs(mtdFii), Math.abs(mtdDii), 1000)

  const combined = todayFii + todayDii
  const combinedMtd = mtdFii + mtdDii

  return (
    <div className="rounded-xl border border-border bg-card p-5 mt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-foreground">FII / DII Activity</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {data.today.date && `As of ${data.today.date} · `}Cash market, ₹ Crores
          </p>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider bg-muted/40 text-muted-foreground px-2 py-1 rounded-full">
          NSE EOD
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Today */}
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-3">Today</p>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground font-medium">FII (Foreign)</span>
              </div>
              <FlowBar val={todayFii} max={maxAbs} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground font-medium">DII (Domestic)</span>
              </div>
              <FlowBar val={todayDii} max={maxAbs} />
            </div>
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold ${
              combined >= 0
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            }`}>
              <span>Net flow today</span>
              <span className="font-mono">{fmtCr(combined)}</span>
            </div>
          </div>
        </div>

        {/* MTD */}
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-3">Month-to-Date</p>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground font-medium">FII (Foreign)</span>
              </div>
              <FlowBar val={mtdFii} max={maxAbs} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground font-medium">DII (Domestic)</span>
              </div>
              <FlowBar val={mtdDii} max={maxAbs} />
            </div>
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold ${
              combinedMtd >= 0
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            }`}>
              <span>Net flow MTD</span>
              <span className="font-mono">{fmtCr(combinedMtd)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent entries mini table */}
      {data.entries && data.entries.length > 1 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-3">Recent 7 Days</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-semibold pb-2">Date</th>
                  <th className="text-right font-semibold pb-2">FII Net</th>
                  <th className="text-right font-semibold pb-2">DII Net</th>
                  <th className="text-right font-semibold pb-2">Combined</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.slice(0, 7).map((e, i) => {
                  const comb = e.fiiNet + e.diiNet
                  return (
                    <tr key={i} className="border-t border-border/40">
                      <td className="py-1.5 text-muted-foreground font-mono text-[10px]">{e.date}</td>
                      <td className={`py-1.5 text-right font-mono font-medium text-[10px] ${e.fiiNet >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {fmtCr(e.fiiNet)}
                      </td>
                      <td className={`py-1.5 text-right font-mono font-medium text-[10px] ${e.diiNet >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {fmtCr(e.diiNet)}
                      </td>
                      <td className={`py-1.5 text-right font-mono font-medium text-[10px] ${comb >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {fmtCr(comb)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground mt-4 leading-relaxed">
        FII = Foreign Institutional Investors · DII = Domestic Institutional Investors · Net = Buy − Sell · Source: NSE India
      </p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LiveIndicesBar() {
  const [data, setData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastFetch, setLastFetch] = useState<number | null>(null)
  const [countdown, setCountdown] = useState(60)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const cdRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const res = await fetch("/api/market-data", { cache: "no-store" })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const json: MarketData = await res.json()
      setData(json)
      setLastFetch(Date.now())
      setCountdown(60)
    } catch (e) {
      console.error("Market data fetch failed", e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Initial + interval
  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(() => fetchData(true), 60_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchData])

  // Countdown ticker
  useEffect(() => {
    cdRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 60 : prev - 1))
    }, 1000)
    return () => { if (cdRef.current) clearInterval(cdRef.current) }
  }, [])

  const india = data?.quotes.filter(q => q.group === "india") ?? []
  const global = data?.quotes.filter(q => q.group === "global") ?? []

  // Skeleton quotes for initial load
  const skeletonIndia: Quote[] = Array(6).fill(null).map((_, i) => ({
    symbol: `sk-india-${i}`, name: ["NIFTY 50","BANK NIFTY","SENSEX","INDIA VIX","MIDCAP 50","GIFT NIFTY"][i],
    group: "india", price: null, change: null, changePercent: null,
    prevClose: null, open: null, high: null, low: null, volume: null,
    marketState: null, decimals: 2, isINR: true, error: false,
  }))
  const skeletonGlobal: Quote[] = Array(4).fill(null).map((_, i) => ({
    symbol: `sk-global-${i}`, name: ["USD / INR","GOLD","CRUDE OIL","MCX CRUDE"][i],
    group: "global", price: null, change: null, changePercent: null,
    prevClose: null, open: null, high: null, low: null, volume: null,
    marketState: null, decimals: 2, error: false,
  }))

  const showIndia = loading ? skeletonIndia : india
  const showGlobal = loading ? skeletonGlobal : global

  return (
    <div className="space-y-3">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-foreground tracking-tight">Market Overview</h2>
          {lastFetch && !loading && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              {ago(lastFetch)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Countdown ring */}
          {!loading && (
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <svg width="14" height="14" viewBox="0 0 14 14" className="-rotate-90">
                <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
                <circle
                  cx="7" cy="7" r="5.5" fill="none"
                  stroke="currentColor" strokeWidth="1.5"
                  strokeDasharray={`${2 * Math.PI * 5.5}`}
                  strokeDashoffset={`${2 * Math.PI * 5.5 * (1 - countdown / 60)}`}
                  className="transition-all duration-1000 text-primary"
                  style={{ stroke: "hsl(var(--primary))" }}
                />
              </svg>
              <span>{countdown}s</span>
            </div>
          )}

          <button
            onClick={() => fetchData()}
            disabled={refreshing}
            className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 px-2 py-1 rounded-md hover:bg-muted/40"
          >
            <span className={`text-sm leading-none ${refreshing ? "animate-spin" : ""}`}>↻</span>
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-bold text-emerald-500 tracking-widest uppercase">Live</span>
          </div>
        </div>
      </div>

      {/* ── Indian Indices ── */}
      <div>
        <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
          Indian Markets
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {showIndia.map(q => <TickerCard key={q.symbol} q={q} />)}
        </div>
      </div>

      {/* ── Global & Commodities ── */}
      <div>
        <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
          Global & Commodities
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {showGlobal.map(q => <TickerCard key={q.symbol} q={q} />)}
        </div>
      </div>

      {/* ── FII / DII ── */}
      <FiiDiiPanel data={data?.fiiDii ?? null} loading={loading} />

    </div>
  )
}
