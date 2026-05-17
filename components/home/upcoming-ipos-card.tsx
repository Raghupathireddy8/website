"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

// UPDATE GMP_DATA daily — check investorgain.com
// Takes 2 minutes — no API exists for GMP anywhere
const GMP_DATA: Record<string, string> = {
  "Schloss Bangalore": "+₹28",
  "Aegis Vopak": "+₹15",
  "Tankup Engineers": "+₹8",
}

interface IPO {
  company: string
  openDate: string
  priceRange: string
  gmp: string
  status: "Open" | "Upcoming" | "Closed"
}

const STATIC_IPOS: IPO[] = [
  {
    company: "Schloss Bangalore",
    openDate: "Opens May 20",
    priceRange: "₹240–260",
    gmp: "+₹28",
    status: "Open",
  },
  {
    company: "Aegis Vopak",
    openDate: "Opens May 23",
    priceRange: "₹108–112",
    gmp: "+₹15",
    status: "Upcoming",
  },
  {
    company: "Tankup Engineers",
    openDate: "Opens Jun 2",
    priceRange: "₹TBA",
    gmp: "+₹8",
    status: "Upcoming",
  },
  {
    company: "Upcoming IPO 4",
    openDate: "Opens Jun 10",
    priceRange: "₹TBA",
    gmp: "—",
    status: "Upcoming",
  },
  {
    company: "Upcoming IPO 5",
    openDate: "Opens Jun 18",
    priceRange: "₹180–195",
    gmp: "—",
    status: "Upcoming",
  },
]

function getStatusStyle(status: string) {
  switch (status) {
    case "Open":
      return "bg-success/10 text-success"
    case "Upcoming":
      return "bg-primary/10 text-primary"
    case "Closed":
      return "bg-muted text-muted-foreground"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function parseChittorgarhData(html: string): IPO[] {
  try {
    const ipos: IPO[] = []
    // Simple regex to extract IPO names from the HTML response
    const tableMatch = html.match(/<table[^>]*class="[^"]*table[^"]*"[^>]*>([\s\S]*?)<\/table>/i)
    if (!tableMatch) return []
    
    const rows = tableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || []
    
    for (const row of rows.slice(1, 6)) { // Skip header, take first 5
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []
      if (cells.length >= 3) {
        const companyMatch = cells[0].match(/>([^<]+)</)?.[1]?.trim()
        const dateMatch = cells[1]?.match(/>([^<]+)</)?.[1]?.trim()
        const priceMatch = cells[2]?.match(/>([^<]+)</)?.[1]?.trim()
        
        if (companyMatch) {
          const status = dateMatch?.toLowerCase().includes("open") ? "Open" : "Upcoming"
          ipos.push({
            company: companyMatch.replace(/&amp;/g, "&").substring(0, 30),
            openDate: dateMatch || "TBA",
            priceRange: priceMatch ? `₹${priceMatch}` : "₹TBA",
            gmp: GMP_DATA[companyMatch] || "—",
            status,
          })
        }
      }
    }
    return ipos.length > 0 ? ipos : []
  } catch {
    return []
  }
}

function parseIPOWatchData(posts: Array<{ title: { rendered: string }, date: string }>): IPO[] {
  try {
    return posts.slice(0, 5).map((post) => {
      const title = post.title.rendered.replace(/&#8211;/g, "–").replace(/&amp;/g, "&")
      const companyName = title.split("IPO")[0]?.trim() || title.substring(0, 25)
      return {
        company: companyName.substring(0, 30),
        openDate: new Date(post.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        priceRange: "₹TBA",
        gmp: GMP_DATA[companyName] || "—",
        status: "Upcoming" as const,
      }
    })
  } catch {
    return []
  }
}

export function UpcomingIPOsCard() {
  const [ipos, setIpos] = useState<IPO[]>(STATIC_IPOS)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchIPOData = async () => {
    setIsLoading(true)
    
    try {
      // Try Chittorgarh first
      const chittorgarhRes = await fetch(
        "https://api.allorigins.win/get?url=" + 
        encodeURIComponent("https://www.chittorgarh.com/report/ipo-subscription-status-live-data/83/"),
        { signal: AbortSignal.timeout(10000) }
      )
      
      if (chittorgarhRes.ok) {
        const data = await chittorgarhRes.json()
        const parsed = parseChittorgarhData(data.contents || "")
        if (parsed.length > 0) {
          setIpos(parsed)
          setLastUpdated(new Date())
          setIsLoading(false)
          return
        }
      }
    } catch {
      // Chittorgarh failed, try fallback
    }

    try {
      // Try IPOWatch fallback
      const ipoWatchRes = await fetch(
        "https://api.allorigins.win/get?url=" +
        encodeURIComponent("https://ipowatch.in/wp-json/wp/v2/posts?categories=3&per_page=10"),
        { signal: AbortSignal.timeout(10000) }
      )
      
      if (ipoWatchRes.ok) {
        const data = await ipoWatchRes.json()
        const posts = JSON.parse(data.contents || "[]")
        const parsed = parseIPOWatchData(posts)
        if (parsed.length > 0) {
          setIpos(parsed)
          setLastUpdated(new Date())
          setIsLoading(false)
          return
        }
      }
    } catch {
      // IPOWatch also failed
    }

    // Fall back to static data
    setIpos(STATIC_IPOS)
    setLastUpdated(new Date())
    setIsLoading(false)
  }

  useEffect(() => {
    fetchIPOData()
    
    // Auto-refresh every 30 minutes
    const interval = setInterval(fetchIPOData, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">Upcoming IPOs</h3>
          <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground font-medium">
            NSE · BSE
          </span>
        </div>
        {lastUpdated && (
          <span className="text-[10px] text-muted-foreground">
            Updated: {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* GMP Manual Badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] px-2 py-0.5 bg-warning/15 text-warning rounded-full font-medium">
          GMP: Manual · Updated daily
        </span>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          ipos.map((ipo, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">
                  {ipo.company}
                </p>
                <p className="text-xs text-muted-foreground">{ipo.openDate}</p>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-mono text-xs px-2 py-1 bg-success/10 text-success rounded-md">
                  {ipo.priceRange}
                </span>
                <span className="text-xs text-warning font-medium min-w-[50px]">
                  GMP {ipo.gmp}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getStatusStyle(
                    ipo.status
                  )}`}
                >
                  {ipo.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <Link
        href="/ipo"
        className="inline-flex items-center gap-1 mt-4 text-sm text-primary font-medium hover:underline"
      >
        View All IPOs →
      </Link>
    </div>
  )
}
