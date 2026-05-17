import Link from "next/link"

const ipoData = [
  {
    company: "Reliance Jio",
    openDate: "Opens May 20",
    priceRange: "₹240–260",
    gmp: "+₹38",
    status: "Open",
  },
  {
    company: "NTPC Green Energy",
    openDate: "Opens May 23",
    priceRange: "₹108–112",
    gmp: "+₹12",
    status: "Upcoming",
  },
  {
    company: "Bajaj Housing Finance",
    openDate: "Opens Jun 2",
    priceRange: "₹TBA",
    gmp: "—",
    status: "Upcoming",
  },
  {
    company: "Ola Electric Series B",
    openDate: "Opens Jun 10",
    priceRange: "₹TBA",
    gmp: "—",
    status: "Upcoming",
  },
  {
    company: "IndiGo Hotels",
    openDate: "Opens Jun 18",
    priceRange: "₹180–195",
    gmp: "+₹5",
    status: "Upcoming",
  },
]

function getStatusStyle(status: string) {
  switch (status) {
    case "Open":
      return "bg-success/10 text-success"
    case "Upcoming":
      return "bg-primary/10 text-primary"
    case "Closed":
      return "bg-muted text-muted-foreground"
    default:
      return "bg-muted text-muted-foreground"
  }
}

export function UpcomingIPOsCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">Upcoming IPOs</h3>
          <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground font-medium">
            NSE · BSE
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {ipoData.map((ipo, index) => (
          <div
            key={index}
            className="flex items-center justify-between py-2 border-b border-border last:border-0"
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">
                {ipo.company}
              </p>
              <p className="text-xs text-muted-foreground">{ipo.openDate}</p>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-mono text-xs px-2 py-1 bg-success/10 text-success rounded-md">
                {ipo.priceRange}
              </span>
              <span className="text-xs text-warning font-medium min-w-[50px]">
                GMP {ipo.gmp}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getStatusStyle(
                  ipo.status
                )}`}
              >
                {ipo.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/ipo"
        className="inline-flex items-center gap-1 mt-4 text-sm text-primary font-medium hover:underline"
      >
        View All IPOs →
      </Link>
    </div>
  )
}
