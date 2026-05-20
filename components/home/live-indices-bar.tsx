"use client"

import { useEffect, useState, useCallback } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface IndexData {
  symbol: string
  name: string
  group: "india" | "global"
  price: number | null
  change: number | null
  changePercent: number | null
  decimals: number
  prefix: string
  isINR: boolean
  loading: boolean
  error: boolean
}

interface FiiDiiEntry { date: string; fiiNet: number; diiNet: number }
interface FiiDiiState {
  today: FiiDiiEntry | null
  mtd: { fiiNet: number; diiNet: number } | null
  entries: FiiDiiEntry[]
  loading: boolean
  error: boolean
}

// ─── Instruments — same structure as original ─────────────────────────────────

const INDICES: Omit<IndexData,"price"|"change"|"changePercent"|"loading"|"error">[] = [
  { symbol:"^NSEI",      name:"NIFTY 50",   group:"india",  decimals:2, prefix:"",  isINR:true  },
  { symbol:"^NSEBANK",   name:"BANK NIFTY", group:"india",  decimals:2, prefix:"",  isINR:true  },
  { symbol:"^BSESN",     name:"SENSEX",     group:"india",  decimals:2, prefix:"",  isINR:true  },
  { symbol:"^INDIAVIX",  name:"INDIA VIX",  group:"india",  decimals:2, prefix:"",  isINR:false },
  { symbol:"^NSEMDCP50", name:"MIDCAP 50",  group:"india",  decimals:2, prefix:"",  isINR:true  },
  { symbol:"^NSEMDCP50", name:"GIFT NIFTY", group:"india",  decimals:2, prefix:"",  isINR:true  },
  { symbol:"USDINR=X",   name:"USD/INR",    group:"global", decimals:2, prefix:"₹", isINR:false },
  { symbol:"GC=F",       name:"GOLD",       group:"global", decimals:2, prefix:"$", isINR:false },
  { symbol:"CL=F",       name:"CRUDE OIL",  group:"global", decimals:2, prefix:"$", isINR:false },
]

// ─── EXACT same fetch as original — allorigins.win — but with 3 proxy fallbacks
// Proxies tried in order; first success wins. Same v8/finance/chart endpoint.

const PROXIES = [
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
]

async function fetchIndexData(symbol: string): Promise<{ price: number; change: number; changePercent: number }> {
  // EXACT same Yahoo endpoint as original
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`

  for (const proxyFn of PROXIES) {
    const proxyUrl = proxyFn(yahooUrl)
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 7000)
      const response = await fetch(proxyUrl, { signal: controller.signal })
      clearTimeout(timer)

      if (!response.ok) continue

      const data = await response.json()

      // allorigins wraps in { contents: "..." }, others return JSON directly
      let parsed: any
      if (data?.contents) {
        parsed = JSON.parse(data.contents)
      } else {
        parsed = data
      }

      const meta = parsed?.chart?.result?.[0]?.meta
      if (!meta) continue

      const price = meta.regularMarketPrice
      const previousClose = meta.chartPreviousClose || meta.regularMarketPreviousClose || meta.previousClose
      if (!price || !previousClose) continue

      const change = price - previousClose
      const changePercent = (change / previousClose) * 100
      return { price, change, changePercent }
    } catch {
      // try next proxy
    }
  }

  throw new Error(`All proxies failed for ${symbol}`)
}

// ─── FII/DII — same proxy chain, NSE endpoint ────────────────────────────────

async function fetchFiiDiiData(): Promise<FiiDiiEntry[]> {
  const nseUrl = "https://www.nseindia.com/api/fiidiiTradeReact"

  for (const proxyFn of PROXIES) {
    const proxyUrl = proxyFn(nseUrl)
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 7000)
      const response = await fetch(proxyUrl, { signal: controller.signal })
      clearTimeout(timer)

      if (!response.ok) continue

      const raw = await response.json()
      // allorigins wraps in contents
      const data = raw?.contents ? JSON.parse(raw.contents) : raw
      if (!Array.isArray(data) || !data.length) continue

      return data.slice(0, 25).map((row: any) => ({
        date: row.date ?? row.tradDate ?? "",
        fiiNet: parseFloat(String(row.fiiNet ?? row.netPurchSales1 ?? "0").replace(/,/g, "")),
        diiNet: parseFloat(String(row.diiNet ?? row.netPurchSales2 ?? "0").replace(/,/g, "")),
      }))
    } catch {
      // try next proxy
    }
  }

  throw new Error("All proxies failed for FII/DII")
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(n: number, dec: number, prefix: string, isINR: boolean) {
  if (isINR) return prefix + n.toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec })
  return prefix + n.toFixed(dec)
}

function fmtCr(n: number) {
  const abs = Math.abs(n), sign = n >= 0 ? "+" : "−"
  return abs >= 10000 ? `${sign}₹${(abs/10000).toFixed(2)}K Cr` : `${sign}₹${abs.toFixed(2)} Cr`
}

function ago(ms: number) {
  const s = Math.floor((Date.now()-ms)/1000)
  if (s < 10) return "just now"
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s/60)}m ago`
}

