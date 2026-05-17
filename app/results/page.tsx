import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import Link from "next/link"
import { Search } from "lucide-react"

const resultsData = [
  { company: "TCS", sector: "IT", epsEst: "₹28.2", epsActual: "₹30.4", vsEst: "+8%", revenue: "₹63,850 Cr", positive: true },
  { company: "Wipro", sector: "IT", epsEst: "₹21.1", epsActual: "₹22.4", vsEst: "+6%", revenue: "₹22,300 Cr", positive: true },
  { company: "Infosys", sector: "IT", epsEst: "₹18.5", epsActual: "₹18.5", vsEst: "0%", revenue: "₹40,925 Cr", positive: null },
  { company: "SBI", sector: "Banking", epsEst: "₹19.4", epsActual: "₹21.1", vsEst: "+9%", revenue: "₹1,28,400 Cr", positive: true },
  { company: "ITC", sector: "FMCG", epsEst: "₹6.8", epsActual: "₹6.5", vsEst: "−4%", revenue: "₹18,750 Cr", positive: false },
  { company: "HDFC Bank", sector: "Banking", epsEst: "₹24.8", epsActual: "₹26.2", vsEst: "+6%", revenue: "₹52,100 Cr", positive: true },
  { company: "Reliance", sector: "Energy", epsEst: "₹32.5", epsActual: "₹35.1", vsEst: "+8%", revenue: "₹2,35,000 Cr", positive: true },
  { company: "ICICI Bank", sector: "Banking", epsEst: "₹18.2", epsActual: "₹19.8", vsEst: "+9%", revenue: "₹41,200 Cr", positive: true },
]

function getVsEstStyle(positive: boolean | null) {
  if (positive === true) return "text-success"
  if (positive === false) return "text-destructive"
  return "text-muted-foreground"
}

export default function ResultsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Quarterly Results</h1>
              <p className="text-sm text-muted-foreground mt-1">Q4 FY 2025–26 earnings reports</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search company..."
                  className="w-full sm:w-64 pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <select className="px-3 py-2 text-sm border border-border rounded-lg bg-card text-muted-foreground">
                <option>All Sectors</option>
                <option>IT</option>
                <option>Banking</option>
                <option>FMCG</option>
                <option>Energy</option>
              </select>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Company</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Sector</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">EPS Est</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">EPS Actual</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">vs Est</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {resultsData.map((result, index) => (
                    <tr key={index} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">{result.company}</td>
                      <td className="py-3 px-4 text-muted-foreground">{result.sector}</td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">{result.epsEst}</td>
                      <td className="py-3 px-4 text-right font-mono text-foreground font-medium">{result.epsActual}</td>
                      <td className={`py-3 px-4 text-right font-mono font-medium ${getVsEstStyle(result.positive)}`}>
                        {result.vsEst}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">{result.revenue}</td>
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
