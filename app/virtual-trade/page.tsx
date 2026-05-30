"use client"

// ─── DB MIGRATION REQUIRED ────────────────────────────────────────────────────
// Run these SQL statements in your Supabase SQL editor if not already present:
//
//   ALTER TABLE positions     ADD COLUMN IF NOT EXISTS margin_blocked NUMERIC DEFAULT 0;
//   ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS margin_blocked NUMERIC DEFAULT 0;
//   ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS realized_pnl   NUMERIC;
//   ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS executed_at    TIMESTAMPTZ DEFAULT NOW();
//   ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ DEFAULT NOW();
//   ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS expiry         DATE;
//   ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS strike_price   NUMERIC;
//   ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS option_type    TEXT;
//
//   -- Strategy builder tables
//   CREATE TABLE IF NOT EXISTS strategies (
//     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     user_id UUID REFERENCES auth.users(id),
//     name TEXT NOT NULL,
//     description TEXT,
//     legs JSONB DEFAULT '[]',
//     created_at TIMESTAMPTZ DEFAULT NOW()
//   );
//
//   -- Replay sessions
//   CREATE TABLE IF NOT EXISTS replay_sessions (
//     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     user_id UUID REFERENCES auth.users(id),
//     symbol TEXT NOT NULL,
//     from_date DATE NOT NULL,
//     to_date DATE,
//     created_at TIMESTAMPTZ DEFAULT NOW()
//   );
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import {
  Eye, EyeOff, Phone, Lock, User, ArrowRight, Mail,
  TrendingUp, TrendingDown, RefreshCw, LogOut,
  X, History, BarChart2, ChevronDown, Wallet, KeyRound, BookOpen,
  Play, Pause, SkipForward, SkipBack, Zap, Target, Layers,
  ChevronRight, Plus, Minus, Activity, Clock, Calendar,
  Info, AlertTriangle, CheckCircle2, Search, Settings, Star,
} from "lucide-react"

// ─── NSE F&O Lot Sizes — effective 2025-26 ───────────────────────────────────
const LOT_SIZES: Record<string, number> = {
  NIFTY: 75,    BANKNIFTY: 30,  FINNIFTY: 60,   MIDCPNIFTY: 120,
  RELIANCE: 500, TCS: 175,      INFY: 400,      HDFCBANK: 550,
  ICICIBANK: 700, SBIN: 1500,   BHARTIARTL: 950, ITC: 3200,
  AXISBANK: 1200, BAJFINANCE: 125, MARUTI: 100,  SUNPHARMA: 350,
  TATAMOTORS: 1425, WIPRO: 1500, HCLTECH: 700,   ONGC: 1925,
  HINDUNILVR: 300, KOTAKBANK: 400, LT: 150,      ASIANPAINT: 200,
  TITAN: 175,   DRREDDY: 125,   CIPLA: 650,     JSWSTEEL: 600,
  TATASTEEL: 5500, HINDALCO: 1075, ADANIENT: 625, BAJAJFINSV: 500,
  NESTLEIND: 40, COALINDIA: 4200, ULTRACEMCO: 100, POWERGRID: 4700,
  NTPC: 3750,   BPCL: 4800,    EICHERMOT: 175,  HEROMOTOCO: 300,
  GRASIM: 475,  INDUSINDBK: 700, TATACONSUM: 1100, DIVISLAB: 200,
}

// Strike intervals per symbol
const STRIKE_INTERVALS: Record<string, number> = {
  NIFTY: 50, BANKNIFTY: 100, FINNIFTY: 50, MIDCPNIFTY: 25,
  default: 50,
}

function getStrikeInterval(symbol: string): number {
  return STRIKE_INTERVALS[symbol] ?? STRIKE_INTERVALS.default
}

function calcOptionsMargin(spot: number, lotSize: number, lots: number): number {
  return Math.round(spot * lotSize * lots * 0.20)
}
function calcFuturesMargin(spot: number, lotSize: number, lots: number): number {
  return Math.round(spot * lotSize * lots * 0.15)
}

const NIFTY50_EQUITY = [
  "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","HINDUNILVR","SBIN",
  "BHARTIARTL","ITC","KOTAKBANK","LT","AXISBANK","ASIANPAINT","MARUTI",
  "TITAN","SUNPHARMA","WIPRO","HCLTECH","ONGC","COALINDIA","TATAMOTORS",
  "JSWSTEEL","BAJFINANCE","NESTLEIND","NTPC","POWERGRID","ULTRACEMCO",
  "BPCL","EICHERMOT","HEROMOTOCO","GRASIM","TATASTEEL","HINDALCO",
  "ADANIENT","BAJAJFINSV","DRREDDY","CIPLA","DIVISLAB","INDUSINDBK","TATACONSUM",
]

const NIFTY50_FNO = ["NIFTY","BANKNIFTY","FINNIFTY", ...NIFTY50_EQUITY]

type InstrumentType = "EQUITY" | "OPTIONS" | "FUTURES"
type TradeType      = "BUY" | "SELL"
type OptionType     = "CE" | "PE"
type AuthMode       = "login" | "signup" | "forgot" | "verify" | "otp" | "reset"
type Tab            = "chain" | "strategy" | "replay" | "future" | "positions" | "history" | "ledger"

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n)
const fmtN = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// Nifty weekly: every Thursday for next 3 months
function getThursdaysForNext3Months(): string[] {
  const dates: string[] = []
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const end = new Date(now); end.setMonth(end.getMonth() + 3)
  const d = new Date(now)
  let daysAhead = (4 - d.getDay() + 7) % 7
  if (daysAhead === 0) daysAhead = 7
  d.setDate(d.getDate() + daysAhead)
  d.setHours(0, 0, 0, 0)
  while (d <= end) { dates.push(toISO(d)); d.setDate(d.getDate() + 7) }
  return dates
}

function getWeeklyExpiries(symbol: string): string[] {
  if (symbol === "NIFTY") return getThursdaysForNext3Months()
  if (symbol === "BANKNIFTY") {
    // BankNifty weekly on Wednesday
    const dates: string[] = []
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const end = new Date(now); end.setMonth(end.getMonth() + 3)
    const d = new Date(now)
    let daysAhead = (3 - d.getDay() + 7) % 7
    if (daysAhead === 0) daysAhead = 7
    d.setDate(d.getDate() + daysAhead)
    d.setHours(0, 0, 0, 0)
    while (d <= end) { dates.push(toISO(d)); d.setDate(d.getDate() + 7) }
    return dates
  }
  return getMonthlyExpiries()
}

function getMonthlyExpiries(): string[] {
  const dates: string[] = []
  const now = new Date(); now.setHours(0, 0, 0, 0)
  for (let m = 0; m < 6; m++) {
    const totalMonth = now.getMonth() + m
    const year  = now.getFullYear() + Math.floor(totalMonth / 12)
    const month = totalMonth % 12
    const d = new Date(year, month + 1, 0)
    d.setHours(0, 0, 0, 0)
    while (d.getDay() !== 4) d.setDate(d.getDate() - 1)
    if (d >= now) dates.push(toISO(d))
  }
  return dates
}

function formatExpiry(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })
}

function daysToExpiry(iso: string): number {
  const now = new Date()
  const exp = new Date(iso + "T15:30:00") // NSE close time
  return Math.max((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24), 0)
}

// ─── Black-Scholes ────────────────────────────────────────────────────────────
function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1.0 + sign * y)
}

function blackScholes(S: number, K: number, T: number, r: number, sigma: number, type: "CE" | "PE"): number {
  if (T <= 0) return Math.max(type === "CE" ? S - K : K - S, 0)
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)
  if (type === "CE") return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2)
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1)
}

function calcOptionPremium(spot: number, strike: number, expiryDate: string, optType: OptionType, iv = 0.18): number {
  const now   = new Date()
  const expiry = new Date(expiryDate + "T15:30:00")
  const T     = Math.max((expiry.getTime() - now.getTime()) / (365 * 24 * 60 * 60 * 1000), 0)
  const premium = blackScholes(spot, strike, T, 0.065, iv, optType)
  return Math.round(premium * 100) / 100
}

// Greeks calculation
function calcGreeks(S: number, K: number, T: number, r: number, sigma: number, type: "CE" | "PE") {
  if (T <= 0) return { delta: type === "CE" ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0, iv: sigma }
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)
  const nd1 = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * d1 * d1)
  const delta = type === "CE" ? normalCDF(d1) : normalCDF(d1) - 1
  const gamma = nd1 / (S * sigma * Math.sqrt(T))
  const theta = type === "CE"
    ? (-(S * nd1 * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normalCDF(d2)) / 365
    : (-(S * nd1 * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * normalCDF(-d2)) / 365
  const vega = S * nd1 * Math.sqrt(T) / 100
  return { delta, gamma, theta: Math.round(theta * 100) / 100, vega: Math.round(vega * 100) / 100, iv: sigma }
}

// VIX-based expected move: 1SD move = Spot × (VIX/100) × √(DTE/365)
function expectedMove(spot: number, vix: number, dte: number): { up: number; down: number; pct: number } {
  const pct = (vix / 100) * Math.sqrt(dte / 365)
  return { up: spot * (1 + pct), down: spot * (1 - pct), pct: pct * 100 }
}

function calcCharges(premium: number, qty: number, type: InstrumentType, side: TradeType) {
  const to        = premium * qty
  const brokerage = type === "EQUITY" ? Math.min(20, to * 0.0003) : 20
  const stt       = side === "SELL" && type === "EQUITY" ? to * 0.001
                  : side === "SELL" && type === "OPTIONS" ? to * 0.0005 : 0
  const other     = to * 0.0000695
  const stamp     = side === "BUY" ? to * 0.00015 : 0
  return Math.round((brokerage + stt + other + stamp) * 100) / 100
}

async function fetchLivePrice(symbol: string, type: InstrumentType): Promise<number | null> {
  const ySym = type === "EQUITY"      ? `${symbol}.NS`
             : symbol === "NIFTY"     ? "^NSEI"
             : symbol === "BANKNIFTY" ? "^NSEBANK"
             : symbol === "FINNIFTY"  ? "^NSEMDCP50"
             : `${symbol}.NS`

  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=1m&range=1d`
  try {
    const res  = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(yahooUrl)}`, { cache: "no-store" })
    if (res.ok) {
      const body = await res.json()
      const json = JSON.parse(body.contents)
      const p    = json?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (p && p > 0) return Math.round(p * 100) / 100
    }
  } catch {}
  try {
    const res2 = await fetch(`https://corsproxy.io/?${encodeURIComponent(`https://query2.finance.yahoo.com/v8/finance/chart/${ySym}?interval=1m&range=1d`)}`, { cache: "no-store" })
    if (res2.ok) {
      const json2 = await res2.json()
      const p2    = json2?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (p2 && p2 > 0) return Math.round(p2 * 100) / 100
    }
  } catch {}
  return null
}

async function fetchLivePrices(items: { symbol: string; instrument: InstrumentType }[]): Promise<Record<string, number>> {
  const unique = Array.from(new Map(items.map(i => [`${i.symbol}__${i.instrument}`, i])).values())
  const results = await Promise.allSettled(
    unique.map(i => fetchLivePrice(i.symbol, i.instrument).then(p => ({ key: `${i.symbol}__${i.instrument}`, p })))
  )
  const out: Record<string, number> = {}
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.p !== null) out[r.value.key] = r.value.p
  }
  return out
}

// ─── Schema-aware Supabase bhav data layer ───────────────────────────────────
//
// NSE bhav CSVs can be stored with many different column naming conventions
// depending on who built the ingestion pipeline.  We probe one sample row,
// detect the schema variant, and normalise every row into a stable shape:
//
//   { strike_price, expiry_date, ce_ltp, pe_ltp, ce_oi, pe_oi,
//     ce_volume, pe_volume, ce_iv, pe_iv, ce_bid, pe_bid,
//     ce_ask, pe_ask, ce_delta, pe_delta }
//
// Supported raw column name variants:
//   strike_price | STRIKE_PR | strikeprice | strike
//   expiry_date  | EXPIRY_DT | expirydate  | expiry
//   ce_ltp / pe_ltp            (already normalised)
//   CALLS_LTP / PUTS_LTP       (NSE web format)
//   call_ltp / put_ltp
//   call_close / put_close     (EOD bhav)
//   ltp (single-row format – one row per option, with OPTION_TYP CE/PE)
//   close / CLOSE              (generic close price)
//   oi / OI / open_interest    (single-row OI, needs OPTION_TYP to split)
//   ce_oi / pe_oi / call_oi / put_oi
//   ce_volume / pe_volume / call_volume / put_volume / volume / CONTRACTS
//   ce_iv / pe_iv / iv / IV / impliedvolatility
//   india_vix.close | india_vix.vix_close | india_vix.CLOSE | india_vix.VIX

type NormRow = {
  strike_price: number
  expiry_date:  string
  ce_ltp:    number | null
  pe_ltp:    number | null
  ce_oi:     number | null
  pe_oi:     number | null
  ce_volume: number | null
  pe_volume: number | null
  ce_iv:     number | null
  pe_iv:     number | null
}

function n(v: any): number | null {
  if (v === null || v === undefined || v === "" || v === "-") return null
  const f = parseFloat(String(v).replace(/,/g, ""))
  return isNaN(f) ? null : f
}

// Pick the first truthy value from a list of keys on an object
function pick(row: any, ...keys: string[]): any {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k]
  }
  return null
}