// ─── UI Pieces ────────────────────────────────────────────────────────────────

function Shimmer({ w, h }: { w?: string; h?: string }) {
  return <div className="animate-pulse rounded bg-muted/50" style={{ width: w ?? "100%", height: h ?? "14px" }} />
}

function TickerCard({ item }: { item: IndexData }) {
  const up = (item.change ?? 0) >= 0
  const clr  = up ? "text-success" : "text-destructive"
  const badge = up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
  const bdr   = up ? "border-success/20" : "border-destructive/20"

  if (item.loading) return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <Shimmer w="55%" h="9px" />
      <Shimmer w="80%" h="22px" />
      <Shimmer w="65%" h="13px" />
    </div>
  )

  if (item.error && item.price === null) return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2 opacity-60">
      <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">{item.name}</p>
      <Shimmer w="80%" h="22px" />
      <Shimmer w="65%" h="13px" />
    </div>
  )

  return (
    <div className={`rounded-xl border ${bdr} bg-card hover:bg-muted/20 transition-colors p-3 flex flex-col gap-1.5 group cursor-default`}>
      <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">{item.name}</span>
      <span className="font-mono text-[15px] font-bold text-foreground leading-none">
        {fmtPrice(item.price!, item.decimals, item.prefix, item.isINR)}
      </span>
      <span className={`inline-flex items-center gap-0.5 self-start text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${badge}`}>
        <span className="text-[9px]">{up ? "▲" : "▼"}</span>
        {Math.abs(item.change ?? 0).toFixed(2)}
        <span className="opacity-60 ml-0.5">({Math.abs(item.changePercent ?? 0).toFixed(2)}%)</span>
      </span>
    </div>
  )
}

function FlowBar({ val, max }: { val: number; max: number }) {
  const up = val >= 0
  const pct = Math.min((Math.abs(val) / Math.max(max, 1)) * 100, 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${up ? "bg-success" : "bg-destructive"}`}
          style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-mono text-[11px] font-bold w-24 text-right shrink-0 ${up ? "text-success" : "text-destructive"}`}>
        {fmtCr(val)}
      </span>
    </div>
  )
}

