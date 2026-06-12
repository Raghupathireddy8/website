"use client"

import { useState } from "react"
import Link from "next/link"

// Recent results data for homepage preview
const RECENT_RESULTS = [
  { company: "TCS", quarter: "Q4 FY26", eps_est: 28.2, eps_act: 30.4, diff: "+8%", revenue: "₹63,850 Cr", profit: "₹12,224 Cr", verdict: "Beat" },
  { company: "Infosys", quarter: "Q4 FY26", eps_est: 18.5, eps_act: 19.1, diff: "+3%", revenue: "₹40,925 Cr", profit: "₹7,033 Cr", verdict: "Beat" },
  { company: "Reliance", quarter: "Q4 FY26", eps_est: 34.5, eps_act: 33.1, diff: "-4%", revenue: "₹2,64,890 Cr", profit: "₹18,951 Cr", verdict: "Miss" },
]

// Upcoming results for homepage preview
const UPCOMING_RESULTS = [
  { company: "ONGC", date: "May 19, 2026", quarter: "Q4 FY26", sector: "Energy" },
  { company: "Coal India", date: "May 20, 2026", quarter: "Q4 FY26", sector: "Mining" },
  { company: "NTPC", date: "May 21, 2026", quarter: "Q4 FY26", sector: "Power" },
]

function getVerdictBadge(verdict: string) {
  if (verdict === "Beat") {
    return "bg-success/10 text-success"
  }
  if (verdict === "Miss") {
    return "bg-destructive/10 text-destructive"
  }
  return "bg-muted text-muted-foreground"
}

function getSectorColor(sector: string) {
  const colors: Record<string, string> = {
    IT: "bg-blue-500/10 text-blue-600",
    Banking: "bg-green-500/10 text-green-600",
    Pharma: "bg-purple-500/10 text-purple-600",
    Auto: "bg-amber-500/10 text-amber-600",
    Energy: "bg-orange-500/10 text-orange-600",
    FMCG: "bg-teal-500/10 text-teal-600",
    Metal: "bg-gray-500/10 text-gray-600",
    Power: "bg-yellow-500/10 text-yellow-700",
    Mining: "bg-stone-500/10 text-stone-600",
    Infra: "bg-amber-700/10 text-amber-700",
  }
  return colors[sector] || "bg-muted text-muted-foreground"
}

export function QuarterlyResultsCard() {
  const [activeTab, setActiveTab] = useState<"recent" | "upcoming">("recent")

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Quarterly Results</h3>
        <div className="flex bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab("recent")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === "recent"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Recent
          </button>
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === "upcoming"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Upcoming
          </button>
        </div>
      </div>

      {activeTab === "recent" ? (
        <div className="space-y-3">
          {RECENT_RESULTS.map((result, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">{result.company}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                  {result.quarter}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs font-mono text-muted-foreground">
                    EPS: {result.eps_act.toFixed(1)}
                  </span>
                  <span className={`text-xs font-mono ml-1 ${
                    result.diff.startsWith("+") ? "text-success" : "text-destructive"
                  }`}>
                    ({result.diff})
                  </span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getVerdictBadge(result.verdict)}`}>
                  {result.verdict}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {UPCOMING_RESULTS.map((result, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">{result.company}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getSectorColor(result.sector)}`}>
                  {result.sector}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{result.date}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/results"
        className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline mt-4"
      >
        View All Results →
      </Link>
    </div>
  )
}
