"use client"

import { useState } from "react"
import { AnnouncementBar } from "@/components/announcement-bar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import Link from "next/link"

// ─── Formatting ───────────────────────────────────────────────────────────────

const inr = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN")

const inrD = (n: number, d = 0) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d })

const pct = (n: number, d = 2) => n.toFixed(d) + "%"

const fmtD = (n: number) => n.toFixed(4)

// ─── BSM helpers ─────────────────────────────────────────────────────────────

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return x >= 0 ? 1 - p * Math.exp(-x * x) : -(1 - p * Math.exp(-x * x))
}
const N = (x: number) => (1 + erf(x / Math.sqrt(2))) / 2
const pdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)

// ─── Shared UI ────────────────────────────────────────────────────────────────

type CalcId =
  | "emi" | "sip" | "mf" | "fd" | "rd"
  | "avg" | "tax" | "sipemi"
  | "greeks" | "cagr" | "be"

const CALCS: { id: CalcId; label: string }[] = [
  { id: "emi",    label: "EMI" },
  { id: "sip",    label: "SIP" },
  { id: "mf",     label: "MF Lumpsum" },
  { id: "fd",     label: "Fixed Deposit" },
  { id: "rd",     label: "Recurring Deposit" },
  { id: "avg",    label: "Stock Averaging" },
  { id: "tax",    label: "Tax Calculator" },
  { id: "sipemi", label: "SIP vs EMI" },
  { id: "greeks", label: "Options Greeks" },
  { id: "cagr",   label: "CAGR" },
  { id: "be",     label: "Breakeven" },
]

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  )
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono transition-colors"
const selectCls =
  "w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"

function CalcButton({ onClick, label = "Calculate" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors mt-4"
    >
      {label}
    </button>
  )
}

function SubTabs<T extends string>({
  tabs, active, onChange,
}: { tabs: { id: T; label: string }[]; active: T; onChange: (id: T) => void }) {
  return (
    <div className="flex gap-2 flex-wrap mb-5">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            active === t.id
              ? "bg-primary/10 border-primary/40 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >{t.label}</button>
      ))}
    </div>
  )
}

function ResultRow({ label, value, valueClass = "text-foreground", isTotal = false, sub }: {
  label: string; value: string; valueClass?: string; isTotal?: boolean; sub?: string
}) {
  return (
    <div className={`flex justify-between items-start py-2.5 ${isTotal ? "border-t border-border mt-1" : "border-b border-border last:border-0"}`}>
      <div>
        <span className={`text-sm ${isTotal ? "font-medium text-foreground" : "text-muted-foreground"}`}>{label}</span>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <span className={`font-mono text-sm font-medium ${valueClass} ${isTotal ? "text-base" : ""} ml-4 shrink-0`}>{value}</span>
    </div>
  )
}

function ResultBox({ children }: { children: React.ReactNode }) {
  return <div className="bg-background border border-border rounded-xl px-4 py-1 mt-4">{children}</div>
}

function InsightBox({ title, big, bigLabel, children }: { title: string; big?: string; bigLabel?: string; children?: React.ReactNode }) {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-4">
      <p className="text-[10px] uppercase tracking-wider text-primary font-medium mb-2">{title}</p>
      {big && <p className="text-2xl font-bold text-success font-mono">{big}</p>}
      {bigLabel && <p className="text-xs text-muted-foreground mt-0.5">{bigLabel}</p>}
      {children}
    </div>
  )
}

