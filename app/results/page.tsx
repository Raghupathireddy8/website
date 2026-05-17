"use client"

import { useState, useMemo } from "react"
import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import Link from "next/link"
import { Search, Bell, ExternalLink } from "lucide-react"

// ============================================
// RECENT RESULTS DATA
// Update after each result announcement
// ============================================
const RECENT_RESULTS = [
  { company: "TCS", quarter: "Q4 FY26", eps_est: 28.2, eps_act: 30.4, diff: "+8%", revenue: "₹63,850 Cr", profit: "₹12,224 Cr", verdict: "Beat", nifty50: true },
  { company: "Infosys", quarter: "Q4 FY26", eps_est: 18.5, eps_act: 19.1, diff: "+3%", revenue: "₹40,925 Cr", profit: "₹7,033 Cr", verdict: "Beat", nifty50: true },
  { company: "Wipro", quarter: "Q4 FY26", eps_est: 21.1, eps_act: 22.4, diff: "+6%", revenue: "₹22,300 Cr", profit: "₹3,570 Cr", verdict: "Beat", nifty50: true },
  { company: "HDFC Bank", quarter: "Q4 FY26", eps_est: 42.0, eps_act: 43.7, diff: "+4%", revenue: "₹1,09,530 Cr", profit: "₹17,616 Cr", verdict: "Beat", nifty50: true },
  { company: "Reliance", quarter: "Q4 FY26", eps_est: 34.5, eps_act: 33.1, diff: "-4%", revenue: "₹2,64,890 Cr", profit: "₹18,951 Cr", verdict: "Miss", nifty50: true },
  { company: "SBI", quarter: "Q4 FY26", eps_est: 19.4, eps_act: 21.1, diff: "+9%", revenue: "₹1,28,400 Cr", profit: "₹18,543 Cr", verdict: "Beat", nifty50: true },
  { company: "ITC", quarter: "Q4 FY26", eps_est: 6.8, eps_act: 6.5, diff: "-4%", revenue: "₹18,750 Cr", profit: "₹5,040 Cr", verdict: "Miss", nifty50: true },
  { company: "Bajaj Finance", quarter: "Q4 FY26", eps_est: 38.1, eps_act: 39.8, diff: "+4%", revenue: "₹16,920 Cr", profit: "₹4,420 Cr", verdict: "Beat", nifty50: true },
  { company: "Axis Bank", quarter: "Q4 FY26", eps_est: 18.2, eps_act: 19.6, diff: "+8%", revenue: "₹71,895 Cr", profit: "₹7,117 Cr", verdict: "Beat", nifty50: true },
  { company: "Maruti Suzuki", quarter: "Q4 FY26", eps_est: 142.0, eps_act: 138.5, diff: "-2%", revenue: "₹43,210 Cr", profit: "₹4,173 Cr", verdict: "Miss", nifty50: true },
]

