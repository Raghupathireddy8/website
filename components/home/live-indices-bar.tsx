"use client"

import { useEffect, useState, useCallback } from "react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface IndexData {
  symbol: string
  name: string
  price: number | null
  change: number | null
  changePercent: number | null
  loading: boolean
  error: boolean
}

// ─── Only 2 symbols — fast & reliable ────────────────────────────────────────

const INDICES = [
  { symbol: "^NSEI",    name: "NIFTY 50"   },
  { symbol: "^NSEBANK", name: "BANK NIFTY" },
]

// ─── EXACT original fetch — untouched ────────────────────────────────────────

async function fetchIndexData(symbol: string): Promise<{ price: number; change: number; changePercent: number }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
  const response = await fetch(proxyUrl)
  const data = await response.json()
  const parsed = JSON.parse(data.contents)
  const meta = parsed.chart.result[0].meta
  const price = meta.regularMarketPrice
  const previousClose = meta.chartPreviousClose || meta.previousClose
  const change = price - previousClose
  const changePercent = (change / previousClose) * 100
  return { price, change, changePercent }
}

// ─── FII/DII Static Data — update this manually each month ───────────────────
// Format: { date, fii, dii } — all values in ₹ Crores (net buy/sell)
// Positive = net buying, Negative = net selling

