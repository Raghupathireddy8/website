"use client"

import { useEffect, useState, useCallback, useRef } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface TickerItem {
  symbol: string
  name: string
  price: number | null
  change: number | null
  changePercent: number | null
  loading: boolean
  error: boolean
  lastUpdated: number | null
  // optional formatting hints
  decimals?: number
  prefix?: string
  isINR?: boolean
}

interface FiiDiiEntry {
  date: string
  fiiNet: number
  diiNet: number
}

interface FiiDiiData {
  today: FiiDiiEntry | null
  mtd: { fiiNet: number; diiNet: number } | null
  loading: boolean
  error: boolean
  lastUpdated: number | null
}

// ─── Instruments ──────────────────────────────────────────────────────────────

const MARKET_ITEMS: Pick<TickerItem, "symbol" | "name" | "decimals" | "prefix" | "isINR">[] = [
  { symbol: "^NSEI",      name: "NIFTY 50",    decimals: 2, isINR: true },
  { symbol: "^NSEBANK",   name: "BANK NIFTY",  decimals: 2, isINR: true },
  { symbol: "^BSESN",     name: "SENSEX",      decimals: 2, isINR: true },
  { symbol: "^INDIAVIX",  name: "INDIA VIX",   decimals: 2 },
  { symbol: "^NSEMDCP50", name: "NIFTY MID50", decimals: 2, isINR: true },
  { symbol: "GIFT.NS",    name: "GIFT NIFTY",  decimals: 2, isINR: true },
]

const GLOBAL_ITEMS: Pick<TickerItem, "symbol" | "name" | "decimals" | "prefix" | "isINR">[] = [
  { symbol: "USDINR=X",  name: "USD/INR",  decimals: 4, prefix: "₹" },
  { symbol: "GC=F",      name: "GOLD",     decimals: 2, prefix: "$" },
  { symbol: "CL=F",      name: "CRUDE OIL",decimals: 2, prefix: "$" },
  { symbol: "MCX:CRUDEOIL", name: "MCX CRUDE", decimals: 2, isINR: true },
]

// MCX Crude is harder via Yahoo; we try it but gracefully fall back
const ALL_SYMBOLS = [...MARKET_ITEMS, ...GLOBAL_ITEMS]

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

// Multiple CORS proxies in priority order — if one fails, try next
const PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
]

async function fetchWithProxyFallback(targetUrl: string, timeout = 8000): Promise<string> {
  const errors: string[] = []

  for (const proxyFn of PROXIES) {
    const proxyUrl = proxyFn(targetUrl)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try {
      const res = await fetch(proxyUrl, { signal: controller.signal, cache: "no-store" })
      clearTimeout(timer)

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const text = await res.text()

      // allorigins wraps in { contents: "..." }
      if (proxyUrl.includes("allorigins")) {
        try {
          const json = JSON.parse(text)
          if (json?.contents) return json.contents
        } catch {}
      }

      return text
    } catch (e: any) {
      clearTimeout(timer)
      errors.push(`[${proxyFn(targetUrl).split("?")[0]}]: ${e.message}`)
    }
  }

  throw new Error(`All proxies failed: ${errors.join(" | ")}`)
}

interface QuoteResult {
  price: number
  change: number
  changePercent: number
}

