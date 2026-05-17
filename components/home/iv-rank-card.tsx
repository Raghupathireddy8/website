import Link from "next/link"

const ivRankData = [
  { stock: "BANKNIFTY", ivRank: 82 },
  { stock: "INFY", ivRank: 91 },
  { stock: "RELIANCE", ivRank: 76 },
  { stock: "HDFCBANK", ivRank: 68 },
  { stock: "TCS", ivRank: 55 },
  { stock: "NIFTY50", ivRank: 44 },
]

function getBarColor(ivRank: number) {
  if (ivRank > 80) return "bg-destructive"
  if (ivRank >= 60) return "bg-warning"
  return "bg-success"
}

function getTextColor(ivRank: number) {
  if (ivRank > 80) return "text-destructive"
  if (ivRank >= 60) return "text-warning"
  return "text-success"
}

export function IVRankCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">High IV Rank Stocks</h3>
          <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground font-medium">
            Options Sellers
          </span>
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground mb-4">
        IV Rank &gt; 70 = Expensive options → good to SELL
      </p>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-[10px] font-medium">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-destructive"></span>
          <span className="text-muted-foreground">Very High</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-warning"></span>
          <span className="text-muted-foreground">High</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-success"></span>
          <span className="text-muted-foreground">Normal</span>
        </div>
      </div>

      <div className="space-y-3">
        {ivRankData.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <span className="text-xs font-medium text-foreground w-20 truncate">
              {item.stock}
            </span>
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(item.ivRank)}`}
                style={{ width: `${item.ivRank}%` }}
              />
            </div>
            <span className={`font-mono text-xs font-medium w-8 text-right ${getTextColor(item.ivRank)}`}>
              {item.ivRank}
            </span>
          </div>
        ))}
      </div>

      <Link
        href="/screener"
        className="inline-flex items-center gap-1 mt-4 text-sm text-primary font-medium hover:underline"
      >
        View Full Screener →
      </Link>
    </div>
  )
}