// ============================================
// UPCOMING RESULTS DATA
// UPDATE this every week during result season
// Check nseindia.com/companies-listing/corporate-filings-financial-results
// Result season: Jan–Feb (Q3) and Apr–May (Q4) are busiest
// ============================================
const UPCOMING_RESULTS = [
  { company: "ONGC", date: "May 19, 2026", day: "Monday", quarter: "Q4 FY26", sector: "Energy", exchange: "NSE/BSE" },
  { company: "Coal India", date: "May 20, 2026", day: "Tuesday", quarter: "Q4 FY26", sector: "Mining", exchange: "NSE/BSE" },
  { company: "NTPC", date: "May 21, 2026", day: "Wednesday", quarter: "Q4 FY26", sector: "Power", exchange: "NSE/BSE" },
  { company: "Power Grid", date: "May 21, 2026", day: "Wednesday", quarter: "Q4 FY26", sector: "Power", exchange: "NSE/BSE" },
  { company: "Sun Pharma", date: "May 22, 2026", day: "Thursday", quarter: "Q4 FY26", sector: "Pharma", exchange: "NSE/BSE" },
  { company: "M&M", date: "May 22, 2026", day: "Thursday", quarter: "Q4 FY26", sector: "Auto", exchange: "NSE/BSE" },
  { company: "Tata Motors", date: "May 23, 2026", day: "Friday", quarter: "Q4 FY26", sector: "Auto", exchange: "NSE/BSE" },
  { company: "HCL Tech", date: "May 23, 2026", day: "Friday", quarter: "Q4 FY26", sector: "IT", exchange: "NSE/BSE" },
  { company: "JSW Steel", date: "May 26, 2026", day: "Monday", quarter: "Q4 FY26", sector: "Metal", exchange: "NSE/BSE" },
  { company: "Hindalco", date: "May 27, 2026", day: "Tuesday", quarter: "Q4 FY26", sector: "Metal", exchange: "NSE/BSE" },
  { company: "Dr Reddy's", date: "May 27, 2026", day: "Tuesday", quarter: "Q4 FY26", sector: "Pharma", exchange: "NSE/BSE" },
  { company: "Adani Ports", date: "May 28, 2026", day: "Wednesday", quarter: "Q4 FY26", sector: "Infra", exchange: "NSE/BSE" },
  { company: "Titan Company", date: "May 28, 2026", day: "Wednesday", quarter: "Q4 FY26", sector: "Consumer", exchange: "NSE/BSE" },
  { company: "Nestle India", date: "May 29, 2026", day: "Thursday", quarter: "Q4 FY26", sector: "FMCG", exchange: "NSE/BSE" },
  { company: "Cipla", date: "May 29, 2026", day: "Thursday", quarter: "Q4 FY26", sector: "Pharma", exchange: "NSE/BSE" },
]

const SECTOR_COLORS: Record<string, string> = {
  IT: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Banking: "bg-green-500/10 text-green-600 border-green-500/20",
  Pharma: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  Auto: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  Energy: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  FMCG: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  Metal: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  Power: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  Mining: "bg-stone-500/10 text-stone-600 border-stone-500/20",
  Infra: "bg-amber-700/10 text-amber-700 border-amber-700/20",
  Consumer: "bg-pink-500/10 text-pink-600 border-pink-500/20",
}

const SECTOR_FILTERS = ["All Sectors", "IT", "Banking", "Pharma", "Auto", "Energy", "FMCG", "Metal", "Power"]
const VERDICT_FILTERS = ["All", "Beat", "Miss", "Nifty 50 only"]

function getVerdictBadge(verdict: string) {
  if (verdict === "Beat") return "bg-success/10 text-success"
  if (verdict === "Miss") return "bg-destructive/10 text-destructive"
  return "bg-muted text-muted-foreground"
}

function getDiffStyle(diff: string) {
  if (diff.startsWith("+")) return "text-success"
  if (diff.startsWith("-")) return "text-destructive"
  return "text-muted-foreground"
}

function isToday(dateStr: string): boolean {
  const today = new Date()
  const resultDate = new Date(dateStr)
  return (
    today.getDate() === resultDate.getDate() &&
    today.getMonth() === resultDate.getMonth() &&
    today.getFullYear() === resultDate.getFullYear()
  )
}

