"use client"

import { useState } from "react"
import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import Link from "next/link"

export default function TaxCalcPage() {
  const [buyPrice, setBuyPrice] = useState("")
  const [sellPrice, setSellPrice] = useState("")
  const [quantity, setQuantity] = useState("")
  const [buyDate, setBuyDate] = useState("")
  const [sellDate, setSellDate] = useState("")
  const [result, setResult] = useState<{
    profit: number
    taxType: string
    taxRate: number
    taxAmount: number
    netProfit: number
  } | null>(null)

  const calculateTax = () => {
    const buy = parseFloat(buyPrice)
    const sell = parseFloat(sellPrice)
    const qty = parseInt(quantity)
    
    if (!buy || !sell || !qty || !buyDate || !sellDate) return

    const profit = (sell - buy) * qty
    const buyD = new Date(buyDate)
    const sellD = new Date(sellDate)
    const holdingDays = Math.floor((sellD.getTime() - buyD.getTime()) / (1000 * 60 * 60 * 24))
    
    const isLongTerm = holdingDays > 365
    const taxType = isLongTerm ? "LTCG (Long Term Capital Gains)" : "STCG (Short Term Capital Gains)"
    const taxRate = isLongTerm ? 12.5 : 20
    
    let taxableProfit = profit
    if (isLongTerm && profit > 125000) {
      taxableProfit = profit - 125000 // LTCG exemption of ₹1.25L
    } else if (isLongTerm) {
      taxableProfit = 0
    }
    
    const taxAmount = taxableProfit > 0 ? (taxableProfit * taxRate) / 100 : 0
    const netProfit = profit - taxAmount

    setResult({ profit, taxType, taxRate, taxAmount, netProfit })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Tax Calculator</h1>
            <p className="text-sm text-muted-foreground mt-1">Calculate STCG & LTCG tax on your equity investments</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Buy Price (per share)</label>
                <input
                  type="number"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  placeholder="₹0"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Sell Price (per share)</label>
                <input
                  type="number"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="₹0"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Buy Date</label>
                <input
                  type="date"
                  value={buyDate}
                  onChange={(e) => setBuyDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Sell Date</label>
                <input
                  type="date"
                  value={sellDate}
                  onChange={(e) => setSellDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <button
              onClick={calculateTax}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Calculate Tax
            </button>

            {result && (
              <div className="mt-6 pt-6 border-t border-border space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Profit/Loss</span>
                  <span className={`font-mono font-medium ${result.profit >= 0 ? "text-success" : "text-destructive"}`}>
                    {result.profit >= 0 ? "+" : ""}₹{result.profit.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax Type</span>
                  <span className="font-medium text-foreground">{result.taxType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax Rate</span>
                  <span className="font-mono text-foreground">{result.taxRate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax Payable</span>
                  <span className="font-mono font-medium text-warning">₹{result.taxAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm pt-3 border-t border-border">
                  <span className="font-medium text-foreground">Net Profit/Loss</span>
                  <span className={`font-mono font-semibold ${result.netProfit >= 0 ? "text-success" : "text-destructive"}`}>
                    {result.netProfit >= 0 ? "+" : ""}₹{result.netProfit.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            )}

            <p className="mt-4 text-[10px] text-muted-foreground">
              * LTCG exemption of ₹1.25L applicable. Tax rates as per Budget 2024. This is for educational purposes only.
            </p>
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
