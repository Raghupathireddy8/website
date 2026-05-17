import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { LiveIndicesBar } from "@/components/home/live-indices-bar"
import { UpcomingIPOsCard } from "@/components/home/upcoming-ipos-card"
import { MarketPulseCard } from "@/components/home/market-pulse-card"
import { IVRankCard } from "@/components/home/iv-rank-card"
import { QuarterlyResultsCard } from "@/components/home/quarterly-results-card"
import { GovtSchemesCard } from "@/components/home/govt-schemes-card"
import { QuickToolsBar } from "@/components/home/quick-tools-bar"

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Section 1: Live Indices Bar */}
          <LiveIndicesBar />

          {/* Section 2: Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card A - Upcoming IPOs */}
            <UpcomingIPOsCard />
            
            {/* Card B - Market Pulse */}
            <MarketPulseCard />
            
            {/* Card C - IV Rank Screener */}
            <IVRankCard />
            
            {/* Card D - Quarterly Results */}
            <QuarterlyResultsCard />
          </div>

          {/* Card E - Govt Savings Schemes (full width) */}
          <GovtSchemesCard />

          {/* Section 3: Quick Tools Bar */}
          <QuickToolsBar />
        </div>
      </main>

      <Footer />
    </div>
  )
}
