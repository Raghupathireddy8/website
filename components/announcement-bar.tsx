"use client"

import { useState } from "react"
import { X } from "lucide-react"

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="bg-primary text-primary-foreground py-2 px-4">
      <div className="mx-auto max-w-7xl flex items-center justify-center gap-2 text-sm">
        <span className="hidden sm:inline">🚀</span>
        <span className="text-center">
          <span className="font-semibold">MarketGreeks Beta</span>
          <span className="hidden sm:inline"> — Free tools for Indian traders & investors.</span>
          <a
            href="https://t.me/marketgreeks"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 underline underline-offset-2 hover:no-underline"
          >
            Join Telegram for alerts →
          </a>
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="ml-2 p-1 hover:bg-white/10 rounded transition-colors"
          aria-label="Dismiss announcement"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
