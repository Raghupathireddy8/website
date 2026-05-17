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

const indices = [
  { symbol: "^NSEI", name: "NIFTY 50" },
  { symbol: "^NSEBANK", name: "BANK NIFTY" },
  { symbol: "^BSESN", name: "SENSEX" },
  { symbol: "^INDIAVIX", name: "INDIA VIX" },
  { symbol: "^NSEMDCP50", name: "NIFTY MIDCAP" },
]

async function fetchIndexData(symbol: string): Promise<{
  price: number
  change: number
  changePercent: number
}> {
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

export function LiveIndicesBar() {
  const [indicesData, setIndicesData] = useState<IndexData[]>(
    indices.map((idx) => ({
      ...idx,
      price: null,
      change: null,
      changePercent: null,
      loading: true,
      error: false,
    }))
  )

  const fetchAllIndices = useCallback(async () => {
    const results = await Promise.allSettled(
      indices.map(async (idx) => {
        const data = await fetchIndexData(idx.symbol)
        return { symbol: idx.symbol, ...data }
      })
    )

    setIndicesData((prev) =>
      prev.map((idx, i) => {
        const result = results[i]
        if (result.status === "fulfilled") {
          return {
            ...idx,
            price: result.value.price,
            change: result.value.change,
            changePercent: result.value.changePercent,
            loading: false,
            error: false,
          }
        }
        return { ...idx, loading: false, error: true }
      })
    )
  }, [])

  useEffect(() => {
    fetchAllIndices()
    const interval = setInterval(fetchAllIndices, 60000)
    return () => clearInterval(interval)
  }, [fetchAllIndices])

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Live Market Indices</h2>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="live-pulse absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          <span className="text-xs font-medium text-success">LIVE</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {indicesData.map((idx) => (
          <div key={idx.symbol} className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
              {idx.name}
            </span>
            
            {idx.loading ? (
              <>
                <div className="skeleton h-6 w-20 mb-1"></div>
                <div className="skeleton h-4 w-16"></div>
              </>
            ) : idx.error ? (
              <span className="text-xs text-destructive">Unavailable</span>
            ) : (
              <>
                <span className="font-mono text-lg font-semibold text-foreground">
                  {idx.price?.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={`flex items-center gap-1 text-xs font-medium ${
                    (idx.change ?? 0) >= 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  {(idx.change ?? 0) >= 0 ? "▲" : "▼"}
                  {Math.abs(idx.change ?? 0).toFixed(2)} (
                  {Math.abs(idx.changePercent ?? 0).toFixed(2)}%)
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
