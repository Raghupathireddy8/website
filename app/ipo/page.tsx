import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import Link from "next/link"

const ipoData = [
  { company: "Reliance Jio", openDate: "May 20, 2026", closeDate: "May 23, 2026", priceRange: "₹240–260", lotSize: 50, gmp: "+₹38", status: "Open" },
  { company: "NTPC Green Energy", openDate: "May 23, 2026", closeDate: "May 26, 2026", priceRange: "₹108–112", lotSize: 125, gmp: "+₹12", status: "Upcoming" },
  { company: "Bajaj Housing Finance", openDate: "Jun 2, 2026", closeDate: "Jun 5, 2026", priceRange: "₹TBA", lotSize: 100, gmp: "—", status: "Upcoming" },
  { company: "Ola Electric Series B", openDate: "Jun 10, 2026", closeDate: "Jun 13, 2026", priceRange: "₹TBA", lotSize: 75, gmp: "—", status: "Upcoming" },
  { company: "IndiGo Hotels", openDate: "Jun 18, 2026", closeDate: "Jun 21, 2026", priceRange: "₹180–195", lotSize: 80, gmp: "+₹5", status: "Upcoming" },
  { company: "Tata Motors EV", openDate: "Apr 15, 2026", closeDate: "Apr 18, 2026", priceRange: "₹320–340", lotSize: 40, gmp: "+₹45", status: "Closed" },
  { company: "Zomato Gold", openDate: "Apr 5, 2026", closeDate: "Apr 8, 2026", priceRange: "₹85–90", lotSize: 165, gmp: "+₹8", status: "Closed" },
]

function getStatusStyle(status: string) {
  switch (status) {
    case "Open": return "bg-success/10 text-success"
    case "Upcoming": return "bg-primary/10 text-primary"
    case "Closed": return "bg-muted text-muted-foreground"
    default: return "bg-muted text-muted-foreground"
  }
}

export default function IPOPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">IPO Tracker</h1>
              <p className="text-sm text-muted-foreground mt-1">Track all upcoming, open, and closed IPOs on NSE & BSE</p>
            </div>
            <div className="flex gap-2">
              {["All", "Open", "Upcoming", "Closed"].map((filter) => (
                <button
                  key={filter}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    filter === "All" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Company</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Open Date</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Close Date</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Price Band</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Lot Size</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">GMP</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ipoData.map((ipo, index) => (
                    <tr key={index} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">{ipo.company}</td>
                      <td className="py-3 px-4 text-muted-foreground">{ipo.openDate}</td>
                      <td className="py-3 px-4 text-muted-foreground">{ipo.closeDate}</td>
                      <td className="py-3 px-4 text-right font-mono text-success">{ipo.priceRange}</td>
                      <td className="py-3 px-4 text-right font-mono text-foreground">{ipo.lotSize}</td>
                      <td className="py-3 px-4 text-right font-mono text-warning">{ipo.gmp}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusStyle(ipo.status)}`}>
                          {ipo.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-primary hover:underline">← Back to Home</Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