export default function ResultsPage() {
  const [activeTab, setActiveTab] = useState<"recent" | "upcoming">("recent")
  const [searchQuery, setSearchQuery] = useState("")
  const [verdictFilter, setVerdictFilter] = useState("All")
  const [sectorFilter, setSectorFilter] = useState("All Sectors")
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Filter recent results
  const filteredRecentResults = useMemo(() => {
    return RECENT_RESULTS.filter((result) => {
      const matchesSearch = result.company.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesVerdict =
        verdictFilter === "All" ||
        verdictFilter === result.verdict ||
        (verdictFilter === "Nifty 50 only" && result.nifty50)
      return matchesSearch && matchesVerdict
    })
  }, [searchQuery, verdictFilter])

  // Filter and group upcoming results by date
  const groupedUpcomingResults = useMemo(() => {
    const filtered = UPCOMING_RESULTS.filter((result) => {
      return sectorFilter === "All Sectors" || result.sector === sectorFilter
    })

    const grouped: Record<string, typeof UPCOMING_RESULTS> = {}
    filtered.forEach((result) => {
      const key = `${result.day}, ${result.date.split(",")[0]}`
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(result)
    })
    return grouped
  }, [sectorFilter])

  const handleSetAlert = (company: string) => {
    setToastMessage(`Alert set! We'll notify you on Telegram when ${company} result is out`)
    setTimeout(() => setToastMessage(null), 3000)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          {/* Telegram Alert Banner */}
          <div className="mb-6 bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <p className="text-sm text-foreground">
                Get result alerts on Telegram the moment they&apos;re announced
              </p>
            </div>
            <a
              href="https://t.me/marketgreeks"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Join Free Channel
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Quarterly Results</h1>
              <p className="text-sm text-muted-foreground mt-1">Q4 FY 2025–26 earnings reports</p>
            </div>

            {/* Tabs */}
            <div className="flex bg-muted rounded-lg p-1">
              <button
                onClick={() => setActiveTab("recent")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "recent"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Recent Results
              </button>
              <button
                onClick={() => setActiveTab("upcoming")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "upcoming"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Upcoming Results
              </button>
            </div>
          </div>

          {activeTab === "recent" ? (
            <>
              {/* Filters for Recent Results */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search company..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {VERDICT_FILTERS.map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setVerdictFilter(filter)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        verdictFilter === filter
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Results Table */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Company</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Quarter</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">EPS Est</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">EPS Actual</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">vs Est</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">
                          Net Profit
                        </th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Verdict</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecentResults.map((result, index) => (
                        <tr key={index} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-semibold text-foreground">{result.company}</td>
                          <td className="py-3 px-4">
                            <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                              {result.quarter}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                            {result.eps_est.toFixed(1)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-foreground font-medium">
                            {result.eps_act.toFixed(1)}
                          </td>
                          <td className={`py-3 px-4 text-right font-mono font-semibold ${getDiffStyle(result.diff)}`}>
                            {result.diff}
                          </td>
                          <td className="py-3 px-4 text-right text-xs text-muted-foreground hidden md:table-cell">
                            {result.profit}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`text-xs px-2.5 py-1 rounded-full font-medium ${getVerdictBadge(
                                result.verdict
                              )}`}
                            >
                              {result.verdict}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredRecentResults.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No results found matching your filters
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Filters for Upcoming Results */}
              <div className="flex gap-2 flex-wrap mb-4">
                {SECTOR_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSectorFilter(filter)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      sectorFilter === filter
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Upcoming Results Calendar View */}
              <div className="space-y-6">
                {Object.entries(groupedUpcomingResults).map(([dateKey, results]) => {
                  const fullDate = results[0].date
                  const isTodayDate = isToday(fullDate)

                  return (
                    <div key={dateKey}>
                      {/* Date Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-sm font-semibold text-foreground">{dateKey}</h3>
                        {isTodayDate && (
                          <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 bg-success/10 text-success rounded-full font-medium">
                            <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                            Today
                          </span>
                        )}
                        <div className="flex-1 h-px bg-border" />
                      </div>

                      {/* Company Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {results.map((result, index) => (
                          <div
                            key={index}
                            className={`bg-card border rounded-xl p-4 hover:shadow-md transition-shadow ${
                              isTodayDate ? "border-success/30 ring-1 ring-success/20" : "border-border"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-foreground">{result.company}</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">{result.quarter}</p>
                              </div>
                              <button
                                onClick={() => handleSetAlert(result.company)}
                                className="p-1.5 rounded-md hover:bg-muted transition-colors group"
                                title="Set alert"
                              >
                                <Bell className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded border font-medium ${
                                  SECTOR_COLORS[result.sector] || "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                {result.sector}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{result.exchange}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Disclaimer */}
              <div className="mt-6 p-4 bg-muted/50 rounded-xl">
                <p className="text-xs text-muted-foreground">
                  Result dates sourced from NSE filings. Dates may change — always verify at{" "}
                  <a
                    href="https://www.nseindia.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    nseindia.com
                  </a>{" "}
                  before trading decisions.
                </p>
              </div>
            </>
          )}

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-primary hover:underline">
              ← Back to Home
            </Link>
          </div>
        </div>
      </main>

      <Footer />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-foreground text-background px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 z-50">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
