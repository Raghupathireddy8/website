"use client"

import { useState, useCallback } from "react"
import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import Link from "next/link"

// ─── Types ────────────────────────────────────────────────────────────────────

type CalcId = "emi" | "sip" | "avg" | "tax" | "sipemi" | "greeks" | "cagr" | "be"
type EmiType = "PL" | "HL" | "AL"
type SipMode = "regular" | "stepup"
type TaxRegime = "new" | "old"
type CagrMode = "find" | "target" | "lumpsum"
type BeMode = "options" | "equity"
type OptionType = "call" | "put" | "callsell" | "putsell"

interface AvgEntry { price: string; qty: string }

interface EmiResult {
  emi: number; principal: number; interest: number; fee: number; total: number; effectiveRate: number
}
interface SipResult {
  invested: number; gains: number; fv: number; wealthPct: number
}
interface AvgResult {
  entries: { price: number; qty: number; cost: number }[]
  totalQty: number; totalCost: number; avgPrice: number; reduction: number
}
interface TaxResult {
  gross: number; taxable: number; tax: number; cess: number; total: number; effectiveRate: number
}
interface SipEmiResult {
  originalTenure: number; reducedTenure: number; monthsSaved: number; sipTotal: number; interestSaved: number
}
interface GreeksResult {
  price: number; delta: number; gamma: number; theta: number; vega: number; rho: number; iv: number; moneyness: string
}
interface CagrResult {
  cagr?: number; absolutePct?: number; gained?: number
  years?: number; doublesIn?: number; target?: number
  fv?: number; gains?: number; absPct?: number
}
interface BeResult {
  be: number; label?: string; maxProfit?: string; maxLoss?: string; premiumTotal?: number
  totalCharges?: number; pctAboveBuy?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN")
const fmtD = (n: number) => n.toFixed(4)

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  const res = 1 - poly * Math.exp(-x * x)
  return x >= 0 ? res : -res
}
const N = (x: number) => (1 + erf(x / Math.sqrt(2))) / 2
const pdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono transition-colors"
const selectCls =
  "w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"

function CalcButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors mt-4"
    >
      {children}
    </button>
  )
}

function ResultRow({
  label, value, valueClass = "text-foreground", isTotal = false,
}: {
  label: string; value: string; valueClass?: string; isTotal?: boolean
}) {
  return (
    <div className={`flex justify-between items-center py-2 ${isTotal ? "border-t border-border mt-1 pt-3" : "border-b border-border"}`}>
      <span className={`text-sm ${isTotal ? "font-medium text-foreground" : "text-muted-foreground"}`}>{label}</span>
      <span className={`font-mono text-sm font-medium ${valueClass} ${isTotal ? "text-base" : ""}`}>{value}</span>
    </div>
  )
}

function ResultBox({ children }: { children: React.ReactNode }) {
  return <div className="bg-background border border-border rounded-xl p-4 mt-4 space-y-0">{children}</div>
}

function InsightBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-4">
      <p className="text-[10px] uppercase tracking-wider text-primary font-medium mb-2">{title}</p>
      {children}
    </div>
  )
}

