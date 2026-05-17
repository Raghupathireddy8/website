"use client"

import { useState } from "react"
import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import Link from "next/link"

const virtualPortfolio = [
  { stock: "TCS", qty: 25, avgPrice: 4100, ltp: 4280, pnl: 4500 },
  { stock: "RELIANCE", qty: 10, avgPrice: 2800, ltp: 2890, pnl: 900 },
  { stock: "HDFCBANK", qty: 30, avgPrice: 1700, ltp: 1680, pnl: -600 },
  { stock: "INFY", qty: 50, avgPrice: 1780, ltp: 1820, pnl: 2000 },
]

export default function VirtualTradePage() {
  const [balance] = useState(843500)
  const totalInvested = virtualPortfolio.reduce((sum, item) => sum + (item.qty * item.avgPrice), 0)
  const currentValue = virtualPortfolio.reduce((sum, item) => sum + (item.qty * item.ltp), 0)
  const totalPnL = currentValue - totalInvested

  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Virtual Trading</h1>
            <p className="text-sm text-muted-foreground mt-1">Practice trading with ₹10L virtual money — no real risk!</p>
          </div>

          {/* Account Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Available Cash</p>
              <p className="text-xl font-mono font-semibold text-foreground">₹{balance.toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Invested</p>
              <p className="text-xl font-mono font-semibold text-foreground">₹{totalInvested.toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current Value</p>
              <p className="text-xl font-mono font-semibold text-foreground">₹{currentValue.toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total P&L</p>
              <p className={`text-xl font-mono font-semibold ${totalPnL >= 0 ? "text-success" : "text-destructive"}`}>
                {totalPnL >= 0 ? "+" : ""}₹{totalPnL.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Buy/Sell Form */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-base font-semibold text-foreground mb-4">Place Order</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Stock Symbol</label>
                  <input
                    type="text"
                    placeholder="e.g. TCS, RELIANCE"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Quantity</label>
                    <input
                      type="number"
                      placeholder="0"
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Price</label>
                    <input
                      type="number"
                      placeholder="Market"
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button className="bg-success text-success-foreground py-2 rounded-lg text-sm font-medium hover:bg-success/90 transition-colors">
                    BUY
                  </button>
                  <button className="bg-destructive text-destructive-foreground py-2 rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors">
                    SELL
                  </button>
                </div>
              </div>
            </div>

            {/* Portfolio */}
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
              <h3 className="text-base font-semibold text-foreground mb-4">Your Portfolio</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium text-muted-foreground">Stock</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Qty</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Avg Price</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">LTP</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {virtualPortfolio.map((item, index) => (
                      <tr key={index} className="border-b border-border last:border-0">
                        <td className="py-3 font-semibold text-foreground">{item.stock}</td>
                        <td className="py-3 text-right font-mono text-foreground">{item.qty}</td>
                        <td className="py-3 text-right font-mono text-muted-foreground">₹{item.avgPrice.toLocaleString("en-IN")}</td>
                        <td className="py-3 text-right font-mono text-foreground">₹{item.ltp.toLocaleString("en-IN")}</td>
                        <td className={`py-3 text-right font-mono font-medium ${item.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                          {item.pnl >= 0 ? "+" : ""}₹{item.pnl.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
