"use client"

import { useEffect, useState, useCallback } from "react"

interface IndexData {
  symbol: string
  name: string
  price: number | null
  change: number | null
  changePercent: number | null
  loading: boolean
  error: boolean
}

const INDICES = [
  { symbol: "^NSEI",    name: "NIFTY 50"   },
  { symbol: "^NSEBANK", name: "BANK NIFTY" },
]

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

function Shimmer({ w, h }: { w?: string; h?: string }) {
  return <div className="animate-pulse rounded-md bg-muted/50" style={{ width: w ?? "100%", height: h ?? "14px" }} />
}

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
        {item.price!.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <div className={`inline-flex items-center gap-1 self-start text-xs font-semibold px-2 py-1 rounded-lg ${up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
        <span>{up ? "▲" : "▼"}</span>
        <span>{Math.abs(item.change ?? 0).toFixed(2)}</span>
        <span className="opacity-70">({Math.abs(item.changePercent ?? 0).toFixed(2)}%)</span>
      </div>
    </div>
  )
}

export function LiveIndicesBar() {
  const [indicesData, setIndicesData] = useState<IndexData[]>(
    INDICES.map(idx => ({ ...idx, price: null, change: null, changePercent: null, loading: true, error: false }))
  )
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

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
    <div className="space-y-3">
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

      <div className="grid grid-cols-2 gap-3">
        {indicesData.map(item => <IndexCard key={item.symbol} item={item} />)}
      </div>
    </div>
  )
}