function SubTabs<T extends string>({
  tabs, active, onChange,
}: {
  tabs: { id: T; label: string }[]; active: T; onChange: (id: T) => void
}) {
  return (
    <div className="flex gap-2 flex-wrap mb-5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            active === t.id
              ? "bg-primary/10 border-primary/40 text-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">{children}</p>
}

// ─── Calculators ──────────────────────────────────────────────────────────────

function EmiCalculator() {
  const [emiType, setEmiType] = useState<EmiType>("PL")
  const [principal, setPrincipal] = useState("500000")
  const [rate, setRate] = useState("12")
  const [tenure, setTenure] = useState("60")
  const [fee, setFee] = useState("5000")
  const [result, setResult] = useState<EmiResult | null>(null)

  const hints: Record<EmiType, string> = {
    PL: "Typical rate: 10–24% p.a.",
    HL: "Typical rate: 8–10% p.a.",
    AL: "Typical rate: 7–14% p.a.",
  }

  const calculate = () => {
    const P = parseFloat(principal), r = parseFloat(rate) / 12 / 100
    const n = parseInt(tenure), f = parseFloat(fee) || 0
    if (!P || !r || !n) return
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    const total = emi * n
    const interest = total - P
    const effectiveRate = ((interest + f) / P / n) * 12 * 100
    setResult({ emi, principal: P, interest, fee: f, total: total + f, effectiveRate })
  }

  return (
    <div>
      <SubTabs
        tabs={[{ id: "PL", label: "Personal Loan" }, { id: "HL", label: "Home Loan" }, { id: "AL", label: "Auto Loan" }]}
        active={emiType} onChange={setEmiType}
      />
      <p className="text-xs text-muted-foreground mb-4">{hints[emiType]}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Loan Amount (₹)"><input type="number" value={principal} onChange={e => setPrincipal(e.target.value)} className={inputCls} /></Field>
        <Field label="Interest Rate (% p.a.)"><input type="number" value={rate} step="0.1" onChange={e => setRate(e.target.value)} className={inputCls} /></Field>
        <Field label="Tenure (months)"><input type="number" value={tenure} onChange={e => setTenure(e.target.value)} className={inputCls} /></Field>
        <Field label="Processing Fee (₹)"><input type="number" value={fee} onChange={e => setFee(e.target.value)} className={inputCls} /></Field>
      </div>
      <CalcButton onClick={calculate}>Calculate EMI</CalcButton>
      {result && (
        <ResultBox>
          <ResultRow label="Monthly EMI" value={fmt(result.emi)} valueClass="text-primary" />
          <ResultRow label="Principal Amount" value={fmt(result.principal)} />
          <ResultRow label="Total Interest" value={fmt(result.interest)} valueClass="text-destructive" />
          <ResultRow label="Processing Fee" value={fmt(result.fee)} valueClass="text-warning" />
          <ResultRow label="Total Payable" value={fmt(result.total)} isTotal />
        </ResultBox>
      )}
      {result && (
        <Note>* Effective rate including fee: ~{result.effectiveRate.toFixed(2)}% p.a. Interest is {((result.interest / result.total) * 100).toFixed(1)}% of total repayment.</Note>
      )}
    </div>
  )
}

function SipCalculator() {
  const [mode, setMode] = useState<SipMode>("regular")
  const [monthly, setMonthly] = useState("10000")
  const [rate, setRate] = useState("12")
  const [years, setYears] = useState("10")
  const [stepup, setStepup] = useState("10")
  const [result, setResult] = useState<SipResult | null>(null)

  const calculate = () => {
    const m = parseFloat(monthly), r = parseFloat(rate) / 12 / 100
    const y = parseFloat(years), su = parseFloat(stepup) || 0
    if (!m || !r || !y) return
    let fv = 0, invested = 0
    if (mode === "stepup") {
      let monthly = m
      for (let yr = 0; yr < y; yr++) {
        for (let mo = 0; mo < 12; mo++) { fv = (fv + monthly) * (1 + r); invested += monthly }
        monthly *= (1 + su / 100)
      }
    } else {
      const n = y * 12
      fv = m * ((Math.pow(1 + r, n) - 1) / r) * (1 + r)
      invested = m * n
    }
    const gains = fv - invested
    setResult({ invested, gains, fv, wealthPct: (gains / invested) * 100 })
  }

  return (
    <div>
      <SubTabs
        tabs={[{ id: "regular", label: "Regular SIP" }, { id: "stepup", label: "Step-up SIP" }]}
        active={mode} onChange={setMode}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Monthly SIP (₹)"><input type="number" value={monthly} onChange={e => setMonthly(e.target.value)} className={inputCls} /></Field>
        <Field label="Expected Return (% p.a.)"><input type="number" value={rate} step="0.1" onChange={e => setRate(e.target.value)} className={inputCls} /></Field>
        <Field label="Duration (years)"><input type="number" value={years} onChange={e => setYears(e.target.value)} className={inputCls} /></Field>
        {mode === "stepup" && (
          <Field label="Annual Step-up (%)"><input type="number" value={stepup} onChange={e => setStepup(e.target.value)} className={inputCls} /></Field>
        )}
      </div>
      <CalcButton onClick={calculate}>Calculate Returns</CalcButton>
      {result && (
        <ResultBox>
          <ResultRow label="Total Invested" value={fmt(result.invested)} />
          <ResultRow label="Estimated Gains" value={fmt(result.gains)} valueClass="text-success" />
          <ResultRow label="Wealth Gained" value={`${result.wealthPct.toFixed(1)}%`} valueClass="text-success" />
          <ResultRow label="Maturity Value" value={fmt(result.fv)} valueClass="text-success" isTotal />
        </ResultBox>
      )}
    </div>
  )
}

function AvgCalculator() {
  const [entries, setEntries] = useState<AvgEntry[]>([
    { price: "500", qty: "100" }, { price: "450", qty: "100" },
  ])
  const [result, setResult] = useState<AvgResult | null>(null)

  const add = () => { if (entries.length < 5) setEntries([...entries, { price: "", qty: "" }]) }
  const remove = (i: number) => setEntries(entries.filter((_, idx) => idx !== i))
  const update = (i: number, field: keyof AvgEntry, val: string) => {
    const next = [...entries]; next[i] = { ...next[i], [field]: val }; setEntries(next)
  }

  const calculate = () => {
    const parsed = entries.map(e => ({ price: parseFloat(e.price) || 0, qty: parseFloat(e.qty) || 0 }))
    const totalQty = parsed.reduce((s, e) => s + e.qty, 0)
    const totalCost = parsed.reduce((s, e) => s + e.price * e.qty, 0)
    const avgPrice = totalCost / totalQty
    const reduction = ((parsed[0].price - avgPrice) / parsed[0].price) * 100
    setResult({ entries: parsed.map(e => ({ ...e, cost: e.price * e.qty })), totalQty, totalCost, avgPrice, reduction })
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">Add up to 5 buy entries to calculate your weighted average cost.</p>
      <div className="space-y-3 mb-3">
        {entries.map((e, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <Field label={`Buy Price ${i + 1} (₹)`}>
              <input type="number" value={e.price} onChange={ev => update(i, "price", ev.target.value)} className={inputCls} />
            </Field>
            <Field label={`Quantity ${i + 1}`}>
              <input type="number" value={e.qty} onChange={ev => update(i, "qty", ev.target.value)} className={inputCls} />
            </Field>
            {entries.length > 1 ? (
              <button onClick={() => remove(i)} className="px-3 py-2 border border-border rounded-lg text-destructive text-sm hover:bg-destructive/5 transition-colors mb-0.5">✕</button>
            ) : <div />}
          </div>
        ))}
      </div>
      {entries.length < 5 && (
        <button onClick={add} className="w-full py-2 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors mb-4">
          + Add entry ({entries.length}/5)
        </button>
      )}
      <CalcButton onClick={calculate}>Calculate Average</CalcButton>
      {result && (
        <ResultBox>
          {result.entries.map((e, i) => (
            <ResultRow key={i} label={`Buy ${i + 1}: ${e.qty} shares @ ${fmt(e.price)}`} value={fmt(e.cost)} />
          ))}
          <ResultRow label="Total Shares" value={result.totalQty.toLocaleString("en-IN")} />
          <ResultRow label="Total Investment" value={fmt(result.totalCost)} />
          <ResultRow label="Average Cost Price" value={fmt(result.avgPrice)} valueClass="text-primary" isTotal />
        </ResultBox>
      )}
      {result && (
        <Note>* First buy {fmt(result.entries[0].price)} → avg reduced to {fmt(result.avgPrice)} ({result.reduction.toFixed(1)}% reduction). Sell above {fmt(result.avgPrice)} to profit.</Note>
      )}
    </div>
  )
}

function TaxCalculator() {
  const [regime, setRegime] = useState<TaxRegime>("new")
  const [income, setIncome] = useState("1200000")
  const [hra, setHra] = useState("0")
  const [d80c, setD80c] = useState("150000")
  const [d80d, setD80d] = useState("25000")
  const [nps, setNps] = useState("50000")
  const [hl, setHl] = useState("0")
  const [lta, setLta] = useState("0")
  const [others, setOthers] = useState("0")
  const [result, setResult] = useState<TaxResult | null>(null)

  const calculate = () => {
    const gross = parseFloat(income) || 0
    let taxable = 0, tax = 0
    if (regime === "new") {
      taxable = gross - 75000
      if (taxable <= 300000) tax = 0
      else if (taxable <= 700000) tax = (taxable - 300000) * 0.05
      else if (taxable <= 1000000) tax = 20000 + (taxable - 700000) * 0.10
      else if (taxable <= 1200000) tax = 50000 + (taxable - 1000000) * 0.15
      else if (taxable <= 1500000) tax = 80000 + (taxable - 1200000) * 0.20
      else tax = 140000 + (taxable - 1500000) * 0.30
      if (taxable <= 700000) tax = 0
    } else {
      const c80 = Math.min(parseFloat(d80c) || 0, 150000)
      const c80d = Math.min(parseFloat(d80d) || 0, 50000)
      const npsAmt = Math.min(parseFloat(nps) || 0, 50000)
      const hlAmt = Math.min(parseFloat(hl) || 0, 200000)
      const deductions = 50000 + (parseFloat(hra) || 0) + c80 + c80d + npsAmt + hlAmt + (parseFloat(lta) || 0) + (parseFloat(others) || 0)
      taxable = Math.max(gross - deductions, 0)
      if (taxable <= 250000) tax = 0
      else if (taxable <= 500000) tax = (taxable - 250000) * 0.05
      else if (taxable <= 1000000) tax = 12500 + (taxable - 500000) * 0.20
      else tax = 112500 + (taxable - 1000000) * 0.30
      if (gross <= 500000) tax = 0
    }
    const cess = tax * 0.04
    const total = tax + cess
    setResult({ gross, taxable, tax, cess, total, effectiveRate: gross > 0 ? (total / gross) * 100 : 0 })
  }

  return (
    <div>
      <SubTabs
        tabs={[{ id: "new", label: "New Regime" }, { id: "old", label: "Old Regime" }]}
        active={regime} onChange={setRegime}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Gross Annual Income (₹)"><input type="number" value={income} onChange={e => setIncome(e.target.value)} className={inputCls} /></Field>
        <Field label="HRA Exempt (₹)"><input type="number" value={hra} onChange={e => setHra(e.target.value)} className={inputCls} /></Field>
      </div>
      {regime === "old" && (
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-wider text-primary font-medium mb-3">Deductions — Old Regime</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="80C — max ₹1.5L (₹)"><input type="number" value={d80c} onChange={e => setD80c(e.target.value)} className={inputCls} /></Field>
            <Field label="80D Medical (₹)"><input type="number" value={d80d} onChange={e => setD80d(e.target.value)} className={inputCls} /></Field>
            <Field label="NPS 80CCD(1B) — max ₹50k"><input type="number" value={nps} onChange={e => setNps(e.target.value)} className={inputCls} /></Field>
            <Field label="Home Loan Interest — max ₹2L"><input type="number" value={hl} onChange={e => setHl(e.target.value)} className={inputCls} /></Field>
            <Field label="LTA (₹)"><input type="number" value={lta} onChange={e => setLta(e.target.value)} className={inputCls} /></Field>
            <Field label="Other deductions (₹)"><input type="number" value={others} onChange={e => setOthers(e.target.value)} className={inputCls} /></Field>
          </div>
        </div>
      )}
      {regime === "new" && (
        <p className="text-xs text-muted-foreground mt-3 bg-muted/30 rounded-lg px-3 py-2">
          New regime: ₹75,000 standard deduction applied automatically. No additional deductions except NPS employer contribution. Zero tax for income up to ₹7L (rebate u/s 87A).
        </p>
      )}
      <CalcButton onClick={calculate}>Calculate Tax</CalcButton>
      {result && (
        <ResultBox>
          <ResultRow label="Gross Income" value={fmt(result.gross)} />
          <ResultRow label="Taxable Income" value={fmt(result.taxable)} />
          <ResultRow label="Income Tax" value={fmt(result.tax)} valueClass="text-destructive" />
          <ResultRow label="Health & Ed. Cess (4%)" value={fmt(result.cess)} valueClass="text-destructive" />
          <ResultRow label="Total Tax Payable" value={fmt(result.total)} valueClass="text-destructive" isTotal />
          <ResultRow label="Effective Tax Rate" value={`${result.effectiveRate.toFixed(2)}%`} valueClass="text-warning" isTotal />
        </ResultBox>
      )}
      {result && (
        <Note>
          * {regime === "new"
            ? "New regime rates FY 2024-25. Surcharge not included for income > ₹50L."
            : "Old regime: Standard deduction ₹50,000 included. Rebate u/s 87A for income ≤ ₹5L. Surcharge not included."}
        </Note>
      )}
    </div>
  )
}

function SipEmiCalculator() {
  const [loan, setLoan] = useState("2000000")
  const [lrate, setLrate] = useState("8.5")
  const [tenure, setTenure] = useState("240")
  const [sipAmt, setSipAmt] = useState("10000")
  const [srate, setSrate] = useState("12")
  const [freq, setFreq] = useState("12")
  const [result, setResult] = useState<SipEmiResult | null>(null)

  const calculate = () => {
    const L = parseFloat(loan), lr = parseFloat(lrate) / 12 / 100
    const n = parseInt(tenure), sip = parseFloat(sipAmt)
    const sr = parseFloat(srate) / 12 / 100, f = parseInt(freq)
    if (!L || !lr || !n || !sip) return
    const emi = (L * lr * Math.pow(1 + lr, n)) / (Math.pow(1 + lr, n) - 1)
    let balance = L, month = 0, sipCorpus = 0
    while (balance > 0 && month < n) {
      sipCorpus = (sipCorpus + sip) * (1 + sr)
      balance = balance * (1 + lr) - emi
      month++
      if (month % f === 0 && sipCorpus >= balance && balance > 0) { balance = 0; break }
    }
    const monthsSaved = n - month
    setResult({ originalTenure: n, reducedTenure: month, monthsSaved, sipTotal: sip * month, interestSaved: emi * monthsSaved })
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">
        Find out how a parallel SIP can help prepay your loan and save interest.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Outstanding Loan (₹)"><input type="number" value={loan} onChange={e => setLoan(e.target.value)} className={inputCls} /></Field>
        <Field label="Loan Rate (% p.a.)"><input type="number" value={lrate} step="0.1" onChange={e => setLrate(e.target.value)} className={inputCls} /></Field>
        <Field label="Remaining Tenure (months)"><input type="number" value={tenure} onChange={e => setTenure(e.target.value)} className={inputCls} /></Field>
        <Field label="Monthly SIP Amount (₹)"><input type="number" value={sipAmt} onChange={e => setSipAmt(e.target.value)} className={inputCls} /></Field>
        <Field label="SIP Expected Return (% p.a.)"><input type="number" value={srate} step="0.1" onChange={e => setSrate(e.target.value)} className={inputCls} /></Field>
        <Field label="Prepay Frequency">
          <select value={freq} onChange={e => setFreq(e.target.value)} className={selectCls}>
            <option value="12">Annually</option>
            <option value="6">Half-yearly</option>
            <option value="3">Quarterly</option>
          </select>
        </Field>
      </div>
      <CalcButton onClick={calculate}>Analyse</CalcButton>
      {result && (
        <>
          <InsightBox title="Analysis Result">
            <p className="text-sm text-foreground mb-2">
              By investing <strong>{fmt(parseFloat(sipAmt))}/month</strong> in SIP alongside your EMI, you can close your loan{" "}
              <strong>{result.monthsSaved} months early</strong> — saving substantial interest!
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-3">Interest saved</p>
            <p className="text-2xl font-bold text-success font-mono">{fmt(result.interestSaved)}</p>
          </InsightBox>
          <ResultBox>
            <ResultRow label="Original Tenure" value={`${result.originalTenure} months`} />
            <ResultRow label="Reduced Tenure" value={`${result.reducedTenure} months`} valueClass="text-success" />
            <ResultRow label="Months Saved" value={`${result.monthsSaved} months`} valueClass="text-success" />
            <ResultRow label="Total SIP Invested" value={fmt(result.sipTotal)} />
            <ResultRow label="Interest Saved" value={fmt(result.interestSaved)} valueClass="text-success" isTotal />
          </ResultBox>
          <Note>* Prepayment made {freq === "12" ? "annually" : freq === "6" ? "half-yearly" : "quarterly"} from SIP corpus. Actual savings depend on lender prepayment terms and charges.</Note>
        </>
      )}
    </div>
  )
}

function GreeksCalculator() {
  const [spot, setSpot] = useState("22000")
  const [strike, setStrike] = useState("22000")
  const [days, setDays] = useState("30")
  const [vol, setVol] = useState("18")
  const [rf, setRf] = useState("6.5")
  const [optType, setOptType] = useState<"call" | "put">("call")
  const [result, setResult] = useState<GreeksResult | null>(null)

  const calculate = () => {
    const S = parseFloat(spot), K = parseFloat(strike)
    const T = parseFloat(days) / 365, v = parseFloat(vol) / 100, r = parseFloat(rf) / 100
    if (!S || !K || !T || !v) return
    const d1 = (Math.log(S / K) + (r + 0.5 * v * v) * T) / (v * Math.sqrt(T))
    const d2 = d1 - v * Math.sqrt(T)
    let price, delta, theta
    if (optType === "call") {
      price = S * N(d1) - K * Math.exp(-r * T) * N(d2)
      delta = N(d1)
      theta = (-S * pdf(d1) * v / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * N(d2)) / 365
    } else {
      price = K * Math.exp(-r * T) * N(-d2) - S * N(-d1)
      delta = N(d1) - 1
      theta = (-S * pdf(d1) * v / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * N(-d2)) / 365
    }
    const gamma = pdf(d1) / (S * v * Math.sqrt(T))
    const vega = S * pdf(d1) * Math.sqrt(T) / 100
    const rho = optType === "call"
      ? K * T * Math.exp(-r * T) * N(d2) / 100
      : -K * T * Math.exp(-r * T) * N(-d2) / 100
    const moneyness = optType === "call" ? (S < K ? "OTM" : "ITM") : (S > K ? "OTM" : "ITM")
    setResult({ price, delta, gamma, theta, vega, rho, iv: v * 100, moneyness })
  }

  const greeks = result
    ? [
        { sym: "Δ", label: "Delta", val: fmtD(result.delta), color: "text-primary" },
        { sym: "Γ", label: "Gamma", val: fmtD(result.gamma), color: "text-success" },
        { sym: "Θ", label: "Theta/day", val: fmtD(result.theta), color: "text-warning" },
        { sym: "V", label: "Vega", val: fmtD(result.vega), color: "text-purple-400" },
        { sym: "ρ", label: "Rho", val: fmtD(result.rho), color: "text-destructive" },
        { sym: "IV", label: "Implied Vol", val: `${result.iv.toFixed(1)}%`, color: "text-muted-foreground" },
      ]
    : []

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Spot Price (₹)"><input type="number" value={spot} onChange={e => setSpot(e.target.value)} className={inputCls} /></Field>
        <Field label="Strike Price (₹)"><input type="number" value={strike} onChange={e => setStrike(e.target.value)} className={inputCls} /></Field>
        <Field label="Time to Expiry (days)"><input type="number" value={days} onChange={e => setDays(e.target.value)} className={inputCls} /></Field>
        <Field label="Volatility (% p.a.)"><input type="number" value={vol} step="0.5" onChange={e => setVol(e.target.value)} className={inputCls} /></Field>
        <Field label="Risk-free Rate (% p.a.)"><input type="number" value={rf} step="0.1" onChange={e => setRf(e.target.value)} className={inputCls} /></Field>
        <Field label="Option Type">
          <select value={optType} onChange={e => setOptType(e.target.value as "call" | "put")} className={selectCls}>
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
        </Field>
      </div>
      <CalcButton onClick={calculate}>Calculate Greeks</CalcButton>
      {result && (
        <>
          <ResultBox>
            <ResultRow label="Theoretical Price" value={fmt(result.price)} valueClass="text-primary" />
            <ResultRow
              label="Moneyness"
              value={`${result.moneyness} ${optType.toUpperCase()}`}
              valueClass={result.moneyness === "ITM" ? "text-success" : "text-warning"}
              isTotal
            />
          </ResultBox>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            {greeks.map(g => (
              <div key={g.sym} className="bg-background border border-border rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${g.color} mb-1`}>{g.sym}</p>
                <p className={`font-mono text-base font-medium ${g.color}`}>{g.val}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{g.label}</p>
              </div>
            ))}
          </div>
          <Note>* Black-Scholes model. European-style, no dividends. Delta: directional sensitivity. Gamma: delta change rate. Theta: daily time decay. Vega: per 1% IV change.</Note>
        </>
      )}
    </div>
  )
}