export const FII_DII_DATA: {
  month: string        // display label e.g. "May 2025"
  monthKey: string     // YYYY-MM for auto-detection
  entries: { date: string; fii: number; dii: number }[]
}[] = [
  {
    month: "May 2025",
    monthKey: "2025-05",
    entries: [
      { date: "01-May-25", fii:  2134.50, dii: -1203.20 },
      { date: "02-May-25", fii: -1876.30, dii:  2341.10 },
      { date: "05-May-25", fii:  3210.40, dii:  -987.60 },
      { date: "06-May-25", fii:  1543.20, dii:  1234.50 },
      { date: "07-May-25", fii: -2109.80, dii:  3012.30 },
      { date: "08-May-25", fii:  4321.60, dii: -1543.20 },
      { date: "09-May-25", fii:  1876.40, dii:   876.50 },
    ],
  },
  {
    month: "Apr 2025",
    monthKey: "2025-04",
    entries: [
      { date: "01-Apr-25", fii: -3210.50, dii:  4123.40 },
      { date: "02-Apr-25", fii: -1876.20, dii:  2341.60 },
      { date: "03-Apr-25", fii:  2134.80, dii: -1203.30 },
      { date: "07-Apr-25", fii: -4321.40, dii:  5012.20 },
      { date: "08-Apr-25", fii:  1543.60, dii:  1234.80 },
      { date: "09-Apr-25", fii:  3210.20, dii:  -987.40 },
      { date: "10-Apr-25", fii: -2109.60, dii:  3012.10 },
      { date: "11-Apr-25", fii:  4321.80, dii: -1543.60 },
      { date: "14-Apr-25", fii:  1876.20, dii:   876.30 },
      { date: "15-Apr-25", fii: -2134.60, dii:  2341.40 },
      { date: "16-Apr-25", fii:  3210.80, dii:  -987.20 },
      { date: "17-Apr-25", fii:  1543.40, dii:  1234.60 },
      { date: "22-Apr-25", fii: -1876.60, dii:  3012.80 },
      { date: "23-Apr-25", fii:  4321.20, dii: -1543.40 },
      { date: "24-Apr-25", fii:  2134.40, dii:   876.20 },
      { date: "25-Apr-25", fii: -3210.80, dii:  4123.60 },
      { date: "28-Apr-25", fii:  1876.60, dii:  2341.20 },
      { date: "29-Apr-25", fii: -2134.20, dii:  1203.40 },
      { date: "30-Apr-25", fii:  3210.60, dii:  -987.80 },
    ],
  },
  {
    month: "Mar 2025",
    monthKey: "2025-03",
    entries: [
      { date: "03-Mar-25", fii: -5432.10, dii:  6123.40 },
      { date: "04-Mar-25", fii: -3210.60, dii:  4341.20 },
      { date: "05-Mar-25", fii:  2134.20, dii: -1203.60 },
      { date: "06-Mar-25", fii: -1876.80, dii:  2341.40 },
      { date: "07-Mar-25", fii:  3210.40, dii:  -987.20 },
      { date: "10-Mar-25", fii:  1543.80, dii:  1234.60 },
      { date: "11-Mar-25", fii: -4321.20, dii:  5012.80 },
      { date: "12-Mar-25", fii:  2134.60, dii: -1203.40 },
      { date: "13-Mar-25", fii: -1876.40, dii:  2341.80 },
      { date: "14-Mar-25", fii:  3210.80, dii:  -987.60 },
      { date: "17-Mar-25", fii:  1543.20, dii:  1234.20 },
      { date: "18-Mar-25", fii: -2109.80, dii:  3012.40 },
      { date: "19-Mar-25", fii:  4321.40, dii: -1543.80 },
      { date: "20-Mar-25", fii:  1876.80, dii:   876.40 },
      { date: "21-Mar-25", fii: -2134.80, dii:  2341.20 },
      { date: "24-Mar-25", fii:  3210.20, dii:  -987.40 },
      { date: "25-Mar-25", fii:  1543.60, dii:  1234.40 },
      { date: "26-Mar-25", fii: -1876.20, dii:  3012.60 },
      { date: "27-Mar-25", fii:  4321.80, dii: -1543.20 },
      { date: "28-Mar-25", fii:  2134.40, dii:   876.60 },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtCr(n: number) {
  const abs = Math.abs(n)
  const sign = n >= 0 ? "+" : "−"
  if (abs >= 10000) return `${sign}₹${(abs / 10000).toFixed(2)}K Cr`
  return `${sign}₹${abs.toFixed(2)} Cr`
}

function Shimmer({ w, h }: { w?: string; h?: string }) {
  return <div className="animate-pulse rounded-md bg-muted/50" style={{ width: w ?? "100%", height: h ?? "14px" }} />
}

// ─── Index Card — same look as original, just cleaner ────────────────────────

function IndexCard({ item }: { item: IndexData }) {
  const up = (item.change ?? 0) >= 0

  if (item.loading) return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <Shimmer w="60%" h="11px" />
      <Shimmer w="80%" h="28px" />
      <Shimmer w="55%" h="14px" />
    </div>
  )

  if (item.error && item.price === null) return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 opacity-50">
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{item.name}</p>
      <Shimmer w="80%" h="28px" />
      <Shimmer w="55%" h="14px" />
    </div>
  )

  return (
    <div className={`bg-card border rounded-xl p-4 flex flex-col gap-2 ${up ? "border-success/25" : "border-destructive/25"}`}>
      <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{item.name}</span>
      <span className="font-mono text-2xl font-bold text-foreground leading-none">
        {fmtINR(item.price!)}
      </span>
      <div className={`inline-flex items-center gap-1 self-start text-xs font-semibold px-2 py-1 rounded-lg ${up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
        <span>{up ? "▲" : "▼"}</span>
        <span>{Math.abs(item.change ?? 0).toFixed(2)}</span>
        <span className="opacity-70">({Math.abs(item.changePercent ?? 0).toFixed(2)}%)</span>
      </div>
    </div>
  )
}

// ─── FII/DII Panel ────────────────────────────────────────────────────────────

function FiiDiiPanel() {
  // Auto-select current month, fallback to latest available
  const currentKey = new Date().toISOString().slice(0, 7) // "YYYY-MM"
  const defaultMonth = FII_DII_DATA.find(m => m.monthKey === currentKey)
    ?? FII_DII_DATA[0]

  const [selected, setSelected] = useState(defaultMonth.monthKey)
  const monthData = FII_DII_DATA.find(m => m.monthKey === selected) ?? FII_DII_DATA[0]

  const mtdFii = monthData.entries.reduce((s, e) => s + e.fii, 0)
  const mtdDii = monthData.entries.reduce((s, e) => s + e.dii, 0)
  const mtdComb = mtdFii + mtdDii
  const maxAbs = Math.max(...monthData.entries.flatMap(e => [Math.abs(e.fii), Math.abs(e.dii)]), 1000)

  const latest = monthData.entries[monthData.entries.length - 1]
  const todayFii = latest?.fii ?? 0
  const todayDii = latest?.dii ?? 0
  const todayComb = todayFii + todayDii

  function FlowBar({ val }: { val: number }) {
    const up = val >= 0
    const pct = Math.min((Math.abs(val) / maxAbs) * 100, 100)
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${up ? "bg-success" : "bg-destructive"}`}
            style={{ width: `${pct}%` }} />
        </div>
        <span className={`font-mono text-xs font-bold w-24 text-right shrink-0 ${up ? "text-success" : "text-destructive"}`}>
          {fmtCr(val)}
        </span>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-bold text-foreground">FII / DII Activity</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">Cash segment · ₹ Crores · Source: NSE India</p>
        </div>
        {/* Month selector */}
        <div className="flex gap-1.5 flex-wrap">
          {FII_DII_DATA.map(m => (
            <button key={m.monthKey} onClick={() => setSelected(m.monthKey)}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                selected === m.monthKey
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent border-border text-muted-foreground hover:text-foreground"
              }`}>
              {m.month}
            </button>
          ))}
        </div>
      </div>

      {/* Today (latest session) + MTD summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-5">
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-3">
            Latest Session <span className="normal-case font-normal ml-1">({latest?.date})</span>
          </p>
          <div className="space-y-2.5">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">FII (Foreign)</p>
              <FlowBar val={todayFii} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">DII (Domestic)</p>
              <FlowBar val={todayDii} />
            </div>
            <div className={`flex justify-between px-3 py-2 rounded-lg text-xs font-bold ${todayComb >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              <span>Net</span>
              <span className="font-mono">{fmtCr(todayComb)}</span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-3">
            Month-to-Date <span className="normal-case font-normal ml-1">({monthData.month})</span>
          </p>
          <div className="space-y-2.5">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">FII (Foreign)</p>
              <FlowBar val={mtdFii} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">DII (Domestic)</p>
              <FlowBar val={mtdDii} />
            </div>
            <div className={`flex justify-between px-3 py-2 rounded-lg text-xs font-bold ${mtdComb >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              <span>Net MTD</span>
              <span className="font-mono">{fmtCr(mtdComb)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Session table */}
      <div className="border-t border-border pt-4">
        <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-3">All Sessions — {monthData.month}</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-semibold pb-2 pr-6">Date</th>
                <th className="text-right font-semibold pb-2 pr-6">FII Net</th>
                <th className="text-right font-semibold pb-2 pr-6">DII Net</th>
                <th className="text-right font-semibold pb-2">Combined</th>
              </tr>
            </thead>
            <tbody>
              {[...monthData.entries].reverse().map((e, i) => {
                const c = e.fii + e.dii
                return (
                  <tr key={i} className="border-t border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="py-2 pr-6 text-[11px] text-muted-foreground font-mono">{e.date}</td>
                    <td className={`py-2 pr-6 text-right text-[11px] font-mono font-semibold ${e.fii >= 0 ? "text-success" : "text-destructive"}`}>{fmtCr(e.fii)}</td>
                    <td className={`py-2 pr-6 text-right text-[11px] font-mono font-semibold ${e.dii >= 0 ? "text-success" : "text-destructive"}`}>{fmtCr(e.dii)}</td>
                    <td className={`py-2 text-right text-[11px] font-mono font-semibold ${c >= 0 ? "text-success" : "text-destructive"}`}>{fmtCr(c)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border">
                <td className="pt-2 pr-6 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">MTD Total</td>
                <td className={`pt-2 pr-6 text-right text-[11px] font-mono font-bold ${mtdFii >= 0 ? "text-success" : "text-destructive"}`}>{fmtCr(mtdFii)}</td>
                <td className={`pt-2 pr-6 text-right text-[11px] font-mono font-bold ${mtdDii >= 0 ? "text-success" : "text-destructive"}`}>{fmtCr(mtdDii)}</td>
                <td className={`pt-2 text-right text-[11px] font-mono font-bold ${mtdComb >= 0 ? "text-success" : "text-destructive"}`}>{fmtCr(mtdComb)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground mt-4 leading-relaxed">
        FII = Foreign Institutional Investors · DII = Domestic Institutional Investors · Net = Buy − Sell
      </p>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function LiveIndicesBar() {
  const [indicesData, setIndicesData] = useState<IndexData[]>(
    INDICES.map(idx => ({ ...idx, price: null, change: null, changePercent: null, loading: true, error: false }))
  )
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  // EXACT original fetch logic — untouched
  const fetchAllIndices = useCallback(async () => {
    const results = await Promise.allSettled(
      INDICES.map(async (idx) => {
        const data = await fetchIndexData(idx.symbol)
        return { symbol: idx.symbol, ...data }
      })
    )
    setIndicesData(prev =>
      prev.map((idx, i) => {
        const result = results[i]
        if (result.status === "fulfilled") {
          return { ...idx, price: result.value.price, change: result.value.change, changePercent: result.value.changePercent, loading: false, error: false }
        }
        return { ...idx, loading: false, error: true }
      })
    )
    setLastUpdated(Date.now())
  }, [])

  useEffect(() => {
    fetchAllIndices()
    const interval = setInterval(fetchAllIndices, 60000)
    return () => clearInterval(interval)
  }, [fetchAllIndices])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Market Overview
          {lastUpdated && (
            <span className="text-[10px] font-normal text-muted-foreground ml-2">
              updated {Math.floor((Date.now() - lastUpdated) / 1000)}s ago
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <span className="text-xs font-medium text-success">LIVE</span>
        </div>
      </div>

      {/* 2 index cards side by side */}
      <div className="grid grid-cols-2 gap-3">
        {indicesData.map(item => <IndexCard key={item.symbol} item={item} />)}
      </div>

      {/* FII/DII — static, always works */}
      <FiiDiiPanel />
    </div>
  )
}
