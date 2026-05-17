"use client"
export const dynamic = "force-dynamic"
export const runtime = "edge"
import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import {
  Eye, EyeOff, Phone, Lock, User, ArrowRight,
  TrendingUp, TrendingDown, RefreshCw, LogOut,
  X, History, BarChart2, ChevronDown, Wallet,
} from "lucide-react"

// ─── Constants ────────────────────────────────────────────────────────────────
const LOT_SIZES: Record<string, number> = {
  NIFTY: 25, BANKNIFTY: 15, FINNIFTY: 40,
  RELIANCE: 250, TCS: 150, INFY: 300, HDFCBANK: 550,
  ICICIBANK: 700, SBIN: 1500, BHARTIARTL: 950, ITC: 3200,
  AXISBANK: 1200, BAJFINANCE: 125, MARUTI: 100, SUNPHARMA: 350,
  TATAMOTORS: 1425, WIPRO: 1500, HCLTECH: 700, ONGC: 1925,
}

const EQUITY_SYMBOLS = [
  "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","HINDUNILVR",
  "SBIN","BHARTIARTL","ITC","KOTAKBANK","LT","AXISBANK",
  "ASIANPAINT","MARUTI","TITAN","SUNPHARMA","WIPRO","HCLTECH",
  "ONGC","COALINDIA","TATAMOTORS","JSWSTEEL","BAJFINANCE","NESTLEIND",
]

const FNO_SYMBOLS = [
  "NIFTY","BANKNIFTY","RELIANCE","TCS","HDFCBANK","INFY",
  "ICICIBANK","SBIN","BHARTIARTL","ITC","AXISBANK","BAJFINANCE",
  "MARUTI","SUNPHARMA","TATAMOTORS","WIPRO","HCLTECH","ONGC",
]

type InstrumentType = "EQUITY" | "OPTIONS" | "FUTURES"
type TradeType      = "BUY" | "SELL"
type OptionType     = "CE" | "PE"
type AuthMode       = "login" | "signup" | "forgot"

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n)

const fmtN = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)

function calcCharges(price: number, qty: number, type: InstrumentType, side: TradeType) {
  const to        = price * qty
  const brokerage = type === "EQUITY" ? Math.min(20, to * 0.0003) : 20
  const stt       = side === "SELL" && type === "EQUITY" ? to * 0.001 : 0
  const other     = to * 0.0000695
  const stamp     = side === "BUY" ? to * 0.00015 : 0
  return Math.round((brokerage + stt + other + stamp) * 100) / 100
}

async function fetchLivePrice(symbol: string, type: InstrumentType): Promise<number | null> {
  try {
    let ySym = type === "EQUITY" ? `${symbol}.NS`
      : symbol === "NIFTY" ? "^NSEI"
      : symbol === "BANKNIFTY" ? "^NSEBANK"
      : `${symbol}.NS`
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=1d&range=1d`
    const res  = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`)
    const body = await res.json()
    const json = JSON.parse(body.contents)
    return json.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
  } catch { return null }
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTH SECTION
// ═════════════════════════════════════════════════════════════════════════════

