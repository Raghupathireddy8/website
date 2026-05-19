"use client"

// ─────────────────────────────────────────────────────────────────────────────
// AuthPage.tsx  —  Sign Up / Sign In with mobile number + password
// Features:
//   • Mobile number is the unique identifier (no two accounts share a number)
//   • Password-based login (no OTP cost)
//   • Forgot password flow via email reset link
//   • On first signup: wallet auto-created with ₹10,00,000
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react"
import { supabase } from "./supabaseClient"
import { Eye, EyeOff, Phone, Lock, User, ArrowRight, TrendingUp } from "lucide-react"

type Mode = "login" | "signup" | "forgot"

export function AuthPage({ onAuth }: { onAuth: () => void }) {
  const [mode,       setMode]       = useState<Mode>("login")
  const [mobile,     setMobile]     = useState("")
  const [email,      setEmail]      = useState("")   // used for forgot-password
  const [password,   setPassword]   = useState("")
  const [confirm,    setConfirm]    = useState("")
  const [fullName,   setFullName]   = useState("")
  const [showPass,   setShowPass]   = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState("")
  const [success,    setSuccess]    = useState("")

  // ── Helpers ────────────────────────────────────────────────────────────────

  function normaliseMobile(m: string) {
    const digits = m.replace(/\D/g, "")
    // Accept 10-digit Indian numbers; prefix +91 for Supabase email trick
    if (digits.length === 10) return digits
    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2)
    return digits
  }

  // We store the user in Supabase Auth using a fake email derived from mobile.
  // This avoids SMS cost while keeping mobile as the unique key.
  function mobileToFakeEmail(mobile: string) {
    return `${mobile}@marketgreeks.user`
  }

  function validate() {
    const m = normaliseMobile(mobile)
    if (m.length !== 10)          return "Enter a valid 10-digit mobile number"
    if (mode === "signup") {
      if (!fullName.trim())        return "Enter your full name"
      if (password.length < 8)    return "Password must be at least 8 characters"
      if (password !== confirm)   return "Passwords do not match"
    }
    if (mode === "login") {
      if (!password)               return "Enter your password"
    }
    return ""
  }

  // ── Sign Up ────────────────────────────────────────────────────────────────

  async function handleSignup() {
    const err = validate()
    if (err) { setError(err); return }

    setLoading(true); setError(""); setSuccess("")

    const m     = normaliseMobile(mobile)
    const fakeEmail = mobileToFakeEmail(m)

    // 1. Check if mobile already exists in profiles
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("mobile", m)
      .maybeSingle()

    if (existing) {
      setError("This mobile number is already registered. Please sign in.")
      setLoading(false)
      return
    }

    // 2. Create auth user
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email:    fakeEmail,
      password: password,
      options:  { data: { full_name: fullName, mobile: m } },
    })

    if (signUpErr) {
      setError(signUpErr.message)
      setLoading(false)
      return
    }

    const userId = data.user?.id
    if (!userId) { setError("Signup failed. Try again."); setLoading(false); return }

    // 3. Insert profile row
    await supabase.from("profiles").insert({
      id:        userId,
      mobile:    m,
      full_name: fullName,
    })

    // 4. Create wallet with ₹10,00,000
    await supabase.from("wallets").insert({
      user_id: userId,
      balance: 1000000.00,
    })

    setSuccess("Account created! ₹10,00,000 added to your virtual wallet. Please sign in.")
    setMode("login")
    setLoading(false)
  }

  // ── Sign In ────────────────────────────────────────────────────────────────

  async function handleLogin() {
    const err = validate()
    if (err) { setError(err); return }

    setLoading(true); setError(""); setSuccess("")

    const m         = normaliseMobile(mobile)
    const fakeEmail = mobileToFakeEmail(m)

    const { error: loginErr } = await supabase.auth.signInWithPassword({
      email:    fakeEmail,
      password: password,
    })

    if (loginErr) {
      setError("Invalid mobile number or password.")
      setLoading(false)
      return
    }

    onAuth()
    setLoading(false)
  }

  // ── Forgot Password ────────────────────────────────────────────────────────

  async function handleForgot() {
    if (!email.trim()) { setError("Enter the email linked to your account"); return }
    setLoading(true); setError(""); setSuccess("")

    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
     redirectTo:
      "https://marketgreeks.com/reset-password",
    })

    if (resetErr) { setError(resetErr.message); setLoading(false); return }
    setSuccess("Password reset link sent to your email. Check your inbox.")
    setLoading(false)
  }

  // ── Submit dispatcher ──────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === "signup")  await handleSignup()
    if (mode === "login")   await handleLogin()
    if (mode === "forgot")  await handleForgot()
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f7ff] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#2d4af0] rounded-2xl mb-3">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#1a1f36]">
            Market<span className="text-[#2d4af0]">Greeks</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Virtual Trading Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#e8ecf5] p-6 shadow-sm">

          {/* Mode heading */}
          <h2 className="text-lg font-bold text-[#1a1f36] mb-1">
            {mode === "login"  && "Sign In to Trade"}
            {mode === "signup" && "Create Free Account"}
            {mode === "forgot" && "Reset Password"}
          </h2>
          <p className="text-xs text-slate-500 mb-5">
            {mode === "login"  && "Use your mobile number and password"}
            {mode === "signup" && "Get ₹10,00,000 virtual money to start trading"}
            {mode === "forgot" && "We'll send a reset link to your email"}
          </p>

          {/* Wallet banner on signup */}
          {mode === "signup" && (
            <div className="bg-[#eef1ff] rounded-xl p-3 mb-5 flex items-center gap-3">
              <div className="text-2xl">💰</div>
              <div>
                <p className="text-xs font-bold text-[#2d4af0]">Free ₹10,00,000 Virtual Wallet</p>
                <p className="text-[11px] text-slate-500">Trade Equity, Options & Futures. No real money.</p>
              </div>
            </div>
          )}

          {/* Alerts */}
          {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-4">{error}</div>}
          {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-2 mb-4">{success}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Full name — signup only */}
            {mode === "signup" && (
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Ravi Kumar"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#e8ecf5] rounded-xl focus:outline-none focus:border-[#2d4af0] focus:ring-2 focus:ring-[#2d4af0]/10"
                  />
                </div>
              </div>
            )}

            {/* Email — forgot password only */}
            {mode === "forgot" ? (
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full px-4 py-2.5 text-sm border border-[#e8ecf5] rounded-xl focus:outline-none focus:border-[#2d4af0] focus:ring-2 focus:ring-[#2d4af0]/10"
                />
              </div>
            ) : (
              /* Mobile number */
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Mobile Number</label>
                <div className="relative flex">
                  <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-50 border border-r-0 border-[#e8ecf5] rounded-l-xl">
                    <Phone className="w-3.5 h-3.5 mr-1" /> +91
                  </span>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    placeholder="9876543210"
                    maxLength={10}
                    className="flex-1 px-4 py-2.5 text-sm border border-[#e8ecf5] rounded-r-xl focus:outline-none focus:border-[#2d4af0] focus:ring-2 focus:ring-[#2d4af0]/10"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Each mobile number can only register once</p>
              </div>
            )}

            {/* Password */}
            {mode !== "forgot" && (
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Minimum 8 characters" : "Enter password"}
                    className="w-full pl-9 pr-10 py-2.5 text-sm border border-[#e8ecf5] rounded-xl focus:outline-none focus:border-[#2d4af0] focus:ring-2 focus:ring-[#2d4af0]/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm password — signup only */}
            {mode === "signup" && (
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#e8ecf5] rounded-xl focus:outline-none focus:border-[#2d4af0] focus:ring-2 focus:ring-[#2d4af0]/10"
                  />
                </div>
              </div>
            )}

            {/* Forgot password link */}
            {mode === "login" && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setError(""); setSuccess("") }}
                  className="text-xs text-[#2d4af0] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#2d4af0] hover:bg-[#2438c0] text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === "login"  && "Sign In"}
                  {mode === "signup" && "Create Account & Get ₹10L"}
                  {mode === "forgot" && "Send Reset Link"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Mode switcher */}
          <div className="mt-5 text-center text-xs text-slate-500">
            {mode === "login" && (
              <>Don't have an account?{" "}
                <button onClick={() => { setMode("signup"); setError(""); setSuccess("") }} className="text-[#2d4af0] font-semibold hover:underline">
                  Sign up free
                </button>
              </>
            )}
            {mode === "signup" && (
              <>Already have an account?{" "}
                <button onClick={() => { setMode("login"); setError(""); setSuccess("") }} className="text-[#2d4af0] font-semibold hover:underline">
                  Sign in
                </button>
              </>
            )}
            {mode === "forgot" && (
              <button onClick={() => { setMode("login"); setError(""); setSuccess("") }} className="text-[#2d4af0] font-semibold hover:underline">
                ← Back to Sign In
              </button>
            )}
          </div>

        </div>

        {/* Disclaimer */}
        <p className="text-center text-[10px] text-slate-400 mt-4 px-4">
          Virtual trading only. No real money involved. For educational purposes.
          Not SEBI registered.
        </p>

      </div>
    </div>
  )
}