// Normalise a raw Supabase row into NormRow.
// Two formats handled:
//   A) Wide row  – one row per strike, CE and PE columns side by side
//   B) Narrow row – one row per option contract, with option_type CE/PE
//      (we call normaliseBhavRows which pairs them up)
function normaliseWideRow(raw: any): NormRow {
  const strike = n(pick(raw,
    "strike_price","STRIKE_PR","strikeprice","strike","STRIKEPRICE","strike_pr",
  )) ?? 0
  const expiry = String(pick(raw,
    "expiry_date","EXPIRY_DT","expirydate","expiry","EXPIRY","expiry_dt",
  ) ?? "")

  return {
    strike_price: strike,
    expiry_date:  expiry,

    // CE LTP – try every known alias
    ce_ltp: n(pick(raw,
      "ce_ltp","CE_LTP","calls_ltp","CALLS_LTP","call_ltp","CALL_LTP",
      "call_close","CALL_CLOSE","ce_close","CE_CLOSE","calls_close","ce_last",
    )),

    // PE LTP
    pe_ltp: n(pick(raw,
      "pe_ltp","PE_LTP","puts_ltp","PUTS_LTP","put_ltp","PUT_LTP",
      "put_close","PUT_CLOSE","pe_close","PE_CLOSE","puts_close","pe_last",
    )),

    // CE OI
    ce_oi: n(pick(raw,
      "ce_oi","CE_OI","calls_oi","CALLS_OI","call_oi","CALL_OI",
      "ce_open_int","CE_OPEN_INT","calls_open_int","CALLS_OPEN_INT",
    )),

    // PE OI
    pe_oi: n(pick(raw,
      "pe_oi","PE_OI","puts_oi","PUTS_OI","put_oi","PUT_OI",
      "pe_open_int","PE_OPEN_INT","puts_open_int","PUTS_OPEN_INT",
    )),

    // CE Volume
    ce_volume: n(pick(raw,
      "ce_volume","CE_VOLUME","calls_volume","CALLS_VOLUME","call_volume","CALL_VOLUME",
      "ce_vol","CE_VOL","calls_vol","CALLS_VOL","ce_contracts","CE_CONTRACTS",
    )),

    // PE Volume
    pe_volume: n(pick(raw,
      "pe_volume","PE_VOLUME","puts_volume","PUTS_VOLUME","put_volume","PUT_VOLUME",
      "pe_vol","PE_VOL","puts_vol","PUTS_VOL","pe_contracts","PE_CONTRACTS",
    )),

    // CE IV
    ce_iv: n(pick(raw,
      "ce_iv","CE_IV","calls_iv","CALLS_IV","call_iv","CALL_IV",
      "ce_implied_volatility","CE_IMPLIED_VOLATILITY","calls_implied_vol",
    )),

    // PE IV
    pe_iv: n(pick(raw,
      "pe_iv","PE_IV","puts_iv","PUTS_IV","put_iv","PUT_IV",
      "pe_implied_volatility","PE_IMPLIED_VOLATILITY","puts_implied_vol",
    )),
  }
}

// For narrow (single-contract) rows, detect option type and pair CE/PE
function normaliseNarrowRows(rows: any[]): NormRow[] {
  const byStrike: Record<number, NormRow> = {}

  for (const raw of rows) {
    const strike = n(pick(raw, "strike_price","STRIKE_PR","strikeprice","strike","STRIKEPRICE","strike_pr")) ?? 0
    if (!strike) continue

    const expiry = String(pick(raw, "expiry_date","EXPIRY_DT","expirydate","expiry","EXPIRY","expiry_dt") ?? "")
    const optType = String(pick(raw, "option_type","OPTION_TYP","optiontype","opt_type","type","OPT_TYPE","CE_PE") ?? "").toUpperCase().trim()
    const isCE = optType === "CE" || optType.includes("CALL")
    const isPE = optType === "PE" || optType.includes("PUT")
    if (!isCE && !isPE) continue

    if (!byStrike[strike]) {
      byStrike[strike] = {
        strike_price: strike, expiry_date: expiry,
        ce_ltp: null, pe_ltp: null, ce_oi: null, pe_oi: null,
        ce_volume: null, pe_volume: null, ce_iv: null, pe_iv: null,
      }
    }
    const norm = byStrike[strike]

    const ltp = n(pick(raw,
      "ltp","LTP","last","LAST","close","CLOSE","last_price","LAST_PRICE",
      "settle_price","SETTLE_PR","settlement_price",
    ))
    const oi = n(pick(raw,
      "oi","OI","open_int","OPEN_INT","open_interest","OPEN_INTEREST",
      "oi_contracts","OI_CONTRACTS","contracts","CONTRACTS",
    ))
    const vol = n(pick(raw,
      "volume","VOLUME","vol","VOL","no_of_contracts","NO_OF_CONTRACTS","qty","QTY",
    ))
    const iv = n(pick(raw,
      "iv","IV","implied_volatility","IMPLIED_VOLATILITY","impliedvol","IMPLIEDVOL",
    ))

    if (isCE) {
      if (ltp !== null) norm.ce_ltp = ltp
      if (oi  !== null) norm.ce_oi  = oi
      if (vol !== null) norm.ce_volume = vol
      if (iv  !== null) norm.ce_iv  = iv
    } else {
      if (ltp !== null) norm.pe_ltp = ltp
      if (oi  !== null) norm.pe_oi  = oi
      if (vol !== null) norm.pe_volume = vol
      if (iv  !== null) norm.pe_iv  = iv
    }
  }
  return Object.values(byStrike)
}

// Detect whether rows are wide or narrow format
function isNarrowFormat(rows: any[]): boolean {
  if (!rows.length) return false
  const r = rows[0]
  // narrow = has option_type / OPTION_TYP column
  return !!(r.option_type ?? r.OPTION_TYP ?? r.optiontype ?? r.opt_type ?? r.OPT_TYPE ?? r.CE_PE)
}

// ─── VIX: try every plausible column name ────────────────────────────────────
async function fetchVIXFromSupabase(): Promise<number> {
  // Try common date-sorted columns
  const tryColumns = [
    { col: "close",     dateCol: "date"       },
    { col: "vix_close", dateCol: "date"       },
    { col: "CLOSE",     dateCol: "date"       },
    { col: "VIX",       dateCol: "date"       },
    { col: "vix",       dateCol: "date"       },
    { col: "close",     dateCol: "TIMESTAMP"  },
    { col: "close",     dateCol: "trade_date" },
  ]

  for (const { col, dateCol } of tryColumns) {
    try {
      const { data } = await supabase
        .from("india_vix")
        .select(`${col},${dateCol}`)
        .order(dateCol, { ascending: false })
        .limit(1)
        .single()
      const v = n(data?.[col])
      if (v && v > 0) return v
    } catch {}
  }

  // Last resort: select * and look at whatever came back
  try {
    const { data } = await supabase.from("india_vix").select("*").order("date", { ascending: false }).limit(1).single()
    if (data) {
      for (const key of Object.keys(data)) {
        const v = n(data[key])
        if (v && v > 5 && v < 100) return v   // VIX is always in this range
      }
    }
  } catch {}

  return 15 // safe default
}

// ─── Main bhav option chain fetcher ──────────────────────────────────────────
async function fetchBhavOptionChain(
  symbol: string,
  expiry: string,        // YYYY-MM-DD format
  spot: number
): Promise<NormRow[]> {
  const tableName = symbol === "BANKNIFTY" ? "banknifty_options" : "nifty_options"
  const interval  = getStrikeInterval(symbol)
  const atm       = Math.round(spot / interval) * interval
  // 10 strikes each side of ATM = 21 total
  const strikes   = Array.from({ length: 21 }, (_, i) => atm - 10 * interval + i * interval).filter(s => s > 0)

  // We don't know the exact column name for strike_price or expiry_date up front.
  // Strategy: fetch a small probe row first, detect schema, then run main query.

  // ── Step 1: probe to detect schema variant ──────────────────────────────────
  const { data: probe } = await supabase.from(tableName).select("*").limit(2)
  if (!probe || probe.length === 0) return []

  const sampleRow = probe[0]
  const keys = Object.keys(sampleRow)

  // Detect the actual column names in this table
  const strikeCol  = keys.find(k => /strike/i.test(k) && !/no|num/i.test(k)) ?? "strike_price"
  const expiryCol  = keys.find(k => /expiry/i.test(k)) ?? "expiry_date"

  // Also check: does the expiry in DB have different format? (DD-MMM-YYYY, YYYY-MM-DD, etc.)
  // Probe what the actual expiry value looks like for the first row
  const probeExpiry = String(sampleRow[expiryCol] ?? "")

  // Convert our YYYY-MM-DD expiry to match DB format
  function convertExpiry(isoDate: string): string[] {
    const d = new Date(isoDate + "T00:00:00")
    const dd  = String(d.getDate()).padStart(2, "0")
    const mon3 = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()
    const yyyy = d.getFullYear()
    const yy   = String(yyyy).slice(2)
    return [
      isoDate,                          // YYYY-MM-DD
      `${dd}-${mon3}-${yyyy}`,          // DD-MMM-YYYY  (NSE standard)
      `${dd}-${mon3}-${yy}`,            // DD-MMM-YY
      `${yyyy}/${String(d.getMonth()+1).padStart(2,"0")}/${dd}`, // YYYY/MM/DD
      `${dd}/${String(d.getMonth()+1).padStart(2,"0")}/${yyyy}`, // DD/MM/YYYY
    ]
  }

  const expiryVariants = convertExpiry(expiry)

  // Try each expiry variant until we get results
  for (const ev of expiryVariants) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq(expiryCol, ev)
      .in(strikeCol, strikes)
      .order(strikeCol, { ascending: true })
      .limit(500)

    if (error || !data || data.length === 0) continue

    // Detect format and normalise
    if (isNarrowFormat(data)) {
      return normaliseNarrowRows(data).sort((a, b) => a.strike_price - b.strike_price)
    } else {
      return data.map(normaliseWideRow).sort((a, b) => a.strike_price - b.strike_price)
    }
  }

  // Nothing found for this expiry — return empty (caller will use BS fallback)
  return []
}

// ─── Fetch all available expiry dates from bhav tables ───────────────────────
async function fetchBhavExpiries(symbol: string): Promise<string[]> {
  const tableName = symbol === "BANKNIFTY" ? "banknifty_options" : "nifty_options"
  // Probe schema first to find expiry column
  const { data: probe } = await supabase.from(tableName).select("*").limit(1)
  if (!probe || !probe.length) return []
  const keys = Object.keys(probe[0])
  const expiryCol = keys.find(k => /expiry/i.test(k)) ?? "expiry_date"

  const { data } = await supabase
    .from(tableName)
    .select(expiryCol)
    .order(expiryCol, { ascending: true })
  if (!data) return []

  const raw = [...new Set(data.map((r: any) => String(r[expiryCol] ?? "").trim()))].filter(Boolean)
  // Normalise all to YYYY-MM-DD
  return raw.map(v => {
    // Try DD-MMM-YYYY  e.g. "25-JAN-2025"
    const m1 = v.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
    if (m1) {
      const months: Record<string,string> = { JAN:"01",FEB:"02",MAR:"03",APR:"04",MAY:"05",JUN:"06",JUL:"07",AUG:"08",SEP:"09",OCT:"10",NOV:"11",DEC:"12" }
      const mm = months[m1[2].toUpperCase()]
      if (mm) return `${m1[3]}-${mm}-${m1[1].padStart(2,"0")}`
    }
    // Try DD-MMM-YY  e.g. "25-JAN-25"
    const m2 = v.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/)
    if (m2) {
      const months: Record<string,string> = { JAN:"01",FEB:"02",MAR:"03",APR:"04",MAY:"05",JUN:"06",JUL:"07",AUG:"08",SEP:"09",OCT:"10",NOV:"11",DEC:"12" }
      const mm = months[m2[2].toUpperCase()]
      const year = `20${m2[3]}`
      if (mm) return `${year}-${mm}-${m2[1].padStart(2,"0")}`
    }
    // YYYY-MM-DD already
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
    return v // leave as-is if unrecognised
  }).sort()
}