function AuthSection({ onAuth }: { onAuth: () => void }) {
  const [mode,      setMode]      = useState<AuthMode>("login")
  const [mobile,    setMobile]    = useState("")
  const [email,     setEmail]     = useState("")
  const [password,  setPassword]  = useState("")
  const [confirm,   setConfirm]   = useState("")
  const [fullName,  setFullName]  = useState("")
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState("")
  const [success,   setSuccess]   = useState("")

  const mobileToEmail = (m: string) => `${m}@marketgreeks.user`
  const normMobile    = (m: string) => m.replace(/\D/g, "").slice(-10)

  function validate() {
    const m = normMobile(mobile)
    if (mode === "forgot") return email ? "" : "Enter your email"
    if (m.length !== 10)   return "Enter a valid 10-digit mobile number"
    if (!password)         return "Enter your password"
    if (mode === "signup") {
      if (!fullName.trim())   return "Enter your full name"
      if (password.length < 8) return "Password must be at least 8 characters"
      if (password !== confirm) return "Passwords do not match"
    }
    return ""
  }

  async function handleSignup() {
    const m = normMobile(mobile)
    const { data: ex } = await supabase.from("profiles").select("id").eq("mobile", m).maybeSingle()
    if (ex) { setError("Mobile number already registered. Please sign in."); setLoading(false); return }

    const { data, error: e } = await supabase.auth.signUp({
      email: mobileToEmail(m), password,
      options: { data: { full_name: fullName, mobile: m } },
    })
    if (e) { setError(e.message); setLoading(false); return }

    const uid = data.user?.id
    if (!uid) { setError("Signup failed. Try again."); setLoading(false); return }

    await supabase.from("profiles").insert({ id: uid, mobile: m, full_name: fullName })
    await supabase.from("wallets").insert({ user_id: uid, balance: 1000000 })

    setSuccess("Account created! ₹10,00,000 added to your wallet. Please sign in.")
    setMode("login")
    setLoading(false)
  }

  async function handleLogin() {
    const m = normMobile(mobile)
    const { error: e } = await supabase.auth.signInWithPassword({
      email: mobileToEmail(m), password,
    })
    if (e) { setError("Invalid mobile number or password."); setLoading(false); return }
    onAuth()
    setLoading(false)
  }

  async function handleForgot() {
    const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (e) { setError(e.message); setLoading(false); return }
    setSuccess("Password reset link sent to your email.")
    setLoading(false)
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true); setError(""); setSuccess("")
    if (mode === "signup") await handleSignup()
    if (mode === "login")  await handleLogin()
    if (mode === "forgot") await handleForgot()
  }

  const switchMode = (m: AuthMode) => { setMode(m); setError(""); setSuccess("") }

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-2xl mb-3">
            <TrendingUp className="w-7 h-7 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Virtual Trading</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signup" ? "Create account & get ₹10L virtual money" :
             mode === "forgot" ? "Reset your password" :
             "Sign in to your trading account"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">

          {/* Welcome bonus banner */}
          {mode === "signup" && (
            <div className="bg-primary/10 rounded-xl p-3 mb-5 flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <p className="text-xs font-bold text-primary">Free ₹10,00,000 Virtual Wallet</p>
                <p className="text-[11px] text-muted-foreground">Trade Equity, Options & Futures. No real money.</p>
              </div>
            </div>
          )}

          {/* Alerts */}
          {error   && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-lg px-3 py-2 mb-4">{error}</div>}
          {success && <div className="bg-success/10 border border-success/30 text-success text-xs rounded-lg px-3 py-2 mb-4">{success}</div>}

          <form onSubmit={submit} className="space-y-4">

            {/* Full name */}
            {mode === "signup" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                    placeholder="Ravi Kumar"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
            )}

            {/* Email for forgot */}
            {mode === "forgot" ? (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full px-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            ) : (
              /* Mobile */
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Mobile Number</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-r-0 border-border rounded-l-xl">
                    <Phone className="w-3.5 h-3.5 mr-1" />+91
                  </span>
                  <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)}
                    placeholder="9876543210" maxLength={10}
                    className="flex-1 px-4 py-2.5 text-sm border border-border rounded-r-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Each mobile number can only register once</p>
              </div>
            )}

            {/* Password */}
            {mode !== "forgot" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Min 8 characters" : "Enter password"}
                    className="w-full pl-9 pr-10 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm password */}
            {mode === "signup" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type={showPass ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
            )}

            {/* Forgot link */}
            {mode === "login" && (
              <div className="text-right -mt-1">
                <button type="button" onClick={() => switchMode("forgot")}
                  className="text-xs text-primary hover:underline">Forgot password?</button>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60">
              {loading
                ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                : <><span>{mode === "login" ? "Sign In" : mode === "signup" ? "Create Account & Get ₹10L" : "Send Reset Link"}</span><ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>

          {/* Mode switch */}
          <div className="mt-5 text-center text-xs text-muted-foreground">
            {mode === "login"  && <>Don't have an account? <button onClick={() => switchMode("signup")} className="text-primary font-semibold hover:underline">Sign up free</button></>}
            {mode === "signup" && <>Already have an account? <button onClick={() => switchMode("login")} className="text-primary font-semibold hover:underline">Sign in</button></>}
            {mode === "forgot" && <button onClick={() => switchMode("login")} className="text-primary font-semibold hover:underline">← Back to Sign In</button>}
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-4">
          Virtual trading only. No real money. For educational purposes. Not SEBI registered.
        </p>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// TRADE FORM
// ═════════════════════════════════════════════════════════════════════════════

function TradeForm({ userId, balance, onDone }: { userId: string; balance: number; onDone: () => void }) {
  const [inst,     setInst]     = useState<InstrumentType>("EQUITY")
  const [side,     setSide]     = useState<TradeType>("BUY")
  const [symbol,   setSymbol]   = useState("RELIANCE")
  const [qty,      setQty]      = useState(1)
  const [price,    setPrice]    = useState<number | "">("")
  const [strike,   setStrike]   = useState<number | "">("")
  const [optType,  setOptType]  = useState<OptionType>("CE")
  const [expiry,   setExpiry]   = useState("")
  const [fetching, setFetching] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")
  const [success,  setSuccess]  = useState("")

  const symbols  = inst === "EQUITY" ? EQUITY_SYMBOLS : FNO_SYMBOLS
  const lotSize  = LOT_SIZES[symbol] ?? 1
  const actualQty = inst === "EQUITY" ? qty : qty * lotSize
  const turnover  = price ? (price as number) * actualQty : 0
  const charges   = price ? calcCharges(price as number, actualQty, inst, side) : 0
  const net       = side === "BUY" ? turnover + charges : turnover - charges

  useEffect(() => { setSymbol(symbols[0]); setPrice("") }, [inst])
  useEffect(() => { setPrice("") }, [symbol])

  async function getPrice() {
    setFetching(true)
    const p = await fetchLivePrice(symbol, inst)
    if (p) setPrice(Math.round(p * 100) / 100)
    else   setError("Could not fetch price. Enter manually.")
    setFetching(false)
  }

  async function placeTrade(ev: React.FormEvent) {
    ev.preventDefault()
    setError(""); setSuccess("")
    if (!price || (price as number) <= 0) { setError("Enter a valid price"); return }
    if (qty < 1)                          { setError("Enter valid quantity"); return }
    if (inst !== "EQUITY" && !expiry)     { setError("Select expiry date"); return }
    if (inst === "OPTIONS" && !strike)    { setError("Enter strike price"); return }
    if (side === "BUY" && net > balance)  {
      setError(`Insufficient balance. Need ${fmt(net)}, have ${fmt(balance)}`); return
    }

    setLoading(true)

    // Insert position
    await supabase.from("positions").insert({
      user_id: userId, symbol, instrument_type: inst, trade_type: side,
      quantity: actualQty, avg_price: price, current_price: price,
      expiry: expiry || null,
      strike_price: inst === "OPTIONS" ? strike : null,
      option_type:  inst === "OPTIONS" ? optType : null,
      lot_size: lotSize, status: "OPEN", pnl: 0,
    })

    // Insert history
    await supabase.from("trade_history").insert({
      user_id: userId, symbol, instrument_type: inst, trade_type: side,
      quantity: actualQty, price, total_value: turnover, charges, net_value: net,
    })

    // Update wallet
    const newBal = side === "BUY" ? balance - net : balance + net
    await supabase.from("wallets").update({ balance: newBal, updated_at: new Date().toISOString() }).eq("user_id", userId)

    setSuccess(`✅ ${side} ${actualQty} ${symbol} @ ₹${price} | Charges ₹${charges.toFixed(2)}`)
    setLoading(false)
    onDone()
  }

  return (
    <form onSubmit={placeTrade} className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-base font-semibold text-foreground mb-4">Place Order</h3>

      {error   && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-lg px-3 py-2 mb-3">{error}</div>}
      {success && <div className="bg-success/10 border border-success/30 text-success text-xs rounded-lg px-3 py-2 mb-3">{success}</div>}

      {/* Instrument tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl mb-4">
        {(["EQUITY","OPTIONS","FUTURES"] as InstrumentType[]).map(t => (
          <button key={t} type="button" onClick={() => setInst(t)}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${inst === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* BUY / SELL */}
      <div className="flex gap-2 mb-4">
        {(["BUY","SELL"] as TradeType[]).map(s => (
          <button key={s} type="button" onClick={() => setSide(s)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
              side === s
                ? s === "BUY" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
                : s === "BUY" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            }`}>
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {/* Symbol */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Symbol</label>
          <div className="relative">
            <select value={symbol} onChange={e => setSymbol(e.target.value)}
              className="w-full appearance-none bg-muted border border-border rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-primary">
              {symbols.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Options extras */}
        {inst === "OPTIONS" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Strike Price ₹</label>
              <input type="number" value={strike} onChange={e => setStrike(Number(e.target.value))}
                placeholder="e.g. 24800"
                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">CE / PE</label>
              <div className="flex gap-1">
                {(["CE","PE"] as OptionType[]).map(o => (
                  <button key={o} type="button" onClick={() => setOptType(o)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${optType === o ? "bg-primary text-primary-foreground" : "bg-muted border border-border text-muted-foreground"}`}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Expiry */}
        {inst !== "EQUITY" && (
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Expiry Date</label>
            <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
        )}

        {/* Price */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
            {inst === "OPTIONS" ? "Option Premium ₹" : "Price ₹"}
          </label>
          <div className="flex gap-2">
            <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))}
              placeholder="Enter or fetch live"
              className="flex-1 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
            <button type="button" onClick={getPrice} disabled={fetching}
              className="px-3 bg-primary/10 text-primary rounded-xl text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50">
              {fetching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Live ₹"}
            </button>
          </div>
        </div>

        {/* Qty */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
            {inst === "EQUITY" ? "Quantity (shares)" : `Lots  (1 lot = ${lotSize} qty)`}
          </label>
          <input type="number" value={qty} min={1}
            onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
          {inst !== "EQUITY" && (
            <p className="text-[10px] text-muted-foreground mt-1">Total qty: {fmtN(actualQty)}</p>
          )}
        </div>

        {/* Summary */}
        {price ? (
          <div className="bg-muted rounded-xl p-3 space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Turnover</span><span className="font-mono font-semibold">{fmt(turnover)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Charges</span><span className="font-mono text-warning">+{fmt(charges)}</span></div>
            <div className="flex justify-between border-t border-border pt-1.5">
              <span className="font-semibold text-foreground">{side === "BUY" ? "Total debit" : "Total credit"}</span>
              <span className={`font-mono font-bold ${side === "BUY" ? "text-destructive" : "text-success"}`}>{fmt(net)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance after</span>
              <span className="font-mono font-semibold text-foreground">{fmt(side === "BUY" ? balance - net : balance + net)}</span>
            </div>
          </div>
        ) : null}

        <button type="submit" disabled={loading}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2 ${
            side === "BUY" ? "bg-success text-success-foreground hover:bg-success/90" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
          }`}>
          {loading
            ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            : `${side} ${inst === "EQUITY" ? `${qty} shares` : `${qty} lot${qty > 1 ? "s" : ""}`} of ${symbol}`
          }
        </button>
      </div>
    </form>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

function TradingDashboard({ userId }: { userId: string }) {
  const [balance,   setBalance]   = useState(0)
  const [positions, setPositions] = useState<any[]>([])
  const [history,   setHistory]   = useState<any[]>([])
  const [profile,   setProfile]   = useState<{ full_name: string; mobile: string } | null>(null)
  const [tab,       setTab]       = useState<"positions" | "history">("positions")
  const [loading,   setLoading]   = useState(true)
  const [closing,   setClosing]   = useState<string | null>(null)

  const load = useCallback(async () => {
    const [w, p, h, pr] = await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", userId).single(),
      supabase.from("positions").select("*").eq("user_id", userId).eq("status", "OPEN").order("opened_at", { ascending: false }),
      supabase.from("trade_history").select("*").eq("user_id", userId).order("executed_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("full_name,mobile").eq("id", userId).single(),
    ])
    if (w.data)  setBalance(w.data.balance)
    if (p.data)  setPositions(p.data)
    if (h.data)  setHistory(h.data)
    if (pr.data) setProfile(pr.data)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  async function closePos(pos: any) {
    setClosing(pos.id)
    const lp = await fetchLivePrice(pos.symbol, pos.instrument_type) ?? pos.current_price
    const pnl = (lp - pos.avg_price) * pos.quantity * (pos.trade_type === "BUY" ? 1 : -1)
    await supabase.from("positions").update({ status: "CLOSED", closed_at: new Date().toISOString(), current_price: lp, pnl }).eq("id", pos.id)
    const closeVal = lp * pos.quantity
    const ch       = calcCharges(lp, pos.quantity, pos.instrument_type, pos.trade_type === "BUY" ? "SELL" : "BUY")
    const ret      = pos.trade_type === "BUY" ? closeVal - ch : closeVal + ch
    await supabase.from("wallets").update({ balance: balance + ret, updated_at: new Date().toISOString() }).eq("user_id", userId)
    await supabase.from("trade_history").insert({
      user_id: userId, symbol: pos.symbol, instrument_type: pos.instrument_type,
      trade_type: pos.trade_type === "BUY" ? "SELL" : "BUY",
      quantity: pos.quantity, price: lp, total_value: closeVal, charges: ch, net_value: ret,
    })
    setClosing(null)
    load()
  }

  const totalPnL = positions.reduce((s, p) => s + (p.current_price - p.avg_price) * p.quantity * (p.trade_type === "BUY" ? 1 : -1), 0)

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-semibold">PAPER MONEY</span>
          {profile && <span className="text-xs text-muted-foreground hidden sm:block">{profile.full_name} · +91 {profile.mobile}</span>}
        </div>
        <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1"><Wallet className="w-3.5 h-3.5 text-primary" /><span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Available Cash</span></div>
          <div className="font-mono text-lg font-bold text-foreground">{fmt(balance)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Open Positions</p>
          <p className="text-lg font-bold text-foreground">{positions.length}</p>
        </div>
        <div className={`border rounded-xl p-4 ${totalPnL >= 0 ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"}`}>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Unrealised P&L</p>
          <div className={`font-mono text-lg font-bold flex items-center gap-1 ${totalPnL >= 0 ? "text-success" : "text-destructive"}`}>
            {totalPnL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {totalPnL >= 0 ? "+" : ""}{fmt(totalPnL)}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Total Trades</p>
          <p className="text-lg font-bold text-foreground">{history.length}</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">

        {/* Trade form */}
        <TradeForm userId={userId} balance={balance} onDone={load} />

        {/* Positions / History */}
        <div>
          <div className="flex gap-1 bg-card border border-border p-1 rounded-xl mb-4 w-fit">
            {([["positions","Positions",BarChart2],["history","History",History]] as const).map(([key, label, Icon]) => (
              <button key={key} onClick={() => setTab(key as any)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
            <button onClick={load} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" title="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {tab === "positions" ? (
            positions.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-10 text-center">
                <BarChart2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-semibold text-muted-foreground">No open positions</p>
                <p className="text-xs text-muted-foreground mt-1">Place your first trade using the form</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-muted">
                      {["Symbol","Type","B/S","Qty","Avg","Current","P&L",""].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {positions.map((pos, i) => {
                        const pnl = (pos.current_price - pos.avg_price) * pos.quantity * (pos.trade_type === "BUY" ? 1 : -1)
                        const pos_ = pnl >= 0
                        return (
                          <tr key={pos.id} className={`border-t border-border ${i % 2 ? "bg-muted/30" : ""}`}>
                            <td className="px-4 py-3">
                              <div className="font-bold text-foreground">{pos.symbol}</div>
                              {pos.instrument_type === "OPTIONS" && <div className="text-[10px] text-muted-foreground">{pos.strike_price} {pos.option_type} {pos.expiry}</div>}
                              {pos.instrument_type === "FUTURES" && <div className="text-[10px] text-muted-foreground">Fut {pos.expiry}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                pos.instrument_type === "EQUITY" ? "bg-primary/10 text-primary" :
                                pos.instrument_type === "OPTIONS" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                                "bg-warning/10 text-warning"}`}>
                                {pos.instrument_type}
                              </span>
                            </td>
                            <td className="px-4 py-3"><span className={`font-bold ${pos.trade_type === "BUY" ? "text-success" : "text-destructive"}`}>{pos.trade_type}</span></td>
                            <td className="px-4 py-3 font-mono">{fmtN(pos.quantity)}</td>
                            <td className="px-4 py-3 font-mono">₹{fmtN(pos.avg_price)}</td>
                            <td className="px-4 py-3 font-mono">₹{fmtN(pos.current_price)}</td>
                            <td className="px-4 py-3">
                              <div className={`font-mono font-bold ${pos_ ? "text-success" : "text-destructive"}`}>{pos_ ? "+" : ""}₹{fmtN(Math.abs(pnl))}</div>
                              <div className={`text-[10px] ${pos_ ? "text-success" : "text-destructive"}`}>{pos_ ? "▲" : "▼"}{Math.abs((pnl / (pos.avg_price * pos.quantity) * 100)).toFixed(2)}%</div>
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => closePos(pos)} disabled={closing === pos.id}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50">
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
          ) : (
            history.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-10 text-center">
                <History className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No trade history yet</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-muted">
                      {["Time","Symbol","Type","B/S","Qty","Price","Charges","Net"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {history.map((t, i) => (
                        <tr key={t.id} className={`border-t border-border ${i % 2 ? "bg-muted/30" : ""}`}>
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                            {new Date(t.executed_at).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-foreground">{t.symbol}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{t.instrument_type}</td>
                          <td className="px-4 py-2.5"><span className={`font-bold ${t.trade_type === "BUY" ? "text-success" : "text-destructive"}`}>{t.trade_type}</span></td>
                          <td className="px-4 py-2.5 font-mono">{fmtN(t.quantity)}</td>
                          <td className="px-4 py-2.5 font-mono">₹{fmtN(t.price)}</td>
                          <td className="px-4 py-2.5 font-mono text-warning">₹{fmtN(t.charges)}</td>
                          <td className="px-4 py-2.5 font-mono font-semibold text-foreground">₹{fmtN(t.net_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-8">
        ⚠️ Virtual trading only. No real money. Prices from Yahoo Finance (~15 min delay). Charges simulated (Zerodha model). Not SEBI registered.
      </p>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE EXPORT — keeps your existing Navbar / Footer
// ═════════════════════════════════════════════════════════════════════════════

export default function VirtualTradePage() {
  const [userId,  setUserId]  = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null)
      setChecked(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user?.id ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Virtual Trading</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Practice Equity, Options & Futures with ₹10,00,000 virtual money — zero real risk
            </p>
          </div>

          {!checked ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : userId ? (
            <TradingDashboard userId={userId} />
          ) : (
            <AuthSection onAuth={() => {
              supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
            }} />
          )}

        </div>
      </main>
      <Footer />
    </div>
  )
}