function SectionHead({ label }: { label: string }) {
  return (
    <p className="text-[10px] uppercase tracking-wider text-primary font-medium mt-5 mb-3 border-b border-border pb-1.5">
      {label}
    </p>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">{children}</p>
}

// ─── EMI ─────────────────────────────────────────────────────────────────────

type EmiType = "PL" | "HL" | "AL"

function EmiCalculator() {
  const [type, setType] = useState<EmiType>("PL")
  const [principal, setPrincipal] = useState("5,00,000")
  const [rate, setRate] = useState("12")
  const [tenure, setTenure] = useState("60")
  const [fee, setFee] = useState("5,000")
  const [result, setResult] = useState<any>(null)

  const parse = (s: string) => parseFloat(s.replace(/,/g, ""))

  const calculate = () => {
    const P = parse(principal), r = parse(rate) / 12 / 100
    const n = parseInt(tenure), f = parse(fee) || 0
    if (!P || !r || !n) return
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    const total = emi * n
    const interest = total - P
    const effectiveRate = ((interest + f) / P / n) * 12 * 100
    setResult({ emi, principal: P, interest, fee: f, total: total + f, effectiveRate, n })
  }

  const hints: Record<EmiType, string> = {
    PL: "Typical: 10–24% p.a.",
    HL: "Typical: 8–10% p.a.",
    AL: "Typical: 7–14% p.a.",
  }

  return (
    <div>
      <SubTabs
        tabs={[{ id: "PL", label: "Personal Loan" }, { id: "HL", label: "Home Loan" }, { id: "AL", label: "Auto Loan" }]}
        active={type} onChange={setType}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Loan Amount (₹)" hint={hints[type]}>
          <input type="text" value={principal} onChange={e => setPrincipal(e.target.value)} className={inputCls} placeholder="5,00,000" />
        </Field>
        <Field label="Interest Rate (% p.a.)">
          <input type="number" value={rate} step="0.1" onChange={e => setRate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Tenure (months)">
          <input type="number" value={tenure} onChange={e => setTenure(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Processing Fee (₹)">
          <input type="text" value={fee} onChange={e => setFee(e.target.value)} className={inputCls} placeholder="5,000" />
        </Field>
      </div>
      <CalcButton onClick={calculate} />
      {result && (
        <>
          <ResultBox>
            <ResultRow label="Monthly EMI" value={inr(result.emi)} valueClass="text-primary" isTotal />
            <ResultRow label="Principal Amount" value={inr(result.principal)} />
            <ResultRow label="Total Interest Payable" value={inr(result.interest)} valueClass="text-destructive" />
            <ResultRow label="Processing Fee" value={inr(result.fee)} valueClass="text-warning" />
            <ResultRow label="Total Payable (incl. fee)" value={inr(result.total)} isTotal />
            <ResultRow label="Effective Interest Rate" value={pct(result.effectiveRate)} valueClass="text-warning"
              sub="Accounts for processing fee amortised over tenure" />
            <ResultRow label="Interest as % of loan" value={pct((result.interest / result.principal) * 100, 1)}
              sub="For every ₹100 borrowed, you pay this much extra" />
          </ResultBox>
          <Note>* EMI = P × r × (1+r)ⁿ / ((1+r)ⁿ−1). Assumes flat interest rate and no prepayment.</Note>
        </>
      )}
    </div>
  )
}

// ─── SIP ─────────────────────────────────────────────────────────────────────

type SipMode = "regular" | "stepup"

function SipCalculator() {
  const [mode, setMode] = useState<SipMode>("regular")
  const [monthly, setMonthly] = useState("10,000")
  const [rate, setRate] = useState("12")
  const [years, setYears] = useState("10")
  const [stepup, setStepup] = useState("10")
  const [result, setResult] = useState<any>(null)

  const parse = (s: string) => parseFloat(s.replace(/,/g, ""))

  const calculate = () => {
    const m = parse(monthly), r = parse(rate) / 12 / 100, y = parseFloat(years)
    const su = parseFloat(stepup) || 0
    if (!m || !r || !y) return
    let fv = 0, invested = 0
    if (mode === "stepup") {
      let cur = m
      for (let yr = 0; yr < y; yr++) {
        for (let mo = 0; mo < 12; mo++) { fv = (fv + cur) * (1 + r); invested += cur }
        cur *= (1 + su / 100)
      }
    } else {
      const n = y * 12
      fv = m * ((Math.pow(1 + r, n) - 1) / r) * (1 + r)
      invested = m * n
    }
    const gains = fv - invested
    setResult({ invested, gains, fv, wPct: (gains / invested) * 100 })
  }

  return (
    <div>
      <SubTabs
        tabs={[{ id: "regular", label: "Regular SIP" }, { id: "stepup", label: "Step-up SIP" }]}
        active={mode} onChange={setMode}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Monthly SIP (₹)">
          <input type="text" value={monthly} onChange={e => setMonthly(e.target.value)} className={inputCls} placeholder="10,000" />
        </Field>
        <Field label="Expected Return (% p.a.)">
          <input type="number" value={rate} step="0.1" onChange={e => setRate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Duration (years)">
          <input type="number" value={years} onChange={e => setYears(e.target.value)} className={inputCls} />
        </Field>
        {mode === "stepup" && (
          <Field label="Annual Step-up (%)" hint="Increase your SIP by this % every year">
            <input type="number" value={stepup} onChange={e => setStepup(e.target.value)} className={inputCls} />
          </Field>
        )}
      </div>
      <CalcButton onClick={calculate} />
      {result && (
        <ResultBox>
          <ResultRow label="Total Invested" value={inr(result.invested)} />
          <ResultRow label="Estimated Gains" value={inr(result.gains)} valueClass="text-success" />
          <ResultRow label="Wealth Multiplier" value={`${((result.fv / result.invested)).toFixed(2)}x`} valueClass="text-success" />
          <ResultRow label="Wealth Gained" value={pct(result.wPct, 1)} valueClass="text-success" />
          <ResultRow label="Maturity Value" value={inr(result.fv)} valueClass="text-success" isTotal />
        </ResultBox>
      )}
    </div>
  )
}

// ─── MF LUMPSUM ──────────────────────────────────────────────────────────────

function MfLumpsumCalculator() {
  const [amount, setAmount] = useState("1,00,000")
  const [rate, setRate] = useState("12")
  const [years, setYears] = useState("10")
  const [result, setResult] = useState<any>(null)

  const parse = (s: string) => parseFloat(s.replace(/,/g, ""))

  const calculate = () => {
    const P = parse(amount), r = parse(rate) / 100, y = parseFloat(years)
    if (!P || !r || !y) return
    const fv = P * Math.pow(1 + r, y)
    const gains = fv - P
    const cagr = r * 100
    const doublesIn = 72 / cagr
    setResult({ fv, gains, invested: P, absPct: (gains / P) * 100, cagr, doublesIn })
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">One-time lumpsum investment in mutual funds with compound growth.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Investment Amount (₹)">
          <input type="text" value={amount} onChange={e => setAmount(e.target.value)} className={inputCls} placeholder="1,00,000" />
        </Field>
        <Field label="Expected CAGR (% p.a.)" hint="Equity MF long-term average: 12–15%">
          <input type="number" value={rate} step="0.1" onChange={e => setRate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Investment Duration (years)">
          <input type="number" value={years} onChange={e => setYears(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <CalcButton onClick={calculate} />
      {result && (
        <>
          <ResultBox>
            <ResultRow label="Amount Invested" value={inr(result.invested)} />
            <ResultRow label="Estimated Gains" value={inr(result.gains)} valueClass="text-success" />
            <ResultRow label="Absolute Return" value={pct(result.absPct, 1)} valueClass="text-success" />
            <ResultRow label="Money Doubles In" value={`${result.doublesIn.toFixed(1)} yrs (Rule of 72)`} valueClass="text-primary" />
            <ResultRow label="Future Value" value={inr(result.fv)} valueClass="text-success" isTotal />
          </ResultBox>
          <Note>* FV = P × (1 + r)ⁿ. Assumes annual compounding. Does not account for exit load, expense ratio (~0.5–1.5% reduces effective return), or LTCG tax (10% on gains above ₹1.25L after 1 year).</Note>
        </>
      )}
    </div>
  )
}

// ─── FD ──────────────────────────────────────────────────────────────────────

type FdCompound = "monthly" | "quarterly" | "halfyearly" | "annually"

function FdCalculator() {
  const [amount, setAmount] = useState("1,00,000")
  const [rate, setRate] = useState("7")
  const [years, setYears] = useState("5")
  const [months, setMonths] = useState("0")
  const [compound, setCompound] = useState<FdCompound>("quarterly")
  const [senior, setSenior] = useState(false)
  const [result, setResult] = useState<any>(null)

  const parse = (s: string) => parseFloat(s.replace(/,/g, ""))

  const nMap: Record<FdCompound, number> = { monthly: 12, quarterly: 4, halfyearly: 2, annually: 1 }

  const calculate = () => {
    const P = parse(amount)
    const baseRate = parse(rate) + (senior ? 0.5 : 0)
    const r = baseRate / 100
    const y = parseInt(years) + parseInt(months) / 12
    const n = nMap[compound]
    if (!P || !r || !y) return
    const fv = P * Math.pow(1 + r / n, n * y)
    const interest = fv - P
    const taxAt30 = interest * 0.30
    const taxAt20 = interest * 0.20
    const taxAt10 = interest * 0.10
    setResult({ fv, interest, invested: P, baseRate, years: y, taxAt30, taxAt20, taxAt10 })
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Principal Amount (₹)">
          <input type="text" value={amount} onChange={e => setAmount(e.target.value)} className={inputCls} placeholder="1,00,000" />
        </Field>
        <Field label="Interest Rate (% p.a.)">
          <input type="number" value={rate} step="0.1" onChange={e => setRate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Tenure — Years">
          <input type="number" value={years} onChange={e => setYears(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Tenure — Additional Months">
          <input type="number" value={months} min="0" max="11" onChange={e => setMonths(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Compounding Frequency">
          <select value={compound} onChange={e => setCompound(e.target.value as FdCompound)} className={selectCls}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly (default)</option>
            <option value="halfyearly">Half-yearly</option>
            <option value="annually">Annually</option>
          </select>
        </Field>
        <Field label="Senior Citizen?" hint="+0.5% additional rate benefit">
          <div className="flex gap-3 mt-1">
            {[false, true].map(v => (
              <button key={String(v)} onClick={() => setSenior(v)}
                className={`px-4 py-2 rounded-lg text-xs border transition-colors ${senior === v ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground"}`}
              >{v ? "Yes" : "No"}</button>
            ))}
          </div>
        </Field>
      </div>
      <CalcButton onClick={calculate} />
      {result && (
        <>
          <ResultBox>
            <ResultRow label="Principal" value={inr(result.invested)} />
            <ResultRow label="Interest Earned" value={inr(result.interest)} valueClass="text-success" />
            <ResultRow label="Effective Rate Applied" value={pct(result.baseRate)} valueClass="text-primary"
              sub={senior ? "Includes +0.5% senior citizen benefit" : undefined} />
            <ResultRow label="Maturity Amount" value={inr(result.fv)} valueClass="text-success" isTotal />
          </ResultBox>
          <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 mt-4">
            <p className="text-[10px] uppercase tracking-wider text-warning font-medium mb-2">Tax on FD interest (as per your slab)</p>
            <div className="grid grid-cols-3 gap-3 mt-2">
              {[{ slab: "10% slab", tax: result.taxAt10 }, { slab: "20% slab", tax: result.taxAt20 }, { slab: "30% slab", tax: result.taxAt30 }].map(t => (
                <div key={t.slab} className="text-center">
                  <p className="text-xs text-muted-foreground">{t.slab}</p>
                  <p className="font-mono text-sm font-medium text-destructive mt-1">{inr(t.tax)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">post-tax: {inr(result.fv - t.tax)}</p>
                </div>
              ))}
            </div>
          </div>
          <Note>* FD interest is fully taxable as "Income from other sources". TDS deducted at 10% if interest &gt; ₹40,000/yr (₹50,000 for seniors). Submit Form 15G/15H to avoid TDS if total income below exemption limit.</Note>
        </>
      )}
    </div>
  )
}

// ─── RD ──────────────────────────────────────────────────────────────────────

function RdCalculator() {
  const [monthly, setMonthly] = useState("5,000")
  const [rate, setRate] = useState("7")
  const [months, setMonths] = useState("24")
  const [result, setResult] = useState<any>(null)

  const parse = (s: string) => parseFloat(s.replace(/,/g, ""))

  const calculate = () => {
    const P = parse(monthly), r = parse(rate) / 400, n = parseInt(months)
    if (!P || !r || !n) return
    const fv = P * ((Math.pow(1 + r, n) - 1) / r) * (1 + r)
    const invested = P * n
    const interest = fv - invested
    setResult({ fv, invested, interest, maturityMonths: n })
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">Recurring Deposit: fixed monthly investment at bank rate, compounded quarterly.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Monthly Deposit (₹)">
          <input type="text" value={monthly} onChange={e => setMonthly(e.target.value)} className={inputCls} placeholder="5,000" />
        </Field>
        <Field label="Interest Rate (% p.a.)" hint="Post Office RD: ~6.7% | Bank RD: 5.5–7.5%">
          <input type="number" value={rate} step="0.1" onChange={e => setRate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Tenure (months)">
          <input type="number" value={months} onChange={e => setMonths(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <CalcButton onClick={calculate} />
      {result && (
        <>
          <ResultBox>
            <ResultRow label="Total Deposited" value={inr(result.invested)} />
            <ResultRow label="Interest Earned" value={inr(result.interest)} valueClass="text-success" />
            <ResultRow label="Tenure" value={`${result.maturityMonths} months`} />
            <ResultRow label="Maturity Amount" value={inr(result.fv)} valueClass="text-success" isTotal />
          </ResultBox>
          <Note>* Uses quarterly compounding formula: FV = P × ((1 + r/4)^n − 1) / (r/4) × (1 + r/4). Interest taxable per income slab. Compare with SIP in equity funds for long tenures (&gt;3 yrs).</Note>
        </>
      )}
    </div>
  )
}

// ─── STOCK AVERAGING ──────────────────────────────────────────────────────────

interface AvgEntry { price: string; qty: string }

function AvgCalculator() {
  const [entries, setEntries] = useState<AvgEntry[]>([
    { price: "500", qty: "100" }, { price: "450", qty: "100" },
  ])
  const [result, setResult] = useState<any>(null)

  const add = () => { if (entries.length < 5) setEntries([...entries, { price: "", qty: "" }]) }
  const remove = (i: number) => setEntries(entries.filter((_, idx) => idx !== i))
  const update = (i: number, f: keyof AvgEntry, v: string) => {
    const n = [...entries]; n[i] = { ...n[i], [f]: v }; setEntries(n)
  }

  const calculate = () => {
    const p = entries.map(e => ({ price: parseFloat(e.price.replace(/,/g, "")) || 0, qty: parseFloat(e.qty.replace(/,/g, "")) || 0 }))
    const totalQty = p.reduce((s, e) => s + e.qty, 0)
    const totalCost = p.reduce((s, e) => s + e.price * e.qty, 0)
    const avgPrice = totalCost / totalQty
    const reduction = ((p[0].price - avgPrice) / p[0].price) * 100
    setResult({ entries: p.map(e => ({ ...e, cost: e.price * e.qty })), totalQty, totalCost, avgPrice, reduction, firstPrice: p[0].price })
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">Add up to 5 buy entries to calculate your weighted average cost basis.</p>
      <div className="space-y-3 mb-3">
        {entries.map((e, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <Field label={`Buy Price ${i + 1} (₹)`}>
              <input type="text" value={e.price} onChange={ev => update(i, "price", ev.target.value)} className={inputCls} />
            </Field>
            <Field label={`Quantity ${i + 1}`}>
              <input type="text" value={e.qty} onChange={ev => update(i, "qty", ev.target.value)} className={inputCls} />
            </Field>
            {entries.length > 1
              ? <button onClick={() => remove(i)} className="px-3 py-2 border border-border rounded-lg text-destructive text-sm hover:bg-destructive/5 transition-colors mb-0.5">✕</button>
              : <div />}
          </div>
        ))}
      </div>
      {entries.length < 5 && (
        <button onClick={add} className="w-full py-2 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors mb-4">
          + Add entry ({entries.length}/5)
        </button>
      )}
      <CalcButton onClick={calculate} />
      {result && (
        <>
          <ResultBox>
            {result.entries.map((e: any, i: number) => (
              <ResultRow key={i} label={`Buy ${i + 1}: ${e.qty.toLocaleString("en-IN")} shares @ ${inr(e.price)}`} value={inr(e.cost)} />
            ))}
            <ResultRow label="Total Shares" value={result.totalQty.toLocaleString("en-IN")} />
            <ResultRow label="Total Investment" value={inr(result.totalCost)} />
            <ResultRow label="Average Cost Price" value={inr(result.avgPrice)} valueClass="text-primary" isTotal />
          </ResultBox>
          <Note>* First buy {inr(result.firstPrice)} → avg reduced to {inr(result.avgPrice)} ({result.reduction.toFixed(1)}% reduction). Sell above {inr(result.avgPrice)} to be in profit.</Note>
        </>
      )}
    </div>
  )
}

// ─── TAX CALCULATOR ──────────────────────────────────────────────────────────

type TaxRegime = "new" | "old"

interface TaxResult {
  regime: TaxRegime
  grossIncome: number
  totalDeductions: number
  taxableIncome: number
  taxBeforeRebate: number
  rebate87A: number
  taxAfterRebate: number
  surcharge: number
  cess: number
  totalTax: number
  effectiveRate: number
  marginalRate: number
  inHandMonthly: number
  slabBreakdown: { slab: string; taxable: number; rate: number; tax: number }[]
  deductionBreakdown: { label: string; claimed: number; max: number; section: string }[]
}

function TaxCalculator() {
  const [regime, setRegime] = useState<TaxRegime>("new")

  // Income
  const [salary, setSalary] = useState("12,00,000")
  const [hra, setHra] = useState("0")
  const [lta, setLta] = useState("0")
  const [otherIncome, setOtherIncome] = useState("0")
  const [rentalIncome, setRentalIncome] = useState("0")
  const [capitalGains, setCapitalGains] = useState("0")

  // Old regime deductions
  const [d80c, setD80c] = useState("1,50,000")
  const [d80ccd1b, setD80ccd1b] = useState("50,000") // NPS
  const [d80d, setD80d] = useState("25,000")
  const [d80dSenior, setD80dSenior] = useState("0")
  const [d80e, setD80e] = useState("0") // education loan interest
  const [d80g, setD80g] = useState("0") // donations
  const [d80gg, setD80gg] = useState("0") // rent (no HRA)
  const [d80tta, setD80tta] = useState("0") // savings account interest
  const [hlInterest, setHlInterest] = useState("0")
  const [ltaAmt, setLtaAmt] = useState("0")
  const [hraExempt, setHraExempt] = useState("0")
  const [otherExemptions, setOtherExemptions] = useState("0")

  // New regime only
  const [npsEmployer, setNpsEmployer] = useState("0") // 80CCD(2) - allowed in new regime

  const [result, setResult] = useState<TaxResult | null>(null)

  const p = (s: string) => parseFloat(s.replace(/,/g, "")) || 0

  const calcOldSlabs = (taxable: number) => {
    const slabs = [
      { slab: "Up to ₹2,50,000", from: 0, to: 250000, rate: 0 },
      { slab: "₹2,50,001 – ₹5,00,000", from: 250000, to: 500000, rate: 5 },
      { slab: "₹5,00,001 – ₹10,00,000", from: 500000, to: 1000000, rate: 20 },
      { slab: "Above ₹10,00,000", from: 1000000, to: Infinity, rate: 30 },
    ]
    let tax = 0
    const breakdown = slabs.map(s => {
      const taxableInSlab = Math.max(0, Math.min(taxable, s.to) - s.from)
      const t = (taxableInSlab * s.rate) / 100
      tax += t
      return { slab: s.slab, taxable: taxableInSlab, rate: s.rate, tax: t }
    })
    return { tax, breakdown }
  }

  const calcNewSlabs = (taxable: number) => {
    const slabs = [
      { slab: "Up to ₹3,00,000", from: 0, to: 300000, rate: 0 },
      { slab: "₹3,00,001 – ₹7,00,000", from: 300000, to: 700000, rate: 5 },
      { slab: "₹7,00,001 – ₹10,00,000", from: 700000, to: 1000000, rate: 10 },
      { slab: "₹10,00,001 – ₹12,00,000", from: 1000000, to: 1200000, rate: 15 },
      { slab: "₹12,00,001 – ₹15,00,000", from: 1200000, to: 1500000, rate: 20 },
      { slab: "Above ₹15,00,000", from: 1500000, to: Infinity, rate: 30 },
    ]
    let tax = 0
    const breakdown = slabs.map(s => {
      const taxableInSlab = Math.max(0, Math.min(taxable, s.to) - s.from)
      const t = (taxableInSlab * s.rate) / 100
      tax += t
      return { slab: s.slab, taxable: taxableInSlab, rate: s.rate, tax: t }
    })
    return { tax, breakdown }
  }

  const getSurcharge = (tax: number, income: number) => {
    if (income <= 5000000) return 0
    if (income <= 10000000) return tax * 0.10
    if (income <= 20000000) return tax * 0.15
    if (income <= 50000000) return tax * 0.25
    return tax * 0.37
  }

  const marginalRate = (taxable: number, regime: TaxRegime) => {
    if (regime === "new") {
      if (taxable <= 300000) return 0
      if (taxable <= 700000) return 5
      if (taxable <= 1000000) return 10
      if (taxable <= 1200000) return 15
      if (taxable <= 1500000) return 20
      return 30
    } else {
      if (taxable <= 250000) return 0
      if (taxable <= 500000) return 5
      if (taxable <= 1000000) return 20
      return 30
    }
  }

  const calculate = () => {
    const grossIncome = p(salary) + p(otherIncome) + p(rentalIncome) + p(capitalGains)

    if (regime === "new") {
      const stdDed = 75000
      const npsEmp = Math.min(p(npsEmployer), p(salary) * 0.10)
      const totalDeductions = stdDed + npsEmp
      const taxableIncome = Math.max(0, grossIncome - totalDeductions)
      const { tax: taxBefore, breakdown } = calcNewSlabs(taxableIncome)
      const rebate87A = taxableIncome <= 700000 ? taxBefore : 0
      const taxAfter = Math.max(0, taxBefore - rebate87A)
      const surcharge = getSurcharge(taxAfter, grossIncome)
      const cess = (taxAfter + surcharge) * 0.04
      const totalTax = taxAfter + surcharge + cess
      const deductionBreakdown = [
        { label: "Standard deduction", claimed: stdDed, max: 75000, section: "Sec 16(ia)" },
        { label: "NPS employer contribution", claimed: npsEmp, max: p(salary) * 0.10, section: "80CCD(2)" },
      ]
      setResult({
        regime: "new", grossIncome, totalDeductions, taxableIncome,
        taxBeforeRebate: taxBefore, rebate87A, taxAfterRebate: taxAfter,
        surcharge, cess, totalTax,
        effectiveRate: grossIncome > 0 ? (totalTax / grossIncome) * 100 : 0,
        marginalRate: marginalRate(taxableIncome, "new"),
        inHandMonthly: (grossIncome - totalTax) / 12,
        slabBreakdown: breakdown,
        deductionBreakdown,
      })
    } else {
      const stdDed = 50000
      const c80 = Math.min(p(d80c), 150000)
      const nps = Math.min(p(d80ccd1b), 50000)
      const med = Math.min(p(d80d), 25000)
      const medSr = Math.min(p(d80dSenior), 50000)
      const eduLoan = p(d80e)
      const donation = p(d80g)
      const rentNohRA = Math.min(p(d80gg), 60000)
      const savInt = Math.min(p(d80tta), 10000)
      const hlInt = Math.min(p(hlInterest), 200000)
      const hraEx = p(hraExempt)
      const ltaEx = p(ltaAmt)
      const otherEx = p(otherExemptions)
      const totalDeductions = stdDed + c80 + nps + med + medSr + eduLoan + donation + rentNohRA + savInt + hlInt + hraEx + ltaEx + otherEx
      const taxableIncome = Math.max(0, grossIncome - totalDeductions)
      const { tax: taxBefore, breakdown } = calcOldSlabs(taxableIncome)
      const rebate87A = grossIncome <= 500000 ? taxBefore : 0
      const taxAfter = Math.max(0, taxBefore - rebate87A)
      const surcharge = getSurcharge(taxAfter, grossIncome)
      const cess = (taxAfter + surcharge) * 0.04
      const totalTax = taxAfter + surcharge + cess
      const deductionBreakdown = [
        { label: "Standard deduction", claimed: stdDed, max: 50000, section: "Sec 16(ia)" },
        { label: "80C (PPF/ELSS/LIC/EPF/etc.)", claimed: c80, max: 150000, section: "80C" },
        { label: "NPS own contribution", claimed: nps, max: 50000, section: "80CCD(1B)" },
        { label: "Medical insurance (self/family)", claimed: med, max: 25000, section: "80D" },
        { label: "Medical insurance (parents)", claimed: medSr, max: 50000, section: "80D" },
        { label: "Education loan interest", claimed: eduLoan, max: 999999, section: "80E" },
        { label: "Donations (50%/100% eligible)", claimed: donation, max: 999999, section: "80G" },
        { label: "Rent paid (no HRA)", claimed: rentNohRA, max: 60000, section: "80GG" },
        { label: "Savings account interest", claimed: savInt, max: 10000, section: "80TTA" },
        { label: "Home loan interest", claimed: hlInt, max: 200000, section: "Sec 24(b)" },
        { label: "HRA exemption", claimed: hraEx, max: 999999, section: "Sec 10(13A)" },
        { label: "LTA exemption", claimed: ltaEx, max: 999999, section: "Sec 10(5)" },
        { label: "Other exemptions", claimed: otherEx, max: 999999, section: "Various" },
      ]
      setResult({
        regime: "old", grossIncome, totalDeductions, taxableIncome,
        taxBeforeRebate: taxBefore, rebate87A, taxAfterRebate: taxAfter,
        surcharge, cess, totalTax,
        effectiveRate: grossIncome > 0 ? (totalTax / grossIncome) * 100 : 0,
        marginalRate: marginalRate(taxableIncome, "old"),
        inHandMonthly: (grossIncome - totalTax) / 12,
        slabBreakdown: breakdown,
        deductionBreakdown,
      })
    }
  }

  return (
    <div>
      <SubTabs
        tabs={[{ id: "new", label: "New Regime (default)" }, { id: "old", label: "Old Regime" }]}
        active={regime} onChange={setRegime}
      />

      {regime === "new" && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5 mb-4">
          <p className="text-xs text-primary font-medium">New Regime (FY 2024-25)</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Default regime from FY 2023-24. ₹75,000 standard deduction. No deductions except NPS employer contribution (80CCD(2)).
            Zero tax up to ₹7L income (rebate u/s 87A). Better for lower deduction profiles.
          </p>
        </div>
      )}
      {regime === "old" && (
        <div className="bg-warning/5 border border-warning/20 rounded-lg px-3 py-2.5 mb-4">
          <p className="text-xs text-warning font-medium">Old Regime</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Must be opted in explicitly. Allows all deductions (80C, 80D, NPS, HRA, home loan, etc.).
            Usually beneficial when deductions exceed ~₹3–4L. Zero tax up to ₹5L (rebate u/s 87A).
          </p>
        </div>
      )}

      <SectionHead label="Income Details" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Gross Salary / CTC (₹)" hint="Include all allowances before deductions">
          <input type="text" value={salary} onChange={e => setSalary(e.target.value)} className={inputCls} placeholder="12,00,000" />
        </Field>
        <Field label="Other Income (₹)" hint="Interest, dividends, freelance, etc.">
          <input type="text" value={otherIncome} onChange={e => setOtherIncome(e.target.value)} className={inputCls} placeholder="0" />
        </Field>
        <Field label="Rental Income (₹)" hint="Annual rent received (30% deduction auto-applied)">
          <input type="text" value={rentalIncome} onChange={e => setRentalIncome(e.target.value)} className={inputCls} placeholder="0" />
        </Field>
        <Field label="Capital Gains (₹)" hint="STCG/LTCG — taxed separately at special rates">
          <input type="text" value={capitalGains} onChange={e => setCapitalGains(e.target.value)} className={inputCls} placeholder="0" />
        </Field>
      </div>

      {regime === "new" && (
        <>
          <SectionHead label="Deductions — New Regime (limited)" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="NPS — Employer Contribution (₹)" hint="80CCD(2): max 10% of basic salary. Only deduction allowed in new regime">
              <input type="text" value={npsEmployer} onChange={e => setNpsEmployer(e.target.value)} className={inputCls} placeholder="0" />
            </Field>
          </div>
          <div className="bg-muted/30 rounded-lg px-3 py-2.5 mt-3">
            <p className="text-[11px] text-muted-foreground">
              Standard deduction of ₹75,000 is auto-applied. No other deductions are available in the new regime — 80C, 80D, HRA, home loan interest, LTA, etc. are all disallowed.
            </p>
          </div>
        </>
      )}

      {regime === "old" && (
        <>
          <SectionHead label="Exemptions from Salary" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="HRA Exempt (₹)" hint="Sec 10(13A): min(actual HRA, 50/40% of basic, rent−10% of basic)">
              <input type="text" value={hraExempt} onChange={e => setHraExempt(e.target.value)} className={inputCls} placeholder="0" />
            </Field>
            <Field label="LTA Exempt (₹)" hint="Sec 10(5): travel costs, 2 journeys in 4-year block">
              <input type="text" value={ltaAmt} onChange={e => setLtaAmt(e.target.value)} className={inputCls} placeholder="0" />
            </Field>
            <Field label="Other Exemptions (₹)" hint="Gratuity, leave encashment, etc.">
              <input type="text" value={otherExemptions} onChange={e => setOtherExemptions(e.target.value)} className={inputCls} placeholder="0" />
            </Field>
          </div>

          <SectionHead label="Section 80 Deductions" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="80C — Investments (₹)" hint="PPF, ELSS, EPF, LIC, NSC, home loan principal. Max ₹1,50,000">
              <input type="text" value={d80c} onChange={e => setD80c(e.target.value)} className={inputCls} placeholder="1,50,000" />
            </Field>
            <Field label="NPS Own Contribution — 80CCD(1B) (₹)" hint="Over and above 80C. Max ₹50,000 additional">
              <input type="text" value={d80ccd1b} onChange={e => setD80ccd1b(e.target.value)} className={inputCls} placeholder="50,000" />
            </Field>
            <Field label="80D — Medical Insurance Self/Family (₹)" hint="Self + family: max ₹25,000 (₹50,000 if you're a senior)">
              <input type="text" value={d80d} onChange={e => setD80d(e.target.value)} className={inputCls} placeholder="25,000" />
            </Field>
            <Field label="80D — Medical Insurance Parents (₹)" hint="₹25,000 if parents &lt;60 yrs; ₹50,000 if parents are seniors">
              <input type="text" value={d80dSenior} onChange={e => setD80dSenior(e.target.value)} className={inputCls} placeholder="0" />
            </Field>
            <Field label="80E — Education Loan Interest (₹)" hint="Entire interest paid, no upper limit. For 8 consecutive years">
              <input type="text" value={d80e} onChange={e => setD80e(e.target.value)} className={inputCls} placeholder="0" />
            </Field>
            <Field label="80G — Donations (₹)" hint="50% or 100% of donation depending on organisation">
              <input type="text" value={d80g} onChange={e => setD80g(e.target.value)} className={inputCls} placeholder="0" />
            </Field>
            <Field label="80GG — Rent Paid (no HRA) (₹)" hint="If you don't receive HRA. Max ₹5,000/month = ₹60,000/yr">
              <input type="text" value={d80gg} onChange={e => setD80gg(e.target.value)} className={inputCls} placeholder="0" />
            </Field>
            <Field label="80TTA — Savings Account Interest (₹)" hint="Interest from savings account. Max ₹10,000">
              <input type="text" value={d80tta} onChange={e => setD80tta(e.target.value)} className={inputCls} placeholder="0" />
            </Field>
          </div>

          <SectionHead label="House Property" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Home Loan Interest — Sec 24(b) (₹)" hint="Self-occupied: max ₹2,00,000. Let-out: no limit">
              <input type="text" value={hlInterest} onChange={e => setHlInterest(e.target.value)} className={inputCls} placeholder="0" />
            </Field>
          </div>
        </>
      )}

      <CalcButton onClick={calculate} label="Calculate Tax" />

      {result && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: "Total tax", val: inr(result.totalTax), danger: true },
              { label: "Effective rate", val: pct(result.effectiveRate), danger: false },
              { label: "Marginal rate", val: pct(result.marginalRate, 0), danger: false },
              { label: "Monthly in-hand", val: inr(result.inHandMonthly), danger: false },
            ].map(c => (
              <div key={c.label} className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{c.label}</p>
                <p className={`font-mono text-base font-bold mt-1 ${c.danger ? "text-destructive" : "text-foreground"}`}>{c.val}</p>
              </div>
            ))}
          </div>

          {/* Deduction breakdown */}
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Deductions claimed</p>
            <ResultBox>
              {result.deductionBreakdown
                .filter((d: any) => d.claimed > 0)
                .map((d: any) => (
                  <ResultRow key={d.section}
                    label={d.label}
                    value={inr(d.claimed)}
                    valueClass="text-success"
                    sub={`${d.section}${d.max < 999999 ? " · max " + inr(d.max) : ""}`}
                  />
                ))}
              <ResultRow label="Total Deductions" value={inr(result.totalDeductions)} valueClass="text-success" isTotal />
            </ResultBox>
          </div>

          {/* Slab breakdown */}
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Slab-wise tax computation</p>
            <ResultBox>
              <ResultRow label="Gross Income" value={inr(result.grossIncome)} />
              <ResultRow label="Less: Total Deductions" value={`− ${inr(result.totalDeductions)}`} valueClass="text-success" />
              <ResultRow label="Taxable Income" value={inr(result.taxableIncome)} isTotal />
              {result.slabBreakdown
                .filter((s: any) => s.taxable > 0)
                .map((s: any) => (
                  <ResultRow key={s.slab}
                    label={s.slab}
                    value={s.rate === 0 ? "Nil" : inr(s.tax)}
                    valueClass={s.rate === 0 ? "text-success" : "text-destructive"}
                    sub={s.rate > 0 ? `${inr(s.taxable)} × ${s.rate}%` : undefined}
                  />
                ))}
              <ResultRow label="Tax on total income" value={inr(result.taxBeforeRebate)} valueClass="text-destructive" isTotal />
              {result.rebate87A > 0 && <ResultRow label="Rebate u/s 87A" value={`− ${inr(result.rebate87A)}`} valueClass="text-success"
                sub={result.regime === "new" ? "Income ≤ ₹7L (new regime)" : "Income ≤ ₹5L (old regime)"} />}
              {result.surcharge > 0 && <ResultRow label="Surcharge" value={inr(result.surcharge)} valueClass="text-destructive"
                sub="Applicable on income > ₹50L" />}
              <ResultRow label="Health & Education Cess (4%)" value={inr(result.cess)} valueClass="text-destructive" />
              <ResultRow label="Total Tax Payable" value={inr(result.totalTax)} valueClass="text-destructive" isTotal />
            </ResultBox>
          </div>

          {/* Regime comparison tip */}
          <div className="bg-success/5 border border-success/20 rounded-xl p-4 mt-4">
            <p className="text-[10px] uppercase tracking-wider text-success font-medium mb-1">Regime recommendation tip</p>
            <p className="text-xs text-muted-foreground">
              {result.totalDeductions > 350000
                ? "Your deductions are high (>" + inr(350000) + "). The old regime is likely better for you — verify by comparing both."
                : "Your deductions are moderate. The new regime may save you tax. Compare both regimes for your exact numbers."}
            </p>
          </div>

          <Note>
            * FY 2024-25 slabs. Surcharge rates: 10% (₹50L–₹1Cr), 15% (₹1Cr–₹2Cr), 25% (₹2Cr–₹5Cr), 37% (&gt;₹5Cr).
            Capital gains taxed separately (STCG: 20%, LTCG: 12.5% above ₹1.25L). This is indicative — consult a CA for filing.
          </Note>
        </>
      )}
    </div>
  )
}

// ─── SIP vs EMI ──────────────────────────────────────────────────────────────

function SipEmiCalculator() {
  const [loan, setLoan] = useState("20,00,000")
  const [lrate, setLrate] = useState("8.5")
  const [tenure, setTenure] = useState("240")
  const [sipAmt, setSipAmt] = useState("10,000")
  const [srate, setSrate] = useState("12")
  const [freq, setFreq] = useState("12")
  const [result, setResult] = useState<any>(null)

  const parse = (s: string) => parseFloat(s.replace(/,/g, ""))

  const calculate = () => {
    const L = parse(loan), lr = parse(lrate) / 12 / 100
    const n = parseInt(tenure), sip = parse(sipAmt)
    const sr = parse(srate) / 12 / 100, f = parseInt(freq)
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
    setResult({ emi, originalTenure: n, reducedTenure: month, monthsSaved, sipTotal: sip * month, interestSaved: emi * monthsSaved })
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">Find out how a parallel SIP can prepay your loan early and save interest.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Outstanding Loan (₹)">
          <input type="text" value={loan} onChange={e => setLoan(e.target.value)} className={inputCls} placeholder="20,00,000" />
        </Field>
        <Field label="Loan Rate (% p.a.)">
          <input type="number" value={lrate} step="0.1" onChange={e => setLrate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Remaining Tenure (months)">
          <input type="number" value={tenure} onChange={e => setTenure(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Monthly SIP Amount (₹)">
          <input type="text" value={sipAmt} onChange={e => setSipAmt(e.target.value)} className={inputCls} placeholder="10,000" />
        </Field>
        <Field label="SIP Expected Return (% p.a.)">
          <input type="number" value={srate} step="0.1" onChange={e => setSrate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Prepayment Frequency">
          <select value={freq} onChange={e => setFreq(e.target.value)} className={selectCls}>
            <option value="12">Annually</option>
            <option value="6">Half-yearly</option>
            <option value="3">Quarterly</option>
          </select>
        </Field>
      </div>
      <CalcButton onClick={calculate} label="Analyse" />
      {result && (
        <>
          <InsightBox title="Analysis result" big={inr(result.interestSaved)} bigLabel="Total interest saved by prepaying with SIP">
            <p className="text-xs text-muted-foreground mt-3">
              Investing {inr(parse(sipAmt))}/month in SIP alongside your EMI of {inr(result.emi)}/month closes your loan <strong>{result.monthsSaved} months early.</strong>
            </p>
          </InsightBox>
          <ResultBox>
            <ResultRow label="Monthly EMI" value={inr(result.emi)} />
            <ResultRow label="Original tenure" value={`${result.originalTenure} months`} />
            <ResultRow label="Reduced tenure (with SIP prepay)" value={`${result.reducedTenure} months`} valueClass="text-success" />
            <ResultRow label="Months saved" value={`${result.monthsSaved} months`} valueClass="text-success" />
            <ResultRow label="Total SIP invested" value={inr(result.sipTotal)} />
            <ResultRow label="Interest saved" value={inr(result.interestSaved)} valueClass="text-success" isTotal />
          </ResultBox>
          <Note>* Prepayment applied every {freq === "12" ? "year" : freq === "6" ? "half-year" : "quarter"} from SIP corpus. Actual savings depend on lender prepayment terms. SIP returns assumed at {srate}% p.a.</Note>
        </>
      )}
    </div>
  )
}

// ─── OPTIONS GREEKS ───────────────────────────────────────────────────────────

function GreeksCalculator() {
  const [spot, setSpot] = useState("22,000")
  const [strike, setStrike] = useState("22,000")
  const [days, setDays] = useState("30")
  const [vol, setVol] = useState("18")
  const [rf, setRf] = useState("6.5")
  const [optType, setOptType] = useState<"call" | "put">("call")
  const [result, setResult] = useState<any>(null)

  const parse = (s: string) => parseFloat(s.replace(/,/g, ""))

  const calculate = () => {
    const S = parse(spot), K = parse(strike)
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
    const rho = optType === "call" ? K * T * Math.exp(-r * T) * N(d2) / 100 : -K * T * Math.exp(-r * T) * N(-d2) / 100
    const moneyness = optType === "call" ? (S < K ? "OTM" : "ITM") : (S > K ? "OTM" : "ITM")
    setResult({ price, delta, gamma, theta, vega, rho, iv: v * 100, moneyness })
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Spot Price (₹)"><input type="text" value={spot} onChange={e => setSpot(e.target.value)} className={inputCls} /></Field>
        <Field label="Strike Price (₹)"><input type="text" value={strike} onChange={e => setStrike(e.target.value)} className={inputCls} /></Field>
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
      <CalcButton onClick={calculate} />
      {result && (
        <>
          <ResultBox>
            <ResultRow label="Theoretical Price" value={inrD(result.price, 2)} valueClass="text-primary" />
            <ResultRow label="Moneyness" value={`${result.moneyness} ${optType.toUpperCase()}`}
              valueClass={result.moneyness === "ITM" ? "text-success" : "text-warning"} isTotal />
          </ResultBox>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            {[
              { sym: "Δ", label: "Delta", val: fmtD(result.delta), hint: "Directional sensitivity", cls: "text-primary" },
              { sym: "Γ", label: "Gamma", val: fmtD(result.gamma), hint: "Rate of delta change", cls: "text-success" },
              { sym: "Θ", label: "Theta / day", val: fmtD(result.theta), hint: "Daily time decay", cls: "text-warning" },
              { sym: "V", label: "Vega", val: fmtD(result.vega), hint: "Per 1% IV move", cls: "text-primary" },
              { sym: "ρ", label: "Rho", val: fmtD(result.rho), hint: "Per 1% rate move", cls: "text-destructive" },
              { sym: "IV", label: "Implied Vol", val: `${result.iv.toFixed(1)}%`, hint: "Annualised volatility", cls: "text-muted-foreground" },
            ].map(g => (
              <div key={g.sym} className="bg-background border border-border rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${g.cls} mb-1`}>{g.sym}</p>
                <p className={`font-mono text-sm font-medium ${g.cls}`}>{g.val}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{g.label}</p>
                <p className="text-[9px] text-muted-foreground">{g.hint}</p>
              </div>
            ))}
          </div>
          <Note>* Black-Scholes model (European, no dividends). Vega per 1% IV change. Theta is daily decay — theta accelerates near expiry.</Note>
        </>
      )}
    </div>
  )
}

// ─── CAGR ────────────────────────────────────────────────────────────────────

type CagrMode = "find" | "target" | "lumpsum"

function CagrCalculator() {
  const [mode, setMode] = useState<CagrMode>("find")
  const [init, setInit] = useState("1,00,000")
  const [final, setFinal] = useState("2,50,000")
  const [cyears, setCyears] = useState("5")
  const [tTarget, setTTarget] = useState("5,00,000")
  const [tRate, setTRate] = useState("12")
  const [lRate, setLRate] = useState("12")
  const [lYears, setLYears] = useState("10")
  const [result, setResult] = useState<any>(null)

  const parse = (s: string) => parseFloat(s.replace(/,/g, ""))

  const calculate = () => {
    if (mode === "find") {
      const P = parse(init), F = parse(final), Y = parseFloat(cyears)
      if (!P || !F || !Y) return
      const cagr = (Math.pow(F / P, 1 / Y) - 1) * 100
      setResult({ cagr, absPct: ((F - P) / P) * 100, gained: F - P, doublesIn: 72 / cagr })
    } else if (mode === "target") {
      const P = parse(init), T = parse(tTarget), rate = parseFloat(tRate) / 100
      if (!P || !T || !rate) return
      const years = Math.log(T / P) / Math.log(1 + rate)
      setResult({ years, doublesIn: 72 / parseFloat(tRate), target: T, init: P })
    } else {
      const P = parse(init), rate = parseFloat(lRate) / 100, Y = parseFloat(lYears)
      if (!P || !rate || !Y) return
      const fv = P * Math.pow(1 + rate, Y)
      setResult({ fv, gains: fv - P, absPct: ((fv - P) / P) * 100, init: P })
    }
  }

  return (
    <div>
      <SubTabs
        tabs={[{ id: "find", label: "Find CAGR" }, { id: "target", label: "Time to target" }, { id: "lumpsum", label: "Lumpsum FV" }]}
        active={mode} onChange={setMode}
      />
      {mode === "find" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Initial Investment (₹)"><input type="text" value={init} onChange={e => setInit(e.target.value)} className={inputCls} /></Field>
          <Field label="Final Value (₹)"><input type="text" value={final} onChange={e => setFinal(e.target.value)} className={inputCls} /></Field>
          <Field label="Duration (years)"><input type="number" value={cyears} onChange={e => setCyears(e.target.value)} className={inputCls} /></Field>
        </div>
      )}
      {mode === "target" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Initial Investment (₹)"><input type="text" value={init} onChange={e => setInit(e.target.value)} className={inputCls} /></Field>
          <Field label="Target Value (₹)"><input type="text" value={tTarget} onChange={e => setTTarget(e.target.value)} className={inputCls} /></Field>
          <Field label="Expected CAGR (%)"><input type="number" value={tRate} onChange={e => setTRate(e.target.value)} className={inputCls} /></Field>
        </div>
      )}
      {mode === "lumpsum" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Investment Amount (₹)"><input type="text" value={init} onChange={e => setInit(e.target.value)} className={inputCls} /></Field>
          <Field label="CAGR (%)"><input type="number" value={lRate} onChange={e => setLRate(e.target.value)} className={inputCls} /></Field>
          <Field label="Duration (years)"><input type="number" value={lYears} onChange={e => setLYears(e.target.value)} className={inputCls} /></Field>
        </div>
      )}
      <CalcButton onClick={calculate} />
      {result && (
        <ResultBox>
          {result.cagr !== undefined && <>
            <ResultRow label="CAGR" value={pct(result.cagr)} valueClass="text-success" />
            <ResultRow label="Absolute Return" value={pct(result.absPct, 1)} valueClass="text-success" />
            <ResultRow label="Doubles in (Rule of 72)" value={`${result.doublesIn.toFixed(1)} yrs`} valueClass="text-primary" />
            <ResultRow label="Value Gained" value={inr(result.gained)} valueClass="text-success" isTotal />
          </>}
          {result.years !== undefined && <>
            <ResultRow label="Years to Target" value={`${result.years.toFixed(1)} years`} valueClass="text-success" />
            <ResultRow label="Doubles in (Rule of 72)" value={`${result.doublesIn.toFixed(1)} yrs`} valueClass="text-primary" />
            <ResultRow label="Target Amount" value={inr(result.target)} isTotal />
          </>}
          {result.fv !== undefined && <>
            <ResultRow label="Amount Invested" value={inr(result.init)} />
            <ResultRow label="Gains" value={inr(result.gains)} valueClass="text-success" />
            <ResultRow label="Absolute Return" value={pct(result.absPct, 1)} valueClass="text-success" />
            <ResultRow label="Future Value" value={inr(result.fv)} valueClass="text-success" isTotal />
          </>}
        </ResultBox>
      )}
    </div>
  )
}

// ─── BREAKEVEN ────────────────────────────────────────────────────────────────

type BeMode = "options" | "equity"
type OptionType = "call" | "put" | "callsell" | "putsell"

function BreakevenCalculator() {
  const [mode, setMode] = useState<BeMode>("options")
  const [beStrike, setBeStrike] = useState("22,000")
  const [premium, setPremium] = useState("150")
  const [lot, setLot] = useState("50")
  const [optType, setOptType] = useState<OptionType>("call")
  const [buyPrice, setBuyPrice] = useState("500")
  const [qty, setQty] = useState("100")
  const [brokerage, setBrokerage] = useState("40")
  const [charges, setCharges] = useState("20")
  const [result, setResult] = useState<any>(null)

  const parse = (s: string) => parseFloat(s.replace(/,/g, ""))

  const calculate = () => {
    if (mode === "options") {
      const K = parse(beStrike), p = parse(premium), l = parse(lot) || 1
      if (!K || !p) return
      const map: Record<OptionType, any> = {
        call:     { be: K + p, label: "Long Call",  maxProfit: "Unlimited", maxLoss: inr(p * l) },
        put:      { be: K - p, label: "Long Put",   maxProfit: inr((K - p) * l), maxLoss: inr(p * l) },
        callsell: { be: K + p, label: "Short Call", maxProfit: inr(p * l), maxLoss: "Unlimited" },
        putsell:  { be: K - p, label: "Short Put",  maxProfit: inr(p * l), maxLoss: inr((K - p) * l) },
      }
      setResult({ ...map[optType], premiumTotal: p * l })
    } else {
      const bp = parse(buyPrice), q = parse(qty) || 1
      const totalCharges = (parse(brokerage) || 0) + (parse(charges) || 0)
      const be = bp + totalCharges / q
      setResult({ be, totalCharges, pctAboveBuy: ((be - bp) / bp) * 100, bp })
    }
  }

  return (
    <div>
      <SubTabs
        tabs={[{ id: "options", label: "Options trade" }, { id: "equity", label: "Equity trade" }]}
        active={mode} onChange={setMode}
      />
      {mode === "options" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Strike Price (₹)"><input type="text" value={beStrike} onChange={e => setBeStrike(e.target.value)} className={inputCls} /></Field>
          <Field label="Premium Paid (₹)"><input type="number" value={premium} onChange={e => setPremium(e.target.value)} className={inputCls} /></Field>
          <Field label="Lot Size"><input type="number" value={lot} onChange={e => setLot(e.target.value)} className={inputCls} /></Field>
          <Field label="Option Type">
            <select value={optType} onChange={e => setOptType(e.target.value as OptionType)} className={selectCls}>
              <option value="call">Call (Long)</option>
              <option value="put">Put (Long)</option>
              <option value="callsell">Call (Short / Write)</option>
              <option value="putsell">Put (Short / Write)</option>
            </select>
          </Field>
        </div>
      )}
      {mode === "equity" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Buy Price (₹)"><input type="text" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} className={inputCls} /></Field>
          <Field label="Quantity"><input type="text" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} /></Field>
          <Field label="Brokerage (₹)" hint="Flat fee per order (e.g. Zerodha ₹20)"><input type="number" value={brokerage} onChange={e => setBrokerage(e.target.value)} className={inputCls} /></Field>
          <Field label="STT + Other Charges (₹)" hint="STT, exchange txn charges, stamp duty, GST"><input type="number" value={charges} onChange={e => setCharges(e.target.value)} className={inputCls} /></Field>
        </div>
      )}
      <CalcButton onClick={calculate} />
      {result && (
        <ResultBox>
          {mode === "options" && result.label && <ResultRow label="Strategy" value={result.label} valueClass="text-primary" />}
          <ResultRow label="Breakeven Price" value={inr(result.be)} valueClass="text-primary" isTotal />
          {mode === "options" && <>
            <ResultRow label="Premium Paid (total)" value={inr(result.premiumTotal)} valueClass="text-warning" />
            <ResultRow label="Max Profit" value={result.maxProfit} valueClass="text-success" />
            <ResultRow label="Max Loss" value={result.maxLoss} valueClass="text-destructive" isTotal />
          </>}
          {mode === "equity" && <>
            <ResultRow label="Total Charges" value={inr(result.totalCharges)} valueClass="text-warning" />
            <ResultRow label="% above buy price to breakeven" value={`${result.pctAboveBuy.toFixed(3)}%`} valueClass="text-warning" isTotal />
          </>}
        </ResultBox>
      )}
    </div>
  )
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

const TITLES: Record<CalcId, { title: string; sub: string }> = {
  emi:    { title: "EMI Calculator", sub: "Personal, Home & Auto loan EMI with effective rate" },
  sip:    { title: "SIP Calculator", sub: "Regular and Step-up SIP with wealth projection" },
  mf:     { title: "MF Lumpsum", sub: "One-time mutual fund investment with compound growth" },
  fd:     { title: "Fixed Deposit", sub: "FD maturity with compounding, senior rates & tax impact" },
  rd:     { title: "Recurring Deposit", sub: "Monthly RD maturity with quarterly compounding" },
  avg:    { title: "Stock Averaging", sub: "Weighted average cost across up to 5 buy entries" },
  tax:    { title: "Income Tax Calculator", sub: "New & Old regime — full deductions, slabs, surcharge — FY 2024-25" },
  sipemi: { title: "SIP vs EMI", sub: "How SIP corpus can prepay your loan early and save interest" },
  greeks: { title: "Options Greeks", sub: "Black-Scholes: Delta, Gamma, Theta, Vega, Rho" },
  cagr:   { title: "CAGR Calculator", sub: "Find CAGR, time to target, or lumpsum future value" },
  be:     { title: "Breakeven Calculator", sub: "Options strategies and equity trade breakeven" },
}

export default function CalculatorsPage() {
  const [active, setActive] = useState<CalcId>("emi")

  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6">

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Calculators</h1>
            <p className="text-sm text-muted-foreground mt-1">Professional tools for equity, options, SIP, deposits & tax planning</p>
          </div>

          {/* Selector */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CALCS.map(c => (
              <button key={c.id} onClick={() => setActive(c.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  active === c.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-card"
                }`}
              >{c.label}</button>
            ))}
          </div>

          {/* Panel */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-foreground">{TITLES[active].title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{TITLES[active].sub}</p>
            </div>
            {active === "emi"    && <EmiCalculator />}
            {active === "sip"    && <SipCalculator />}
            {active === "mf"     && <MfLumpsumCalculator />}
            {active === "fd"     && <FdCalculator />}
            {active === "rd"     && <RdCalculator />}
            {active === "avg"    && <AvgCalculator />}
            {active === "tax"    && <TaxCalculator />}
            {active === "sipemi" && <SipEmiCalculator />}
            {active === "greeks" && <GreeksCalculator />}
            {active === "cagr"   && <CagrCalculator />}
            {active === "be"     && <BreakevenCalculator />}
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
