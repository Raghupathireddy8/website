import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import Link from "next/link"

export default function BacktestPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Backtest Strategy</h1>
            <p className="text-sm text-muted-foreground mt-1">Test your trading strategies on historical data</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <div className="text-4xl mb-4">🔁</div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Coming Soon</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Backtest your trading strategies against historical NIFTY and stock data. See how your strategy would have performed.
            </p>
            <p className="text-xs text-muted-foreground">
              Features: Strategy builder, historical data, performance metrics, drawdown analysis.
            </p>
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
