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
  X, History, BarChart2, ChevronDown, Wallet, KeyRound,
} from "lucide-react"

// ─── NSE F&O Lot Sizes — effective 2025-26 ───────────────────────────────────
// Source: NSE circulars. Update when NSE revises: nseindia.com/circulars
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

// ─── Margin calculator (Zerodha SPAN approximation) ──────────────────────────
// Options sell: ~20-25% of notional. Futures: ~15% of notional.
// These are approximations — real margin fluctuates with volatility.
function calcOptionsMargin(spot: number, lotSize: number, lots: number): number {
  // ~20% of notional as initial margin (SPAN + Exposure approx)
  return Math.round(spot * lotSize * lots * 0.20)
}
function calcFuturesMargin(spot: number, lotSize: number, lots: number): number {
  // ~15% of notional (lower than options short margin)
  return Math.round(spot * lotSize * lots * 0.15)
}

// ─── Nifty 50 stocks only ─────────────────────────────────────────────────────
const NIFTY50_EQUITY = [
  "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","HINDUNILVR","SBIN",
  "BHARTIARTL","ITC","KOTAKBANK","LT","AXISBANK","ASIANPAINT","MARUTI",
  "TITAN","SUNPHARMA","WIPRO","HCLTECH","ONGC","COALINDIA","TATAMOTORS",
  "JSWSTEEL","BAJFINANCE","NESTLEIND","NTPC","POWERGRID","ULTRACEMCO",
  "BPCL","EICHERMOT","HEROMOTOCO","GRASIM","TATASTEEL","HINDALCO",
  "ADANIENT","BAJAJFINSV","DRREDDY","CIPLA","DIVISLAB","INDUSINDBK","TATACONSUM",
]

const NIFTY50_FNO = [
  "NIFTY","BANKNIFTY","FINNIFTY",
  ...NIFTY50_EQUITY,
]

type InstrumentType = "EQUITY" | "OPTIONS" | "FUTURES"
type TradeType      = "BUY" | "SELL"
type OptionType     = "CE" | "PE"
type AuthMode       = "login" | "signup" | "forgot" | "verify" | "otp" | "reset"

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n)
const fmtN = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)

// ─── Generate expiry dates ────────────────────────────────────────────────────
// NSE rules:
//   Nifty 50  → weekly expiry every TUESDAY
//   All others → monthly expiry = LAST TUESDAY of the contract month
//   Holiday rule → user enters date manually

function toISO(d: Date): string {
  // Use local date (not UTC) to avoid off-by-one due to timezone
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// Nifty weekly: every Tuesday for next 3 months
function getThursdaysForNext3Months(): string[] {
  const dates: string[] = []
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const end = new Date(now); end.setMonth(end.getMonth() + 3)

  const d = new Date(now)
  // days until next Tuesday (JS weekday: 0=Sun,1=Mon,2=Tue)
  let daysAhead = (2 - d.getDay() + 7) % 7
  if (daysAhead === 0) daysAhead = 7  // if today is Tuesday, go to next Tuesday
  d.setDate(d.getDate() + daysAhead)
  d.setHours(0, 0, 0, 0)

  while (d <= end) {
    dates.push(toISO(d))
    d.setDate(d.getDate() + 7)
  }
  return dates
}

// Monthly: last Tuesday of each month for next 6 months
function getMonthlyExpiries(): string[] {
  const dates: string[] = []
  const now = new Date(); now.setHours(0, 0, 0, 0)

  for (let m = 0; m < 6; m++) {
    const totalMonth = now.getMonth() + m
    const year  = now.getFullYear() + Math.floor(totalMonth / 12)
    const month = totalMonth % 12
    // Last day of this month
    const d = new Date(year, month + 1, 0)
    d.setHours(0, 0, 0, 0)
    // Walk back to last Tuesday (weekday 2)
    while (d.getDay() !== 2) d.setDate(d.getDate() - 1)
    if (d >= now) dates.push(toISO(d))
  }
  return dates
}

function formatExpiry(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })
}

// ─── Black-Scholes option pricing ────────────────────────────────────────────
function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1.0 + sign * y)
}

function blackScholes(
  S: number,      // spot price
  K: number,      // strike price
  T: number,      // time to expiry in years
  r: number,      // risk-free rate (0.065 for India)
  sigma: number,  // volatility (IV)
  type: "CE" | "PE"
): number {
  if (T <= 0) return Math.max(type === "CE" ? S - K : K - S, 0)
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)
  if (type === "CE") {
    return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2)
  } else {
    return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1)
  }
}

function calcOptionPremium(
  spot: number,
  strike: number,
  expiryDate: string,
  optType: OptionType,
  iv = 0.18 // default 18% IV — typical for Nifty
): number {
  const now   = new Date()
  const expiry = new Date(expiryDate)
  const T     = Math.max((expiry.getTime() - now.getTime()) / (365 * 24 * 60 * 60 * 1000), 0)
  const premium = blackScholes(spot, strike, T, 0.065, iv, optType)
  return Math.round(premium * 100) / 100
}

// ─── Charges calculation ──────────────────────────────────────────────────────
function calcCharges(premium: number, qty: number, type: InstrumentType, side: TradeType) {
  // For options: turnover = premium * qty (NOT spot * qty)
  const to        = premium * qty
  const brokerage = type === "EQUITY" ? Math.min(20, to * 0.0003) : 20
  const stt       = side === "SELL" && type === "EQUITY" ? to * 0.001
                  : side === "SELL" && type === "OPTIONS" ? to * 0.0005 : 0
  const other     = to * 0.0000695
  const stamp     = side === "BUY" ? to * 0.00015 : 0
  return Math.round((brokerage + stt + other + stamp) * 100) / 100
}

// ─── Live price fetch (Yahoo Finance via CORS proxy) ─────────────────────────
// Returns null on failure — caller should show last known price
async function fetchLivePrice(symbol: string, type: InstrumentType): Promise<number | null> {
  const ySym = type === "EQUITY"         ? `${symbol}.NS`
             : symbol === "NIFTY"        ? "^NSEI"
             : symbol === "BANKNIFTY"    ? "^NSEBANK"
             : symbol === "FINNIFTY"     ? "^NSEMDCP50"
             : symbol === "MIDCPNIFTY"   ? "^NSEMDCP50"
             : `${symbol}.NS`

  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=1m&range=1d`

  // Try proxy 1
  try {
    const res  = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(yahooUrl)}`, { cache: "no-store" })
    if (res.ok) {
      const body = await res.json()
      const json = JSON.parse(body.contents)
      const p    = json?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (p && p > 0) return Math.round(p * 100) / 100
    }
  } catch { /* fall through */ }

  // Try proxy 2
  try {
    const res2 = await fetch(
      `https://corsproxy.io/?${encodeURIComponent(`https://query2.finance.yahoo.com/v8/finance/chart/${ySym}?interval=1m&range=1d`)}`,
      { cache: "no-store" }
    )
    if (res2.ok) {
      const json2 = await res2.json()
      const p2    = json2?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (p2 && p2 > 0) return Math.round(p2 * 100) / 100
    }
  } catch { /* give up */ }

  return null
}

