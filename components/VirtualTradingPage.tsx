"use client"

// ─────────────────────────────────────────────────────────────────────────────
// VirtualTradingPage.tsx  —  Drop this into your pages/app router
//
// Usage in Next.js App Router: create file at
//   app/virtual-trade/page.tsx
// and put this content there.
//
// Usage in Next.js Pages Router: create file at
//   pages/virtual-trade.tsx
// and put this content there.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react"
import { supabase } from "./supabaseClient"
import { AuthPage } from "./AuthPage"
import { VirtualTradingDashboard } from "./VirtualTradingDashboard"

export default function VirtualTradingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)  // null = loading

  useEffect(() => {
    // Check existing session on page load
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session)
    })

    // Listen for auth state changes (login / logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Loading state
  if (isLoggedIn === null) {
    return (
      <div className="min-h-screen bg-[#f5f7ff] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2d4af0]/20 border-t-[#2d4af0] rounded-full animate-spin" />
      </div>
    )
  }

  // Not logged in → show auth page
  if (!isLoggedIn) {
    return <AuthPage onAuth={() => setIsLoggedIn(true)} />
  }

  // Logged in → show trading dashboard
  return <VirtualTradingDashboard />
}
