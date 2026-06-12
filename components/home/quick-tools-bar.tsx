import Link from "next/link"
import { Calculator, TrendingUp, RefreshCw, Search } from "lucide-react"

const tools = [
  {
    icon: Calculator,
    title: "Tax Calculator",
    description: "Calculate STCG & LTCG tax instantly",
    href: "/tax-calc",
    color: "text-primary",
  },
  {
    icon: TrendingUp,
    title: "Virtual Trading",
    description: "Practice trading with ₹10L virtual money",
    href: "/virtual-trade",
    color: "text-success",
  },
  {
    icon: RefreshCw,
    title: "Backtest Strategy",
    description: "Test your strategy on historical data",
    href: "/backtest",
    color: "text-warning",
  },
  {
    icon: Search,
    title: "MF Compare",
    description: "Compare mutual fund returns & ratings",
    href: "/mutual-funds",
    color: "text-primary",
  },
]

export function QuickToolsBar() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {tools.map((tool, index) => (
        <div
          key={index}
          className="bg-card border border-border rounded-xl p-4 flex items-start gap-4"
        >
          <div className={`p-2 rounded-lg bg-muted ${tool.color}`}>
            <tool.icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground mb-1">{tool.title}</h3>
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
              {tool.description}
            </p>
            <Link
              href={tool.href}
              className="inline-flex items-center bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              Open
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