function FiiDiiPanel({ state }: { state: FiiDiiState }) {
  if (state.loading) return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex justify-between items-center">
        <Shimmer w="40%" h="14px" />
        <Shimmer w="12%" h="14px" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        {[0,1].map(i=><div key={i} className="space-y-3">
          <Shimmer h="10px"/><Shimmer h="10px"/><Shimmer h="10px"/>
        </div>)}
      </div>
    </div>
  )

  if (state.error && !state.today) return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center text-base shrink-0">📡</div>
      <div>
        <p className="text-sm font-semibold text-foreground">FII / DII data unavailable</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          NSE is blocking browser requests right now. Auto-retries every 5 min. Check{" "}
          <a href="https://www.nseindia.com/market-data/fii-dii-activity" target="_blank" rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline">NSE directly</a>.
        </p>
      </div>
    </div>
  )

  if (!state.today) return null

  const tf = state.today.fiiNet, td = state.today.diiNet
  const mf = state.mtd?.fiiNet ?? 0, md = state.mtd?.diiNet ?? 0
  const maxV = Math.max(Math.abs(tf), Math.abs(td), Math.abs(mf), Math.abs(md), 500)
  const todayComb = tf + td, mtdComb = mf + md

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-foreground">FII / DII Activity</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {state.today.date && `${state.today.date} · `}Cash segment · ₹ Crores
          </p>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider bg-muted/40 text-muted-foreground px-2 py-1 rounded-full">NSE EOD</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-3">Today</p>
          <div className="space-y-2.5">
            <div><p className="text-[10px] text-muted-foreground mb-1">FII (Foreign)</p><FlowBar val={tf} max={maxV}/></div>
            <div><p className="text-[10px] text-muted-foreground mb-1">DII (Domestic)</p><FlowBar val={td} max={maxV}/></div>
            <div className={`flex justify-between items-center px-3 py-2 rounded-lg text-xs font-semibold ${todayComb>=0?"bg-success/10 text-success":"bg-destructive/10 text-destructive"}`}>
              <span>Net today</span><span className="font-mono">{fmtCr(todayComb)}</span>
            </div>
          </div>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-3">Month-to-Date</p>
          <div className="space-y-2.5">
            <div><p className="text-[10px] text-muted-foreground mb-1">FII (Foreign)</p><FlowBar val={mf} max={maxV}/></div>
            <div><p className="text-[10px] text-muted-foreground mb-1">DII (Domestic)</p><FlowBar val={md} max={maxV}/></div>
            <div className={`flex justify-between items-center px-3 py-2 rounded-lg text-xs font-semibold ${mtdComb>=0?"bg-success/10 text-success":"bg-destructive/10 text-destructive"}`}>
              <span>Net MTD</span><span className="font-mono">{fmtCr(mtdComb)}</span>
            </div>
          </div>
        </div>
      </div>

      {state.entries.length > 1 && (
        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-3">Recent Sessions</p>
          <table className="w-full">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-semibold pb-2 pr-4">Date</th>
                <th className="text-right font-semibold pb-2 pr-4">FII Net</th>
                <th className="text-right font-semibold pb-2 pr-4">DII Net</th>
                <th className="text-right font-semibold pb-2">Combined</th>
              </tr>
            </thead>
            <tbody>
              {state.entries.slice(0,7).map((e,i) => {
                const c = e.fiiNet + e.diiNet
                return (
                  <tr key={i} className="border-t border-border/30">
                    <td className="py-1.5 pr-4 text-[10px] text-muted-foreground font-mono">{e.date}</td>
                    <td className={`py-1.5 pr-4 text-right text-[10px] font-mono font-semibold ${e.fiiNet>=0?"text-success":"text-destructive"}`}>{fmtCr(e.fiiNet)}</td>
                    <td className={`py-1.5 pr-4 text-right text-[10px] font-mono font-semibold ${e.diiNet>=0?"text-success":"text-destructive"}`}>{fmtCr(e.diiNet)}</td>
                    <td className={`py-1.5 text-right text-[10px] font-mono font-semibold ${c>=0?"text-success":"text-destructive"}`}>{fmtCr(c)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[9px] text-muted-foreground mt-4">FII = Foreign · DII = Domestic · Net = Buy − Sell · Source: NSE India</p>
    </div>
  )
}

// ─── Main — structure kept identical to original ──────────────────────────────

export function LiveIndicesBar() {
  const [indicesData, setIndicesData] = useState<IndexData[]>(
    INDICES.map(idx => ({ ...idx, price: null, change: null, changePercent: null, loading: true, error: false }))
  )
  const [fiiDii, setFiiDii] = useState<FiiDiiState>({ today:null, mtd:null, entries:[], loading:true, error:false })
  const [lastUpdated, setLastUpdated] = useState<number|null>(null)

  // ── IDENTICAL to original fetch logic — one at a time with 400ms stagger
  // so allorigins doesn't rate-limit (this is the key fix vs batching)
  const fetchAllIndices = useCallback(async () => {
    for (let i = 0; i < INDICES.length; i++) {
      const idx = INDICES[i]
      // stagger 400ms apart — same as original spirit, prevents rate-limiting
      await new Promise(r => setTimeout(r, i === 0 ? 0 : 400))
      try {
        const data = await fetchIndexData(idx.symbol)
        setIndicesData(prev => prev.map((item, j) =>
          j === i ? { ...item, ...data, loading: false, error: false } : item
        ))
      } catch {
        setIndicesData(prev => prev.map((item, j) =>
          j === i ? { ...item, loading: false, error: true } : item
        ))
      }
    }
    setLastUpdated(Date.now())
  }, [])

  const fetchFiiDii = useCallback(async () => {
    try {
      const rows = await fetchFiiDiiData()
      const now = new Date()
      const mtdRows = rows.filter(r => {
        const m = r.date.match(/(\d{2})-([A-Za-z]{3})-(\d{4})/)
        if (!m) return false
        const d = new Date(`${m[2]} ${m[1]}, ${m[3]}`)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      const mtd = mtdRows.reduce((a,e) => ({ fiiNet:a.fiiNet+e.fiiNet, diiNet:a.diiNet+e.diiNet }), { fiiNet:0, diiNet:0 })
      setFiiDii({ today:rows[0], mtd, entries:rows, loading:false, error:false })
    } catch {
      setFiiDii(prev => ({ ...prev, loading:false, error:true }))
    }
  }, [])

  // ── IDENTICAL interval to original (60s quotes, 5min FII/DII)
  useEffect(() => {
    fetchAllIndices()
    fetchFiiDii()
    const qi = setInterval(fetchAllIndices, 60000)
    const fi = setInterval(fetchFiiDii, 300000)
    return () => { clearInterval(qi); clearInterval(fi) }
  }, [fetchAllIndices, fetchFiiDii])

  const india  = indicesData.filter(q => q.group === "india")
  const global = indicesData.filter(q => q.group === "global")

  return (
    <div className="space-y-3">

      {/* Header — same structure as original */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Live Market Indices</h2>
          {lastUpdated && <span className="text-[10px] text-muted-foreground hidden sm:inline">{ago(lastUpdated)}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <span className="text-xs font-medium text-success">LIVE</span>
        </div>
      </div>

      {/* Indian indices */}
      <div>
        <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Indian Markets</p>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
          {india.map(item => <TickerCard key={item.symbol + item.name} item={item} />)}
        </div>
      </div>

      {/* Global & Commodities */}
      <div>
        <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Global & Commodities</p>
        <div className="grid grid-cols-3 gap-2">
          {global.map(item => <TickerCard key={item.symbol} item={item} />)}
        </div>
      </div>

      {/* FII / DII */}
      <FiiDiiPanel state={fiiDii} />

    </div>
  )
}
