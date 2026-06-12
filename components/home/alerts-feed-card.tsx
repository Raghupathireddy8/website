const alertsData = [
  {
    type: "Technical",
    color: "success",
    text: "NIFTY broke above 24,850 resistance",
    time: "10:31 AM",
  },
  {
    type: "Result",
    color: "warning",
    text: "Wipro Q4 EPS ₹22.4 — beat estimates by 6%",
    time: "11:05 AM",
  },
  {
    type: "Price Alert",
    color: "destructive",
    text: "HDFC Bank hit your price alert at ₹1,620",
    time: "12:18 PM",
  },
  {
    type: "Technical",
    color: "success",
    text: "TCS crossed 52-week high ₹4,280",
    time: "13:42 PM",
  },
  {
    type: "IPO",
    color: "primary",
    text: "Reliance Jio IPO opens tomorrow",
    time: "09:00 AM",
  },
]

function getDotColor(color: string) {
  switch (color) {
    case "success":
      return "bg-success"
    case "warning":
      return "bg-warning"
    case "destructive":
      return "bg-destructive"
    case "primary":
      return "bg-primary"
    default:
      return "bg-muted-foreground"
  }
}

function getBadgeStyle(type: string) {
  switch (type) {
    case "Technical":
      return "bg-success/10 text-success"
    case "Result":
      return "bg-warning/10 text-warning"
    case "Price Alert":
      return "bg-destructive/10 text-destructive"
    case "IPO":
      return "bg-primary/10 text-primary"
    default:
      return "bg-muted text-muted-foreground"
  }
}

export function AlertsFeedCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">Recent Alerts</h3>
          <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground font-medium">
            Live Feed
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {alertsData.map((alert, index) => (
          <div
            key={index}
            className="flex items-start gap-3 py-2 border-b border-border last:border-0"
          >
            <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${getDotColor(alert.color)}`} />
            
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-foreground leading-snug">
                {alert.text}
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getBadgeStyle(alert.type)}`}>
                {alert.type}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {alert.time}
              </span>
            </div>
          </div>
        ))}
      </div>

      <a
        href="https://t.me/marketgreeks"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 mt-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Subscribe on Telegram →
      </a>
    </div>
  )
}