async function fetchQuote(symbol: string): Promise<QuoteResult> {
  // Try Yahoo Finance v8 chart endpoint first (more reliable)
  const yahooSymbol = symbol === "MCX:CRUDEOIL" ? "CRUDEOIL.MCX" : symbol
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`

  const raw = await fetchWithProxyFallback(chartUrl)
  const parsed = JSON.parse(raw)
  const result = parsed?.chart?.result?.[0]

  if (!result) throw new Error("No data in response")

  const meta = result.meta
  const price = meta.regularMarketPrice ?? meta.price
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPreviousClose
  if (price == null || prevClose == null) throw new Error("Missing price fields")

  const change = price - prevClose
  const changePercent = (change / prevClose) * 100

  return { price, change, changePercent }
}

// ─── FII/DII fetch ────────────────────────────────────────────────────────────
// NSE India publishes FII/DII as a public JSON endpoint

async function fetchFiiDii(): Promise<FiiDiiEntry[]> {
  // NSE FII/DII activity endpoint
  const url = "https://www.nseindia.com/api/fiidiiTradeReact"

  // NSE requires headers; we route through proxy
  const raw = await fetchWithProxyFallback(url, 10000)
  const data = JSON.parse(raw)

  // NSE returns array of objects; map to our shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).slice(0, 22).map((row: any) => ({
    date: row.date ?? row.tradDate ?? "",
    fiiNet: parseFloat(row.fiiNet ?? row.NET_PURCHASE_SALES1 ?? "0"),
    diiNet: parseFloat(row.diiNet ?? row.NET_PURCHASE_SALES2 ?? "0"),
  }))
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function ago(ms: number | null): string {
  if (!ms) return ""
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 10) return "just now"
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function fmt(price: number, decimals = 2, prefix = "", isINR = false): string {
  if (isINR) {
    return prefix + price.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }
  return prefix + price.toFixed(decimals)
}

function fmtCr(n: number): string {
  const abs = Math.abs(n)
  const sign = n >= 0 ? "+" : "-"
  if (abs >= 10000) return `${sign}₹${(abs / 10000).toFixed(2)}K Cr`
  return `${sign}₹${abs.toFixed(2)} Cr`
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ w, h }: { w: number; h: number }) {
  return (
    <div
      className="rounded animate-pulse bg-muted/50"
      style={{ width: w, height: h }}
    />
  )
}

// ─── Single ticker card ───────────────────────────────────────────────────────

function TickerCard({ item }: { item: TickerItem }) {
  const up = (item.change ?? 0) >= 0
  const colorCls = up ? "text-success" : "text-destructive"
  const bgCls = up ? "bg-success/5" : "bg-destructive/5"

  return (
    <div className={`rounded-xl border border-border p-3 flex flex-col gap-1 transition-all ${item.error ? "opacity-60" : ""}`}>
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
        {item.name}
      </span>

      {item.loading && !item.price ? (
        <>
          <Skeleton w={80} h={22} />
          <Skeleton w={64} h={14} />
        </>
      ) : item.error && !item.price ? (
        <div className="flex flex-col gap-1 mt-0.5">
          <span className="text-xs text-muted-foreground font-mono">—</span>
          <span className="text-[10px] text-muted-foreground">Retrying…</span>
        </div>
      ) : (
        <>
          <span className="font-mono text-base font-bold text-foreground leading-tight">
            {fmt(item.price!, item.decimals ?? 2, item.prefix ?? "", item.isINR)}
          </span>
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${colorCls} ${bgCls} px-1.5 py-0.5 rounded-md self-start`}>
            <span>{up ? "▲" : "▼"}</span>
            <span>
              {Math.abs(item.change ?? 0).toFixed(item.decimals ?? 2)}
            </span>
            <span className="opacity-70">({Math.abs(item.changePercent ?? 0).toFixed(2)}%)</span>
          </span>
          {item.lastUpdated && (
            <span className="text-[9px] text-muted-foreground/50 mt-0.5">{ago(item.lastUpdated)}</span>
          )}
        </>
      )}
    </div>
  )
}

// ─── FII/DII Panel ───────────────────────────────────────────────────────────

