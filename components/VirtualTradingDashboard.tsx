"use client"

// ─────────────────────────────────────────────────────────────────────────────
// VirtualTradingDashboard.tsx
// Full trading dashboard with:
//   • Wallet balance display
//   • Place trade form (Equity / Options / Futures)
//   • Open positions with live P&L
//   • Trade history
//   • Close position button
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react"
import { supabase } from "./supabaseClient"
import type { Wallet, Position, TradeHistory, InstrumentType, OptionType } from "./supabaseClient"
import {
  TrendingUp, TrendingDown, RefreshCw, LogOut,
  Plus, X, ChevronDown, History, BarChart2, Wallet as WalletIcon,
} from "lucide-react"

// ─── NSE lot sizes (standard F&O lot sizes) ───────────────────────────────────
const LOT_SIZES: Record<string, number> = {
  NIFTY: 25, BANKNIFTY: 15, FINNIFTY: 40, MIDCPNIFTY: 75,
  RELIANCE: 250, TCS: 150, INFY: 300, HDFCBANK: 550,
  ICICIBANK: 700, SBIN: 1500, BHARTIARTL: 950, ITC: 3200,
  AXISBANK: 1200, BAJFINANCE: 125, MARUTI: 100, SUNPHARMA: 350,
  TATAMOTORS: 1425, WIPRO: 1500, HCLTECH: 700, ONGC: 1925,
}

// ─── Popular symbols list ──────────────────────────────────────────────────────
const EQUITY_SYMBOLS = [
  "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","HINDUNILVR",
  "SBIN","BHARTIARTL","ITC","KOTAKBANK","LT","AXISBANK",
  "ASIANPAINT","MARUTI","TITAN","SUNPHARMA","WIPRO","HCLTECH",
  "ONGC","COALINDIA","TATAMOTORS","JSWSTEEL","BAJFINANCE","NESTLEIND",
]

const FNO_SYMBOLS = [
  "NIFTY","BANKNIFTY","FINNIFTY","MIDCPNIFTY",
  "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK",
  "SBIN","BHARTIARTL","ITC","AXISBANK","BAJFINANCE",
  "MARUTI","SUNPHARMA","TATAMOTORS","WIPRO","HCLTECH","ONGC",
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n)

const fmtNum = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)

function calcCharges(price: number, qty: number, type: InstrumentType, tradeType: "BUY" | "SELL") {
  const turnover = price * qty
  // Simulated brokerage (Zerodha-style flat ₹20 or 0.03% whichever lower)
  const brokerage = type === "EQUITY" ? Math.min(20, turnover * 0.0003) : 20
  const stt       = tradeType === "SELL" && type === "EQUITY" ? turnover * 0.001 : 0
  const exchTxn   = turnover * 0.0000345
  const sebi      = turnover * 0.000001
  const stamp     = tradeType === "BUY" ? turnover * 0.00015 : 0
  const total     = brokerage + stt + exchTxn + sebi + stamp
  return Math.round(total * 100) / 100
}

