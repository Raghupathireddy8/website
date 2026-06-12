"use client"

import { useState } from "react"
import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import Link from "next/link"
import { Search } from "lucide-react"

interface MutualFund {
  schemeCode: number
  schemeName: string
}

export default function MutualFundsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [funds, setFunds] = useState<MutualFund[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const searchFunds = async () => {
    if (!searchQuery.trim()) return
    
    setLoading(true)
    setSearched(true)
    
    try {
      const response = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      setFunds(data.slice(0, 20))
    } catch {
      setFunds([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Mutual Funds</h1>
            <p className="text-sm text-muted-foreground mt-1">Search and compare mutual fund returns & ratings</p>
          </div>

          {/* Search */}
          <div className="bg-card border border-border rounded-xl p-5 mb-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchFunds()}
                  placeholder="Search mutual funds... e.g. HDFC, SBI, Axis"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                onClick={searchFunds}
                className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Search
              </button>
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <div className="skeleton h-4 w-48 mx-auto mb-3"></div>
              <div className="skeleton h-4 w-32 mx-auto"></div>
            </div>
          ) : searched && funds.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground">No funds found. Try a different search term.</p>
            </div>
          ) : funds.length > 0 ? (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <p className="text-sm text-muted-foreground">Found {funds.length} funds</p>
              </div>
              <div className="divide-y divide-border">
                {funds.map((fund) => (
                  <div key={fund.schemeCode} className="p-4 hover:bg-muted/30 transition-colors">
                    <p className="font-medium text-sm text-foreground">{fund.schemeName}</p>
                    <p className="text-xs text-muted-foreground mt-1">Scheme Code: {fund.schemeCode}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground mb-2">Search for mutual funds to compare</p>
              <p className="text-xs text-muted-foreground">Data powered by mfapi.in</p>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-primary hover:underline">← Back to Home</Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
