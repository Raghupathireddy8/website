// app/api/market-data/route.ts
// Server-side fetcher — no CORS issues, full header control, fast
// Place this at: app/api/market-data/route.ts

import { NextResponse } from "next/server"

const YAHOO_SYMBOLS = [
  { symbol: "^NSEI",     name: "NIFTY 50",    group: "india",  decimals: 2, isINR: true  },
  { symbol: "^NSEBANK",  name: "BANK NIFTY",  group: "india",  decimals: 2, isINR: true  },
  { symbol: "^BSESN",    name: "SENSEX",      group: "india",  decimals: 2, isINR: true  },
  { symbol: "^INDIAVIX", name: "INDIA VIX",   group: "india",  decimals: 2, isINR: false },
  { symbol: "NIFTYMIDCAP50.NS", name: "MIDCAP 50", group: "india", decimals: 2, isINR: true },
  { symbol: "GIFT.NS",   name: "GIFT NIFTY",  group: "india",  decimals: 2, isINR: true  },
  { symbol: "USDINR=X",  name: "USD / INR",   group: "global", decimals: 4, prefix: "₹" },
  { symbol: "GC=F",      name: "GOLD",        group: "global", decimals: 2, prefix: "$" },
  { symbol: "CL=F",      name: "CRUDE OIL",   group: "global", decimals: 2, prefix: "$" },
  { symbol: "MCX_MC:CRUDEOIL%3DINR", name: "MCX CRUDE", group: "global", decimals: 2, isINR: true },
]

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
  Origin: "https://finance.yahoo.com",
}

const NSE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/",
  Origin: "https://www.nseindia.com",
  Cookie: "", // populated dynamically if needed
}

async function fetchQuote(symbol: string) {
  // Use Yahoo Finance v6 quoteSummary — most stable endpoint
  const url = `https://query1.finance.yahoo.com/v6/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price`
  const res = await fetch(url, {
    headers: HEADERS,
    next: { revalidate: 55 }, // ISR cache 55 seconds
  })
  if (!res.ok) throw new Error(`Yahoo ${res.status} for ${symbol}`)
  const json = await res.json()
  const price = json?.quoteSummary?.result?.[0]?.price
  if (!price) throw new Error(`No price data for ${symbol}`)

  return {
    symbol,
    price: price.regularMarketPrice?.raw ?? null,
    change: price.regularMarketChange?.raw ?? null,
    changePercent: price.regularMarketChangePercent?.raw ? price.regularMarketChangePercent.raw * 100 : null,
    prevClose: price.regularMarketPreviousClose?.raw ?? null,
    open: price.regularMarketOpen?.raw ?? null,
    high: price.regularMarketDayHigh?.raw ?? null,
    low: price.regularMarketDayLow?.raw ?? null,
    volume: price.regularMarketVolume?.raw ?? null,
    marketState: price.marketState ?? null,
  }
}

// Get NSE session cookie first, then fetch FII/DII
async function fetchFiiDii() {
  // Step 1: get a session cookie from NSE homepage
  let cookie = ""
  try {
    const cookieRes = await fetch("https://www.nseindia.com/", {
      headers: NSE_HEADERS,
      cache: "no-store",
    })
    const setCookie = cookieRes.headers.get("set-cookie")
    if (setCookie) {
      // extract nsit and nseappid cookies
      cookie = setCookie
        .split(",")
        .map((c) => c.split(";")[0].trim())
        .join("; ")
    }
  } catch {
    // proceed without cookie — may still work
  }

  // Step 2: fetch FII/DII data
  const res = await fetch("https://www.nseindia.com/api/fiidiiTradeReact", {
    headers: { ...NSE_HEADERS, Cookie: cookie },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`NSE FII/DII ${res.status}`)
  const data = await res.json()
  return data
}

function parseFiiDii(raw: any[]) {
  if (!Array.isArray(raw) || !raw.length) return null

  const entries = raw.slice(0, 25).map((row: any) => ({
    date: row.date ?? row.tradDate ?? "",
    fiiNet: parseFloat(row.fiiNet ?? row.netTurnover1 ?? "0"),
    diiNet: parseFloat(row.diiNet ?? row.netTurnover2 ?? "0"),
  }))

  const today = entries[0]

  // MTD: all entries in the current calendar month
  const now = new Date()
  const mtdEntries = entries.filter((e) => {
    if (!e.date) return true // if no date, include all in fallback
    const parts = e.date.match(/(\d{2})-([A-Za-z]{3})-(\d{4})/)
    if (!parts) return false
    const d = new Date(`${parts[2]} ${parts[1]}, ${parts[3]}`)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const mtd = mtdEntries.reduce(
    (acc, e) => ({ fiiNet: acc.fiiNet + e.fiiNet, diiNet: acc.diiNet + e.diiNet }),
    { fiiNet: 0, diiNet: 0 }
  )

  return { today, mtd, entries: entries.slice(0, 10) }
}

export async function GET() {
  // Fetch all quotes in parallel — server-side, no CORS
  const quoteResults = await Promise.allSettled(
    YAHOO_SYMBOLS.map(async (s) => {
      const q = await fetchQuote(s.symbol)
      return { ...s, ...q }
    })
  )

  const quotes = quoteResults.map((r, i) => ({
    ...YAHOO_SYMBOLS[i],
    price: null,
    change: null,
    changePercent: null,
    prevClose: null,
    open: null,
    high: null,
    low: null,
    volume: null,
    marketState: null,
    error: r.status === "rejected",
    ...(r.status === "fulfilled" ? r.value : {}),
  }))

  // FII/DII — best-effort
  let fiiDii = null
  try {
    const raw = await fetchFiiDii()
    fiiDii = parseFiiDii(raw)
  } catch {
    // return null — client handles gracefully
  }

  return NextResponse.json(
    { quotes, fiiDii, timestamp: Date.now() },
    {
      headers: {
        "Cache-Control": "public, s-maxage=55, stale-while-revalidate=5",
      },
    }
  )
}