async function fetchLivePrice(symbol: string, instrumentType: InstrumentType): Promise<number | null> {
  try {
    let yahooSymbol = symbol
    if (instrumentType === "EQUITY") yahooSymbol = `${symbol}.NS`
    else if (symbol === "NIFTY")     yahooSymbol = "^NSEI"
    else if (symbol === "BANKNIFTY") yahooSymbol = "^NSEBANK"
    else                             yahooSymbol = `${symbol}.NS`

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`)
    const body = await res.json()
    const json = JSON.parse(body.contents)
    return json.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
  } catch { return null }
}

// ─── TRADE FORM ────────────────────────────────────────────────────────────────

function TradeForm({
  userId, wallet, onTradeComplete,
}: {
  userId: string
  wallet: Wallet
  onTradeComplete: () => void
}) {
  const [instrumentType, setInstrumentType] = useState<InstrumentType>("EQUITY")
  const [tradeType,      setTradeType]      = useState<"BUY" | "SELL">("BUY")
  const [symbol,         setSymbol]         = useState("RELIANCE")
  const [quantity,       setQuantity]       = useState(1)
  const [price,          setPrice]          = useState<number | "">("")
  const [strikePrice,    setStrikePrice]    = useState<number | "">("")
  const [optionType,     setOptionType]     = useState<OptionType>("CE")
  const [expiry,         setExpiry]         = useState("")
  const [fetchingPrice,  setFetchingPrice]  = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState("")
  const [success,        setSuccess]        = useState("")

  const symbolList = instrumentType === "EQUITY" ? EQUITY_SYMBOLS : FNO_SYMBOLS
  const lotSize    = LOT_SIZES[symbol] ?? 1
  const actualQty  = instrumentType === "EQUITY" ? quantity : quantity * lotSize
  const estTotal   = price ? price * actualQty : 0
  const charges    = price ? calcCharges(price as number, actualQty, instrumentType, tradeType) : 0
  const netTotal   = tradeType === "BUY" ? estTotal + charges : estTotal - charges

  async function fetchPrice() {
    setFetchingPrice(true)
    const p = await fetchLivePrice(symbol, instrumentType)
    if (p) setPrice(Math.round(p * 100) / 100)
    setFetchingPrice(false)
  }

  useEffect(() => { setSymbol(symbolList[0]); setPrice("") }, [instrumentType])
  useEffect(() => { setPrice("") }, [symbol])

  async function handleTrade(e: React.FormEvent) {
    e.preventDefault()
    setError(""); setSuccess("")

    if (!price || price <= 0)   { setError("Enter a valid price"); return }
    if (quantity <= 0)           { setError("Enter valid quantity"); return }
    if (instrumentType !== "EQUITY" && !expiry) { setError("Select expiry date"); return }
    if (instrumentType === "OPTIONS" && !strikePrice) { setError("Enter strike price"); return }

    if (tradeType === "BUY" && netTotal > wallet.balance) {
      setError(`Insufficient balance. Required: ${fmt(netTotal)} | Available: ${fmt(wallet.balance)}`)
      return
    }

    setLoading(true)

    // 1. Insert position
    const { error: posErr } = await supabase.from("positions").insert({
      user_id:         userId,
      symbol,
      instrument_type: instrumentType,
      trade_type:      tradeType,
      quantity:        actualQty,
      avg_price:       price,
      current_price:   price,
      expiry:          expiry || null,
      strike_price:    instrumentType === "OPTIONS" ? strikePrice : null,
      option_type:     instrumentType === "OPTIONS" ? optionType  : null,
      lot_size:        lotSize,
      status:          "OPEN",
      pnl:             0,
    })

    if (posErr) { setError(posErr.message); setLoading(false); return }

    // 2. Insert trade history
    await supabase.from("trade_history").insert({
      user_id:         userId,
      symbol,
      instrument_type: instrumentType,
      trade_type:      tradeType,
      quantity:        actualQty,
      price:           price,
      total_value:     estTotal,
      charges,
      net_value:       netTotal,
    })

    // 3. Update wallet balance
    const newBalance = tradeType === "BUY"
      ? wallet.balance - netTotal
      : wallet.balance + netTotal

    await supabase.from("wallets").update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", userId)

    setSuccess(`${tradeType === "BUY" ? "Bought" : "Sold"} ${actualQty} ${symbol} @ ₹${price}. Charges: ₹${charges.toFixed(2)}`)
    setLoading(false)
    onTradeComplete()
  }

  return (
    <form onSubmit={handleTrade} className="bg-white border border-[#e8ecf5] rounded-2xl p-5">
      <h3 className="text-sm font-bold text-[#1a1f36] mb-4">Place Order</h3>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-3">{error}</div>}
      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-2 mb-3">{success}</div>}

      {/* Instrument type tabs */}
      <div className="flex gap-1 bg-[#f5f7ff] p-1 rounded-xl mb-4">
        {(["EQUITY","OPTIONS","FUTURES"] as InstrumentType[]).map(t => (
          <button key={t} type="button" onClick={() => setInstrumentType(t)}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${
              instrumentType === t ? "bg-white text-[#2d4af0] shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* BUY / SELL */}
      <div className="flex gap-2 mb-4">
        <button type="button" onClick={() => setTradeType("BUY")}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
            tradeType === "BUY" ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
          }`}>
          BUY
        </button>
        <button type="button" onClick={() => setTradeType("SELL")}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
            tradeType === "SELL" ? "bg-red-500 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"
          }`}>
          SELL
        </button>
      </div>

      <div className="space-y-3">
        {/* Symbol */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Symbol</label>
          <div className="relative">
            <select value={symbol} onChange={e => setSymbol(e.target.value)}
              className="w-full appearance-none bg-[#f5f7ff] border border-[#e8ecf5] rounded-xl px-3 py-2.5 text-sm font-semibold text-[#1a1f36] focus:outline-none focus:border-[#2d4af0]">
              {symbolList.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Options-specific: strike + type */}
        {instrumentType === "OPTIONS" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Strike Price ₹</label>
              <input type="number" value={strikePrice} onChange={e => setStrikePrice(Number(e.target.value))}
                placeholder="e.g. 24800"
                className="w-full bg-[#f5f7ff] border border-[#e8ecf5] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2d4af0]" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Option Type</label>
              <div className="flex gap-1">
                {(["CE","PE"] as OptionType[]).map(t => (
                  <button key={t} type="button" onClick={() => setOptionType(t)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                      optionType === t ? "bg-[#2d4af0] text-white" : "bg-[#f5f7ff] text-slate-600 border border-[#e8ecf5]"
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Expiry — options & futures */}
        {instrumentType !== "EQUITY" && (
          <div>
            <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Expiry Date</label>
            <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full bg-[#f5f7ff] border border-[#e8ecf5] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2d4af0]" />
          </div>
        )}

        {/* Price */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
            {instrumentType === "OPTIONS" ? "Option Premium ₹" : "Price ₹"}
          </label>
          <div className="flex gap-2">
            <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))}
              placeholder="Enter price"
              className="flex-1 bg-[#f5f7ff] border border-[#e8ecf5] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2d4af0]" />
            <button type="button" onClick={fetchPrice} disabled={fetchingPrice}
              title="Fetch live price"
              className="px-3 py-2.5 bg-[#eef1ff] text-[#2d4af0] rounded-xl text-xs font-semibold hover:bg-[#dde4ff] transition-colors disabled:opacity-50">
              {fetchingPrice ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Live ₹"}
            </button>
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
            {instrumentType === "EQUITY" ? "Quantity (shares)" : `Lots (1 lot = ${lotSize} shares)`}
          </label>
          <input type="number" value={quantity} min={1}
            onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full bg-[#f5f7ff] border border-[#e8ecf5] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2d4af0]" />
          {instrumentType !== "EQUITY" && (
            <p className="text-[10px] text-slate-400 mt-1">Total shares: {fmtNum(actualQty)}</p>
          )}
        </div>

        {/* Order summary */}
        {price ? (
          <div className="bg-[#f5f7ff] rounded-xl p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Turnover</span>
              <span className="font-mono font-semibold">{fmt(estTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Est. charges</span>
              <span className="font-mono text-amber-600">+ {fmt(charges)}</span>
            </div>
            <div className="flex justify-between border-t border-[#e8ecf5] pt-1.5">
              <span className="font-semibold text-[#1a1f36]">
                {tradeType === "BUY" ? "Total debit" : "Total credit"}
              </span>
              <span className={`font-mono font-bold ${tradeType === "BUY" ? "text-red-600" : "text-emerald-600"}`}>
                {fmt(netTotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Balance after</span>
              <span className="font-mono font-semibold text-[#1a1f36]">
                {fmt(tradeType === "BUY" ? wallet.balance - netTotal : wallet.balance + netTotal)}
              </span>
            </div>
          </div>
        ) : null}

        {/* Submit */}
        <button type="submit" disabled={loading}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2 ${
            tradeType === "BUY"
              ? "bg-emerald-500 hover:bg-emerald-600 text-white"
              : "bg-red-500 hover:bg-red-600 text-white"
          }`}>
          {loading
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : `${tradeType} ${instrumentType === "EQUITY" ? `${quantity} shares` : `${quantity} lot${quantity > 1 ? "s" : ""}`} of ${symbol}`
          }
        </button>
      </div>
    </form>
  )
}