// ─── Fetch all dates available in bhav (for replay) ──────────────────────────
async function fetchBhavDates(symbol: string): Promise<string[]> {
  const tableName = symbol === "BANKNIFTY" ? "banknifty_options" : "nifty_options"
  const { data: probe } = await supabase.from(tableName).select("*").limit(1)
  if (!probe || !probe.length) return []
  const keys = Object.keys(probe[0])
  const dateCol = keys.find(k => /^date$|^trade_date$|^timestamp$/i.test(k)) ?? "date"

  const { data } = await supabase
    .from(tableName)
    .select(dateCol)
    .order(dateCol, { ascending: true })
  if (!data) return []
  return [...new Set(data.map((r: any) => String(r[dateCol] ?? "").slice(0, 10)))].filter(Boolean).sort()
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTH SECTION (preserved from original)
// ═════════════════════════════════════════════════════════════════════════════

function AuthSection({ onAuth, initialMode = "login" }: { onAuth: () => void; initialMode?: AuthMode }) {
  const [mode,     setMode]     = useState<AuthMode>(initialMode)
  const [mobile,   setMobile]   = useState("")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [confirm,  setConfirm]  = useState("")
  const [fullName, setFullName] = useState("")
  const [otp,      setOtp]      = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [resendCD, setResendCD] = useState(0)
  const [error,    setError]    = useState("")
  const [success,  setSuccess]  = useState("")
  const [pendingUid,    setPendingUid]    = useState("")
  const [pendingMobile, setPendingMobile] = useState("")

  const normMobile = (m: string) => m.replace(/\D/g, "").slice(-10)

  useEffect(() => {
    if (resendCD <= 0) return
    const t = setTimeout(() => setResendCD(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCD])

  function switchMode(m: AuthMode) { setMode(m); setError(""); setSuccess("") }

  function validate() {
    if (mode === "otp") { if (otp.replace(/\D/g,"").length !== 6) return "Enter 6-digit code"; return "" }
    if (mode === "forgot") return email ? "" : "Enter your registered email"
    if (mode === "reset") {
      if (!password) return "Enter new password"
      if (password.length < 8) return "Password must be at least 8 characters"
      if (password !== confirm) return "Passwords do not match"
      return ""
    }
    if (mode === "login") {
      const isEmail = /\S+@\S+\.\S+/.test(mobile.trim())
      if (!isEmail && normMobile(mobile).length !== 10) return "Enter a valid 10-digit mobile number or email"
      if (!password) return "Enter your password"
      return ""
    }
    const m = normMobile(mobile)
    if (m.length !== 10) return "Enter a valid 10-digit mobile number"
    if (!fullName.trim()) return "Enter your full name"
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) return "Enter a valid email"
    if (!password || password.length < 8) return "Password must be at least 8 characters"
    if (password !== confirm) return "Passwords do not match"
    return ""
  }

  async function handleSignup() {
    const m = normMobile(mobile)
    const { data: mobileExists } = await supabase.rpc("mobile_registered", { p_mobile: m })
    if (mobileExists) { setError("Mobile already registered. Please sign in."); setLoading(false); return }
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: email.toLowerCase(), password,
      options: { emailRedirectTo: `${window.location.origin}/virtual-trade`, data: { full_name: fullName, mobile: m } },
    })
    if (signUpErr) { setError(signUpErr.message); setLoading(false); return }
    const uid = data.user?.id
    if (uid) {
      setPendingUid(uid); setPendingMobile(m)
      await supabase.from("profiles").upsert({ id: uid, email: email.toLowerCase(), mobile: m, full_name: fullName })
    }
    if (data.user && !data.session) switchMode("otp")
    else { onAuth() }
  }

  async function handleOtp() {
    const { error: verErr } = await supabase.auth.verifyOtp({ email: email.toLowerCase(), token: otp.replace(/\D/g,""), type: "signup" })
    if (verErr) { setError(verErr.message); setLoading(false); return }
    if (pendingUid) {
      const { data: wal } = await supabase.from("wallets").select("id").eq("user_id", pendingUid).maybeSingle()
      if (!wal) await supabase.from("wallets").insert({ user_id: pendingUid, balance: 1000000 })
    }
    onAuth()
  }

  async function handleResendOtp() {
    setResendCD(60); setError("")
    await supabase.auth.resend({ type: "signup", email: email.toLowerCase() })
    setSuccess("Verification code resent!")
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true); setError(""); setSuccess("")
    try {
      if (mode === "otp") { await handleOtp(); return }
      if (mode === "signup") { await handleSignup(); return }
      if (mode === "login") {
        const isEmail = /\S+@\S+\.\S+/.test(mobile.trim())
        const loginEmail = isEmail ? mobile.trim().toLowerCase() : ""
        let resolvedEmail = loginEmail
        if (!isEmail) {
          const { data: prof } = await supabase.from("profiles").select("email").eq("mobile", normMobile(mobile)).maybeSingle()
          if (!prof?.email) { setError("Mobile number not found. Please sign up."); setLoading(false); return }
          resolvedEmail = prof.email
        }
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password })
        if (loginErr) { setError(loginErr.message); setLoading(false); return }
        onAuth(); return
      }
      if (mode === "forgot") {
        const { error: forgotErr } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), { redirectTo: `${window.location.origin}/virtual-trade` })
        if (forgotErr) { setError(forgotErr.message) } else { setSuccess("Password reset link sent! Check your email.") }
        setLoading(false); return
      }
      if (mode === "reset") {
        const { error: resetErr } = await supabase.auth.updateUser({ password })
        if (resetErr) { setError(resetErr.message) } else { setSuccess("Password updated! Signing you in…"); setTimeout(() => onAuth(), 1500) }
        setLoading(false); return
      }
    } catch (e: any) { setError(e.message ?? "Unknown error"); setLoading(false) }
  }

  if (mode === "otp") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-2xl mb-3">
              <Mail className="w-7 h-7 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Verify your email</h2>
            <p className="text-sm text-muted-foreground mt-1">Enter the 6-digit code sent to <strong>{email}</strong></p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6">
            {error && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-lg px-3 py-2 mb-4">{error}</div>}
            {success && <div className="bg-success/10 border border-success/30 text-success text-xs rounded-lg px-3 py-2 mb-4">{success}</div>}
            <form onSubmit={submit} className="space-y-4">
              <input type="text" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} placeholder="123456"
                className="w-full text-center text-2xl font-mono tracking-widest border border-border rounded-xl py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60">
                {loading ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <><span>Verify & Continue</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
            <div className="mt-4 text-center">
              {resendCD > 0 ? <p className="text-xs text-muted-foreground">Resend in {resendCD}s</p>
                : <button onClick={handleResendOtp} className="text-xs text-primary hover:underline font-semibold">Resend code</button>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-2xl mb-3">
            <TrendingUp className="w-7 h-7 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Virtual Trading</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signup" ? "Create account & get ₹10L virtual money"
            : mode === "forgot" ? "Reset your password via email"
            : mode === "reset" ? "Set your new password"
            : "Sign in to start trading"}
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6">
          {mode === "signup" && (
            <div className="bg-primary/10 rounded-xl p-3 mb-5 flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <p className="text-xs font-bold text-primary">Free ₹10,00,000 Virtual Wallet</p>
                <p className="text-[11px] text-muted-foreground">Trade with real Bhav data. No real money.</p>
              </div>
            </div>
          )}
          {error && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-lg px-3 py-2 mb-4">{error}</div>}
          {success && <div className="bg-success/10 border border-success/30 text-success text-xs rounded-lg px-3 py-2 mb-4">{success}</div>}
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ravi Kumar"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
            )}
            {mode !== "forgot" && mode !== "reset" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  {mode === "signup" ? "Mobile Number" : "Mobile or Email"}
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" value={mobile} onChange={e => setMobile(e.target.value)} placeholder={mode === "signup" ? "9876543210" : "Mobile or email"}
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
            )}
            {(mode === "signup" || mode === "forgot") && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
            )}
            {mode !== "forgot" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  {mode === "reset" ? "New Password" : "Password"}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters"
                    className="w-full pl-9 pr-10 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
            {(mode === "signup" || mode === "reset") && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type={showPass ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60">
              {loading ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <><span>{mode === "signup" ? "Create Account" : mode === "forgot" ? "Send Reset Link" : mode === "reset" ? "Update Password" : "Sign In"}</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
          <div className="mt-4 pt-4 border-t border-border text-center space-y-2">
            {mode === "login" && <><button onClick={() => switchMode("signup")} className="block w-full text-xs text-primary hover:underline font-semibold">Don't have an account? Sign up</button><button onClick={() => switchMode("forgot")} className="block w-full text-xs text-muted-foreground hover:underline">Forgot password?</button></>}
            {mode === "signup" && <button onClick={() => switchMode("login")} className="text-xs text-primary hover:underline font-semibold">Already have an account? Sign in</button>}
            {(mode === "forgot" || mode === "reset") && <button onClick={() => switchMode("login")} className="text-xs text-primary hover:underline font-semibold">Back to sign in</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPIRY P&L POPUP
// ═════════════════════════════════════════════════════════════════════════════

function ExpiryPnLPopup({ positions, onClose }: { positions: any[]; onClose: () => void }) {
  const totalPnL = positions.reduce((s, p) => s + (p.realized_pnl ?? 0), 0)
  const profitable = positions.filter(p => (p.realized_pnl ?? 0) >= 0)
  const losing = positions.filter(p => (p.realized_pnl ?? 0) < 0)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className={`p-6 rounded-t-2xl ${totalPnL >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${totalPnL >= 0 ? "bg-success text-white" : "bg-destructive text-white"}`}>
                {totalPnL >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expiry Settlement</div>
                <div className="text-sm font-bold text-foreground">Today's Expired Positions</div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold font-mono mb-1" style={{ color: totalPnL >= 0 ? "var(--success)" : "var(--destructive)" }}>
              {totalPnL >= 0 ? "+" : ""}{fmt(totalPnL)}
            </div>
            <div className="text-sm text-muted-foreground">Net P&L from expiry</div>
          </div>
          {/* Win/Loss summary */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-card/50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-foreground">{positions.length}</div>
              <div className="text-[11px] text-muted-foreground">Expired</div>
            </div>
            <div className="bg-success/10 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-success">{profitable.length}</div>
              <div className="text-[11px] text-muted-foreground">Profitable</div>
            </div>
            <div className="bg-destructive/10 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-destructive">{losing.length}</div>
              <div className="text-[11px] text-muted-foreground">Loss</div>
            </div>
          </div>
        </div>
        {/* Positions list */}
        <div className="p-4 max-h-64 overflow-y-auto">
          <div className="space-y-2">
            {positions.map((p, i) => {
              const pnl = p.realized_pnl ?? 0
              const isProfit = pnl >= 0
              return (
                <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${isProfit ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"}`}>
                  <div>
                    <div className="font-bold text-sm text-foreground">{p.symbol}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {p.instrument === "OPTIONS" ? `${p.strike_price} ${p.option_type} · ${p.trade_type}` : p.instrument}
                      {p.expiry && ` · Exp: ${formatExpiry(p.expiry)}`}
                    </div>
                  </div>
                  <div className={`font-mono font-bold text-sm ${isProfit ? "text-success" : "text-destructive"}`}>
                    {isProfit ? "+" : ""}{fmt(pnl)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="p-4 pt-0">
          <button onClick={onClose} className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl text-sm hover:bg-primary/90 transition-colors">
            Got it! Continue Trading
          </button>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// OPTION CHAIN
// ═════════════════════════════════════════════════════════════════════════════

function OptionChain({ userId, balance, positions, onTrade, spot, vix, symbol, expiry, onExpiryChange, onSymbolChange }: {
  userId: string; balance: number; positions: any[]; onTrade: () => void
  spot: number; vix: number; symbol: string; expiry: string
  onExpiryChange: (e: string) => void; onSymbolChange: (s: string) => void
}) {
  const [chainData,    setChainData]    = useState<NormRow[]>([])
  const [dataSource,   setDataSource]   = useState<"bhav" | "bs" | "none">("none")
  const [loading,      setLoading]      = useState(false)
  const [bhavExpiries, setBhavExpiries] = useState<string[]>([])
  const [tradeModal,   setTradeModal]   = useState<{ strike: number; type: OptionType; premium: number } | null>(null)
  const [lots,         setLots]         = useState(1)
  const [tradeType,    setTradeType]    = useState<TradeType>("BUY")
  const [placing,      setPlacing]      = useState(false)
  const [tradeMsg,     setTradeMsg]     = useState("")
  const [debugMsg,     setDebugMsg]     = useState("")

  const interval = getStrikeInterval(symbol)
  const atm = spot > 0 ? Math.round(spot / interval) * interval : 0
  const lotSize = LOT_SIZES[symbol] ?? 75
  const dte = expiry ? daysToExpiry(expiry) : 30
  const move = spot > 0 && vix > 0 ? expectedMove(spot, vix, dte) : null

  // Merge bhav expiries with calculated ones; bhav expiries take priority
  const calculatedExpiries = getWeeklyExpiries(symbol)
  const allExpiries = bhavExpiries.length > 0
    ? [...new Set([...bhavExpiries, ...calculatedExpiries])].sort()
    : calculatedExpiries

  // Load bhav expiries once per symbol change
  useEffect(() => {
    fetchBhavExpiries(symbol).then(exps => {
      if (exps.length > 0) {
        setBhavExpiries(exps)
        const today = new Date().toISOString().slice(0,10)
        if (!exps.includes(expiry)) {
          const future = exps.filter(e => e >= today)
          if (future.length > 0) onExpiryChange(future[0])
        }
      }
    })
  }, [symbol])

  useEffect(() => {
    if (!expiry) return
    loadChain()
  }, [symbol, expiry, spot, vix])

  async function loadChain() {
    setLoading(true)
    setDebugMsg("")

    // ── 1. Try Supabase bhav data ─────────────────────────────────────────────
    const bhavData = await fetchBhavOptionChain(symbol, expiry, spot > 0 ? spot : 24500)

    if (bhavData.length > 0) {
      // Enrich missing IV / LTP with BS estimates so the chain is never empty
      const enriched = bhavData.map(row => {
        const s = spot > 0 ? spot : row.strike_price
        return {
          ...row,
          ce_ltp: row.ce_ltp ?? (s > 0 ? calcOptionPremium(s, row.strike_price, expiry, "CE", vix/100) : null),
          pe_ltp: row.pe_ltp ?? (s > 0 ? calcOptionPremium(s, row.strike_price, expiry, "PE", vix/100) : null),
          ce_iv: row.ce_iv ?? vix,
          pe_iv: row.pe_iv ?? vix,
        }
      })
      setChainData(enriched)
      setDataSource("bhav")
      const hasOI = enriched.some(r => r.ce_oi != null || r.pe_oi != null)
      setDebugMsg(`📊 Live Bhav data — ${enriched.length} strikes${hasOI ? " · OI + Volume available" : " · no OI column in table"}`)
    } else {
      // ── 2. Fall back to Black-Scholes when no bhav data ───────────────────
      if (spot <= 0) { setLoading(false); setDataSource("none"); setDebugMsg("⚠ Enter or fetch spot price first"); return }
      const strikes = Array.from({ length: 21 }, (_, i) => atm - 10 * interval + i * interval).filter(s => s > 0)
      const synthetic: NormRow[] = strikes.map(strike => ({
        strike_price: strike,
        expiry_date:  expiry,
        ce_ltp:    calcOptionPremium(spot, strike, expiry, "CE", vix / 100),
        pe_ltp:    calcOptionPremium(spot, strike, expiry, "PE", vix / 100),
        ce_iv:     vix, pe_iv: vix,
        ce_oi:     null, pe_oi:     null,
        ce_volume: null, pe_volume: null,
      }))
      setChainData(synthetic)
      setDataSource("bs")
      setDebugMsg("~Black-Scholes estimates (no bhav match for this expiry — check expiry date format in DB)")
    }
    setLoading(false)
  }

  function getPositionForStrike(strike: number, optType: OptionType) {
    return positions.find(p =>
      p.instrument === "OPTIONS" &&
      p.symbol === symbol &&
      p.strike_price === strike &&
      p.option_type === optType &&
      p.status === "OPEN"
    )
  }

  async function placeOptionTrade() {
    if (!tradeModal) return
    setPlacing(true); setTradeMsg("")
    const { strike, type: optType, premium } = tradeModal
    const actualQty = lots * lotSize
    const charges = calcCharges(premium, actualQty, "OPTIONS", tradeType)
    let walletDebit = 0, marginBlocked = 0

    if (tradeType === "BUY") {
      walletDebit = premium * actualQty + charges
    } else {
      marginBlocked = calcOptionsMargin(spot, lotSize, lots)
      walletDebit = marginBlocked
    }

    const { data: walletData } = await supabase.from("wallets").select("balance").eq("user_id", userId).single()
    if (!walletData || walletData.balance < walletDebit) {
      setTradeMsg(`Insufficient balance. Need ${fmt(walletDebit)}`); setPlacing(false); return
    }

    // Check existing position
    const { data: existing } = await supabase.from("positions")
      .select("id, quantity, avg_price, margin_blocked")
      .eq("user_id", userId).eq("symbol", symbol).eq("instrument", "OPTIONS")
      .eq("trade_type", tradeType).eq("status", "OPEN").eq("expiry", expiry)
      .eq("strike_price", strike).eq("option_type", optType).maybeSingle()

    if (existing) {
      const newQty = existing.quantity + actualQty
      const newAvg = Math.round(((existing.quantity * (existing.avg_price || premium)) + (actualQty * premium)) / newQty * 100) / 100
      await supabase.from("positions").update({ quantity: newQty, avg_price: newAvg, margin_blocked: (existing.margin_blocked || 0) + marginBlocked }).eq("id", existing.id)
    } else {
      await supabase.from("positions").insert({
        user_id: userId, symbol, instrument: "OPTIONS", trade_type: tradeType,
        quantity: actualQty, entry_price: premium, avg_price: premium, current_price: premium,
        expiry, strike_price: strike, option_type: optType,
        margin_blocked: marginBlocked, status: "OPEN", opened_at: new Date().toISOString(),
      })
    }

    await supabase.from("wallets").update({ balance: walletData.balance - walletDebit }).eq("user_id", userId)
    await supabase.from("trade_history").insert({
      user_id: userId, symbol, instrument: "OPTIONS", trade_type: tradeType,
      quantity: actualQty, price: premium, total_value: premium * actualQty,
      charges, net_value: walletDebit, margin_blocked: marginBlocked,
      expiry, strike_price: strike, option_type: optType,
      executed_at: new Date().toISOString(), created_at: new Date().toISOString(),
    })

    setTradeMsg(`✅ ${tradeType} ${lots} lot${lots > 1 ? "s" : ""} ${symbol} ${strike}${optType} @ ₹${fmtN(premium)}`)
    setPlacing(false)
    onTrade()
    setTimeout(() => { setTradeModal(null); setTradeMsg("") }, 1500)
  }

  const sortedStrikes = [...new Set(chainData.map(r => r.strike_price))].sort((a, b) => a - b)

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Symbol</label>
            <select value={symbol} onChange={e => onSymbolChange(e.target.value)}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary">
              {["NIFTY","BANKNIFTY","FINNIFTY"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Expiry</label>
            <select value={expiry} onChange={e => onExpiryChange(e.target.value)}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary">
              {allExpiries.map(e => <option key={e} value={e}>{formatExpiry(e)}{bhavExpiries.includes(e) ? " ✦" : ""} · {Math.round(daysToExpiry(e))}d</option>)}
            </select>
          </div>
          <button onClick={loadChain} disabled={loading}
            className="self-end flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          {spot > 0 && (
            <div className="self-end ml-auto text-right">
              <div className="text-xs text-muted-foreground">Spot</div>
              <div className="font-mono font-bold text-lg text-foreground">₹{fmtN(spot)}</div>
            </div>
          )}
        </div>

        {/* Expected move banner */}
        {move && (
          <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-primary">Market Expected Move (1σ) based on VIX {vix.toFixed(1)}</span>
              <span className="text-[10px] text-muted-foreground">for {Math.round(dte)} days to expiry</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success inline-block" />
                <span className="text-muted-foreground">Upside:</span>
                <span className="font-mono font-bold text-success">₹{fmtN(move.up)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-destructive inline-block" />
                <span className="text-muted-foreground">Downside:</span>
                <span className="font-mono font-bold text-destructive">₹{fmtN(move.down)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Range:</span>
                <span className="font-mono font-bold">±{move.pct.toFixed(1)}%</span>
              </div>
            </div>
            <div className="mt-1.5 text-[10px] text-muted-foreground">
              Formula: Spot × (VIX÷100) × √(DTE÷365) — 68% probability the market stays within this range
            </div>
          </div>
        )}
      </div>

      {/* Option Chain Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">Option Chain — {symbol} {expiry ? formatExpiry(expiry) : ""}</span>
          <span className="text-[10px] text-muted-foreground">{loading ? "Loading…" : `${sortedStrikes.length} strikes · ATM: ${atm}`}</span>
          <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${
            dataSource === "bhav" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
            dataSource === "bs"   ? "bg-warning/10 text-warning" :
                                    "bg-muted text-muted-foreground"
          }`}>
            {dataSource === "bhav" ? "📊 Bhav Data" : dataSource === "bs" ? "~BS Theoretical" : "No Data"}
          </span>
          {debugMsg && <span className="text-[10px] text-muted-foreground truncate max-w-xs">{debugMsg}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30">
                <th colSpan={4} className="px-3 py-2 text-center text-[10px] font-bold text-success uppercase tracking-wide border-r border-border">CALLS (CE)</th>
                <th className="px-3 py-2 text-center text-[10px] font-bold text-foreground uppercase tracking-wide bg-primary/5">STRIKE</th>
                <th colSpan={4} className="px-3 py-2 text-center text-[10px] font-bold text-destructive uppercase tracking-wide border-l border-border">PUTS (PE)</th>
              </tr>
              <tr className="bg-muted/10">
                {["OI","Vol","IV","LTP"].map(h => <th key={`ce-${h}`} className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground">{h}</th>)}
                <th className="px-3 py-2 text-center text-[10px] font-bold text-foreground bg-primary/5">STRIKE</th>
                {["LTP","IV","Vol","OI"].map(h => <th key={`pe-${h}`} className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    Loading option chain…
                  </div>
                </td></tr>
              ) : sortedStrikes.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No data. Select a symbol and expiry, then click Refresh.
                </td></tr>
              ) : sortedStrikes.map(strike => {
                const row = chainData.find(r => r.strike_price === strike)
                if (!row) return null

                const ceLtp = row.ce_ltp ?? row.call_close ?? (spot > 0 ? calcOptionPremium(spot, strike, expiry, "CE", vix / 100) : 0)
                const peLtp = row.pe_ltp ?? row.put_close  ?? (spot > 0 ? calcOptionPremium(spot, strike, expiry, "PE", vix / 100) : 0)
                const ceIV  = row.ce_iv ?? vix
                const peIV  = row.pe_iv ?? vix
                const ceOI  = row.ce_oi ?? row.call_oi ?? null
                const peOI  = row.pe_oi ?? row.put_oi  ?? null
                const ceVol = row.ce_volume ?? row.call_volume ?? null
                const peVol = row.pe_volume ?? row.put_volume  ?? null

                const isATM = Math.abs(strike - atm) < interval / 2
                const isITM_CE = strike < atm
                const isITM_PE = strike > atm

                const cePos = getPositionForStrike(strike, "CE")
                const pePos = getPositionForStrike(strike, "PE")

                return (
                  <tr key={strike}
                    className={`border-t border-border/50 transition-colors ${isATM ? "bg-primary/5 font-semibold" : ""}`}>
                    {/* CE side */}
                    <td className={`px-3 py-2.5 text-right font-mono ${isITM_CE ? "bg-success/5" : ""}`}>
                      {ceOI != null ? fmtN(ceOI / 1000) + "K" : "—"}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono text-muted-foreground ${isITM_CE ? "bg-success/5" : ""}`}>
                      {ceVol != null ? fmtN(ceVol / 1000) + "K" : "—"}
                    </td>
                    <td className={`px-3 py-2.5 text-right text-muted-foreground ${isITM_CE ? "bg-success/5" : ""}`}>
                      {ceIV != null ? ceIV.toFixed(1) + "%" : "—"}
                    </td>
                    <td className={`px-3 py-2.5 text-right ${isITM_CE ? "bg-success/5" : ""}`}>
                      <button
                        onClick={() => { setTradeModal({ strike, type: "CE", premium: ceLtp }); setTradeType("BUY") }}
                        className={`font-mono font-bold transition-all px-2 py-1 rounded-lg cursor-pointer ${
                          cePos ? "bg-success/20 text-success ring-2 ring-success/50 animate-pulse" : "text-success hover:bg-success/10"
                        }`}>
                        ₹{fmtN(ceLtp)}
                        {cePos && <span className="ml-1 text-[9px]">●{cePos.trade_type}</span>}
                      </button>
                    </td>
                    {/* Strike */}
                    <td className={`px-3 py-2.5 text-center font-mono font-bold text-sm bg-primary/5 border-x border-border/30 ${isATM ? "text-primary" : "text-foreground"}`}>
                      {fmtN(strike)}
                      {isATM && <div className="text-[9px] text-primary font-bold">ATM</div>}
                    </td>
                    {/* PE side */}
                    <td className={`px-3 py-2.5 text-left ${isITM_PE ? "bg-destructive/5" : ""}`}>
                      <button
                        onClick={() => { setTradeModal({ strike, type: "PE", premium: peLtp }); setTradeType("BUY") }}
                        className={`font-mono font-bold transition-all px-2 py-1 rounded-lg cursor-pointer ${
                          pePos ? "bg-destructive/20 text-destructive ring-2 ring-destructive/50 animate-pulse" : "text-destructive hover:bg-destructive/10"
                        }`}>
                        ₹{fmtN(peLtp)}
                        {pePos && <span className="ml-1 text-[9px]">●{pePos.trade_type}</span>}
                      </button>
                    </td>
                    <td className={`px-3 py-2.5 text-muted-foreground ${isITM_PE ? "bg-destructive/5" : ""}`}>
                      {peIV != null ? peIV.toFixed(1) + "%" : "—"}
                    </td>
                    <td className={`px-3 py-2.5 font-mono text-muted-foreground ${isITM_PE ? "bg-destructive/5" : ""}`}>
                      {peVol != null ? fmtN(peVol / 1000) + "K" : "—"}
                    </td>
                    <td className={`px-3 py-2.5 font-mono ${isITM_PE ? "bg-destructive/5" : ""}`}>
                      {peOI != null ? fmtN(peOI / 1000) + "K" : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-border bg-muted/20 text-[10px] text-muted-foreground flex gap-4">
          <span>🟢 Highlighted = open position</span>
          <span>CE ITM = shaded green | PE ITM = shaded red</span>
          <span>Click any LTP to trade</span>
        </div>
      </div>

      {/* Trade Modal */}
      {tradeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Place Order</div>
                  <div className="font-bold text-lg text-foreground">{symbol} {tradeModal.strike} {tradeModal.type}</div>
                  <div className="text-xs text-muted-foreground">{expiry ? formatExpiry(expiry) : ""} · {Math.round(dte)} days</div>
                </div>
                <button onClick={() => { setTradeModal(null); setTradeMsg("") }} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* B/S toggle */}
              <div className="flex gap-2 mb-4">
                {(["BUY","SELL"] as TradeType[]).map(t => (
                  <button key={t} onClick={() => setTradeType(t)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      tradeType === t ? (t === "BUY" ? "bg-success text-white" : "bg-destructive text-white") : "bg-muted text-muted-foreground"
                    }`}>{t}</button>
                ))}
              </div>

              {/* Lots */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Lots (1 lot = {lotSize} shares)</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setLots(l => Math.max(1, l - 1))} className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center font-bold"><Minus className="w-4 h-4" /></button>
                  <input type="number" value={lots} min={1} onChange={e => setLots(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 text-center font-mono font-bold text-lg bg-muted border border-border rounded-lg py-2 focus:outline-none focus:border-primary" />
                  <button onClick={() => setLots(l => l + 1)} className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center font-bold"><Plus className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Order summary */}
              <div className="bg-muted rounded-xl p-3 space-y-1.5 text-xs mb-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Premium</span>
                  <span className="font-mono font-bold">₹{fmtN(tradeModal.premium)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Qty</span>
                  <span className="font-mono">{lots} lots × {lotSize} = {lots * lotSize} shares</span>
                </div>
                {tradeType === "BUY" ? (
                  <div className="flex justify-between border-t border-border pt-1.5">
                    <span className="font-semibold">Total debit</span>
                    <span className="font-mono font-bold text-destructive">{fmt(tradeModal.premium * lots * lotSize)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between border-t border-border pt-1.5">
                    <span className="font-semibold">Margin blocked (~20%)</span>
                    <span className="font-mono font-bold text-warning">{fmt(calcOptionsMargin(spot, lotSize, lots))}</span>
                  </div>
                )}
              </div>

              {tradeMsg && (
                <div className={`text-xs rounded-lg px-3 py-2 mb-3 ${tradeMsg.startsWith("✅") ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {tradeMsg}
                </div>
              )}

              <button onClick={placeOptionTrade} disabled={placing}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                  tradeType === "BUY" ? "bg-success text-white hover:bg-success/90" : "bg-destructive text-white hover:bg-destructive/90"
                } disabled:opacity-60`}>
                {placing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : `${tradeType} ${lots} Lot${lots > 1 ? "s" : ""} ${tradeModal.type}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// STRATEGY BUILDER
// ═════════════════════════════════════════════════════════════════════════════

type StrategyLeg = {
  id: string; type: OptionType | "FUTURES"; action: TradeType; strike: number
  lots: number; premium: number; expiry: string; delta?: number; theta?: number
}

const PRESET_STRATEGIES = [
  { name: "Bull Call Spread", description: "Buy lower CE, Sell higher CE. Limited risk, limited profit.", icon: "📈",
    legs: (spot: number, iv: number, exp: string, sym: string) => {
      const interval = getStrikeInterval(sym)
      const atm = Math.round(spot / interval) * interval
      return [
        { type: "CE" as OptionType, action: "BUY" as TradeType, strike: atm, lots: 1, premium: calcOptionPremium(spot, atm, exp, "CE", iv/100), expiry: exp },
        { type: "CE" as OptionType, action: "SELL" as TradeType, strike: atm + interval, lots: 1, premium: calcOptionPremium(spot, atm + interval, exp, "CE", iv/100), expiry: exp },
      ]
    }
  },
  { name: "Bear Put Spread", description: "Buy higher PE, Sell lower PE. Limited risk, limited profit.", icon: "📉",
    legs: (spot: number, iv: number, exp: string, sym: string) => {
      const interval = getStrikeInterval(sym)
      const atm = Math.round(spot / interval) * interval
      return [
        { type: "PE" as OptionType, action: "BUY" as TradeType, strike: atm, lots: 1, premium: calcOptionPremium(spot, atm, exp, "PE", iv/100), expiry: exp },
        { type: "PE" as OptionType, action: "SELL" as TradeType, strike: atm - interval, lots: 1, premium: calcOptionPremium(spot, atm - interval, exp, "PE", iv/100), expiry: exp },
      ]
    }
  },
  { name: "Iron Condor", description: "Sell strangle + Buy wings. Profits in range-bound market.", icon: "🦅",
    legs: (spot: number, iv: number, exp: string, sym: string) => {
      const interval = getStrikeInterval(sym)
      const atm = Math.round(spot / interval) * interval
      return [
        { type: "PE" as OptionType, action: "BUY" as TradeType, strike: atm - 3*interval, lots: 1, premium: calcOptionPremium(spot, atm - 3*interval, exp, "PE", iv/100), expiry: exp },
        { type: "PE" as OptionType, action: "SELL" as TradeType, strike: atm - interval, lots: 1, premium: calcOptionPremium(spot, atm - interval, exp, "PE", iv/100), expiry: exp },
        { type: "CE" as OptionType, action: "SELL" as TradeType, strike: atm + interval, lots: 1, premium: calcOptionPremium(spot, atm + interval, exp, "CE", iv/100), expiry: exp },
        { type: "CE" as OptionType, action: "BUY" as TradeType, strike: atm + 3*interval, lots: 1, premium: calcOptionPremium(spot, atm + 3*interval, exp, "CE", iv/100), expiry: exp },
      ]
    }
  },
  { name: "Short Straddle", description: "Sell ATM CE + PE. Profits from low volatility / time decay.", icon: "⚡",
    legs: (spot: number, iv: number, exp: string, sym: string) => {
      const interval = getStrikeInterval(sym)
      const atm = Math.round(spot / interval) * interval
      return [
        { type: "CE" as OptionType, action: "SELL" as TradeType, strike: atm, lots: 1, premium: calcOptionPremium(spot, atm, exp, "CE", iv/100), expiry: exp },
        { type: "PE" as OptionType, action: "SELL" as TradeType, strike: atm, lots: 1, premium: calcOptionPremium(spot, atm, exp, "PE", iv/100), expiry: exp },
      ]
    }
  },
  { name: "Long Straddle", description: "Buy ATM CE + PE. Profits from big moves in either direction.", icon: "🎯",
    legs: (spot: number, iv: number, exp: string, sym: string) => {
      const interval = getStrikeInterval(sym)
      const atm = Math.round(spot / interval) * interval
      return [
        { type: "CE" as OptionType, action: "BUY" as TradeType, strike: atm, lots: 1, premium: calcOptionPremium(spot, atm, exp, "CE", iv/100), expiry: exp },
        { type: "PE" as OptionType, action: "BUY" as TradeType, strike: atm, lots: 1, premium: calcOptionPremium(spot, atm, exp, "PE", iv/100), expiry: exp },
      ]
    }
  },
  { name: "Covered Call", description: "Hold underlying + Sell CE. Income from sideways market.", icon: "💰",
    legs: (spot: number, iv: number, exp: string, sym: string) => {
      const interval = getStrikeInterval(sym)
      const atm = Math.round(spot / interval) * interval
      return [
        { type: "CE" as OptionType, action: "SELL" as TradeType, strike: atm + interval, lots: 1, premium: calcOptionPremium(spot, atm + interval, exp, "CE", iv/100), expiry: exp },
      ]
    }
  },
]

function StrategyBuilder({ userId, balance, spot, vix, symbol, onTrade }: {
  userId: string; balance: number; spot: number; vix: number; symbol: string; onTrade: () => void
}) {
  const [legs, setLegs] = useState<StrategyLeg[]>([])
  const [expiry, setExpiry] = useState(getWeeklyExpiries(symbol)[0] ?? "")
  const [placing, setPlacing] = useState(false)
  const [msg, setMsg] = useState("")
  const expiryOptions = getWeeklyExpiries(symbol)
  const interval = getStrikeInterval(symbol)
  const atm = spot > 0 ? Math.round(spot / interval) * interval : 0
  const lotSize = LOT_SIZES[symbol] ?? 75
  const dte = expiry ? daysToExpiry(expiry) : 30
  const move = spot > 0 && vix > 0 ? expectedMove(spot, vix, dte) : null

  function addLeg() {
    setLegs(prev => [...prev, {
      id: Math.random().toString(36).slice(2), type: "CE", action: "BUY",
      strike: atm, lots: 1, premium: spot > 0 ? calcOptionPremium(spot, atm, expiry, "CE", vix/100) : 0,
      expiry,
    }])
  }

  function loadPreset(preset: typeof PRESET_STRATEGIES[0]) {
    if (spot <= 0) { setMsg("Fetch spot price first"); return }
    const newLegs = preset.legs(spot, vix, expiry, symbol).map((l, i) => ({
      ...l, id: Math.random().toString(36).slice(2),
      delta: calcGreeks(spot, l.strike, dte/365, 0.065, vix/100, l.type as OptionType).delta,
      theta: calcGreeks(spot, l.strike, dte/365, 0.065, vix/100, l.type as OptionType).theta,
    }))
    setLegs(newLegs)
    setMsg(`Loaded ${preset.name}`)
    setTimeout(() => setMsg(""), 2000)
  }

  function updateLeg(id: string, field: string, value: any) {
    setLegs(prev => prev.map(l => {
      if (l.id !== id) return l
      const updated = { ...l, [field]: value }
      if ((field === "strike" || field === "type") && spot > 0) {
        updated.premium = calcOptionPremium(spot, updated.strike, expiry, updated.type as OptionType, vix/100)
      }
      return updated
    }))
  }

  // Net premium / max profit / max loss summary
  const netPremium = legs.reduce((s, l) => {
    const sign = l.action === "BUY" ? -1 : 1
    return s + sign * l.premium * l.lots * lotSize
  }, 0)

  async function placeAllLegs() {
    if (legs.length === 0) { setMsg("Add at least one leg"); return }
    setPlacing(true); setMsg("")

    const { data: walletData } = await supabase.from("wallets").select("balance").eq("user_id", userId).single()
    if (!walletData) { setMsg("Could not read wallet"); setPlacing(false); return }

    let totalDebit = 0
    for (const leg of legs) {
      const actualQty = leg.lots * lotSize
      const charges = calcCharges(leg.premium, actualQty, "OPTIONS", leg.action)
      if (leg.action === "BUY") totalDebit += leg.premium * actualQty + charges
      else totalDebit += calcOptionsMargin(spot, lotSize, leg.lots)
    }

    if (totalDebit > walletData.balance) { setMsg(`Insufficient balance. Need ${fmt(totalDebit)}, have ${fmt(walletData.balance)}`); setPlacing(false); return }

    let bal = walletData.balance
    for (const leg of legs) {
      const actualQty = leg.lots * lotSize
      const charges = calcCharges(leg.premium, actualQty, "OPTIONS", leg.action)
      const marginBlocked = leg.action === "SELL" ? calcOptionsMargin(spot, lotSize, leg.lots) : 0
      const walletDebit = leg.action === "BUY" ? leg.premium * actualQty + charges : marginBlocked

      await supabase.from("positions").insert({
        user_id: userId, symbol, instrument: "OPTIONS", trade_type: leg.action,
        quantity: actualQty, entry_price: leg.premium, avg_price: leg.premium, current_price: leg.premium,
        expiry: leg.expiry, strike_price: leg.strike, option_type: leg.type,
        margin_blocked: marginBlocked, status: "OPEN", opened_at: new Date().toISOString(),
      })

      await supabase.from("trade_history").insert({
        user_id: userId, symbol, instrument: "OPTIONS", trade_type: leg.action,
        quantity: actualQty, price: leg.premium, total_value: leg.premium * actualQty,
        charges, net_value: walletDebit, margin_blocked: marginBlocked,
        expiry: leg.expiry, strike_price: leg.strike, option_type: leg.type,
        executed_at: new Date().toISOString(), created_at: new Date().toISOString(),
      })

      bal -= walletDebit
    }

    await supabase.from("wallets").update({ balance: bal }).eq("user_id", userId)
    setMsg(`✅ ${legs.length} leg${legs.length > 1 ? "s" : ""} placed successfully!`)
    onTrade()
    setTimeout(() => { setLegs([]); setMsg("") }, 2000)
    setPlacing(false)
  }

  return (
    <div className="space-y-4">
      {/* Preset strategies */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Strategy Templates</span>
          <span className="text-[11px] text-muted-foreground ml-1">Click to load a preset</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {PRESET_STRATEGIES.map(p => (
            <button key={p.name} onClick={() => loadPreset(p)}
              className="text-left p-3 bg-muted hover:bg-muted/80 border border-border hover:border-primary/50 rounded-xl transition-all group">
              <div className="text-lg mb-1">{p.icon}</div>
              <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{p.name}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-center mb-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Expiry</label>
            <select value={expiry} onChange={e => setExpiry(e.target.value)}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary">
              {expiryOptions.map(e => <option key={e} value={e}>{formatExpiry(e)} · {Math.round(daysToExpiry(e))}d</option>)}
            </select>
          </div>
          {spot > 0 && <div className="self-end"><div className="text-xs text-muted-foreground">Spot</div><div className="font-mono font-bold text-lg">₹{fmtN(spot)}</div></div>}
          {move && <div className="self-end"><div className="text-[11px] text-muted-foreground">Expected range ±{move.pct.toFixed(1)}%</div><div className="text-xs font-mono">{fmtN(move.down)} – {fmtN(move.up)}</div></div>}
          <button onClick={addLeg} className="self-end flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors ml-auto">
            <Plus className="w-3.5 h-3.5" /> Add Leg
          </button>
        </div>

        {/* Net premium summary */}
        {legs.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-muted rounded-xl">
            <div className="text-center">
              <div className="text-[11px] text-muted-foreground">Net Premium</div>
              <div className={`font-mono font-bold text-sm ${netPremium >= 0 ? "text-success" : "text-destructive"}`}>
                {netPremium >= 0 ? "+" : ""}{fmt(Math.abs(netPremium))}
              </div>
              <div className="text-[10px] text-muted-foreground">{netPremium >= 0 ? "credit received" : "debit paid"}</div>
            </div>
            <div className="text-center">
              <div className="text-[11px] text-muted-foreground">Legs</div>
              <div className="font-bold text-sm text-foreground">{legs.length}</div>
            </div>
            <div className="text-center">
              <div className="text-[11px] text-muted-foreground">Net Delta</div>
              <div className="font-mono text-sm text-foreground">
                {legs.reduce((s, l) => {
                  if (l.type === "FUTURES") return s
                  const g = calcGreeks(spot, l.strike, dte/365, 0.065, vix/100, l.type as OptionType)
                  return s + (l.action === "BUY" ? 1 : -1) * g.delta * l.lots * lotSize
                }, 0).toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Legs */}
        {legs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Pick a template above or click "Add Leg" to build your strategy
          </div>
        ) : (
          <div className="space-y-3">
            {legs.map((leg, i) => {
              const greeks = leg.type !== "FUTURES" ? calcGreeks(spot, leg.strike, dte/365, 0.065, vix/100, leg.type as OptionType) : null
              return (
                <div key={leg.id} className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-2 items-center bg-muted/50 rounded-xl p-3">
                  <span className="text-[11px] font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
                  {/* B/S */}
                  <div className="flex gap-1">
                    {(["BUY","SELL"] as TradeType[]).map(t => (
                      <button key={t} onClick={() => updateLeg(leg.id, "action", t)}
                        className={`flex-1 text-[11px] font-bold py-1 px-2 rounded-lg transition-colors ${
                          leg.action === t ? (t === "BUY" ? "bg-success text-white" : "bg-destructive text-white") : "bg-background text-muted-foreground"
                        }`}>{t}</button>
                    ))}
                  </div>
                  {/* CE/PE */}
                  <div className="flex gap-1">
                    {(["CE","PE"] as OptionType[]).map(t => (
                      <button key={t} onClick={() => updateLeg(leg.id, "type", t)}
                        className={`flex-1 text-[11px] font-bold py-1 px-2 rounded-lg transition-colors ${
                          leg.type === t ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                        }`}>{t}</button>
                    ))}
                  </div>
                  {/* Strike */}
                  <div>
                    <select value={leg.strike} onChange={e => updateLeg(leg.id, "strike", Number(e.target.value))}
                      className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary">
                      {Array.from({ length: 21 }, (_, i) => atm - 10 * interval + i * interval)
                        .filter(s => s > 0)
                        .map(s => <option key={s} value={s}>{s}{s === atm ? " (ATM)" : ""}</option>)}
                    </select>
                    {greeks && <div className="text-[9px] text-muted-foreground mt-0.5">Δ{greeks.delta.toFixed(2)} Θ{greeks.theta.toFixed(2)}/d</div>}
                  </div>
                  {/* Lots + Premium */}
                  <div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateLeg(leg.id, "lots", Math.max(1, leg.lots - 1))} className="w-5 h-5 rounded bg-background text-muted-foreground flex items-center justify-center text-xs"><Minus className="w-3 h-3" /></button>
                      <span className="text-xs font-mono w-4 text-center">{leg.lots}</span>
                      <button onClick={() => updateLeg(leg.id, "lots", leg.lots + 1)} className="w-5 h-5 rounded bg-background text-muted-foreground flex items-center justify-center text-xs"><Plus className="w-3 h-3" /></button>
                    </div>
                    <div className="text-[9px] font-mono text-muted-foreground mt-0.5">₹{fmtN(leg.premium)}/sh</div>
                  </div>
                  <button onClick={() => setLegs(prev => prev.filter(l => l.id !== leg.id))} className="w-7 h-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20"><X className="w-3.5 h-3.5" /></button>
                </div>
              )
            })}
          </div>
        )}

        {msg && <div className={`mt-3 text-xs rounded-lg px-3 py-2 ${msg.startsWith("✅") ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{msg}</div>}

        {legs.length > 0 && (
          <button onClick={placeAllLegs} disabled={placing}
            className="mt-4 w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {placing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Zap className="w-4 h-4" />Place All {legs.length} Leg{legs.length > 1 ? "s" : ""}</>}
          </button>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// REPLAY / AUTOPLAY
// ═════════════════════════════════════════════════════════════════════════════

function ReplayPanel({ symbol, vix }: { symbol: string; vix: number }) {
  const [fromDate, setFromDate] = useState("2024-08-01")
  const [currentDate, setCurrentDate] = useState("2024-08-01")
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1000) // ms per day
  const [allDates, setAllDates] = useState<string[]>([])
  const [normRows, setNormRows] = useState<NormRow[]>([])  // normalised rows for current date
  const [loading, setLoading] = useState(false)
  const [loadMsg, setLoadMsg] = useState("")
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const replaySym = ["NIFTY","BANKNIFTY"].includes(symbol) ? symbol : "NIFTY"
  const tableName = replaySym === "BANKNIFTY" ? "banknifty_options" : "nifty_options"

  async function loadBhav() {
    setLoading(true)
    setLoadMsg("")

    // Step 1: get all available dates from the table (schema-aware)
    const dates = await fetchBhavDates(replaySym)
    const filteredDates = dates.filter(d => d >= fromDate)

    if (filteredDates.length === 0) {
      setLoadMsg("⚠ No data found from this date. Check table name and date column.")
      setLoading(false); return
    }

    setAllDates(filteredDates)
    const firstDate = filteredDates[0]
    setCurrentDate(firstDate)
    await loadDateRows(firstDate)
    setLoadMsg(`✅ Loaded ${filteredDates.length} trading days`)
    setLoading(false)
  }

  async function loadDateRows(date: string) {
    // Probe schema to find actual date column name
    const { data: probe } = await supabase.from(tableName).select("*").limit(1)
    if (!probe || !probe.length) return
    const keys = Object.keys(probe[0])
    const dateCol   = keys.find(k => /^date$|^trade_date$|^timestamp$/i.test(k)) ?? "date"
    const strikeCol = keys.find(k => /strike/i.test(k) && !/no|num/i.test(k)) ?? "strike_price"

    const { data } = await supabase
      .from(tableName)
      .select("*")
      .eq(dateCol, date)
      .order(strikeCol, { ascending: true })
      .limit(500)

    if (!data || data.length === 0) { setNormRows([]); return }

    if (isNarrowFormat(data)) {
      setNormRows(normaliseNarrowRows(data))
    } else {
      setNormRows(data.map(normaliseWideRow).sort((a, b) => a.strike_price - b.strike_price))
    }
  }

  function stepTo(date: string) {
    setCurrentDate(date)
    loadDateRows(date)
  }

  function togglePlay() {
    if (isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setIsPlaying(false)
    } else {
      setIsPlaying(true)
      let idx = allDates.indexOf(currentDate)
      intervalRef.current = setInterval(() => {
        idx++
        if (idx >= allDates.length) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          setIsPlaying(false)
          return
        }
        stepTo(allDates[idx])
      }, speed)
    }
  }

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const currentIdx = allDates.indexOf(currentDate)

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Historical Replay</span>
          <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">{replaySym}</span>
        </div>
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Start Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} min="2024-08-01" max="2026-05-29"
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Speed</label>
            <select value={speed} onChange={e => setSpeed(Number(e.target.value))}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary">
              <option value={2000}>0.5x (slow)</option>
              <option value={1000}>1x (normal)</option>
              <option value={500}>2x (fast)</option>
              <option value={200}>5x (very fast)</option>
            </select>
          </div>
          <button onClick={loadBhav} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90">
            {loading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Search className="w-3.5 h-3.5" />Load Data</>}
          </button>
          {loadMsg && !loading && <p className={`text-xs self-end ${loadMsg.startsWith("✅") ? "text-success" : "text-warning"}`}>{loadMsg}</p>}
        </div>

        {allDates.length > 0 && (
          <>
            {/* Date progress */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{allDates[0]}</span>
                <span className="font-bold text-foreground">📅 {currentDate}</span>
                <span>{allDates[allDates.length - 1]}</span>
              </div>
              <input type="range" min={0} max={allDates.length - 1} value={currentIdx >= 0 ? currentIdx : 0}
                onChange={e => stepTo(allDates[parseInt(e.target.value)])}
                className="w-full accent-primary" />
              <div className="text-center text-[11px] text-muted-foreground mt-1">
                Day {currentIdx + 1} of {allDates.length}
              </div>
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => { if (currentIdx > 0) stepTo(allDates[currentIdx - 1]) }}
                className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 disabled:opacity-40" disabled={currentIdx <= 0}>
                <SkipBack className="w-4 h-4" />
              </button>
              <button onClick={togglePlay}
                className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button onClick={() => { if (currentIdx < allDates.length - 1) stepTo(allDates[currentIdx + 1]) }}
                className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 disabled:opacity-40" disabled={currentIdx >= allDates.length - 1}>
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Normalised bhav data for current replay date */}
      {normRows.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">{replaySym} Option Chain — {currentDate}</span>
            <span className="text-[10px] text-muted-foreground ml-2">{normRows.length} strikes</span>
            {normRows.some(r => r.ce_oi != null) && <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full font-semibold ml-auto">OI ✓</span>}
          </div>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30 sticky top-0">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground">Expiry</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground">Strike</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold text-success">CE LTP</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground">CE OI</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground">CE Vol</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold text-destructive">PE LTP</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground">PE OI</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground">PE Vol</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground">CE IV</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground">PE IV</th>
                </tr>
              </thead>
              <tbody>
                {normRows.map((r, i) => (
                  <tr key={i} className="border-t border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-muted-foreground text-[10px]">{r.expiry_date || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{fmtN(r.strike_price)}</td>
                    <td className="px-3 py-2 text-right font-mono text-success font-semibold">{r.ce_ltp != null ? fmtN(r.ce_ltp) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{r.ce_oi != null ? (r.ce_oi >= 1000 ? (r.ce_oi/1000).toFixed(0)+"K" : r.ce_oi) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{r.ce_volume != null ? (r.ce_volume >= 1000 ? (r.ce_volume/1000).toFixed(0)+"K" : r.ce_volume) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-destructive font-semibold">{r.pe_ltp != null ? fmtN(r.pe_ltp) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{r.pe_oi != null ? (r.pe_oi >= 1000 ? (r.pe_oi/1000).toFixed(0)+"K" : r.pe_oi) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{r.pe_volume != null ? (r.pe_volume >= 1000 ? (r.pe_volume/1000).toFixed(0)+"K" : r.pe_volume) : "—"}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{r.ce_iv != null ? r.ce_iv.toFixed(1)+"%" : "—"}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{r.pe_iv != null ? r.pe_iv.toFixed(1)+"%" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allDates.length === 0 && !loading && (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">Load historical bhav data to replay</p>
          <p className="text-xs text-muted-foreground mt-1">Data available from Aug 2024 – May 2026</p>
          {loadMsg && <p className="text-xs text-warning mt-2">{loadMsg}</p>}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// FUTURE PLAYS (Black-Scholes + VIX forecasting)
// ═════════════════════════════════════════════════════════════════════════════

function FuturePlays({ spot, vix, symbol }: { spot: number; vix: number; symbol: string }) {
  const [targetExpiry, setTargetExpiry] = useState("")
  const [targetVIX, setTargetVIX] = useState(vix)
  const [targetSpot, setTargetSpot] = useState(spot)
  const expiryOptions = getWeeklyExpiries(symbol)
  const interval = getStrikeInterval(symbol)
  const atm = spot > 0 ? Math.round(spot / interval) * interval : 0

  useEffect(() => {
    if (expiryOptions.length > 0 && !targetExpiry) setTargetExpiry(expiryOptions[0])
  }, [symbol])

  useEffect(() => { setTargetVIX(vix) }, [vix])
  useEffect(() => { setTargetSpot(spot) }, [spot])

  const dte = targetExpiry ? daysToExpiry(targetExpiry) : 30
  const currentMove = spot > 0 && vix > 0 ? expectedMove(spot, vix, dte) : null
  const futureMove  = targetSpot > 0 ? expectedMove(targetSpot, targetVIX, dte) : null

  // Generate strikes around ATM
  const strikes = atm > 0 ? Array.from({ length: 11 }, (_, i) => atm - 5 * interval + i * interval).filter(s => s > 0) : []

  // Current premiums
  const currentPremiums = strikes.map(s => ({
    strike: s,
    ce: spot > 0 ? calcOptionPremium(spot, s, targetExpiry || expiryOptions[0], "CE", vix / 100) : 0,
    pe: spot > 0 ? calcOptionPremium(spot, s, targetExpiry || expiryOptions[0], "PE", vix / 100) : 0,
  }))

  // Future premiums (what Black-Scholes says if spot/VIX change)
  const futurePremiums = strikes.map(s => ({
    strike: s,
    ce: targetSpot > 0 ? calcOptionPremium(targetSpot, s, targetExpiry || expiryOptions[0], "CE", targetVIX / 100) : 0,
    pe: targetSpot > 0 ? calcOptionPremium(targetSpot, s, targetExpiry || expiryOptions[0], "PE", targetVIX / 100) : 0,
  }))

  const vixLevel = targetVIX < 12 ? { label: "Calm", color: "text-success", bg: "bg-success/10" }
    : targetVIX < 18 ? { label: "Low", color: "text-success", bg: "bg-success/10" }
    : targetVIX < 25 ? { label: "Normal", color: "text-primary", bg: "bg-primary/10" }
    : targetVIX < 35 ? { label: "Elevated", color: "text-warning", bg: "bg-warning/10" }
    : { label: "High Fear", color: "text-destructive", bg: "bg-destructive/10" }

  return (
    <div className="space-y-4">
      {/* Scenario builder */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Future Scenario Builder</span>
          <span className="text-[11px] text-muted-foreground">Powered by Black-Scholes + VIX expected move</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Expiry */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Target Expiry</label>
            <select value={targetExpiry} onChange={e => setTargetExpiry(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary">
              {expiryOptions.map(e => <option key={e} value={e}>{formatExpiry(e)} · {Math.round(daysToExpiry(e))} days</option>)}
            </select>
          </div>
          {/* Spot scenario */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
              Spot Scenario: <span className="text-foreground font-mono">{fmtN(targetSpot)}</span>
              {spot > 0 && <span className={`ml-2 text-[10px] font-bold ${targetSpot > spot ? "text-success" : targetSpot < spot ? "text-destructive" : "text-muted-foreground"}`}>
                {targetSpot > spot ? "▲" : targetSpot < spot ? "▼" : "—"}{Math.abs(((targetSpot - spot) / spot) * 100).toFixed(1)}%
              </span>}
            </label>
            <input type="range" min={spot > 0 ? spot * 0.85 : 20000} max={spot > 0 ? spot * 1.15 : 30000} step={interval}
              value={targetSpot}
              onChange={e => setTargetSpot(Number(e.target.value))}
              className="w-full accent-primary" />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>-15%</span><span>Current</span><span>+15%</span>
            </div>
          </div>
          {/* VIX scenario */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
              VIX Scenario: <span className={`font-mono font-bold ${vixLevel.color}`}>{targetVIX.toFixed(1)}</span>
              <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${vixLevel.bg} ${vixLevel.color}`}>{vixLevel.label}</span>
            </label>
            <input type="range" min={8} max={50} step={0.5}
              value={targetVIX}
              onChange={e => setTargetVIX(Number(e.target.value))}
              className="w-full accent-primary" />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>8 (calm)</span><span>Current: {vix.toFixed(1)}</span><span>50 (fear)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expected move */}
      {futureMove && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentMove && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">Current Scenario (VIX {vix.toFixed(1)})</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Spot</span>
                  <span className="font-mono font-bold">₹{fmtN(spot)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-success">Upper bound (1σ)</span>
                  <span className="font-mono font-bold text-success">₹{fmtN(currentMove.up)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-destructive">Lower bound (1σ)</span>
                  <span className="font-mono font-bold text-destructive">₹{fmtN(currentMove.down)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Expected ±%</span>
                  <span className="font-mono font-bold">±{currentMove.pct.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          )}
          <div className={`border rounded-xl p-4 ${vixLevel.bg} border-current/20`}>
            <div className={`text-xs font-bold mb-3 uppercase tracking-wide ${vixLevel.color}`}>Your Scenario (VIX {targetVIX.toFixed(1)} · {vixLevel.label})</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Spot</span>
                <span className="font-mono font-bold">₹{fmtN(targetSpot)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-success">Upper bound (1σ)</span>
                <span className="font-mono font-bold text-success">₹{fmtN(futureMove.up)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-destructive">Lower bound (1σ)</span>
                <span className="font-mono font-bold text-destructive">₹{fmtN(futureMove.down)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expected ±%</span>
                <span className={`font-mono font-bold ${vixLevel.color}`}>±{futureMove.pct.toFixed(2)}%</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-current/20 text-[10px] text-muted-foreground">
              {targetVIX > vix + 3 ? "📈 Higher VIX → Options are more expensive → Better for buyers" :
               targetVIX < vix - 3 ? "📉 Lower VIX → Options are cheaper → Better for sellers" :
               "VIX similar to current — premiums roughly same"}
            </div>
          </div>
        </div>
      )}

      {/* Premium comparison table */}
      {strikes.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/50">
            <span className="text-xs font-bold text-foreground">Premium Impact: Current vs Your Scenario</span>
            <span className="text-[10px] text-muted-foreground ml-2">Δ = change in premium</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30">
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-foreground">Strike</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-success">CE Now</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-primary">CE Future</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-muted-foreground">CE Δ</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-destructive">PE Now</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-primary">PE Future</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-muted-foreground">PE Δ</th>
                </tr>
              </thead>
              <tbody>
                {strikes.map((s, i) => {
                  const now = currentPremiums[i]
                  const fut = futurePremiums[i]
                  const ceDiff = fut.ce - now.ce
                  const peDiff = fut.pe - now.pe
                  const isATM = Math.abs(s - atm) < interval / 2
                  return (
                    <tr key={s} className={`border-t border-border/50 ${isATM ? "bg-primary/5 font-semibold" : ""}`}>
                      <td className="px-3 py-2.5 text-center font-mono font-bold">
                        {fmtN(s)}{isATM ? " ⬡" : ""}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-success">₹{fmtN(now.ce)}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-primary">₹{fmtN(fut.ce)}</td>
                      <td className={`px-3 py-2.5 text-center font-mono font-bold ${ceDiff > 0 ? "text-success" : ceDiff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {ceDiff > 0 ? "+" : ""}{fmtN(ceDiff)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-destructive">₹{fmtN(now.pe)}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-primary">₹{fmtN(fut.pe)}</td>
                      <td className={`px-3 py-2.5 text-center font-mono font-bold ${peDiff > 0 ? "text-success" : peDiff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {peDiff > 0 ? "+" : ""}{fmtN(peDiff)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-border bg-muted/20 text-[10px] text-muted-foreground">
            Formula: Black-Scholes · Risk-free rate 6.5% · IV = VIX scenario ÷ 100 · Time = days to expiry ÷ 365
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// TRADING DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

function TradingDashboard({ userId }: { userId: string }) {
  const [balance,    setBalance]    = useState(0)
  const [positions,  setPositions]  = useState<any[]>([])
  const [history,    setHistory]    = useState<any[]>([])
  const [profile,    setProfile]    = useState<{ full_name: string; mobile: string } | null>(null)
  const [tab,        setTab]        = useState<Tab>("chain")
  const [loading,    setLoading]    = useState(true)
  const [closing,    setClosing]    = useState<string | null>(null)
  const [targetPrices, setTargetPrices] = useState<Record<string, number>>({})
  const [targetInputs, setTargetInputs] = useState<Record<string, string>>({})
  const [livePrices,   setLivePrices]   = useState<Record<string, number>>({})
  const [priceTs,      setPriceTs]      = useState<Date | null>(null)
  const [fetching,     setFetching]     = useState(false)
  const [spot,         setSpot]         = useState(0)
  const [vix,          setVix]          = useState(15)
  const [chainSymbol,  setChainSymbol]  = useState("NIFTY")
  const [chainExpiry,  setChainExpiry]  = useState(getThursdaysForNext3Months()[0] ?? "")
  const [expiryPopup,  setExpiryPopup]  = useState<any[] | null>(null)
  const positionsRef    = useRef<any[]>([])
  const targetPricesRef = useRef<Record<string, number>>({})
  const [autoPlayTimer, setAutoPlayTimer] = useState<NodeJS.Timeout | null>(null)
  const [isAutoPlay, setIsAutoPlay] = useState(false)
  const autoPlayRef = useRef(false)

  useEffect(() => { targetPricesRef.current = targetPrices }, [targetPrices])

  const load = useCallback(async () => {
    const [w, p, h, pr] = await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", userId).single(),
      supabase.from("positions").select("*").eq("user_id", userId).eq("status", "OPEN").order("opened_at", { ascending: false }),
      supabase.from("trade_history")
        .select("id,symbol,instrument,trade_type,quantity,price,total_value,charges,net_value,realized_pnl,margin_blocked,expiry,strike_price,option_type,executed_at,created_at")
        .eq("user_id", userId).order("id", { ascending: false }).limit(500),
      supabase.from("profiles").select("full_name,mobile").eq("id", userId).single(),
    ])
    if (w.data) setBalance(w.data.balance)
    if (p.data) { setPositions(p.data); positionsRef.current = p.data }
    if (h.data) setHistory(h.data)
    if (pr.data) setProfile(pr.data)
    setLoading(false)
  }, [userId])

  const refreshLivePrices = useCallback(async () => {
    const pos = positionsRef.current
    if (pos.length === 0) return
    setFetching(true)

    const spotItems: { symbol: string; instrument: InstrumentType }[] = []
    const seen = new Set<string>()
    for (const p of pos) {
      const eqKey = `${p.symbol}__EQUITY`
      if (!seen.has(eqKey)) { seen.add(eqKey); spotItems.push({ symbol: p.symbol, instrument: "EQUITY" }) }
      if (p.instrument === "FUTURES") {
        const fKey = `${p.symbol}__FUTURES`
        if (!seen.has(fKey)) { seen.add(fKey); spotItems.push({ symbol: p.symbol, instrument: "FUTURES" }) }
      }
    }

    const spotPrices = await fetchLivePrices(spotItems)
    const allPrices: Record<string, number> = { ...spotPrices }

    for (const p of pos) {
      if (p.instrument === "OPTIONS") {
        const s = spotPrices[`${p.symbol}__EQUITY`]
        if (s && s > 0 && p.strike_price && p.expiry && p.option_type) {
          const livePremium = calcOptionPremium(s, p.strike_price, p.expiry, p.option_type as OptionType, vix / 100)
          allPrices[`${p.symbol}__OPTIONS`] = livePremium
          await supabase.from("positions").update({ current_price: livePremium }).eq("id", p.id)
        }
      }
    }

    if (Object.keys(allPrices).length > 0) {
      setLivePrices(prev => ({ ...prev, ...allPrices }))
      setPriceTs(new Date())
      await Promise.all(pos.map((p: any) => {
        if (p.instrument === "OPTIONS") return Promise.resolve()
        const lp = allPrices[`${p.symbol}__${p.instrument}`]
        if (lp) return supabase.from("positions").update({ current_price: lp }).eq("id", p.id)
        return Promise.resolve()
      }))

      // Target price auto-exit
      const currentTargets = targetPricesRef.current
      for (const p of pos) {
        const target = currentTargets[p.id]
        if (!target || target <= 0) continue
        const liveKey = `${p.symbol}__${p.instrument}`
        const ltp = allPrices[liveKey] ?? p.current_price
        if (!ltp) continue
        const entryP = p.avg_price ?? p.entry_price
        const triggered = p.trade_type === "BUY" ? ltp >= target : ltp <= target
        if (triggered) {
          setTargetPrices(prev => { const n = {...prev}; delete n[p.id]; return n })
          setTargetInputs(prev => { const n = {...prev}; delete n[p.id]; return n })
          await closePos(p, ltp)
        }
      }
    }
    setFetching(false)
  }, [vix])

  const [schemaInfo,   setSchemaInfo]   = useState<string>("")
  const [showSchema,   setShowSchema]   = useState(false)
  const [manualSpot,   setManualSpot]   = useState("")

  // Auto-fetch spot for option chain
  async function fetchChainSpot() {
    const p = await fetchLivePrice(chainSymbol, "EQUITY")
    if (p) { setSpot(p); setManualSpot(String(p)) }
    const v = await fetchVIXFromSupabase()
    setVix(v)
  }

  // Schema probe — shows exactly what columns are in your bhav tables
  async function probeSchema() {
    const lines: string[] = []
    for (const tbl of ["nifty_options","banknifty_options","india_vix"]) {
      const { data, error } = await supabase.from(tbl).select("*").limit(3)
      if (error) { lines.push(`❌ ${tbl}: ${error.message}`); continue }
      if (!data || !data.length) { lines.push(`⚠ ${tbl}: table exists but no rows`); continue }
      const cols = Object.keys(data[0])
      lines.push(`✅ ${tbl} (${cols.length} cols): ${cols.join(", ")}`)
      lines.push(`   Sample row[0]: ${JSON.stringify(data[0]).slice(0,200)}`)
    }
    setSchemaInfo(lines.join("\n"))
    setShowSchema(true)
  }

  useEffect(() => {
    load().then(() => {
      setTimeout(() => { checkExpiry(); checkSquareOff() }, 1500)
    })
  }, [load])

  useEffect(() => {
    const init = setTimeout(() => refreshLivePrices(), 500)
    const interval = setInterval(() => refreshLivePrices(), 30_000)
    return () => { clearTimeout(init); clearInterval(interval) }
  }, [refreshLivePrices])

  useEffect(() => {
    if (positions.length > 0) refreshLivePrices()
  }, [positions.length, refreshLivePrices])

  // Fetch spot on symbol change
  useEffect(() => { fetchChainSpot() }, [chainSymbol])

  // Daily auto-play: check expiry at start of each "day"
  function startAutoPlay() {
    if (isAutoPlay) return
    setIsAutoPlay(true)
    autoPlayRef.current = true
    const t = setInterval(async () => {
      if (!autoPlayRef.current) { clearInterval(t); return }
      await refreshLivePrices()
      checkExpiry()
      checkSquareOff()
    }, 60_000) // check every minute for expiry
    setAutoPlayTimer(t)
  }

  function stopAutoPlay() {
    setIsAutoPlay(false)
    autoPlayRef.current = false
    if (autoPlayTimer) { clearInterval(autoPlayTimer); setAutoPlayTimer(null) }
  }

  async function closePos(pos: any, forcePrice?: number) {
    setClosing(pos.id)
    const liveKey = `${pos.symbol}__${pos.instrument}`
    const lp = forcePrice !== undefined
      ? forcePrice
      : (livePrices[liveKey] ?? pos.current_price ?? pos.avg_price ?? pos.entry_price)
    const entryP = pos.avg_price ?? pos.entry_price
    const qty    = pos.quantity
    const margin = pos.margin_blocked ?? 0

    let walletCredit = 0, realizedPnl = 0, exitValue = 0

    if (pos.instrument === "EQUITY") {
      const ch = calcCharges(lp, qty, "EQUITY", "SELL")
      exitValue = lp * qty - ch; realizedPnl = (lp - entryP) * qty - ch; walletCredit = exitValue
    } else if (pos.instrument === "OPTIONS") {
      if (pos.trade_type === "BUY") {
        const ch = calcCharges(lp, qty, "OPTIONS", "SELL")
        exitValue = lp * qty - ch; realizedPnl = (lp - entryP) * qty - ch; walletCredit = Math.max(exitValue, 0)
      } else {
        const ch = calcCharges(lp, qty, "OPTIONS", "BUY")
        realizedPnl = (entryP - lp) * qty - ch; walletCredit = Math.max(margin + realizedPnl, 0); exitValue = lp * qty
      }
    } else {
      const ch = calcCharges(lp, qty, "FUTURES" as any, pos.trade_type === "BUY" ? "SELL" : "BUY")
      if (pos.trade_type === "BUY") realizedPnl = (lp - entryP) * qty - ch
      else realizedPnl = (entryP - lp) * qty - ch
      walletCredit = Math.max(margin + realizedPnl, 0); exitValue = lp * qty
    }

    await supabase.from("positions").update({ status: "CLOSED", closed_at: new Date().toISOString(), current_price: lp, pnl: realizedPnl }).eq("id", pos.id)
    const { data: walletData } = await supabase.from("wallets").select("balance").eq("user_id", userId).single()
    const freshBal = walletData?.balance ?? balance
    await supabase.from("wallets").update({ balance: freshBal + walletCredit }).eq("user_id", userId)

    const exitNow = new Date().toISOString()
    const histRow: Record<string, any> = {
      user_id: userId, symbol: pos.symbol, instrument: pos.instrument,
      trade_type: pos.trade_type === "BUY" ? "SELL" : "BUY",
      quantity: qty, price: lp, total_value: exitValue, charges: 0, net_value: walletCredit,
      realized_pnl: realizedPnl, margin_blocked: pos.margin_blocked ?? 0,
      expiry: pos.expiry || null, strike_price: pos.strike_price || null, option_type: pos.option_type || null,
      executed_at: exitNow, created_at: exitNow,
    }
    await supabase.from("trade_history").insert(histRow)
    setClosing(null)
    await load()
    return realizedPnl
  }

  async function checkExpiry() {
    const today = new Date(); today.setHours(23, 59, 59, 999)
    const expired = positionsRef.current.filter(p =>
      (p.instrument === "OPTIONS" || p.instrument === "FUTURES") && p.expiry && new Date(p.expiry + "T00:00:00") <= today
    )
    if (expired.length === 0) return
    const settledPositions: any[] = []
    for (const pos of expired) {
      const settlementPrice = pos.instrument === "OPTIONS" ? 0
        : (livePrices[`${pos.symbol}__${pos.instrument}`] ?? pos.current_price ?? pos.entry_price)
      const pnl = await closePos(pos, settlementPrice)
      settledPositions.push({ ...pos, realized_pnl: pnl })
    }
    if (settledPositions.length > 0) setExpiryPopup(settledPositions)
  }

  async function checkSquareOff() {
    const sellPos = positionsRef.current.filter(p =>
      (p.instrument === "OPTIONS" || p.instrument === "FUTURES") && p.trade_type === "SELL" && p.margin_blocked > 0
    )
    for (const pos of sellPos) {
      const liveKey = `${pos.symbol}__${pos.instrument}`
      const lp = livePrices[liveKey] ?? pos.current_price ?? pos.entry_price
      const entryP = pos.avg_price ?? pos.entry_price
      const loss = (lp - entryP) * pos.quantity
      if (loss >= pos.margin_blocked) await closePos(pos, lp)
    }
  }

  const getLivePrice = (pos: any) => {
    if (pos.instrument === "OPTIONS") return pos.current_price ?? pos.avg_price ?? pos.entry_price
    return livePrices[`${pos.symbol}__${pos.instrument}`] ?? pos.current_price ?? pos.entry_price ?? pos.avg_price
  }

  const totalPnL = positions.reduce((s, p) => {
    const entryP = p.avg_price ?? p.entry_price
    const curPrice = getLivePrice(p)
    const raw = p.trade_type === "BUY" ? (curPrice - entryP) * p.quantity : (entryP - curPrice) * p.quantity
    return s + raw
  }, 0)

  const realizedPnL = history.reduce((s, h) => s + (h.realized_pnl ?? 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  )

  const tabs: { key: Tab; label: string; icon: any; badge?: number }[] = [
    { key: "chain",    label: "Option Chain", icon: BarChart2 },
    { key: "strategy", label: "Strategy",     icon: Layers },
    { key: "replay",   label: "Replay",       icon: Clock },
    { key: "future",   label: "Future Plays", icon: Zap },
    { key: "positions",label: "Positions",    icon: Target, badge: positions.length },
    { key: "history",  label: "History",      icon: History, badge: history.length },
    { key: "ledger",   label: "Ledger",       icon: BookOpen },
  ]

  // Build ledger from history + opening balance
  const OPENING_BALANCE = 1_000_000
  type LedgerEntry = {
    id: string; date: Date; description: string; debit: number; credit: number; pnl: number | null
    runningBalance: number; instrument?: string; tag?: string
  }
  const entries: LedgerEntry[] = (() => {
    const list: LedgerEntry[] = []
    let running = OPENING_BALANCE
    list.push({ id: "opening", date: new Date(0), description: "Opening virtual wallet", debit: 0, credit: OPENING_BALANCE, pnl: null, runningBalance: OPENING_BALANCE })
    const sorted = [...history].sort((a, b) => new Date(a.executed_at ?? a.created_at ?? 0).getTime() - new Date(b.executed_at ?? b.created_at ?? 0).getTime())
    for (const h of sorted) {
      const d = new Date(h.executed_at ?? h.created_at ?? 0)
      const isBuy = h.trade_type === "BUY"
      const pnl = h.realized_pnl ?? null
      let debit = 0, credit = 0
      if (h.instrument === "EQUITY") { if (isBuy) debit = h.net_value ?? h.total_value; else credit = h.net_value ?? h.total_value }
      else { if (isBuy) debit = h.net_value ?? (h.margin_blocked ?? 0); else credit = h.net_value ?? 0 }
      running = running - debit + credit
      list.push({
        id: h.id, date: d,
        description: `${h.trade_type} ${h.instrument === "OPTIONS" ? `${h.symbol} ${h.strike_price}${h.option_type}` : h.symbol}`,
        debit, credit, pnl, runningBalance: running, instrument: h.instrument,
        tag: h.expiry && new Date(h.expiry + "T00:00:00") <= new Date() && h.instrument === "OPTIONS" ? "expiry" : undefined,
      })
    }
    return list
  })()

  return (
    <div>
      {/* Expiry Popup */}
      {expiryPopup && <ExpiryPnLPopup positions={expiryPopup} onClose={() => setExpiryPopup(null)} />}

      {/* Schema debug modal */}
      {showSchema && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <div className="font-bold text-foreground">Supabase Table Schema Probe</div>
                <div className="text-[11px] text-muted-foreground">Shows actual column names in your bhav tables — use this to verify the data layer</div>
              </div>
              <button onClick={() => setShowSchema(false)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 max-h-96 overflow-y-auto">
              <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap bg-muted rounded-xl p-4 leading-relaxed">{schemaInfo || "Loading…"}</pre>
            </div>
            <div className="px-5 py-3 border-t border-border text-[10px] text-muted-foreground">
              If column names differ from what the code expects, the normaliser will still try to map them.
              Check that strike and expiry columns are present.
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-semibold">PAPER MONEY</span>
          {profile && <span className="text-xs text-muted-foreground hidden sm:block">{profile.full_name} · +91 {profile.mobile}</span>}
          {/* Auto-play toggle */}
          <button onClick={isAutoPlay ? stopAutoPlay : startAutoPlay}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
              isAutoPlay ? "bg-success/15 text-success border border-success/30 animate-pulse" : "bg-muted text-muted-foreground border border-border hover:text-foreground"
            }`}>
            {isAutoPlay ? <><Pause className="w-3 h-3" />Auto-Play ON</> : <><Play className="w-3 h-3" />Auto-Play</>}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Manual spot override — for when Yahoo fetch fails */}
          <div className="flex items-center gap-1 bg-muted rounded-lg px-2 py-1">
            <span className="text-[10px] text-muted-foreground font-semibold">Spot ₹</span>
            <input
              type="number" value={manualSpot} placeholder={spot > 0 ? String(Math.round(spot)) : "e.g. 24500"}
              onChange={e => {
                setManualSpot(e.target.value)
                const v = parseFloat(e.target.value)
                if (v > 1000) setSpot(v)
              }}
              className="w-20 text-xs font-mono bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50"
            />
            <button onClick={fetchChainSpot} title="Auto-fetch from Yahoo Finance"
              className="text-primary hover:text-primary/80">
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <button onClick={() => { load(); refreshLivePrices(); fetchChainSpot() }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted rounded-lg px-2 py-1.5 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${fetching ? "animate-spin text-primary" : ""}`} /> Refresh
          </button>
          {/* Schema debug button */}
          <button onClick={probeSchema}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground bg-muted rounded-lg px-2 py-1.5 transition-colors"
            title="Check what columns exist in your Supabase bhav tables">
            <Settings className="w-3 h-3" /> DB Schema
          </button>
          <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1"><Wallet className="w-3.5 h-3.5 text-primary" /><span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Cash</span></div>
          <div className="font-mono text-base font-bold text-foreground">{fmt(balance)}</div>
        </div>
        <div className={`border rounded-xl p-3 ${totalPnL >= 0 ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"}`}>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Unrealised P&L</p>
          <div className={`font-mono text-base font-bold flex items-center gap-1 ${totalPnL >= 0 ? "text-success" : "text-destructive"}`}>
            {totalPnL >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {totalPnL >= 0 ? "+" : ""}{fmt(totalPnL)}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Realised P&L</p>
          <div className={`font-mono text-base font-bold ${realizedPnL >= 0 ? "text-success" : "text-destructive"}`}>
            {realizedPnL >= 0 ? "+" : ""}{fmt(realizedPnL)}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Open Positions</p>
          <p className="text-base font-bold text-foreground">{positions.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">India VIX</p>
          <div className="flex items-center gap-1.5">
            <p className="text-base font-bold text-foreground font-mono">{vix.toFixed(2)}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
              vix < 15 ? "bg-success/10 text-success" : vix < 25 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            }`}>{vix < 15 ? "Low" : vix < 25 ? "Normal" : "High"}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 border border-border p-1 rounded-xl mb-5 overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon, badge }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${tab === key ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
            {badge != null && badge > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === key ? "bg-primary/10 text-primary" : "bg-muted-foreground/20 text-muted-foreground"}`}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Live price status bar */}
      <div className="flex items-center gap-2 mb-4 text-[10px] text-muted-foreground">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${fetching ? "bg-warning animate-pulse" : priceTs ? "bg-success" : "bg-muted-foreground"}`} />
        {fetching ? "Fetching live prices…" : priceTs ? `Prices updated ${priceTs.toLocaleTimeString("en-IN")} · auto-refresh every 30s` : "Click refresh to load prices"}
        {isAutoPlay && <span className="ml-2 text-success font-semibold animate-pulse">● Auto-play active — daily expiry check running</span>}
      </div>

      {/* Tab content */}
      {tab === "chain" && (
        <OptionChain
          userId={userId} balance={balance} positions={positions} onTrade={load}
          spot={spot} vix={vix} symbol={chainSymbol} expiry={chainExpiry}
          onExpiryChange={setChainExpiry} onSymbolChange={s => { setChainSymbol(s); setSpot(0) }}
        />
      )}

      {tab === "strategy" && (
        <StrategyBuilder userId={userId} balance={balance} spot={spot} vix={vix} symbol={chainSymbol} onTrade={load} />
      )}

      {tab === "replay" && (
        <ReplayPanel symbol={chainSymbol} vix={vix} />
      )}

      {tab === "future" && (
        <FuturePlays spot={spot} vix={vix} symbol={chainSymbol} />
      )}

      {tab === "positions" && (
        positions.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <Target className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-semibold text-muted-foreground">No open positions</p>
            <p className="text-xs text-muted-foreground mt-1">Use the Option Chain or Strategy Builder to place trades</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {positions.some(p => p.instrument === "OPTIONS") && (
              <div className="flex items-start gap-2 px-4 py-2.5 bg-warning/5 border-b border-warning/20 text-[10px] text-warning/90">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>Options LTP is a Black-Scholes estimate using live spot + VIX {vix.toFixed(1)}%. Actual market premium may differ.</span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-muted">
                  {["Symbol","Type","B/S","Qty","Entry Avg","LTP","P&L","Target Exit","Action"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {positions.map((pos, i) => {
                    const entryP  = pos.avg_price ?? pos.entry_price
                    const liveKey = `${pos.symbol}__${pos.instrument}`
                    const ltp = livePrices[liveKey] ?? pos.current_price ?? entryP
                    const hasLive = !!livePrices[liveKey]
                    const pnl = pos.trade_type === "BUY" ? (ltp - entryP) * pos.quantity : (entryP - ltp) * pos.quantity
                    const isProfit = pnl >= 0
                    const pnlPct  = entryP > 0 ? pnl / (entryP * pos.quantity) * 100 : 0
                    const marginBlocked = pos.margin_blocked ?? 0
                    const lossNearMargin = pos.trade_type === "SELL" && marginBlocked > 0 && (-pnl) > marginBlocked * 0.8

                    return (
                      <tr key={pos.id} className={`border-t border-border ${lossNearMargin ? "bg-destructive/5" : i % 2 ? "bg-muted/30" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="font-bold text-foreground">{pos.symbol}</div>
                          {pos.instrument === "OPTIONS" && (
                            <div className="text-[10px] text-muted-foreground">
                              {pos.strike_price} {pos.option_type} · {pos.expiry ? formatExpiry(pos.expiry) : ""}
                              {pos.trade_type === "SELL" && <span className="ml-1 text-warning">SHORT</span>}
                            </div>
                          )}
                          {pos.instrument === "FUTURES" && (
                            <div className="text-[10px] text-muted-foreground">Fut · {pos.expiry ? formatExpiry(pos.expiry) : ""}{pos.trade_type === "SELL" && <span className="ml-1 text-warning">SHORT</span>}</div>
                          )}
                          {pos.trade_type === "SELL" && marginBlocked > 0 && (
                            <div className={`text-[9px] mt-0.5 ${lossNearMargin ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                              {lossNearMargin ? "⚠️ Near auto sq-off" : `Margin: ₹${fmtN(marginBlocked)}`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            pos.instrument === "EQUITY"  ? "bg-primary/10 text-primary" :
                            pos.instrument === "OPTIONS" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                            "bg-warning/10 text-warning"}`}>{pos.instrument}</span>
                        </td>
                        <td className="px-4 py-3"><span className={`font-bold ${pos.trade_type === "BUY" ? "text-success" : "text-destructive"}`}>{pos.trade_type}</span></td>
                        <td className="px-4 py-3 font-mono">{fmtN(pos.quantity)}</td>
                        <td className="px-4 py-3 font-mono">₹{fmtN(entryP)}</td>
                        <td className="px-4 py-3">
                          <div className={`font-mono font-semibold ${hasLive ? "text-foreground" : "text-muted-foreground"}`}>₹{fmtN(ltp)}</div>
                          {!hasLive && <div className="text-[9px] text-muted-foreground">last known</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className={`font-mono font-bold ${isProfit ? "text-success" : "text-destructive"}`}>
                            {isProfit ? "+" : ""}₹{fmtN(Math.abs(pnl))}
                          </div>
                          <div className={`text-[10px] ${isProfit ? "text-success" : "text-destructive"}`}>{isProfit ? "▲" : "▼"}{Math.abs(pnlPct).toFixed(2)}%</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <input type="number" min="0" step="0.5" placeholder="₹ target" value={targetInputs[pos.id] ?? ""}
                              onChange={e => setTargetInputs(prev => ({ ...prev, [pos.id]: e.target.value }))}
                              className="w-20 text-xs font-mono border border-border rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                            <button onClick={() => {
                              const v = parseFloat(targetInputs[pos.id] ?? "")
                              if (v > 0) setTargetPrices(prev => ({ ...prev, [pos.id]: v }))
                              else setTargetPrices(prev => { const n = {...prev}; delete n[pos.id]; return n })
                            }} className="text-[10px] font-semibold px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20">Set</button>
                          </div>
                          {targetPrices[pos.id] && (
                            <div className="text-[9px] mt-0.5 text-primary font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                              Active: ₹{fmtN(targetPrices[pos.id])}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => closePos(pos)} disabled={closing === pos.id}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50 whitespace-nowrap flex items-center gap-1">
                            {closing === pos.id ? <div className="w-3 h-3 border border-destructive/30 border-t-destructive rounded-full animate-spin" /> : <X className="w-3 h-3" />}
                            Close
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {tab === "history" && (
        history.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <History className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-semibold text-muted-foreground">No trade history yet</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-muted">
                  {["Date","Symbol","Type","B/S","Qty","Price","P&L","Charges","Net"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {history.map((h, i) => {
                    const pnl = h.realized_pnl
                    const hasPnl = pnl !== null && pnl !== undefined
                    return (
                      <tr key={h.id} className={`border-t border-border ${i % 2 ? "bg-muted/30" : ""}`}>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap font-mono">
                          {new Date(h.executed_at ?? h.created_at ?? 0).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-bold text-foreground">{h.symbol}</div>
                          {h.instrument === "OPTIONS" && <div className="text-[10px] text-muted-foreground">{h.strike_price} {h.option_type}</div>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            h.instrument === "EQUITY" ? "bg-primary/10 text-primary" :
                            h.instrument === "OPTIONS" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                            "bg-warning/10 text-warning"}`}>{h.instrument}</span>
                        </td>
                        <td className="px-4 py-2.5"><span className={`font-bold ${h.trade_type === "BUY" ? "text-success" : "text-destructive"}`}>{h.trade_type}</span></td>
                        <td className="px-4 py-2.5 font-mono">{fmtN(h.quantity)}</td>
                        <td className="px-4 py-2.5 font-mono">₹{fmtN(h.price)}</td>
                        <td className="px-4 py-2.5">
                          {hasPnl ? <span className={`font-mono font-bold ${pnl >= 0 ? "text-success" : "text-destructive"}`}>{pnl >= 0 ? "+" : ""}₹{fmtN(Math.abs(pnl))}</span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-warning">{h.charges > 0 ? `₹${fmtN(h.charges)}` : "—"}</td>
                        <td className="px-4 py-2.5 font-mono font-semibold">{fmt(h.net_value)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {tab === "ledger" && (() => {
        return (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="text-[11px] text-muted-foreground mb-1">Opening Balance</div>
                <div className="font-mono font-bold text-foreground">{fmt(OPENING_BALANCE)}</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="text-[11px] text-muted-foreground mb-1">Current Balance</div>
                <div className="font-mono font-bold text-foreground">{fmt(balance)}</div>
              </div>
              <div className={`border rounded-xl p-4 text-center ${(balance - OPENING_BALANCE) >= 0 ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"}`}>
                <div className="text-[11px] text-muted-foreground mb-1">Net P&L</div>
                <div className={`font-mono font-bold ${(balance - OPENING_BALANCE) >= 0 ? "text-success" : "text-destructive"}`}>
                  {(balance - OPENING_BALANCE) >= 0 ? "+" : ""}{fmt(balance - OPENING_BALANCE)}
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">Account Ledger</h3>
                <span className="text-[10px] text-muted-foreground">{entries.length} entries</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-muted">
                    {["Date","Description","Debit (−)","Credit (+)","P&L","Balance"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {[...entries].reverse().map((e, i) => (
                      <tr key={e.id} className={`border-t border-border ${i % 2 ? "bg-muted/30" : ""}`}>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap font-mono">
                          {e.id === "opening" ? "—" : e.date.toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                        </td>
                        <td className="px-4 py-2.5 max-w-[220px]">
                          <div className="font-semibold text-foreground truncate">{e.description}</div>
                          {e.instrument && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                              e.instrument === "EQUITY"  ? "bg-primary/10 text-primary" :
                              e.instrument === "OPTIONS" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                              "bg-warning/10 text-warning"}`}>
                              {e.instrument}{e.tag === "expiry" && " · EXPIRED"}{e.tag === "sqoff" && " · SQ-OFF"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          {e.debit > 0 ? <span className="text-destructive font-semibold">− {fmt(e.debit)}</span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          {e.credit > 0 ? <span className="text-success font-semibold">+ {fmt(e.credit)}</span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-semibold">
                          {e.pnl !== null ? <span className={e.pnl >= 0 ? "text-success" : "text-destructive"}>{e.pnl >= 0 ? "+" : ""}₹{fmtN(Math.abs(e.pnl))}</span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-foreground whitespace-nowrap">{fmt(e.runningBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

      <p className="text-[10px] text-muted-foreground text-center mt-8">
        ⚠️ Virtual trading only. No real money involved. Options premium via Black-Scholes (IV from India VIX). Bhav data from Supabase (nifty_options, banknifty_options, india_vix tables).
        Auto square-off if loss ≥ margin. Not SEBI registered. Past performance does not guarantee future results.
      </p>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE EXPORT
// ═════════════════════════════════════════════════════════════════════════════

export default function VirtualTradePage() {
  const [userId,     setUserId]     = useState<string | null>(null)
  const [checked,    setChecked]    = useState(false)
  const [isRecovery, setIsRecovery] = useState(false)

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "INITIAL_SESSION") {
        setUserId(session?.user?.id ?? null)
        setChecked(true)
      } else if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true); setUserId(null); setChecked(true)
      } else if (event === "USER_UPDATED") {
        setIsRecovery(false); setUserId(session?.user?.id ?? null)
      } else if (event === "SIGNED_IN") {
        if (isRecovery) return
        const uid = session?.user?.id
        if (uid) {
          const { data: prof } = await supabase.from("profiles").select("id").eq("id", uid).maybeSingle()
          if (!prof) {
            const meta = session?.user?.user_metadata ?? {}
            await supabase.from("profiles").upsert({ id: uid, email: session?.user?.email?.toLowerCase() ?? "", mobile: meta.mobile ?? "", full_name: meta.full_name ?? "" })
          }
          const { data: wal } = await supabase.from("wallets").select("id").eq("user_id", uid).maybeSingle()
          if (!wal) await supabase.from("wallets").insert({ user_id: uid, balance: 1000000 })
        }
        setUserId(uid ?? null); setChecked(true)
      } else if (event === "SIGNED_OUT") {
        setUserId(null); setIsRecovery(false); setChecked(true)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">Virtual Trading</h1>
              <span className="text-[11px] bg-primary/10 text-primary px-2.5 py-1 rounded-full font-semibold border border-primary/20">v2.0</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Practice with ₹10,00,000 virtual money · Option Chain · Strategy Builder · Historical Replay · Future Play with VIX forecasting
            </p>
          </div>
          {!checked ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : userId && !isRecovery ? (
            <TradingDashboard userId={userId} />
          ) : (
            <AuthSection
              initialMode={isRecovery ? "reset" : "login"}
              onAuth={() => {
                setIsRecovery(false)
                supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
              }}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