function FiiDiiPanel({ data }: { data: FiiDiiData }) {
  if (data.loading) {
    return (
      <div className="rounded-xl border border-border p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton w={160} h={14} />
          <Skeleton w={48} h={14} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton w={80} h={10} />
              <Skeleton w={100} h={20} />
              <Skeleton w={90} h={10} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (data.error && !data.today && !data.mtd) {
    return (
      <div className="rounded-xl border border-border p-4 mt-4 flex items-center gap-3">
        <span className="text-lg">📡</span>
        <div>
          <p className="text-sm font-medium text-foreground">FII/DII data temporarily unavailable</p>
          <p className="text-xs text-muted-foreground mt-0.5">NSE servers are rate-limiting. Will retry automatically.</p>
        </div>
      </div>
    )
  }

  const todayFii = data.today?.fiiNet ?? 0
  const todayDii = data.today?.diiNet ?? 0
  const mtdFii = data.mtd?.fiiNet ?? 0
  const mtdDii = data.mtd?.diiNet ?? 0

  const Bar = ({ val, label }: { val: number; label: string }) => {
    const up = val >= 0
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        <span className={`font-mono text-sm font-bold ${up ? "text-success" : "text-destructive"}`}>
          {fmtCr(val)}
        </span>
        <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden w-full">
          <div
            className={`h-full rounded-full transition-all duration-700 ${up ? "bg-success" : "bg-destructive"}`}
            style={{ width: `${Math.min(Math.abs(val) / 5000 * 100, 100)}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border p-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">FII / DII Activity</h3>
          {data.today?.date && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              As of {data.today.date}
              {data.lastUpdated && ` · Updated ${ago(data.lastUpdated)}`}
            </p>
          )}
        </div>
        <span className="text-[10px] bg-muted/40 text-muted-foreground px-2 py-1 rounded-full font-medium">NSE EOD</span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Today */}
        <div>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-3 border-b border-border pb-1.5">
            Today
          </p>
          <div className="space-y-3">
            <Bar val={todayFii} label="FII Net" />
            <Bar val={todayDii} label="DII Net" />
            <div className={`text-[10px] px-2 py-1 rounded-md font-medium ${(todayFii + todayDii) >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              Combined: {fmtCr(todayFii + todayDii)}
            </div>
          </div>
        </div>

        {/* MTD */}
        <div>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-3 border-b border-border pb-1.5">
            Month-to-Date
          </p>
          <div className="space-y-3">
            <Bar val={mtdFii} label="FII Net MTD" />
            <Bar val={mtdDii} label="DII Net MTD" />
            <div className={`text-[10px] px-2 py-1 rounded-md font-medium ${(mtdFii + mtdDii) >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              Combined MTD: {fmtCr(mtdFii + mtdDii)}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground mt-3 leading-relaxed">
        * Net = Buy − Sell in cash market (₹ Crores). FII = Foreign Institutional Investors. DII = Domestic Institutional Investors. Data sourced from NSE India.
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LiveIndicesBar() {
  const [tickers, setTickers] = useState<TickerItem[]>(
    ALL_SYMBOLS.map(s => ({
      ...s,
      price: null, change: null, changePercent: null,
      loading: true, error: false, lastUpdated: null,
    }))
  )

  const [fiiDii, setFiiDii] = useState<FiiDiiData>({
    today: null, mtd: null, loading: true, error: false, lastUpdated: null,
  })

  const [lastRefresh, setLastRefresh] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const retryCountRef = useRef<Record<string, number>>({})

  // Fetch a single ticker with retry tracking
  const fetchTicker = useCallback(async (symbol: string, index: number) => {
    try {
      const result = await fetchQuote(symbol)
      retryCountRef.current[symbol] = 0
      setTickers(prev => prev.map((t, i) =>
        i === index
          ? { ...t, ...result, loading: false, error: false, lastUpdated: Date.now() }
          : t
      ))
    } catch {
      retryCountRef.current[symbol] = (retryCountRef.current[symbol] ?? 0) + 1
      setTickers(prev => prev.map((t, i) =>
        i === index ? { ...t, loading: false, error: true } : t
      ))
    }
  }, [])

  // Staggered fetch — don't hammer all proxies at once
  const fetchAllTickers = useCallback(async () => {
    setRefreshing(true)

    // Stagger by 300ms each to avoid proxy rate-limit
    for (let i = 0; i < ALL_SYMBOLS.length; i++) {
      const sym = ALL_SYMBOLS[i].symbol
      // Skip MCX crude if it keeps failing
      if (sym === "MCX:CRUDEOIL" && (retryCountRef.current[sym] ?? 0) > 3) continue

      setTimeout(() => fetchTicker(sym, i), i * 300)
    }

    setTimeout(() => {
      setRefreshing(false)
      setLastRefresh(Date.now())
    }, ALL_SYMBOLS.length * 300 + 5000)
  }, [fetchTicker])

  // FII/DII fetch with month aggregation
  const fetchFiiDiiData = useCallback(async () => {
    setFiiDii(prev => ({ ...prev, loading: true }))
    try {
      const entries = await fetchFiiDii()
      if (!entries.length) throw new Error("Empty response")

      const today = entries[0]
      const now = new Date()
      const month = now.getMonth()
      const year = now.getFullYear()

      const mtdEntries = entries.filter(e => {
        if (!e.date) return false
        const d = new Date(e.date.split("-").reverse().join("-")) // DD-Mon-YYYY → YYYY-Mon-DD
        return d.getMonth() === month && d.getFullYear() === year
      })

      const mtd = mtdEntries.reduce(
        (acc, e) => ({ fiiNet: acc.fiiNet + e.fiiNet, diiNet: acc.diiNet + e.diiNet }),
        { fiiNet: 0, diiNet: 0 }
      )

      setFiiDii({ today, mtd, loading: false, error: false, lastUpdated: Date.now() })
    } catch {
      setFiiDii(prev => ({ ...prev, loading: false, error: true }))
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchAllTickers()
    fetchFiiDiiData()
  }, [fetchAllTickers, fetchFiiDiiData])

  // Auto-refresh: tickers every 60s, FII/DII every 5 min
  useEffect(() => {
    const tickerInterval = setInterval(fetchAllTickers, 60_000)
    const fiiInterval = setInterval(fetchFiiDiiData, 300_000)
    return () => {
      clearInterval(tickerInterval)
      clearInterval(fiiInterval)
    }
  }, [fetchAllTickers, fetchFiiDiiData])

  const marketItems = tickers.slice(0, MARKET_ITEMS.length)
  const globalItems = tickers.slice(MARKET_ITEMS.length)

  const allLoaded = tickers.some(t => t.price !== null)
  const errorCount = tickers.filter(t => t.error && !t.price).length

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Market Overview</h2>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-[10px] text-muted-foreground">{ago(lastRefresh)}</span>
          )}
          {errorCount > 0 && allLoaded && (
            <span className="text-[10px] text-warning bg-warning/10 px-2 py-0.5 rounded-full">
              {errorCount} retrying
            </span>
          )}
          <button
            onClick={() => { fetchAllTickers(); fetchFiiDiiData() }}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <span className={refreshing ? "animate-spin" : ""}>↻</span>
            Refresh
          </button>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span className="text-[10px] font-semibold text-success tracking-wide">LIVE</span>
          </div>
        </div>
      </div>

      {/* Indian indices */}
      <div>
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Indian Indices</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {marketItems.map(item => <TickerCard key={item.symbol} item={item} />)}
        </div>
      </div>

      {/* Global / commodities */}
      <div>
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Global & Commodities</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {globalItems.map(item => <TickerCard key={item.symbol} item={item} />)}
        </div>
      </div>

      {/* FII / DII */}
      <FiiDiiPanel data={fiiDii} />
    </div>
  )
}
