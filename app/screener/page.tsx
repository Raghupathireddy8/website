import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import Link from "next/link"

const screenerData = [
  { stock: "BANKNIFTY", ltp: "52,450", ivRank: 82, iv: 18.5, pcr: 1.24, maxPain: "52,000" },
  { stock: "INFY", ltp: "1,820", ivRank: 91, iv: 24.2, pcr: 0.85, maxPain: "1,800" },
  { stock: "RELIANCE", ltp: "2,890", ivRank: 76, iv: 21.3, pcr: 1.12, maxPain: "2,850" },
  { stock: "HDFCBANK", ltp: "1,680", ivRank: 68, iv: 19.8, pcr: 0.92, maxPain: "1,700" },
  { stock: "TCS", ltp: "4,280", ivRank: 55, iv: 16.4, pcr: 1.35, maxPain: "4,200" },
  { stock: "NIFTY50", ltp: "24,850", ivRank: 44, iv: 12.8, pcr: 1.18, maxPain: "24,500" },
  { stock: "ICICIBANK", ltp: "1,240", ivRank: 62, iv: 20.1, pcr: 0.98, maxPain: "1,250" },
  { stock: "SBIN", ltp: "780", ivRank: 71, iv: 22.5, pcr: 1.05, maxPain: "775" },
  { stock: "AXISBANK", ltp: "1,120", ivRank: 58, iv: 18.9, pcr: 0.88, maxPain: "1,100" },
  { stock: "WIPRO", ltp: "485", ivRank: 85, iv: 26.3, pcr: 0.72, maxPain: "480" },
]

function getIVRankStyle(ivRank: number) {
  if (ivRank > 80) return "bg-destructive/10 text-destructive"
  if (ivRank >= 60) return "bg-warning/10 text-warning"
  return "bg-success/10 text-success"
}

function getBarColor(ivRank: number) {
  if (ivRank > 80) return "bg-destructive"
  if (ivRank >= 60) return "bg-warning"
  return "bg-success"
}

export default function ScreenerPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">IV Rank Screener</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Implied Volatility Rank for F&O stocks. IV Rank &gt; 70 = Expensive options → good to SELL
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mb-4 text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-destructive"></span>
              <span className="text-muted-foreground">Very High (&gt;80)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-warning"></span>
              <span className="text-muted-foreground">High (60-80)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-success"></span>
              <span className="text-muted-foreground">Normal (&lt;60)</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Stock</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">LTP</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-48">IV Rank</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">IV %</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">PCR</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Max Pain</th>
                  </tr>
                </thead>
                <tbody>
                  {screenerData.map((item, index) => (
                    <tr key={index} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">{item.stock}</td>
                      <td className="py-3 px-4 text-right font-mono text-foreground">₹{item.ltp}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${getBarColor(item.ivRank)}`}
                              style={{ width: `${item.ivRank}%` }}
                            />
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${getIVRankStyle(item.ivRank)}`}>
                            {item.ivRank}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">{item.iv}%</td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">{item.pcr}</td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">₹{item.maxPain}</td>
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