function CagrCalculator() {
  const [mode, setMode] = useState<CagrMode>("find")
  const [init, setInit] = useState("100000")
  const [final, setFinal] = useState("250000")
  const [cyears, setCyears] = useState("5")
  const [tTarget, setTTarget] = useState("500000")
  const [tRate, setTRate] = useState("12")
  const [lRate, setLRate] = useState("12")
  const [lYears, setLYears] = useState("10")
  const [result, setResult] = useState<CagrResult | null>(null)

  const calculate = () => {
    if (mode === "find") {
      const P = parseFloat(init), F = parseFloat(final), Y = parseFloat(cyears)
      if (!P || !F || !Y) return
      const cagr = (Math.pow(F / P, 1 / Y) - 1) * 100
      setResult({ cagr, absolutePct: ((F - P) / P) * 100, gained: F - P })
    } else if (mode === "target") {
      const P = parseFloat(init), T = parseFloat(tTarget), rate = parseFloat(tRate) / 100
      if (!P || !T || !rate) return
      const years = Math.log(T / P) / Math.log(1 + rate)
      setResult({ years, doublesIn: 72 / parseFloat(tRate), target: T })
    } else {
      const P = parseFloat(init), rate = parseFloat(lRate) / 100, Y = parseFloat(lYears)
      if (!P || !rate || !Y) return
      const fv = P * Math.pow(1 + rate, Y)
      setResult({ fv, gains: fv - P, absPct: ((fv - P) / P) * 100 })
    }
  }

  return (
    <div>
      <SubTabs
        tabs={[{ id: "find", label: "Find CAGR" }, { id: "target", label: "Time to Target" }, { id: "lumpsum", label: "Lumpsum FV" }]}
        active={mode} onChange={setMode}
      />
      {mode === "find" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Initial Investment (₹)"><input type="number" value={init} onChange={e => setInit(e.target.value)} className={inputCls} /></Field>
          <Field label="Final Value (₹)"><input type="number" value={final} onChange={e => setFinal(e.target.value)} className={inputCls} /></Field>
          <Field label="Duration (years)"><input type="number" value={cyears} onChange={e => setCyears(e.target.value)} className={inputCls} /></Field>
        </div>
      )}
      {mode === "target" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Initial Investment (₹)"><input type="number" value={init} onChange={e => setInit(e.target.value)} className={inputCls} /></Field>
          <Field label="Target Value (₹)"><input type="number" value={tTarget} onChange={e => setTTarget(e.target.value)} className={inputCls} /></Field>
          <Field label="Expected CAGR (%)"><input type="number" value={tRate} onChange={e => setTRate(e.target.value)} className={inputCls} /></Field>
        </div>
      )}
      {mode === "lumpsum" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Investment Amount (₹)"><input type="number" value={init} onChange={e => setInit(e.target.value)} className={inputCls} /></Field>
          <Field label="CAGR (%)"><input type="number" value={lRate} onChange={e => setLRate(e.target.value)} className={inputCls} /></Field>
          <Field label="Duration (years)"><input type="number" value={lYears} onChange={e => setLYears(e.target.value)} className={inputCls} /></Field>
        </div>
      )}
      <CalcButton onClick={calculate}>Calculate</CalcButton>
      {result && (
        <ResultBox>
          {result.cagr !== undefined && <>
            <ResultRow label="CAGR" value={`${result.cagr!.toFixed(2)}%`} valueClass="text-success" />
            <ResultRow label="Absolute Return" value={`${result.absolutePct!.toFixed(1)}%`} valueClass="text-success" />
            <ResultRow label="Value Gained" value={fmt(result.gained!)} valueClass="text-success" isTotal />
          </>}
          {result.years !== undefined && <>
            <ResultRow label="Years to Target" value={`${result.years!.toFixed(1)} years`} valueClass="text-success" />
            <ResultRow label="Doubles in (Rule of 72)" value={`${result.doublesIn!.toFixed(1)} years`} valueClass="text-primary" />
            <ResultRow label="Target Amount" value={fmt(result.target!)} isTotal />
          </>}
          {result.fv !== undefined && <>
            <ResultRow label="Future Value" value={fmt(result.fv!)} valueClass="text-success" />
            <ResultRow label="Gains" value={fmt(result.gains!)} valueClass="text-success" />
            <ResultRow label="Absolute Return" value={`${result.absPct!.toFixed(1)}%`} valueClass="text-success" isTotal />
          </>}
        </ResultBox>
      )}
    </div>
  )
}