// ─── POSITIONS TABLE ───────────────────────────────────────────────────────────

function PositionsTable({
  positions, userId, onUpdate,
}: {
  positions: Position[]
  userId: string
  onUpdate: () => void
}) {
  const [closing, setClosing] = useState<string | null>(null)

  async function closePosition(pos: Position) {
    setClosing(pos.id)
    const livePrice = await fetchLivePrice(pos.symbol, pos.instrument_type)
    const closePrice = livePrice ?? pos.current_price
    const pnl = pos.trade_type === "BUY"
      ? (closePrice - pos.avg_price) * pos.quantity
      : (pos.avg_price - closePrice) * pos.quantity

    // Update position
    await supabase.from("positions").update({
      status: "CLOSED", closed_at: new Date().toISOString(),
      current_price: closePrice, pnl,
    }).eq("id", pos.id)

    // Credit/debit wallet
    const { data: walletData } = await supabase
      .from("wallets").select("balance").eq("user_id", userId).single()

    if (walletData) {
      const closeValue  = closePrice * pos.quantity
      const charges     = calcCharges(closePrice, pos.quantity, pos.instrument_type, pos.trade_type === "BUY" ? "SELL" : "BUY")
      const returnAmt   = pos.trade_type === "BUY" ? closeValue - charges : closeValue + charges

      await supabase.from("wallets").update({
        balance: walletData.balance + returnAmt,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId)

      await supabase.from("trade_history").insert({
        user_id: userId, symbol: pos.symbol,
        instrument_type: pos.instrument_type,
        trade_type: pos.trade_type === "BUY" ? "SELL" : "BUY",
        quantity: pos.quantity, price: closePrice,
        total_value: closeValue, charges, net_value: returnAmt,
      })
    }

    setClosing(null)
    onUpdate()
  }

  if (positions.length === 0) {
    return (
      <div className="bg-white border border-[#e8ecf5] rounded-2xl p-8 text-center">
        <BarChart2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-400">No open positions</p>
        <p className="text-xs text-slate-400 mt-1">Place your first trade using the form</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#e8ecf5] rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#e8ecf5] flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#1a1f36]">Open Positions ({positions.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#f5f7ff]">
              {["Symbol","Type","B/S","Qty","Avg Price","Curr Price","P&L","Action"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, i) => {
              const pnl      = (pos.current_price - pos.avg_price) * pos.quantity * (pos.trade_type === "BUY" ? 1 : -1)
              const pnlPct   = ((pnl / (pos.avg_price * pos.quantity)) * 100).toFixed(2)
              const positive = pnl >= 0
              return (
                <tr key={pos.id} className={`border-t border-[#f0f2f9] ${i % 2 === 0 ? "" : "bg-[#fafbff]"}`}>
                  <td className="px-4 py-3">
                    <div className="font-bold text-[#1a1f36]">{pos.symbol}</div>
                    {pos.instrument_type === "OPTIONS" && (
                      <div className="text-[10px] text-slate-500">{pos.strike_price} {pos.option_type} {pos.expiry}</div>
                    )}
                    {pos.instrument_type === "FUTURES" && (
                      <div className="text-[10px] text-slate-500">Fut {pos.expiry}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      pos.instrument_type === "EQUITY"  ? "bg-blue-100 text-blue-700" :
                      pos.instrument_type === "OPTIONS" ? "bg-purple-100 text-purple-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>{pos.instrument_type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${pos.trade_type === "BUY" ? "text-emerald-600" : "text-red-600"}`}>
                      {pos.trade_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">{fmtNum(pos.quantity)}</td>
                  <td className="px-4 py-3 font-mono">₹{fmtNum(pos.avg_price)}</td>
                  <td className="px-4 py-3 font-mono">₹{fmtNum(pos.current_price)}</td>
                  <td className="px-4 py-3">
                    <div className={`font-mono font-bold ${positive ? "text-emerald-600" : "text-red-600"}`}>
                      {positive ? "+" : ""}₹{fmtNum(Math.abs(pnl))}
                    </div>
                    <div className={`text-[10px] ${positive ? "text-emerald-500" : "text-red-500"}`}>
                      {positive ? "▲" : "▼"} {Math.abs(Number(pnlPct))}%
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => closePosition(pos)} disabled={closing === pos.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50">
                      {closing === pos.id
                        ? <div className="w-3 h-3 border border-red-300 border-t-red-600 rounded-full animate-spin" />
                        : <X className="w-3 h-3" />}
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
}

// ─── TRADE HISTORY ─────────────────────────────────────────────────────────────

function TradeHistoryTable({ history }: { history: TradeHistory[] }) {
  if (history.length === 0) {
    return (
      <div className="bg-white border border-[#e8ecf5] rounded-2xl p-8 text-center">
        <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No trade history yet</p>
      </div>
    )
  }
  return (
    <div className="bg-white border border-[#e8ecf5] rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#e8ecf5]">
        <h3 className="text-sm font-bold text-[#1a1f36]">Trade History</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#f5f7ff]">
              {["Time","Symbol","Type","B/S","Qty","Price","Charges","Net"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((t, i) => (
              <tr key={t.id} className={`border-t border-[#f0f2f9] ${i % 2 === 0 ? "" : "bg-[#fafbff]"}`}>
                <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                  {new Date(t.executed_at).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                </td>
                <td className="px-4 py-2.5 font-bold text-[#1a1f36]">{t.symbol}</td>
                <td className="px-4 py-2.5 text-slate-500">{t.instrument_type}</td>
                <td className="px-4 py-2.5">
                  <span className={`font-bold ${t.trade_type === "BUY" ? "text-emerald-600" : "text-red-600"}`}>{t.trade_type}</span>
                </td>
                <td className="px-4 py-2.5 font-mono">{fmtNum(t.quantity)}</td>
                <td className="px-4 py-2.5 font-mono">₹{fmtNum(t.price)}</td>
                <td className="px-4 py-2.5 font-mono text-amber-600">₹{fmtNum(t.charges)}</td>
                <td className="px-4 py-2.5 font-mono font-semibold text-[#1a1f36]">₹{fmtNum(t.net_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── MAIN DASHBOARD ────────────────────────────────────────────────────────────

export function VirtualTradingDashboard() {
  const [userId,    setUserId]    = useState<string | null>(null)
  const [profile,   setProfile]   = useState<{ full_name: string; mobile: string } | null>(null)
  const [wallet,    setWallet]    = useState<Wallet | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [history,   setHistory]   = useState<TradeHistory[]>([])
  const [activeTab, setActiveTab] = useState<"positions" | "history">("positions")
  const [loading,   setLoading]   = useState(true)

  const loadAll = useCallback(async (uid: string) => {
    const [walletRes, posRes, histRes, profRes] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", uid).single(),
      supabase.from("positions").select("*").eq("user_id", uid).eq("status", "OPEN").order("opened_at", { ascending: false }),
      supabase.from("trade_history").select("*").eq("user_id", uid).order("executed_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("full_name, mobile").eq("id", uid).single(),
    ])
    if (walletRes.data) setWallet(walletRes.data)
    if (posRes.data)    setPositions(posRes.data)
    if (histRes.data)   setHistory(histRes.data)
    if (profRes.data)   setProfile(profRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) { setUserId(data.user.id); loadAll(data.user.id) }
    })
  }, [loadAll])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.reload()
  }

  function onTradeComplete() {
    if (userId) loadAll(userId)
  }

  // Total P&L across open positions
  const totalPnL = positions.reduce((sum, pos) => {
    return sum + (pos.current_price - pos.avg_price) * pos.quantity * (pos.trade_type === "BUY" ? 1 : -1)
  }, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7ff] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#2d4af0]/20 border-t-[#2d4af0] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading your portfolio...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f7ff]">

      {/* Top bar */}
      <div className="bg-white border-b border-[#e8ecf5] px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#2d4af0]" />
          <span className="font-bold text-[#1a1f36]">Virtual Trading</span>
          <span className="text-[10px] bg-[#eef1ff] text-[#2d4af0] px-2 py-0.5 rounded-full font-semibold">PAPER MONEY</span>
        </div>
        <div className="flex items-center gap-3">
          {profile && (
            <span className="text-xs text-slate-500 hidden sm:block">
              {profile.full_name} · +91 {profile.mobile}
            </span>
          )}
          <button onClick={handleSignOut} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Wallet + P&L cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-[#e8ecf5] rounded-2xl p-4 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <WalletIcon className="w-4 h-4 text-[#2d4af0]" />
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Available Balance</span>
            </div>
            <div className="font-mono text-xl font-bold text-[#1a1f36]">{wallet ? fmt(wallet.balance) : "—"}</div>
          </div>
          <div className="bg-white border border-[#e8ecf5] rounded-2xl p-4">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Open Positions</div>
            <div className="text-xl font-bold text-[#1a1f36]">{positions.length}</div>
          </div>
          <div className={`border rounded-2xl p-4 ${totalPnL >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Unrealised P&L</div>
            <div className={`font-mono text-xl font-bold ${totalPnL >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {totalPnL >= 0 ? "+" : ""}{fmt(totalPnL)}
            </div>
          </div>
          <div className="bg-white border border-[#e8ecf5] rounded-2xl p-4">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Trades</div>
            <div className="text-xl font-bold text-[#1a1f36]">{history.length}</div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">

          {/* Left — Trade form */}
          {wallet && userId && (
            <div>
              <TradeForm userId={userId} wallet={wallet} onTradeComplete={onTradeComplete} />
            </div>
          )}

          {/* Right — Positions / History */}
          <div>
            <div className="flex gap-1 bg-white border border-[#e8ecf5] p-1 rounded-xl mb-4 w-fit">
              <button onClick={() => setActiveTab("positions")}
                className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${
                  activeTab === "positions" ? "bg-[#2d4af0] text-white" : "text-slate-500 hover:text-slate-700"
                }`}>
                <BarChart2 className="w-3.5 h-3.5" /> Positions
              </button>
              <button onClick={() => setActiveTab("history")}
                className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${
                  activeTab === "history" ? "bg-[#2d4af0] text-white" : "text-slate-500 hover:text-slate-700"
                }`}>
                <History className="w-3.5 h-3.5" /> History
              </button>
              <button onClick={() => userId && loadAll(userId)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                title="Refresh">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeTab === "positions"
              ? <PositionsTable positions={positions} userId={userId!} onUpdate={() => userId && loadAll(userId)} />
              : <TradeHistoryTable history={history} />
            }
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-slate-400 text-center mt-8">
          ⚠️ Virtual trading only — no real money involved. Prices fetched from Yahoo Finance (15 min delay).
          Charges are simulated (Zerodha model). For educational purposes only. Not SEBI registered.
        </p>
      </div>
    </div>
  )
}