// Fetch live prices for multiple symbols in parallel
async function fetchLivePrices(
  items: { symbol: string; instrument: InstrumentType }[]
): Promise<Record<string, number>> {
  const unique = Array.from(
    new Map(items.map(i => [`${i.symbol}__${i.instrument}`, i])).values()
  )
  const results = await Promise.allSettled(
    unique.map(i => fetchLivePrice(i.symbol, i.instrument).then(p => ({ key: `${i.symbol}__${i.instrument}`, p })))
  )
  const out: Record<string, number> = {}
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.p !== null) {
      out[r.value.key] = r.value.p
    }
  }
  return out
}

// ═════════════════════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════
// AUTH
// ═════════════════════════════════════════════════════════════════════════════

function AuthSection({ onAuth, initialMode = "login" }: { onAuth: () => void; initialMode?: AuthMode }) {
  const [mode,     setMode]     = useState<AuthMode>(initialMode)
  const [mobile,   setMobile]   = useState("")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [confirm,  setConfirm]  = useState("")
  const [fullName, setFullName] = useState("")
  const [otp,      setOtp]      = useState("")
  const [otpRefs]               = useState(() => Array.from({ length: 6 }, () => ({ current: null as HTMLInputElement | null })))
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [resendCD, setResendCD] = useState(0)
  const [error,    setError]    = useState("")
  const [success,  setSuccess]  = useState("")
  // Saved signup data to upsert profile after OTP verify
  const [pendingUid,    setPendingUid]    = useState("")
  const [pendingMobile, setPendingMobile] = useState("")

  const normMobile = (m: string) => m.replace(/\D/g, "").slice(-10)

  // Resend countdown timer
  useEffect(() => {
    if (resendCD <= 0) return
    const t = setTimeout(() => setResendCD(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCD])

  // Recovery mode is controlled by parent VirtualTradePage via initialMode prop.

  function validate() {
    if (mode === "otp") {
      if (otp.replace(/\D/g, "").length !== 6) return "Enter the 6-digit code sent to your email"
      return ""
    }
    if (mode === "forgot") return email ? "" : "Enter your registered email"
    if (mode === "reset") {
      if (!password)             return "Enter new password"
      if (password.length < 8)  return "Password must be at least 8 characters"
      if (password !== confirm)  return "Passwords do not match"
      return ""
    }
    if (mode === "login") {
      const isEmail = /\S+@\S+\.\S+/.test(mobile.trim())
      if (!isEmail && normMobile(mobile).length !== 10) return "Enter a valid 10-digit mobile number or email address"
      if (!password) return "Enter your password"
      return ""
    }
    // signup
    const m = normMobile(mobile)
    if (m.length !== 10)                      return "Enter a valid 10-digit mobile number"
    if (!fullName.trim())                     return "Enter your full name"
    if (!email.trim())                        return "Enter your email address"
    if (!/\S+@\S+\.\S+/.test(email))         return "Enter a valid email"
    if (!password)                            return "Enter your password"
    if (password.length < 8)                 return "Password must be at least 8 characters"
    if (password !== confirm)                return "Passwords do not match"
    return ""
  }

  // ── Signup: create user then send Supabase OTP ─────────────────────────────────
  async function handleSignup() {
    const m = normMobile(mobile)

    // Check mobile uniqueness via RPC (bypasses RLS)
    const { data: mobileExists } = await supabase.rpc("mobile_registered", { p_mobile: m })
    if (mobileExists) {
      setError("Mobile number already registered. Please sign in.")
      setLoading(false); return
    }

    // Step 1: Create the auth user with email+password.
    // We set shouldSendConfirmationEmail implicitly via signUp.
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/virtual-trade`,
        data: { full_name: fullName, mobile: m },
      },
    })

    if (signUpErr) {
      if (signUpErr.message.toLowerCase().includes("already registered") ||
          signUpErr.message.toLowerCase().includes("already exists")) {
        setError("Email already registered. Please sign in or use Forgot Password.")
      } else {
        setError(signUpErr.message)
      }
      setLoading(false); return
    }

    const uid = data.user?.id

    // Save profile + wallet if we have a uid (user confirmed or auto-confirmed)
    if (uid) {
      await supabase.from("profiles").upsert({
        id: uid, mobile: m, full_name: fullName, email: email.toLowerCase(),
      })
      const { data: existingWallet } = await supabase
        .from("wallets").select("id").eq("user_id", uid).maybeSingle()
      if (!existingWallet) {
        await supabase.from("wallets").insert({ user_id: uid, balance: 1000000 })
      }
    }
    // Whether uid exists or not, Supabase has sent a confirmation email.
    // Show the verify screen — user must click the link to activate account.
    setMode("verify")
    setLoading(false)
  }

    // ── Verify OTP (after signup) ──────────────────────────────────────────
  async function handleVerifyOtp() {
    const code = otp.replace(/\s/g, "")

    // Verify using Supabase’s native OTP verifier.
    // type "email" covers both signup confirmation and signInWithOtp codes.
    const { data, error: e } = await supabase.auth.verifyOtp({
      email: email.toLowerCase(),
      token: code,
      type: "email",
    })

    if (e || !data.session) {
      setError("Invalid or expired code. Please check the code or click Resend.")
      setLoading(false); return
    }

    onAuth()
    setLoading(false)
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────────────────
  async function handleResendOtp() {
    setError(""); setSuccess(""); setResendCD(60)
    const { error: e } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: { shouldCreateUser: false },
    })
    if (e) { setError(e.message); setResendCD(0); return }
    setSuccess("New code sent! Check your inbox.")
  }

    // ── Login ─────────────────────────────────────────────────────────────────
  async function handleLogin() {
    const isEmail = /\S+@\S+\.\S+/.test(mobile.trim())
    let loginEmail = ""

    if (isEmail) {
      loginEmail = mobile.trim().toLowerCase()
    } else {
      const m = normMobile(mobile)
      // Try plain 10-digit first, then with +91 prefix (handles both storage formats)
      let foundEmail: string | null = null
      const { data: d1 } = await supabase.rpc("get_email_by_mobile", { p_mobile: m })
      if (d1) {
        foundEmail = d1 as string
      } else {
        const { data: d2 } = await supabase.rpc("get_email_by_mobile", { p_mobile: "+91" + m })
        if (d2) foundEmail = d2 as string
      }
      if (!foundEmail) {
        setError("Mobile number not registered. Please sign up first, or log in with your email address.")
        setLoading(false); return
      }
      loginEmail = foundEmail
    }

    const { error: e } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (e) {
      if (e.message.toLowerCase().includes("email not confirmed")) {
        setError("Email not verified. Check your inbox for the OTP or verification link, or sign up again.")
      } else if (e.message.toLowerCase().includes("invalid login") ||
                 e.message.toLowerCase().includes("invalid credentials")) {
        setError("Wrong password. Try again or use Forgot Password.")
      } else {
        setError(e.message)
      }
      setLoading(false); return
    }

    onAuth()
    setLoading(false)
  }

  // ── Forgot password ───────────────────────────────────────────────────────
  async function handleForgot() {
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
      redirectTo: `${window.location.origin}/virtual-trade`,
    })
    if (e) { setError(e.message); setLoading(false); return }
    setSuccess("Reset link sent! Check your inbox and spam folder.")
    setLoading(false)
  }

  // ── Reset password (after clicking email link) ────────────────────────────
  async function handleReset() {
    const { error: e } = await supabase.auth.updateUser({ password })
    if (e) { setError(e.message); setLoading(false); return }
    setSuccess("Password updated successfully!")
    window.history.replaceState({}, document.title, window.location.pathname)
    setTimeout(() => { setMode("login"); setPassword(""); setConfirm("") }, 1500)
    setLoading(false)
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true); setError(""); setSuccess("")
    if (mode === "signup") await handleSignup()
    if (mode === "login")  await handleLogin()
    if (mode === "otp")    await handleVerifyOtp()
    if (mode === "forgot") await handleForgot()
    if (mode === "reset")  await handleReset()
  }

  const switchMode = (m: AuthMode) => {
    setMode(m); setError(""); setSuccess("")
    setMobile(""); setEmail(""); setPassword(""); setConfirm(""); setFullName(""); setOtp("")
  }

  // ── OTP input: auto-advance on digit entry ────────────────────────────────
  function handleOtpKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    const val = e.key
    if (/^\d$/.test(val)) {
      const arr = otp.split("")
      arr[i] = val
      const next = arr.join("")
      setOtp(next.padEnd(6, " ").slice(0, 6))
      if (i < 5) otpRefs[i + 1].current?.focus()
      e.preventDefault()
    } else if (val === "Backspace") {
      const arr = otp.split("")
      arr[i] = " "
      setOtp(arr.join(""))
      if (i > 0) otpRefs[i - 1].current?.focus()
      e.preventDefault()
    }
  }

  // ── OTP screen ────────────────────────────────────────────────────────────
  if (mode === "otp") {
    const digits = otp.padEnd(6, " ").split("")
    return (
      <div className="min-h-[70vh] flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Check your email</h2>
            <p className="text-sm text-muted-foreground mt-2">
              We sent a 6-digit code to <strong>{email}</strong>
            </p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6">
            {error   && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-lg px-3 py-2 mb-4">{error}</div>}
            {success && <div className="bg-success/10 border border-success/30 text-success text-xs rounded-lg px-3 py-2 mb-4">{success}</div>}
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-3 block text-center">Enter verification code</label>
                <div className="flex gap-2 justify-center">
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs[i].current = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d.trim()}
                      onKeyDown={e => handleOtpKey(i, e)}
                      onChange={() => {}}
                      onFocus={e => e.target.select()}
                      className="w-11 h-12 text-center text-lg font-bold border-2 border-border rounded-xl bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                    />
                  ))}
                </div>
              </div>
              <button type="submit" disabled={loading || otp.replace(/\s/g, "").length < 6}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60">
                {loading
                  ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  : <><span>Verify & Continue</span><ArrowRight className="w-4 h-4" /></>
                }
              </button>
            </form>
            <div className="mt-4 text-center">
              {resendCD > 0 ? (
                <p className="text-xs text-muted-foreground">Resend code in <span className="font-semibold text-foreground">{resendCD}s</span></p>
              ) : (
                <button onClick={handleResendOtp} className="text-xs text-primary hover:underline font-semibold">
                  Didn't receive it? Resend code
                </button>
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-3">
              Check spam/junk if you don't see it in inbox
            </p>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">
            Wrong email?{" "}
            <button onClick={() => switchMode("signup")} className="text-primary hover:underline font-semibold">Start over</button>
          </p>
        </div>
      </div>
    )
  }

  // ── Verify screen ────────────────────────────────────────────────────────
  if (mode === "verify") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl mb-4">
            <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Verification link sent!</h2>
          <p className="text-muted-foreground text-sm mb-1">Please check your inbox at</p>
          <p className="font-bold text-foreground text-sm mb-6">{email}</p>
          <div className="bg-card border border-border rounded-2xl p-5 text-left space-y-3 mb-6">
            {[
              "Open your email inbox",
              "Click the confirmation link from MarketGreeks",
              "You will be automatically signed in after confirming",
              "Check spam/junk folder if you don’t see it",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 bg-primary text-primary-foreground">
                  {i + 1}
                </span>
                <p className="text-xs text-muted-foreground">{step}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Wrong email?{" "}
            <button onClick={() => switchMode("signup")} className="text-primary hover:underline font-semibold">Sign up again</button>
          </p>
        </div>
      </div>
    )
  }

  // ── Reset password screen ─────────────────────────────────────────────────
  if (mode === "reset") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-2xl mb-3">
              <KeyRound className="w-7 h-7 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Set New Password</h2>
            <p className="text-sm text-muted-foreground mt-1">Choose a strong password for your account</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6">
            {error   && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-lg px-3 py-2 mb-4">{error}</div>}
            {success && <div className="bg-success/10 border border-success/30 text-success text-xs rounded-lg px-3 py-2 mb-4">{success}</div>}
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full pl-9 pr-10 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type={showPass ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60">
                {loading
                  ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  : <><span>Update Password</span><ArrowRight className="w-4 h-4" /></>
                }
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // ── Main auth form (login / signup / forgot) ──────────────────────────────
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
            : "Sign in with mobile number or email"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          {mode === "signup" && (
            <div className="bg-primary/10 rounded-xl p-3 mb-5 flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <p className="text-xs font-bold text-primary">Free ₹10,00,000 Virtual Wallet</p>
                <p className="text-[11px] text-muted-foreground">Trade Nifty 50 Equity, Options & Futures. No real money.</p>
              </div>
            </div>
          )}

          {error   && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-lg px-3 py-2 mb-4">{error}</div>}
          {success && <div className="bg-success/10 border border-success/30 text-success text-xs rounded-lg px-3 py-2 mb-4">{success}</div>}

          <form onSubmit={submit} className="space-y-4">
            {/* Full name — signup only */}
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

            {/* Mobile — signup; mobile or email — login */}
            {mode !== "forgot" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  {mode === "login" ? "Mobile Number or Email" : "Mobile Number"}
                </label>
                {mode === "login" ? (
                  <input type="text" value={mobile} onChange={e => setMobile(e.target.value)}
                    placeholder="9876543210 or you@email.com"
                    className="w-full px-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                ) : (
                  <div className="flex">
                    <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-r-0 border-border rounded-l-xl">
                      <Phone className="w-3.5 h-3.5 mr-1" />+91
                    </span>
                    <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="9876543210" maxLength={10}
                      className="flex-1 px-4 py-2.5 text-sm border border-border rounded-r-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                )}
                {mode === "signup" && <p className="text-[10px] text-muted-foreground mt-1">Used for login. Each number registers only once.</p>}
              </div>
            )}

            {/* Email — signup + forgot */}
            {(mode === "signup" || mode === "forgot") && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  {mode === "signup" ? "Email Address" : "Registered Email Address"}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@gmail.com"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                {mode === "signup" && <p className="text-[10px] text-muted-foreground mt-1">A 6-digit OTP will be sent here to verify your account.</p>}
              </div>
            )}

            {/* Password — login + signup */}
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

            {/* Confirm password — signup only */}
            {mode === "signup" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type={showPass ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
            )}

            {mode === "login" && (
              <div className="text-right -mt-1">
                <button type="button" onClick={() => switchMode("forgot")} className="text-xs text-primary hover:underline">Forgot password?</button>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60">
              {loading
                ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                : <><span>{mode === "login" ? "Sign In" : mode === "signup" ? "Create Account & Send OTP" : "Send Reset Link"}</span><ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>

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
  const [inst,      setInst]      = useState<InstrumentType>("EQUITY")
  const [side,      setSide]      = useState<TradeType>("BUY")
  const [symbol,    setSymbol]    = useState("RELIANCE")
  const [qty,       setQty]       = useState(1)
  const [price,     setPrice]     = useState<number | "">("")
  const [strike,    setStrike]    = useState<number | "">("")
  const [optType,   setOptType]   = useState<OptionType>("CE")
  const [expiry,    setExpiry]    = useState("")
  const [manualExpiry, setManualExpiry] = useState(false)
  const [fetching,  setFetching]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState("")
  const [success,   setSuccess]   = useState("")
  const [spotPrice, setSpotPrice] = useState<number | null>(null)
  const [lotSizeOverride, setLotSizeOverride] = useState<number | "">("")  // manual lot size override

  const symbols  = inst === "EQUITY" ? NIFTY50_EQUITY : NIFTY50_FNO
  const defaultLotSize = LOT_SIZES[symbol] ?? 1
  const lotSize  = (lotSizeOverride !== "" && (lotSizeOverride as number) > 0) ? (lotSizeOverride as number) : defaultLotSize
  const actualQty = inst === "EQUITY" ? qty : qty * lotSize

  // Expiry options — weekly for Nifty, monthly for others
  const expiryOptions = symbol === "NIFTY"
    ? getThursdaysForNext3Months()
    : getMonthlyExpiries()

  // For options: cost = premium * qty (not spot * qty)
  // For equity/futures: cost = price * qty
  const premiumPerUnit = price as number || 0
  const turnover = premiumPerUnit * actualQty
  const charges  = premiumPerUnit ? calcCharges(premiumPerUnit, actualQty, inst, side) : 0
  const net      = side === "BUY" ? turnover + charges : turnover - charges

  useEffect(() => { setSymbol(symbols[0]); setPrice(""); setSpotPrice(null); setLotSizeOverride("") }, [inst])
  useEffect(() => { setPrice(""); setSpotPrice(null); setLotSizeOverride("") }, [symbol])
  useEffect(() => {
    if (expiryOptions.length > 0 && !expiry) setExpiry(expiryOptions[0])
  }, [symbol, inst])

  // When user enters spot price manually for options, recalc BS premium
  function recalcBS(spot: number) {
    if (inst === "OPTIONS" && spot > 0 && strike && expiry) {
      const bs = calcOptionPremium(spot, strike as number, expiry, optType)
      setPrice(bs)
      setSpotPrice(spot)
    }
  }

  async function fetchPrice() {
    setFetching(true); setError("")
    const p = await fetchLivePrice(symbol, inst)
    if (p) {
      if (inst === "OPTIONS") {
        setSpotPrice(p)
        if (strike && expiry) {
          setPrice(calcOptionPremium(p, strike as number, expiry, optType))
        }
      } else {
        setPrice(p)
      }
    } else {
      setError("Could not fetch live price. Enter manually.")
    }
    setFetching(false)
  }

  // Auto-recalculate BS premium when strike/expiry/optType changes (if spot already entered)
  useEffect(() => {
    if (inst === "OPTIONS" && spotPrice && strike && expiry) {
      const bs = calcOptionPremium(spotPrice, strike as number, expiry, optType)
      setPrice(bs)
    }
  }, [strike, expiry, optType, spotPrice, inst])

  async function placeTrade(ev: React.FormEvent) {
    ev.preventDefault()
    setError(""); setSuccess("")

    if (!price || (price as number) <= 0) { setError("Enter or fetch a valid price"); return }
    if (qty < 1)                           { setError("Enter valid quantity"); return }
    if (inst !== "EQUITY" && !expiry)      { setError("Select expiry date"); return }
    if (inst === "OPTIONS" && !strike)     { setError("Enter strike price"); return }

    setLoading(true)

    // ── Local variables to avoid stale closure bugs ───────────────────────────
    const tradePrice    = price as number
    const tradeQty      = actualQty   // shares for equity, lots×lotSize for F&O
    const tradeTurnover = tradePrice * tradeQty
    const tradeCharges  = calcCharges(tradePrice, tradeQty, inst, side)

    // ── WALLET IMPACT LOGIC ──────────────────────────────────────────────────
    // EQUITY BUY:         debit  full value + charges
    // EQUITY SELL:        credit full value − charges
    // OPTIONS BUY:        debit  premium × qty + charges  (not notional!)
    // OPTIONS SELL:       debit  margin (blocked); P&L settled on exit
    // FUTURES BUY/SELL:   debit  margin (blocked)
    let walletDebit  = 0  // amount to subtract from wallet
    let walletCredit = 0  // amount to add to wallet
    let marginBlocked = 0 // stored in position for future release

    if (inst === "EQUITY") {
      if (side === "BUY")  walletDebit  = tradeTurnover + tradeCharges
      else                  walletCredit = tradeTurnover - tradeCharges
    } else if (inst === "OPTIONS") {
      if (side === "BUY") {
        // Only premium × qty is debited
        walletDebit = tradeTurnover + tradeCharges
      } else {
        // SELL: block margin based on strike price (best proxy for spot when not fetched)
        // spotPrice is only set if user clicked "Auto BS". Otherwise use strike.
        const spotForMargin = spotPrice ?? (strike as number)
        marginBlocked = calcOptionsMargin(spotForMargin, lotSize, qty)
        walletDebit = marginBlocked
      }
    } else {
      // FUTURES: margin based on futures price (close to spot)
      marginBlocked = calcFuturesMargin(tradePrice, lotSize, qty)
      walletDebit = marginBlocked
    }

    const tradeNet = walletDebit > 0 ? walletDebit : walletCredit

    // ── Fetch FRESH wallet balance ────────────────────────────────────────────
    const { data: walletData, error: walletFetchErr } = await supabase
      .from("wallets").select("balance").eq("user_id", userId).single()
    if (walletFetchErr || !walletData) {
      setError("Could not read wallet balance. Please refresh and try again.")
      setLoading(false); return
    }
    const freshBalance = walletData.balance

    if (walletDebit > freshBalance) {
      setError(`Insufficient balance. Need ${fmt(walletDebit)}, have ${fmt(freshBalance)}`)
      setLoading(false); return
    }

    // ── Check for existing open position to average ───────────────────────────
    const matchQuery = supabase
      .from("positions")
      .select("id, quantity, entry_price, avg_price, margin_blocked")
      .eq("user_id", userId)
      .eq("symbol", symbol)
      .eq("instrument", inst)
      .eq("trade_type", side)
      .eq("status", "OPEN")
    if (inst !== "EQUITY") matchQuery.eq("expiry", expiry || "")
    if (inst === "OPTIONS") matchQuery.eq("strike_price", strike as number).eq("option_type", optType)

    const { data: existing } = await matchQuery.maybeSingle()

    if (existing) {
      const oldQty   = existing.quantity
      const oldAvg   = existing.avg_price ?? existing.entry_price
      const newTotalQty = oldQty + tradeQty
      const newAvg   = Math.round(((oldQty * oldAvg) + (tradeQty * tradePrice)) / newTotalQty * 100) / 100
      const newMargin = (existing.margin_blocked ?? 0) + marginBlocked

      const { error: updErr } = await supabase
        .from("positions")
        .update({ quantity: newTotalQty, avg_price: newAvg, current_price: tradePrice, margin_blocked: newMargin })
        .eq("id", existing.id)

      if (updErr) {
        setError(`Failed to update position: ${updErr.message}`)
        setLoading(false); return
      }
    } else {
      const { error: posErr } = await supabase.from("positions").insert({
        user_id:       userId,
        symbol,
        instrument:    inst,
        trade_type:    side,
        quantity:      tradeQty,
        entry_price:   tradePrice,
        avg_price:     tradePrice,
        current_price: tradePrice,
        expiry:        expiry || null,
        strike_price:  inst === "OPTIONS" ? strike : null,
        option_type:   inst === "OPTIONS" ? optType : null,
        lot_size:      lotSize,
        margin_blocked: marginBlocked,
        status:        "OPEN",
        pnl:           0,
      })
      if (posErr) {
        setError(`Failed to place trade: ${posErr.message}`)
        setLoading(false); return
      }
    }

    // ── Insert trade history ──────────────────────────────────────────────────
    const now = new Date().toISOString()
    await supabase.from("trade_history").insert({
      user_id:        userId,
      symbol,
      instrument:     inst,
      trade_type:     side,
      quantity:       tradeQty,
      price:          tradePrice,
      total_value:    tradeTurnover,
      charges:        tradeCharges,
      net_value:      tradeNet,
      margin_blocked: marginBlocked,
      expiry:         expiry || null,
      strike_price:   inst === "OPTIONS" ? strike : null,
      option_type:    inst === "OPTIONS" ? optType : null,
      executed_at:    now,
      created_at:     now,
    })

    // ── Update wallet ─────────────────────────────────────────────────────────
    const newBalance = freshBalance - walletDebit + walletCredit
    const { error: walletErr } = await supabase
      .from("wallets").update({ balance: newBalance }).eq("user_id", userId)

    if (walletErr) {
      setError(`Trade saved but wallet update failed: ${walletErr.message}`)
      setLoading(false); return
    }

    // ── Success message ───────────────────────────────────────────────────────
    let msg = ""
    if (inst === "OPTIONS" && side === "BUY") {
      msg = `✅ Bought ${qty} lot${qty > 1 ? "s" : ""} ${symbol} ${strike}${optType} @ ₹${tradePrice} premium | Debited ₹${fmtN(tradeTurnover)} + charges`
    } else if (inst === "OPTIONS" && side === "SELL") {
      msg = `✅ Sold ${qty} lot${qty > 1 ? "s" : ""} ${symbol} ${strike}${optType} @ ₹${tradePrice} | Margin blocked ₹${fmtN(marginBlocked)}`
    } else if (inst === "FUTURES") {
      msg = `✅ ${side} ${qty} lot${qty > 1 ? "s" : ""} ${symbol} Futures @ ₹${tradePrice} | Margin blocked ₹${fmtN(marginBlocked)}`
    } else {
      msg = `✅ ${side} ${tradeQty} ${symbol} @ ₹${tradePrice} | Total ₹${fmt(tradeTurnover)} | Charges ₹${tradeCharges.toFixed(2)}`
    }
    setSuccess(msg)
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
          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
            Symbol <span className="text-primary">(Nifty 50)</span>
          </label>
          <div className="relative">
            <select value={symbol} onChange={e => setSymbol(e.target.value)}
              className="w-full appearance-none bg-muted border border-border rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-primary">
              {symbols.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Expiry — options and futures */}
        {inst !== "EQUITY" && (
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
              Expiry Date {symbol === "NIFTY" && <span className="text-primary">(Weekly · Every Tuesday)</span>}
            </label>
            {!manualExpiry ? (
              <>
                <div className="relative">
                  <select value={expiry} onChange={e => setExpiry(e.target.value)}
                    className="w-full appearance-none bg-muted border border-border rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-primary">
                    {expiryOptions.map(d => (
                      <option key={d} value={d}>{formatExpiry(d)}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                <button type="button" onClick={() => { setManualExpiry(true); setExpiry("") }}
                  className="text-[10px] text-primary hover:underline mt-1 block">
                  Holiday? Enter expiry manually
                </button>
              </>
            ) : (
              <>
                <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-primary" />
                <button type="button" onClick={() => { setManualExpiry(false); setExpiry(expiryOptions[0] ?? "") }}
                  className="text-[10px] text-primary hover:underline mt-1 block">
                  ← Back to standard dates
                </button>
              </>
            )}
          </div>
        )}

        {/* Options: strike + CE/PE */}
        {inst === "OPTIONS" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Strike Price ₹</label>
              <input type="number" value={strike} onChange={e => setStrike(Number(e.target.value))}
                placeholder="e.g. 24800" step="50"
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

        {/* Price / Premium */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
            {inst === "OPTIONS" ? "Option Premium ₹" : "Price ₹"}
          </label>
          {inst === "OPTIONS" ? (
            <>
              <div className="flex gap-2">
                <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))}
                  placeholder="Enter premium (e.g. 86)"
                  className="flex-1 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
                <button type="button" onClick={fetchPrice} disabled={fetching}
                  title="Fetch spot price and auto-calculate premium via Black-Scholes"
                  className="px-3 bg-primary/10 text-primary rounded-xl text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1">
                  {fetching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Auto BS"}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Enter premium manually, or click <strong>Auto BS</strong> to fetch spot price &amp; calculate via Black-Scholes (IV 18%)
                {spotPrice ? ` · Spot fetched: ₹${fmtN(spotPrice)}` : ""}
              </p>
            </>
          ) : (
            <div className="flex gap-2">
              <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))}
                placeholder="Enter or fetch live price"
                className="flex-1 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
              <button type="button" onClick={fetchPrice} disabled={fetching}
                className="px-3 bg-primary/10 text-primary rounded-xl text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1">
                {fetching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Live ₹"}
              </button>
            </div>
          )}
        </div>

        {/* Quantity */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
            {inst === "EQUITY" ? "Quantity (shares)" : "Lots"}
          </label>
          <input type="number" value={qty} min={1} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
          {inst !== "EQUITY" && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Lot size <span className="text-primary">(NSE default: {fmtN(defaultLotSize)})</span>
                </label>
                {lotSizeOverride !== "" && (
                  <button type="button" onClick={() => setLotSizeOverride("")}
                    className="text-[10px] text-primary hover:underline">Reset to default</button>
                )}
              </div>
              <input
                type="number" value={lotSizeOverride === "" ? defaultLotSize : lotSizeOverride}
                min={1}
                onChange={e => {
                  const v = parseInt(e.target.value) || 1
                  setLotSizeOverride(v === defaultLotSize ? "" : v)
                }}
                className={`w-full bg-muted border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary ${lotSizeOverride !== "" ? "border-warning text-warning font-semibold" : "border-border"}`}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Total qty: <strong>{fmtN(actualQty)}</strong> shares
                {lotSizeOverride !== "" && <span className="text-warning ml-1">⚠ Custom lot size</span>}
              </p>
            </div>
          )}
        </div>

        {/* Order summary */}
        {price ? (() => {
          const p = price as number
          const marginForSell = (inst === "OPTIONS" && side === "SELL")
            ? calcOptionsMargin(spotPrice ?? (strike as number) ?? (price as number), lotSize, qty)
            : (inst === "FUTURES")
            ? calcFuturesMargin(price as number, lotSize, qty)
            : 0
          const displayDebit = (inst === "OPTIONS" && side === "SELL") || inst === "FUTURES"
            ? marginForSell
            : inst === "OPTIONS" ? turnover + charges
            : side === "BUY" ? turnover + charges : 0
          const displayCredit = (inst === "EQUITY" && side === "SELL") ? turnover - charges : 0
          const balAfter = balance - displayDebit + displayCredit

          return (
          <div className="bg-muted rounded-xl p-3 space-y-1.5 text-xs">
            {inst === "OPTIONS" && side === "BUY" && (
              <div className="flex justify-between text-primary font-semibold border-b border-border pb-1.5 mb-1">
                <span>Premium × Qty</span>
                <span className="font-mono">₹{fmtN(p)} × {actualQty} = {fmt(turnover)}</span>
              </div>
            )}
            {(inst === "OPTIONS" || inst === "FUTURES") && side === "SELL" && (
              <div className="flex justify-between text-warning font-semibold border-b border-border pb-1.5 mb-1">
                <span>Margin blocked (SPAN approx)</span>
                <span className="font-mono">{fmt(marginForSell)}</span>
              </div>
            )}
            {inst === "EQUITY" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Turnover</span>
                <span className="font-mono font-semibold">{fmt(turnover)}</span>
              </div>
            )}
            {(inst === "OPTIONS" && side === "BUY") && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Premium</span>
                <span className="font-mono font-semibold">{fmt(turnover)}</span>
              </div>
            )}
            {inst !== "OPTIONS" || side === "BUY" ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Charges</span>
                <span className="font-mono text-warning">+{fmt(charges)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-border pt-1.5">
              <span className="font-semibold text-foreground">
                {(inst === "OPTIONS" || inst === "FUTURES") && side === "SELL" ? "Margin blocked" : side === "BUY" ? "Total debit" : "Total credit"}
              </span>
              <span className={`font-mono font-bold ${displayDebit > 0 ? "text-destructive" : "text-success"}`}>
                {displayDebit > 0 ? fmt(displayDebit) : fmt(displayCredit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance after</span>
              <span className="font-mono font-semibold">{fmt(balAfter)}</span>
            </div>
            {(inst === "OPTIONS" || inst === "FUTURES") && side === "SELL" && (
              <p className="text-[10px] text-warning/80 pt-1 border-t border-border">
                ⚠️ If loss reaches margin, position auto squares off
              </p>
            )}
            {inst === "OPTIONS" && side === "BUY" && (
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                At expiry — worthless if OTM. P&L = (exit premium − entry premium) × {actualQty}
              </p>
            )}
          </div>
          )
        })() : null}

        <button type="submit" disabled={loading}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2 ${
            side === "BUY" ? "bg-success text-success-foreground hover:bg-success/90" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
          }`}>
          {loading
            ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            : inst === "OPTIONS"
              ? `${side} ${qty} lot${qty > 1 ? "s" : ""} ${symbol} ${strike || ""}${optType}`
              : `${side} ${inst === "EQUITY" ? `${qty} shares` : `${qty} lot${qty > 1 ? "s" : ""}`} of ${symbol}`
          }
        </button>
      </div>
    </form>
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
  const [tab,        setTab]        = useState<"positions" | "history">("positions")
  const [loading,    setLoading]    = useState(true)
  const [closing,    setClosing]    = useState<string | null>(null)
  // live prices: key = "SYMBOL__INSTRUMENT"
  const [livePrices, setLivePrices] = useState<Record<string, number>>({})
  const [priceTs,    setPriceTs]    = useState<Date | null>(null)   // last updated timestamp
  const [fetching,   setFetching]   = useState(false)
  const positionsRef = useRef<any[]>([])

  const load = useCallback(async () => {
    const [w, p, h, pr] = await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", userId).single(),
      supabase.from("positions").select("*").eq("user_id", userId).eq("status", "OPEN").order("opened_at", { ascending: false }),
    supabase.from("trade_history").select("*").eq("user_id", userId).order("executed_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("full_name,mobile").eq("id", userId).single(),
    ])
    if (w.data)  setBalance(w.data.balance)
    if (p.data)  { setPositions(p.data); positionsRef.current = p.data }
    if (h.data)  setHistory(h.data)
    if (pr.data) setProfile(pr.data)
    setLoading(false)
  }, [userId])

  // ── Fetch live prices for all open positions ────────────────────────────────
  const refreshLivePrices = useCallback(async () => {
    const pos = positionsRef.current
    if (pos.length === 0) return
    setFetching(true)
    const items = pos.map((p: any) => ({ symbol: p.symbol, instrument: p.instrument as InstrumentType }))
    const prices = await fetchLivePrices(items)
    if (Object.keys(prices).length > 0) {
      setLivePrices(prev => ({ ...prev, ...prices }))
      setPriceTs(new Date())
      // Persist current_price to DB silently so close uses latest price.
      // IMPORTANT: Skip OPTIONS — Yahoo returns spot price, not option premium.
      // OPTIONS current_price must stay as the last known premium (set at trade entry or manual update).
      await Promise.all(
        pos.map((p: any) => {
          if (p.instrument === "OPTIONS") return Promise.resolve()  // never overwrite premium with spot
          const lp = prices[`${p.symbol}__${p.instrument}`]
          if (lp) return supabase.from("positions").update({ current_price: lp }).eq("id", p.id)
          return Promise.resolve()
        })
      )
    }
    setFetching(false)
  }, [])

  useEffect(() => {
    load().then(() => {
      // After positions load, check for expired options and auto square-offs
      setTimeout(() => {
        checkExpiry()
        checkSquareOff()
      }, 1500)
    })
  }, [load]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh prices every 30s
  useEffect(() => {
    // Initial fetch after positions load
    const init = setTimeout(() => refreshLivePrices(), 500)
    const interval = setInterval(() => refreshLivePrices(), 30_000)
    return () => { clearTimeout(init); clearInterval(interval) }
  }, [refreshLivePrices])

  // Re-trigger price fetch when positions change (new trade placed)
  const posLen = positions.length
  useEffect(() => {
    if (posLen > 0) refreshLivePrices()
  }, [posLen, refreshLivePrices])

  async function closePos(pos: any, forcePrice?: number) {
    setClosing(pos.id)
    const liveKey = `${pos.symbol}__${pos.instrument}`
    // OPTIONS: Yahoo returns spot price, not option premium. Use stored current_price (last known premium).
    // EQUITY/FUTURES: use live Yahoo price.
    const lp = forcePrice !== undefined
      ? forcePrice
      : pos.instrument === "OPTIONS"
        ? (pos.current_price ?? pos.avg_price ?? pos.entry_price)
        : (livePrices[liveKey] ?? pos.current_price ?? pos.avg_price ?? pos.entry_price)
    const entryP  = pos.avg_price ?? pos.entry_price
    const qty     = pos.quantity
    const margin  = pos.margin_blocked ?? 0

    let walletCredit = 0
    let realizedPnl  = 0
    let exitValue    = 0

    if (pos.instrument === "EQUITY") {
      // Standard: credit sell proceeds minus charges
      const ch    = calcCharges(lp, qty, "EQUITY", "SELL")
      exitValue   = lp * qty - ch
      realizedPnl = (lp - entryP) * qty - ch
      walletCredit = exitValue
    } else if (pos.instrument === "OPTIONS") {
      if (pos.trade_type === "BUY") {
        // Credit exit premium × qty (minus charges)
        const ch     = calcCharges(lp, qty, "OPTIONS", "SELL")
        exitValue    = lp * qty - ch
        realizedPnl  = (lp - entryP) * qty - ch
        walletCredit = Math.max(exitValue, 0) // can't receive negative
      } else {
        // SELL position: release margin + P&L
        // P&L = (entry_premium − exit_premium) × qty  [seller profits when premium falls]
        const ch     = calcCharges(lp, qty, "OPTIONS", "BUY")
        realizedPnl  = (entryP - lp) * qty - ch
        // Release margin adjusted by P&L
        walletCredit = Math.max(margin + realizedPnl, 0)
        exitValue    = lp * qty
      }
    } else {
      // FUTURES — same as options sell logic
      const ch     = calcCharges(lp, qty, "FUTURES" as any, pos.trade_type === "BUY" ? "SELL" : "BUY")
      if (pos.trade_type === "BUY") {
        realizedPnl  = (lp - entryP) * qty - ch
      } else {
        realizedPnl  = (entryP - lp) * qty - ch
      }
      walletCredit = Math.max(margin + realizedPnl, 0)
      exitValue    = lp * qty
    }

    const isProfit = realizedPnl >= 0

    await supabase.from("positions").update({
      status:      "CLOSED",
      closed_at:   new Date().toISOString(),
      current_price: lp,
      pnl:         realizedPnl,
    }).eq("id", pos.id)

    const { data: walletData } = await supabase
      .from("wallets").select("balance").eq("user_id", userId).single()
    const freshBal = walletData?.balance ?? balance

    await supabase.from("wallets").update({ balance: freshBal + walletCredit }).eq("user_id", userId)

    const exitNow = new Date().toISOString()
    await supabase.from("trade_history").insert({
      user_id:      userId,
      symbol:       pos.symbol,
      instrument:   pos.instrument,
      trade_type:   pos.trade_type === "BUY" ? "SELL" : "BUY",
      quantity:     qty,
      price:        lp,
      total_value:  exitValue,
      charges:      0,
      net_value:    walletCredit,
      realized_pnl: realizedPnl,
      expiry:       pos.expiry || null,
      strike_price: pos.strike_price || null,
      option_type:  pos.option_type || null,
      executed_at:  exitNow,
      created_at:   exitNow,
    })

    setClosing(null)
    load()
  }

  // ── Expiry settlement: options expire worthless (price=0); futures settle at live price ─────
  async function checkExpiry() {
    const today = new Date(); today.setHours(23, 59, 59, 999)
    const expired = positionsRef.current.filter(p =>
      (p.instrument === "OPTIONS" || p.instrument === "FUTURES") &&
      p.expiry &&
      new Date(p.expiry) <= today
    )
    for (const pos of expired) {
      if (pos.instrument === "OPTIONS") {
        // Options expire worthless if not squared off
        await closePos(pos, 0)
      } else {
        // Futures settle at last live price (or stored current_price)
        const liveKey = `${pos.symbol}__${pos.instrument}`
        const settlementPrice = livePrices[liveKey] ?? pos.current_price ?? pos.avg_price ?? pos.entry_price
        await closePos(pos, settlementPrice)
      }
    }
  }

  // ── Auto square-off: close sell positions if loss >= margin ────────────────
  async function checkSquareOff() {
    const sellPos = positionsRef.current.filter(p =>
      (p.instrument === "OPTIONS" || p.instrument === "FUTURES") &&
      p.trade_type === "SELL" &&
      p.margin_blocked > 0
    )
    for (const pos of sellPos) {
      const liveKey = `${pos.symbol}__${pos.instrument}`
      const lp = livePrices[liveKey] ?? pos.current_price ?? pos.entry_price
      const entryP = pos.avg_price ?? pos.entry_price
      const loss = (lp - entryP) * pos.quantity  // loss is positive when price rose
      if (loss >= pos.margin_blocked) {
        await closePos(pos, lp)
      }
    }
  }

  // For OPTIONS: live price from Yahoo is the SPOT price, not premium.
  // We only use Yahoo prices for EQUITY and FUTURES. For OPTIONS, use stored current_price (premium).
  const getLivePrice = (pos: any) => {
    if (pos.instrument === "OPTIONS") {
      return pos.current_price ?? pos.avg_price ?? pos.entry_price
    }
    return livePrices[`${pos.symbol}__${pos.instrument}`] ?? pos.current_price ?? pos.entry_price ?? pos.avg_price
  }

  const totalPnL = positions.reduce((s, p) => {
    const entryP   = p.avg_price ?? p.entry_price
    const curPrice = getLivePrice(p)
    const raw = p.trade_type === "BUY"
      ? (curPrice - entryP) * p.quantity
      : (entryP - curPrice) * p.quantity
    return s + raw
  }, 0)

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Available Cash</span>
          </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        <TradeForm userId={userId} balance={balance} onDone={load} />
        <div>
          <div className="flex gap-1 bg-card border border-border p-1 rounded-xl mb-4 w-fit">
            {([["positions","Positions",BarChart2],["history","History",History]] as const).map(([key, label, Icon]) => (
              <button key={key} onClick={() => setTab(key as any)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
                {key === "history" && history.length > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                    {history.length}
                  </span>
                )}
              </button>
            ))}
            <button onClick={() => { load(); refreshLivePrices() }} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${fetching ? "animate-spin text-primary" : ""}`} />
            </button>
          </div>
          {/* Live price status */}
          <div className="flex items-center gap-2 mb-3 text-[10px] text-muted-foreground">
            <span className={`w-1.5 h-1.5 rounded-full ${fetching ? "bg-warning animate-pulse" : priceTs ? "bg-success" : "bg-muted-foreground"}`} />
            {fetching ? "Fetching live prices…" : priceTs ? `Prices updated ${priceTs.toLocaleTimeString("en-IN")} · auto-refresh every 30s` : "Fetching prices…"}
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
                      {["Symbol","Type","B/S","Qty","Entry Avg","LTP","P&L","Action"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {positions.map((pos, i) => {
                        const entryP  = pos.avg_price ?? pos.entry_price
                        const liveKey = `${pos.symbol}__${pos.instrument}`
                        // OPTIONS: Yahoo returns spot price, NOT option premium. Use stored current_price (premium).
                        // EQUITY/FUTURES: use live price from Yahoo.
                        const ltp = pos.instrument === "OPTIONS"
                          ? (pos.current_price ?? entryP)
                          : (livePrices[liveKey] ?? pos.current_price ?? entryP)
                        const hasLive = pos.instrument === "OPTIONS"
                          ? true   // always show — it's the stored premium
                          : !!livePrices[liveKey]
                        // P&L: buyers profit when premium rises, sellers profit when premium falls
                        const pnl = pos.trade_type === "BUY"
                          ? (ltp - entryP) * pos.quantity
                          : (entryP - ltp) * pos.quantity
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
                                <div className="text-[10px] text-muted-foreground">
                                  Fut · {pos.expiry ? formatExpiry(pos.expiry) : ""}
                                  {pos.trade_type === "SELL" && <span className="ml-1 text-warning">SHORT</span>}
                                </div>
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
                                "bg-warning/10 text-warning"}`}>
                                {pos.instrument}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`font-bold ${pos.trade_type === "BUY" ? "text-success" : "text-destructive"}`}>{pos.trade_type}</span>
                            </td>
                            <td className="px-4 py-3 font-mono">{fmtN(pos.quantity)}</td>
                            <td className="px-4 py-3 font-mono">₹{fmtN(entryP)}</td>
                            <td className="px-4 py-3">
                              <div className={`font-mono font-semibold ${hasLive ? "text-foreground" : "text-muted-foreground"}`}>
                                ₹{fmtN(ltp)}
                              </div>
                              {!hasLive && <div className="text-[9px] text-muted-foreground">last known</div>}
                            </td>
                            <td className="px-4 py-3">
                              <div className={`font-mono font-bold ${isProfit ? "text-success" : "text-destructive"}`}>
                                {isProfit ? "+" : ""}₹{fmtN(Math.abs(pnl))}
                              </div>
                              <div className={`text-[10px] ${isProfit ? "text-success" : "text-destructive"}`}>
                                {isProfit ? "▲" : "▼"}{Math.abs(pnlPct).toFixed(2)}%
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => closePos(pos)}
                                disabled={closing === pos.id}
                                title={`Exit at live price ₹${fmtN(ltp)}`}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 whitespace-nowrap ${lossNearMargin ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-destructive/10 hover:bg-destructive/20 text-destructive"}`}>
                                {closing === pos.id
                                  ? <div className="w-3 h-3 border border-destructive/30 border-t-destructive rounded-full animate-spin" />
                                  : <X className="w-3 h-3" />}
                                Exit @ ₹{fmtN(ltp)}
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
                {/* P&L summary bar */}
                {(() => {
                  const closed = history.filter(t => t.realized_pnl !== null && t.realized_pnl !== undefined)
                  const totalRealized = closed.reduce((s: number, t: any) => s + (t.realized_pnl ?? 0), 0)
                  const wins  = closed.filter((t: any) => (t.realized_pnl ?? 0) > 0).length
                  const total = closed.length
                  if (total === 0) return null
                  return (
                    <div className={`flex items-center justify-between px-4 py-3 border-b border-border text-xs ${totalRealized >= 0 ? "bg-success/5" : "bg-destructive/5"}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">Realised P&L</span>
                        <span className={`font-mono font-bold ${totalRealized >= 0 ? "text-success" : "text-destructive"}`}>
                          {totalRealized >= 0 ? "+" : ""}{fmt(totalRealized)}
                        </span>
                      </div>
                      <span className="text-muted-foreground">{wins}/{total} profitable exits</span>
                    </div>
                  )
                })()}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-muted">
                      {["Time","Symbol","Type","B/S","Qty","Price","P&L","Net"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {history.map((t, i) => {
                        const hasPnl = t.realized_pnl !== null && t.realized_pnl !== undefined
                        const pnl    = t.realized_pnl ?? 0
                        return (
                        <tr key={t.id} className={`border-t border-border ${i % 2 ? "bg-muted/30" : ""}`}>
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                            {new Date(t.executed_at ?? t.created_at).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-bold text-foreground">{t.symbol}</div>
                            {t.instrument === "OPTIONS" && t.strike_price && (
                              <div className="text-[9px] text-muted-foreground">
                                {t.strike_price}{t.option_type} · {t.expiry ? formatExpiry(t.expiry) : ""}
                              </div>
                            )}
                            {t.instrument === "FUTURES" && t.expiry && (
                              <div className="text-[9px] text-muted-foreground">Fut · {formatExpiry(t.expiry)}</div>
                            )}
                            {t.instrument !== "EQUITY" && !t.strike_price && !t.expiry && (
                              <div className="text-[9px] text-muted-foreground">{t.instrument}</div>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                              t.instrument === "EQUITY" ? "bg-primary/10 text-primary" :
                              t.instrument === "OPTIONS" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                              "bg-warning/10 text-warning"}`}>
                              {t.instrument}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`font-bold ${t.trade_type === "BUY" ? "text-success" : "text-destructive"}`}>{t.trade_type}</span>
                          </td>
                          <td className="px-4 py-2.5 font-mono">{fmtN(t.quantity)}</td>
                          <td className="px-4 py-2.5 font-mono">₹{fmtN(t.price)}</td>
                          <td className="px-4 py-2.5 font-mono font-semibold">
                            {hasPnl ? (
                              <span className={pnl >= 0 ? "text-success" : "text-destructive"}>
                                {pnl >= 0 ? "+" : ""}₹{fmtN(Math.abs(pnl))}
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-2.5 font-mono font-semibold">₹{fmtN(t.net_value)}</td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-8">
        ⚠️ Virtual trading only. No real money. Options premium via Black-Scholes (IV 18%). Options BUY: only premium debited.
        Options/Futures SELL: ~20% SPAN margin blocked; auto square-off if loss ≥ margin. Expired options settle worthless.
        Equity/Futures live prices from Yahoo Finance (~15 min delay). Charges simulated (Zerodha model). Not SEBI registered.
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
    // IMPORTANT: Do NOT call getSession() first.
    // onAuthStateChange fires INITIAL_SESSION immediately with the current
    // session, AND fires PASSWORD_RECOVERY before SIGNED_IN when the user
    // lands from a reset link. Letting it control everything avoids a race
    // condition where getSession sets checked=true before recovery is detected.
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {

      if (event === "INITIAL_SESSION") {
        // Page just loaded normally — no recovery token in URL
        setUserId(session?.user?.id ?? null)
        setChecked(true)

      } else if (event === "PASSWORD_RECOVERY") {
        // User clicked the forgot-password link in their email.
        // Show the reset password form immediately.
        setIsRecovery(true)
        setUserId(null)
        setChecked(true)

      } else if (event === "USER_UPDATED") {
        // User successfully saved their new password
        setIsRecovery(false)
        setUserId(session?.user?.id ?? null)

      } else if (event === "SIGNED_IN") {
        // Skip SIGNED_IN if we are in recovery mode (it fires right after
        // PASSWORD_RECOVERY — we don't want it to override the reset form)
        if (isRecovery) return
        const uid = session?.user?.id
        if (uid) {
          // Ensure profile + wallet exist (handles email confirmation link flow)
          const { data: prof } = await supabase
            .from("profiles").select("id").eq("id", uid).maybeSingle()
          if (!prof) {
            const meta = session?.user?.user_metadata ?? {}
            await supabase.from("profiles").upsert({
              id: uid,
              email: session?.user?.email?.toLowerCase() ?? "",
              mobile: meta.mobile ?? "",
              full_name: meta.full_name ?? "",
            })
          }
          const { data: wal } = await supabase
            .from("wallets").select("id").eq("user_id", uid).maybeSingle()
          if (!wal) {
            await supabase.from("wallets").insert({ user_id: uid, balance: 1000000 })
          }
        }
        setUserId(uid ?? null)
        setChecked(true)

      } else if (event === "SIGNED_OUT") {
        setUserId(null)
        setIsRecovery(false)
        setChecked(true)
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
            <h1 className="text-2xl font-bold text-foreground">Virtual Trading</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Practice Nifty 50 Equity, Options & Futures with ₹10,00,000 virtual money — zero real risk
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