function BreakevenCalculator() {
  const [mode, setMode] = useState<BeMode>("options")
  const [beStrike, setBeStrike] = useState("22000")
  const [premium, setPremium] = useState("150")
  const [lot, setLot] = useState("50")
  const [optType, setOptType] = useState<OptionType>("call")
  const [buyPrice, setBuyPrice] = useState("500")
  const [qty, setQty] = useState("100")
  const [brokerage, setBrokerage] = useState("40")
  const [charges, setCharges] = useState("20")
  const [result, setResult] = useState<BeResult | null>(null)

  const calculate = () => {
    if (mode === "options") {
      const K = parseFloat(beStrike), p = parseFloat(premium), l = parseFloat(lot) || 1
      if (!K || !p) return
      const map: Record<OptionType, { be: number; label: string; maxProfit: string; maxLoss: string }> = {
        call: { be: K + p, label: "Long Call", maxProfit: "Unlimited", maxLoss: fmt(p * l) },
        put: { be: K - p, label: "Long Put", maxProfit: fmt((K - p) * l), maxLoss: fmt(p * l) },
        callsell: { be: K + p, label: "Short Call", maxProfit: fmt(p * l), maxLoss: "Unlimited" },
        putsell: { be: K - p, label: "Short Put", maxProfit: fmt(p * l), maxLoss: fmt((K - p) * l) },
      }
      setResult({ ...map[optType], be: map[optType].be, premiumTotal: p * l })
    } else {
      const bp = parseFloat(buyPrice), q = parseFloat(qty) || 1
      const b = parseFloat(brokerage) || 0, c = parseFloat(charges) || 0
      const totalCharges = b + c
      const be = bp + totalCharges / q
      setResult({ be, totalCharges, pctAboveBuy: ((be - bp) / bp) * 100 })
    }
  }

  return (
    <div>
      <SubTabs
        tabs={[{ id: "options", label: "Options Trade" }, { id: "equity", label: "Equity Trade" }]}
        active={mode} onChange={setMode}
      />
      {mode === "options" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Strike Price (₹)"><input type="number" value={beStrike} onChange={e => setBeStrike(e.target.value)} className={inputCls} /></Field>
          <Field label="Premium Paid (₹)"><input type="number" value={premium} onChange={e => setPremium(e.target.value)} className={inputCls} /></Field>
          <Field label="Lot Size"><input type="number" value={lot} onChange={e => setLot(e.target.value)} className={inputCls} /></Field>
          <Field label="Option Type">
            <select value={optType} onChange={e => setOptType(e.target.value as OptionType)} className={selectCls}>
              <option value="call">Call (Long)</option>
              <option value="put">Put (Long)</option>
              <option value="callsell">Call (Short)</option>
              <option value="putsell">Put (Short)</option>
            </select>
          </Field>
        </div>
      )}
      {mode === "equity" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Buy Price (₹)"><input type="number" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} className={inputCls} /></Field>
          <Field label="Quantity"><input type="number" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} /></Field>
          <Field label="Brokerage (₹)"><input type="number" value={brokerage} onChange={e => setBrokerage(e.target.value)} className={inputCls} /></Field>
          <Field label="STT + Other Charges (₹)"><input type="number" value={charges} onChange={e => setCharges(e.target.value)} className={inputCls} /></Field>
        </div>
      )}
      <CalcButton onClick={calculate}>Calculate Breakeven</CalcButton>
      {result && (
        <ResultBox>
          {mode === "options" && result.label && (
            <ResultRow label="Strategy" value={result.label} valueClass="text-primary" />
          )}
          <ResultRow label="Breakeven Price" value={fmt(result.be)} valueClass="text-primary" isTotal />
          {mode === "options" && result.premiumTotal !== undefined && <>
            <ResultRow label="Premium Paid (total)" value={fmt(result.premiumTotal)} valueClass="text-warning" />
            <ResultRow label="Max Profit" value={result.maxProfit!} valueClass="text-success" />
            <ResultRow label="Max Loss" value={result.maxLoss!} valueClass="text-destructive" isTotal />
          </>}
          {mode === "equity" && result.totalCharges !== undefined && <>
            <ResultRow label="Total Charges" value={fmt(result.totalCharges)} valueClass="text-warning" />
            <ResultRow label="% Above Buy Price" value={`${result.pctAboveBuy!.toFixed(3)}%`} valueClass="text-warning" isTotal />
          </>}
        </ResultBox>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const CALCS: { id: CalcId; label: string; short: string }[] = [
  { id: "emi", label: "EMI Calculator", short: "EMI" },
  { id: "sip", label: "SIP Calculator", short: "SIP" },
  { id: "avg", label: "Stock Averaging", short: "Avg" },
  { id: "tax", label: "Tax Calculator", short: "Tax" },
  { id: "sipemi", label: "SIP vs EMI", short: "SIP→EMI" },
  { id: "greeks", label: "Options Greeks", short: "Greeks" },
  { id: "cagr", label: "CAGR Calculator", short: "CAGR" },
  { id: "be", label: "Breakeven", short: "B/E" },
]

export default function CalculatorsPage() {
  const [active, setActive] = useState<CalcId>("emi")

  const titles: Record<CalcId, { title: string; sub: string }> = {
    emi: { title: "EMI Calculator", sub: "Personal, Home & Auto loan EMI with effective rate" },
    sip: { title: "SIP Calculator", sub: "Regular and Step-up SIP with wealth projection" },
    avg: { title: "Stock Averaging", sub: "Weighted average cost across up to 5 buy entries" },
    tax: { title: "Income Tax Calculator", sub: "New & Old regime with all major deductions — FY 2024-25" },
    sipemi: { title: "SIP vs EMI", sub: "How SIP corpus can prepay your loan early and save interest" },
    greeks: { title: "Options Greeks", sub: "Black-Scholes: Delta, Gamma, Theta, Vega, Rho" },
    cagr: { title: "CAGR Calculator", sub: "Find CAGR, time to target, or lumpsum future value" },
    be: { title: "Breakeven Calculator", sub: "Options strategies and equity trade breakeven" },
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Calculators</h1>
            <p className="text-sm text-muted-foreground mt-1">Professional tools for equity, options, SIP & tax planning</p>
          </div>

          {/* Calculator selector */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CALCS.map(c => (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  active === c.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-card"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Active panel */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-foreground">{titles[active].title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{titles[active].sub}</p>
            </div>
            {active === "emi" && <EmiCalculator />}
            {active === "sip" && <SipCalculator />}
            {active === "avg" && <AvgCalculator />}
            {active === "tax" && <TaxCalculator />}
            {active === "sipemi" && <SipEmiCalculator />}
            {active === "greeks" && <GreeksCalculator />}
            {active === "cagr" && <CagrCalculator />}
            {active === "be" && <BreakevenCalculator />}
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
