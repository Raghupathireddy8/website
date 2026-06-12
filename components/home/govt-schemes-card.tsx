import Link from "next/link"

const schemes = [
  {
    name: "NPS",
    fullName: "National Pension System",
    icon: "🏦",
    iconBg: "bg-primary/10",
    rate: "Market Linked (10–12% avg)",
    lockIn: "Till age 60",
    taxBenefit: "Up to ₹2L under 80C + 80CCD(1B)",
    minInvestment: "₹500/month",
    bestFor: "Retirement planning",
  },
  {
    name: "PPF",
    fullName: "Public Provident Fund",
    icon: "📗",
    iconBg: "bg-success/10",
    rate: "7.10% p.a.",
    rateNote: "compounded annually",
    lockIn: "15 years",
    taxBenefit: "Up to ₹1.5L under 80C",
    minInvestment: "₹500/year, Max ₹1.5L/year",
    bestFor: "Safe long-term savings",
  },
  {
    name: "SSY",
    fullName: "Sukanya Samriddhi Yojana",
    icon: "👧",
    iconBg: "bg-warning/10",
    rate: "8.20% p.a.",
    rateNote: "highest govt rate",
    lockIn: "Till girl turns 21",
    taxBenefit: "Up to ₹1.5L under 80C",
    minInvestment: "₹250/year, Max ₹1.5L/year",
    bestFor: "Girl child education & marriage",
  },
]

export function GovtSchemesCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">Government Savings Schemes</h3>
          <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground font-medium">
            Tax Saving · 2025–26 Rates
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {schemes.map((scheme, index) => (
          <div
            key={index}
            className="border border-border rounded-lg p-4 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-2xl w-10 h-10 flex items-center justify-center rounded-lg ${scheme.iconBg}`}>
                {scheme.icon}
              </span>
              <div>
                <h4 className="font-semibold text-sm text-foreground">{scheme.name}</h4>
                <p className="text-[10px] text-muted-foreground">{scheme.fullName}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rate:</span>
                <span className="font-medium text-foreground text-right">
                  {scheme.rate}
                  {scheme.rateNote && (
                    <span className="text-muted-foreground text-[10px] block">({scheme.rateNote})</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lock-in:</span>
                <span className="font-medium text-foreground">{scheme.lockIn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax Benefit:</span>
                <span className="font-medium text-foreground text-right text-[10px]">{scheme.taxBenefit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min Investment:</span>
                <span className="font-medium text-foreground text-right text-[10px]">{scheme.minInvestment}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Best for:</span>
                <span className="font-medium text-primary text-right text-[10px]">{scheme.bestFor}</span>
              </div>
            </div>

            <Link
              href="/savings"
              className="inline-flex items-center gap-1 mt-4 text-xs text-primary font-medium hover:underline"
            >
              Learn More →
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
