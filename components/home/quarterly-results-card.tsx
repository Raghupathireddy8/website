import Link from "next/link"

const resultsData = [
  { company: "TCS", epsEst: "₹28.2", epsActual: "₹30.4", vsEst: "+8%", revenue: "₹63,850 Cr", positive: true },
  { company: "Wipro", epsEst: "₹21.1", epsActual: "₹22.4", vsEst: "+6%", revenue: "₹22,300 Cr", positive: true },
  { company: "Infosys", epsEst: "₹18.5", epsActual: "₹18.5", vsEst: "0%", revenue: "₹40,925 Cr", positive: null },
  { company: "SBI", epsEst: "₹19.4", epsActual: "₹21.1", vsEst: "+9%", revenue: "₹1,28,400 Cr", positive: true },
  { company: "ITC", epsEst: "₹6.8", epsActual: "₹6.5", vsEst: "−4%", revenue: "₹18,750 Cr", positive: false },
]

function getVsEstStyle(positive: boolean | null) {
  if (positive === true) return "text-success"
  if (positive === false) return "text-destructive"
  return "text-muted-foreground"
}

function getArrow(positive: boolean | null) {
  if (positive === true) return " ▲"
  if (positive === false) return " ▼"
  return " →"
}

export function QuarterlyResultsCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">Q4 Results</h3>
          <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground font-medium">
            FY 2025–26
          </span>
        </div>
      </div>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 font-medium text-muted-foreground">Company</th>
              <th className="text-right py-2 font-medium text-muted-foreground">EPS Est</th>
              <th className="text-right py-2 font-medium text-muted-foreground">EPS Actual</th>
              <th className="text-right py-2 font-medium text-muted-foreground">vs Est</th>
              <th className="text-right py-2 font-medium text-muted-foreground hidden sm:table-cell">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {resultsData.map((result, index) => (
              <tr key={index} className="border-b border-border last:border-0">
                <td className="py-2 font-medium text-foreground">{result.company}</td>
                <td className="py-2 text-right font-mono text-muted-foreground">{result.epsEst}</td>
                <td className="py-2 text-right font-mono text-foreground font-medium">{result.epsActual}</td>
                <td className={`py-2 text-right font-mono font-medium ${getVsEstStyle(result.positive)}`}>
                  {result.vsEst}{getArrow(result.positive)}
                </td>
                <td className="py-2 text-right font-mono text-muted-foreground hidden sm:table-cell">{result.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Link
        href="/results"
        className="inline-flex items-center gap-1 mt-4 text-sm text-primary font-medium hover:underline"
      >
        View All Results →
      </Link>
    </div>
  )
}
