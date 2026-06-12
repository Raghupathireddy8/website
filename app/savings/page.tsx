import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import Link from "next/link"

const schemes = [
  {
    name: "NPS",
    fullName: "National Pension System",
    icon: "🏦",
    iconBg: "bg-primary/10",
    description: "A government-sponsored pension scheme for systematic retirement savings with tax benefits.",
    rate: "Market Linked (10–12% avg)",
    lockIn: "Till age 60",
    taxBenefit: "Up to ₹2L under 80C + 80CCD(1B)",
    minInvestment: "₹500/month",
    maxInvestment: "No limit",
    bestFor: "Retirement planning",
    features: [
      "Choice of fund managers and asset allocation",
      "60% corpus tax-free at maturity",
      "Additional ₹50,000 deduction under 80CCD(1B)",
      "Partial withdrawal allowed for specific purposes",
    ],
  },
  {
    name: "PPF",
    fullName: "Public Provident Fund",
    icon: "📗",
    iconBg: "bg-success/10",
    description: "A long-term, risk-free savings scheme backed by the Government of India with EEE tax status.",
    rate: "7.10% p.a. (compounded annually)",
    lockIn: "15 years",
    taxBenefit: "Up to ₹1.5L under 80C",
    minInvestment: "₹500/year",
    maxInvestment: "₹1.5L/year",
    bestFor: "Safe long-term savings",
    features: [
      "EEE status: Exempt at investment, growth, and withdrawal",
      "Loan facility available from 3rd to 6th year",
      "Partial withdrawal from 7th year",
      "Can be extended in blocks of 5 years",
    ],
  },
  {
    name: "SSY",
    fullName: "Sukanya Samriddhi Yojana",
    icon: "👧",
    iconBg: "bg-warning/10",
    description: "A savings scheme for the girl child with the highest government-backed interest rate.",
    rate: "8.20% p.a. (highest govt rate)",
    lockIn: "Till girl turns 21",
    taxBenefit: "Up to ₹1.5L under 80C",
    minInvestment: "₹250/year",
    maxInvestment: "₹1.5L/year",
    bestFor: "Girl child education & marriage",
    features: [
      "Highest interest rate among small savings schemes",
      "Account can be opened for girl child below 10 years",
      "Partial withdrawal for higher education after age 18",
      "EEE tax status",
    ],
  },
  {
    name: "NSC",
    fullName: "National Savings Certificate",
    icon: "📜",
    iconBg: "bg-primary/10",
    description: "A fixed-income investment scheme with guaranteed returns and tax benefits.",
    rate: "7.70% p.a. (compounded annually)",
    lockIn: "5 years",
    taxBenefit: "Up to ₹1.5L under 80C",
    minInvestment: "₹1,000",
    maxInvestment: "No limit",
    bestFor: "Guaranteed returns seekers",
    features: [
      "Interest compounds annually but paid at maturity",
      "Accrued interest qualifies for 80C deduction",
      "Can be pledged as collateral for loans",
      "Available at all post offices",
    ],
  },
  {
    name: "SCSS",
    fullName: "Senior Citizens Savings Scheme",
    icon: "👴",
    iconBg: "bg-success/10",
    description: "A special savings scheme for senior citizens with high interest and quarterly payouts.",
    rate: "8.20% p.a. (paid quarterly)",
    lockIn: "5 years",
    taxBenefit: "Up to ₹1.5L under 80C",
    minInvestment: "₹1,000",
    maxInvestment: "₹30L",
    bestFor: "Senior citizens seeking regular income",
    features: [
      "Quarterly interest payout for regular income",
      "Available to individuals above 60 years",
      "VRS/superannuation beneficiaries eligible at 55",
      "Can be extended for 3 more years after maturity",
    ],
  },
]

export default function SavingsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Government Savings Schemes</h1>
            <p className="text-sm text-muted-foreground mt-1">Compare tax-saving schemes with 2025–26 interest rates</p>
          </div>

          <div className="space-y-6">
            {schemes.map((scheme, index) => (
              <div key={index} className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-start gap-4 mb-4">
                  <span className={`text-3xl w-14 h-14 flex items-center justify-center rounded-xl ${scheme.iconBg}`}>
                    {scheme.icon}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-foreground">{scheme.name}</h2>
                      <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                        {scheme.fullName}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{scheme.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Interest Rate</p>
                    <p className="text-sm font-semibold text-success">{scheme.rate}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Lock-in</p>
                    <p className="text-sm font-semibold text-foreground">{scheme.lockIn}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tax Benefit</p>
                    <p className="text-sm font-semibold text-foreground">{scheme.taxBenefit}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Min Investment</p>
                    <p className="text-sm font-semibold text-foreground">{scheme.minInvestment}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Max Investment</p>
                    <p className="text-sm font-semibold text-foreground">{scheme.maxInvestment}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Best For</p>
                    <p className="text-sm font-semibold text-primary">{scheme.bestFor}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Key Features:</p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {scheme.features.map((feature, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-success mt-0.5">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
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
