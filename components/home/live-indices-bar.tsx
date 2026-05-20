"use client"

import { useEffect, useState, useCallback, useRef } from "react"

// ─── Strategy: Try 3 different free APIs one by one ──────────────────────────
// 1. Yahoo Finance v7 /quote — sometimes works directly from browser (no proxy)
// 2. Yahoo Finance v8 via allorigins
// 3. Yahoo Finance v8 via corsproxy.io

async function fetchQuote(symbol: string): Promise<{ price: number; change: number; changePercent: number }> {

  // ── Option 1: Yahoo v7 direct (fastest, no proxy needed sometimes) ──────────
  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`,
      { signal: AbortSignal.timeout(4000) }
    )
    if (res.ok) {
      const json = await res.json()
      const q = json?.quoteResponse?.result?.[0]
      if (q?.regularMarketPrice) {
        return {
          price: q.regularMarketPrice,
          change: q.regularMarketChange,
          changePercent: q.regularMarketChangePercent,
        }
      }
    }
  } catch {}

  // ── Option 2: v8 chart via allorigins ───────────────────────────────────────
  try {
    const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (res.ok) {
      const json = await res.json()
      const meta = JSON.parse(json.contents)?.chart?.result?.[0]?.meta
      if (meta?.regularMarketPrice) {
        const prev = meta.chartPreviousClose || meta.regularMarketPreviousClose
        const change = meta.regularMarketPrice - prev
        return { price: meta.regularMarketPrice, change, changePercent: (change / prev) * 100 }
      }
    }
  } catch {}

  // ── Option 3: v8 chart via corsproxy ────────────────────────────────────────
  const target2 = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
  const res2 = await fetch(
    `https://corsproxy.io/?${encodeURIComponent(target2)}`,
    { signal: AbortSignal.timeout(6000) }
  )
  if (!res2.ok) throw new Error("all failed")
  const json2 = await res2.json()
  const meta2 = json2?.chart?.result?.[0]?.meta
  if (!meta2?.regularMarketPrice) throw new Error("no price")
  const prev2 = meta2.chartPreviousClose || meta2.regularMarketPreviousClose
  const change2 = meta2.regularMarketPrice - prev2
  return { price: meta2.regularMarketPrice, change: change2, changePercent: (change2 / prev2) * 100 }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface IndexData {
  symbol: string
  name: string
  price: number | null
  change: number | null
  changePercent: number | null
  loading: boolean
  error: boolean
  lastOk: number | null  // timestamp of last successful fetch — keep showing stale price
}

const INDICES = [
  { symbol: "^NSEI",    name: "NIFTY 50"   },
  { symbol: "^NSEBANK", name: "BANK NIFTY" },
]

// ─── Card ─────────────────────────────────────────────────────────────────────

function IndexCard({ item, onRetry }: { item: IndexData; onRetry: () => void }) {
  const [tick, setTick] = useState(0)

  // live "Xs ago" counter
  useEffect(() => {
    if (!item.lastOk) return
    const t = setInterval(() => setTick(n => n + 1), 5000)
    return () => clearInterval(t)
  }, [item.lastOk])

  const up = (item.change ?? 0) >= 0
  const hasPrice = item.price !== null

  function agoStr(ms: number) {
    const s = Math.floor((Date.now() - ms) / 1000)
    if (s < 10) return "just now"
    if (s < 60) return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    return `${Math.floor(s / 3600)}h ago`
  }

  return (
    <div className={`bg-card rounded-xl border p-5 flex flex-col gap-3 transition-all ${
      !hasPrice ? "border-border" : up ? "border-success/30" : "border-destructive/30"
    }`}>
      {/* Name row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{item.name}</span>
        {item.loading && (
          <span className="text-[9px] text-muted-foreground animate-pulse">fetching…</span>
        )}
        {!item.loading && item.error && !hasPrice && (
          <button onClick={onRetry}
            className="text-[9px] text-primary hover:underline">retry</button>
        )}
        {hasPrice && item.lastOk && (
          <span className="text-[9px] text-muted-foreground/50">{agoStr(item.lastOk)}</span>
        )}
      </div>

      {/* Price */}
      {hasPrice ? (
        <>
          <span className={`font-mono text-3xl font-bold leading-none ${item.loading ? "opacity-50" : ""}`}>
            {item.price!.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className={`inline-flex items-center gap-1.5 self-start text-sm font-semibold px-2.5 py-1 rounded-lg ${
            up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}>
            <span className="text-xs">{up ? "▲" : "▼"}</span>
            <span>{Math.abs(item.change ?? 0).toFixed(2)}</span>
            <span className="opacity-60">({Math.abs(item.changePercent ?? 0).toFixed(2)}%)</span>
          </div>
        </>
      ) : (
        <>
          {/* skeleton — only shown before first successful load */}
          <div className="h-9 w-40 rounded-lg bg-muted/40 animate-pulse" />
          <div className="h-7 w-28 rounded-lg bg-muted/30 animate-pulse" />
        </>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function LiveIndicesBar() {
  const [data, setData] = useState<IndexData[]>(
    INDICES.map(i => ({ ...i, price: null, change: null, changePercent: null, loading: true, error: false, lastOk: null }))
  )
  const [countdown, setCountdown] = useState(60)
  const countdownRef = useRef<NodeJS.Timeout>()

  const fetchOne = useCallback(async (idx: number) => {
    setData(prev => prev.map((d, i) => i === idx ? { ...d, loading: true } : d))
    try {
      const result = await fetchQuote(INDICES[idx].symbol)
      setData(prev => prev.map((d, i) => i === idx
        ? { ...d, ...result, loading: false, error: false, lastOk: Date.now() }
        : d
      ))
    } catch {
      setData(prev => prev.map((d, i) => i === idx
        ? { ...d, loading: false, error: true }
        : d
      ))
    }
  }, [])

  const fetchAll = useCallback(() => {
    INDICES.forEach((_, i) => fetchOne(i))
    setCountdown(60)
  }, [fetchOne])

  // Reset countdown on each fetch cycle
  const startCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setCountdown(60)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { return 60 }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => {
    fetchAll()
    startCountdown()
    const interval = setInterval(() => { fetchAll(); startCountdown() }, 60000)
    return () => {
      clearInterval(interval)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [fetchAll, startCountdown])

  // Countdown ring radius
  const r = 8
  const circ = 2 * Math.PI * r
  const dash = circ * (1 - countdown / 60)

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Market Overview</h2>
        <div className="flex items-center gap-3">

          {/* Countdown ring */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground" title={`Refreshes in ${countdown}s`}>
            <svg width="20" height="20" viewBox="0 0 20 20" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="10" cy="10" r={r} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.15" />
              <circle cx="10" cy="10" r={r} fill="none"
                strokeWidth="2"
                strokeDasharray={circ}
                strokeDashoffset={dash}
                style={{ stroke: "hsl(var(--primary))", transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <span>{countdown}s</span>
          </div>

          {/* Manual refresh */}
          <button onClick={fetchAll}
            className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/40">
            ↻ Refresh
          </button>

          {/* Live dot */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span className="text-xs font-medium text-success">LIVE</span>
          </div>
        </div>
      </div>

      {/* 2 cards */}
      <div className="grid grid-cols-2 gap-3">
        {data.map((item, i) => (
          <IndexCard key={item.symbol} item={item} onRetry={() => fetchOne(i)} />
        ))}
      </div>

    </div>
  )
}
