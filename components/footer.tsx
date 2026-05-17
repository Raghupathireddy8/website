import Link from "next/link"
import { Send } from "lucide-react"

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/ipo", label: "IPO" },
  { href: "/results", label: "Results" },
  { href: "/screener", label: "Screener" },
  { href: "/virtual-trade", label: "Virtual Trade" },
  { href: "/tax-calc", label: "Tax Calc" },
  { href: "/mutual-funds", label: "Mutual Funds" },
]

export function Footer() {
  return (
    <footer className="bg-foreground text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo and tagline */}
          <div>
            <div className="flex items-center gap-0 mb-3">
              <span className="text-lg font-bold text-primary">Market</span>
              <span className="text-lg font-bold text-white">Greeks</span>
            </div>
            <p className="text-white/70 text-sm">
              Your complete Indian market toolkit
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-white/70 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Telegram and copyright */}
          <div className="flex flex-col items-start md:items-end gap-4">
            <a
              href="https://t.me/marketgreeks"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Send className="h-4 w-4" />
              Join our Telegram
            </a>
            <p className="text-xs text-white/50">
              © 2026 MarketGreeks. Not SEBI registered. For educational purposes only.
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-xs text-white/40 text-center">
            Data is delayed by 15 minutes. Not investment advice. Please consult a SEBI registered advisor before making investment decisions.
          </p>
        </div>
      </div>
    </footer>
  )
}
