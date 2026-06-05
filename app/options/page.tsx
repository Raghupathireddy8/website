// app/options/page.tsx
"use client";
import { useState, useCallback } from "react";
import Papa from "papaparse";

// ── Types ──────────────────────────────────────────────────────────────────
interface OHLCRow {
  date: string;
  price: number;
  open: number;
  high: number;
  low: number;
  vol: string;
  change: number;
}

interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

// ── Black-Scholes helpers ──────────────────────────────────────────────────
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
function normalCDF(x: number) { return 0.5 * (1 + erf(x / Math.sqrt(2))); }
function normalPDF(x: number) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }

function bsGreeks(S: number, K: number, T: number, r: number, sigma: number, isCall: boolean): Greeks {
  if (T <= 0) return { delta: isCall ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0, rho: 0 };
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const nd1 = normalCDF(d1);
  const nd2 = normalCDF(d2);
  const pd1 = normalPDF(d1);
  const delta = isCall ? nd1 : nd1 - 1;
  const gamma = pd1 / (S * sigma * Math.sqrt(T));
  const theta = (-(S * pd1 * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * (isCall ? nd2 : normalCDF(-d2))) / 365;
  const vega = S * pd1 * Math.sqrt(T) / 100;
  const rho = isCall ? K * T * Math.exp(-r * T) * nd2 / 100 : -K * T * Math.exp(-r * T) * normalCDF(-d2) / 100;
  return { delta, gamma, theta, vega, rho };
}

function syntheticIV(spot: number, strike: number, vixLevel: number): number {
  const moneyness = Math.abs(Math.log(spot / strike));
  return (vixLevel / 100) * (1 + 0.5 * moneyness * moneyness * 20);
}

// ── Expiry logic ───────────────────────────────────────────────────────────
function getNextExpiry(from: Date, type: "weekly" | "monthly"): Date {
  const d = new Date(from);
  if (type === "weekly") {
    const day = d.getDay(); // 0=Sun, 2=Tue
    const daysToTue = (2 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + daysToTue);
  } else {
    // last Tuesday of month
    d.setMonth(d.getMonth() + 1, 0); // last day of current month
    while (d.getDay() !== 2) d.setDate(d.getDate() - 1);
  }
  // holiday check: if Tuesday, shift to Monday
  if (d.getDay() === 2) { /* add NSE holiday list check here */ }
  return d;
}

function daysToExpiry(spot_date: Date, expiry: Date): number {
  return Math.max(0, Math.round((expiry.getTime() - spot_date.getTime()) / 86400000));
}

// ── CSV parser ─────────────────────────────────────────────────────────────
function parseCSV(file: File): Promise<OHLCRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const rows = (data as Record<string, string>[]).map(r => ({
          date: r["Date"]?.trim() ?? "",
          price: parseFloat(r["Price"]?.replace(/,/g, "") ?? "0"),
          open:  parseFloat(r["Open"]?.replace(/,/g, "")  ?? "0"),
          high:  parseFloat(r["High"]?.replace(/,/g, "")  ?? "0"),
          low:   parseFloat(r["Low"]?.replace(/,/g, "")   ?? "0"),
          vol:   r["Vol."]?.trim() ?? "",
          change: parseFloat(r["Change %"]?.replace("%", "") ?? "0"),
        })).filter(r => r.date && !isNaN(r.price) && r.price > 0);
        resolve(rows);
      },
      error: reject,
    });
  });
}

// ── Strikes ────────────────────────────────────────────────────────────────
const STEPS = [-600, -400, -200, 0, 200, 400, 600];

export default function OptionsPage() {
  const [niftyData, setNiftyData] = useState<OHLCRow[]>([]);
  const [vixData, setVixData] = useState<OHLCRow[]>([]);
  const [replayIdx, setReplayIdx] = useState(0);
  const [expiryType, setExpiryType] = useState<"weekly" | "monthly">("weekly");
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
  const [isCall, setIsCall] = useState(true);

  // Current row
  const row = niftyData[replayIdx];
  const spot = row?.price ?? 24320;
  const vixRow = vixData[replayIdx];
  const vix = vixRow?.price ?? 13.5;

  // Expiry
  const spotDate = row ? new Date(row.date) : new Date();
  const expiry = getNextExpiry(spotDate, expiryType);
  const dte = daysToExpiry(spotDate, expiry);
  const T = dte / 365;
  const r = 0.065;
  const atmStrike = Math.round(spot / 100) * 100;

  // IV Rank (simple: current vix vs 52w range from data)
  const vixPrices = vixData.map(v => v.price);
  const vixMin = vixPrices.length ? Math.min(...vixPrices) : 10;
  const vixMax = vixPrices.length ? Math.max(...vixPrices) : 20;
  const ivRank = vixMax > vixMin ? Math.round(((vix - vixMin) / (vixMax - vixMin)) * 100) : 28;

  // Greeks for selected/ATM
  const strike = selectedStrike ?? atmStrike;
  const sigma = syntheticIV(spot, strike, vix);
  const greeks = bsGreeks(spot, strike, T, r, sigma, isCall);

  // Option chain
  const chain = STEPS.map(offset => {
    const K = atmStrike + offset;
    const ivCE = syntheticIV(spot, K, vix);
    const ivPE = syntheticIV(spot, K, vix);
    const gCE = bsGreeks(spot, K, T, r, ivCE, true);
    const gPE = bsGreeks(spot, K, T, r, ivPE, false);
    const ltpCE = Math.max(0.5, gCE.delta * (spot - K) + ivCE * spot * Math.sqrt(T) * 0.4);
    const ltpPE = Math.max(0.5, -gPE.delta * (K - spot) + ivPE * spot * Math.sqrt(T) * 0.4);
    return { K, ltpCE: Math.round(ltpCE), ltpPE: Math.round(ltpPE), deltaCE: gCE.delta, ivCE, ivPE };
  });

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, type: "nifty" | "vix") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const rows = await parseCSV(file);
    if (type === "nifty") { setNiftyData(rows); setReplayIdx(rows.length - 1); }
    else setVixData(rows);
  }, []);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* ── Header ── */}
      <section className="flex items-center gap-4 flex-wrap">
        <h1 className="text-xl font-medium">Options · Greeks Lab</h1>
        <div className="flex gap-2 ml-auto text-sm">
          <span className="text-muted-foreground">NIFTY</span>
          <span className="font-medium">{spot.toLocaleString("en-IN")}</span>
          <span className={row?.change >= 0 ? "text-green-600" : "text-red-500"}>
            {row?.change >= 0 ? "+" : ""}{row?.change?.toFixed(2) ?? "—"}%
          </span>
        </div>
      </section>

      {/* ── Upload zone ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(["nifty", "vix"] as const).map(type => (
          <label key={type} className="border border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/30 transition-colors">
            <span className="block text-sm font-medium mb-1">{type === "nifty" ? "Nifty" : "India VIX"} CSV</span>
            <span className="block text-xs text-muted-foreground mb-2">Date · Price · Open · High · Low · Vol · Change%</span>
            <input type="file" accept=".csv" className="hidden" onChange={e => handleFile(e, type)} />
            <span className="text-xs px-3 py-1 rounded-full border">
              {type === "nifty" ? niftyData.length : vixData.length} rows loaded · click to upload
            </span>
          </label>
        ))}
      </section>

      {/* ── Expiry selector ── */}
      <section className="flex gap-2 flex-wrap items-center text-sm">
        <span className="text-muted-foreground">Expiry:</span>
        {(["weekly", "monthly"] as const).map(t => (
          <button key={t} onClick={() => setExpiryType(t)}
            className={`px-3 py-1 rounded-full border text-xs transition-colors ${expiryType === t ? "bg-blue-50 border-blue-200 text-blue-700" : "border-border text-muted-foreground"}`}>
            {t === "weekly" ? "Weekly · Tue" : "Monthly · Last Tue"}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          Expiry: {expiry.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })} · {dte}d left
        </span>
      </section>

      {/* ── Metric cards ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Spot", val: spot.toLocaleString("en-IN"), sub: `${row?.change >= 0 ? "+" : ""}${(row?.change ?? 0).toFixed(2)}%`, color: row?.change >= 0 ? "text-green-600" : "text-red-500" },
          { label: "VIX", val: vix.toFixed(2), sub: vix < 15 ? "Low fear" : vix < 20 ? "Moderate" : "High fear", color: vix > 20 ? "text-red-500" : "text-green-600" },
          { label: "IV Rank", val: `${ivRank}%`, sub: "52w percentile", color: "text-muted-foreground" },
          { label: "Strike", val: strike.toLocaleString("en-IN"), sub: `${isCall ? "Call" : "Put"} · σ ${(sigma * 100).toFixed(1)}%`, color: "text-muted-foreground" },
        ].map(c => (
          <div key={c.label} className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-xl font-medium">{c.val}</p>
            <p className={`text-xs mt-0.5 ${c.color}`}>{c.sub}</p>
          </div>
        ))}
      </section>

      {/* ── Greeks + Chain + IV Smile ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Greeks */}
        <div className="border rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-muted-foreground">Greeks panel</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">synthetic</span>
            <button onClick={() => setIsCall(!isCall)}
              className="ml-auto text-xs px-2 py-0.5 rounded border">
              {isCall ? "CE" : "PE"}
            </button>
          </div>
          {[
            { sym: "Δ", name: "Delta",  val: greeks.delta.toFixed(3),  desc: "Price sensitivity",   color: greeks.delta >= 0 ? "text-green-600" : "text-red-500" },
            { sym: "Γ", name: "Gamma",  val: greeks.gamma.toFixed(4),  desc: "Delta change rate",   color: "text-blue-600" },
            { sym: "Θ", name: "Theta",  val: greeks.theta.toFixed(2),  desc: "Time decay / day",    color: "text-red-500" },
            { sym: "V", name: "Vega",   val: greeks.vega.toFixed(2),   desc: "IV sensitivity",      color: "text-amber-600" },
            { sym: "ρ", name: "Rho",    val: greeks.rho.toFixed(3),    desc: "Rate sensitivity",    color: "text-muted-foreground" },
          ].map(g => (
            <div key={g.name} className="flex justify-between items-center border-b last:border-0 py-1.5">
              <div>
                <p className="text-sm font-medium">{g.sym} {g.name}</p>
                <p className="text-xs text-muted-foreground">{g.desc}</p>
              </div>
              <span className={`text-sm font-medium ${g.color}`}>{g.val}</span>
            </div>
          ))}
        </div>

        {/* Option Chain */}
        <div className="border rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">
            Option chain · ATM {atmStrike.toLocaleString("en-IN")}
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="text-left py-1">CE Δ</th>
                <th className="text-right py-1">LTP</th>
                <th className="text-center py-1 font-medium">Strike</th>
                <th className="text-left py-1">LTP</th>
                <th className="text-right py-1">PE Δ</th>
              </tr>
            </thead>
            <tbody>
              {chain.map(c => (
                <tr key={c.K}
                  onClick={() => setSelectedStrike(c.K)}
                  className={`cursor-pointer border-b last:border-0 transition-colors
                    ${c.K === atmStrike ? "bg-blue-50/60 font-semibold" : ""}
                    ${c.K === selectedStrike ? "bg-amber-50" : "hover:bg-muted/30"}`}>
                  <td className="py-1.5 text-green-700">{c.deltaCE.toFixed(2)}</td>
                  <td className="py-1.5 text-right">{c.ltpCE}</td>
                  <td className="py-1.5 text-center text-muted-foreground">{c.K.toLocaleString("en-IN")}</td>
                  <td className="py-1.5">{c.ltpPE}</td>
                  <td className="py-1.5 text-right text-red-500">{(c.deltaCE - 1).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* IV smile */}
        <div className="border rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">IV smile</p>
          <div className="space-y-2">
            {chain.map(c => (
              <div key={c.K}>
                <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                  <span>{c.K === atmStrike ? `${c.K} (ATM)` : c.K > atmStrike ? `${c.K} OTM CE` : `${c.K} OTM PE`}</span>
                  <span>{(c.ivCE * 100).toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, c.ivCE * 200)}%`, background: c.K === atmStrike ? "#1D9E75" : "#378ADD" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Replay ── */}
      {niftyData.length > 0 && (
        <section className="border rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Historical replay</p>
          <input type="range" min={0} max={niftyData.length - 1} value={replayIdx}
            onChange={e => setReplayIdx(Number(e.target.value))} className="w-full" />
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{row?.date}</span>
            <span>Spot {spot.toLocaleString("en-IN")}</span>
            <span>VIX {vix.toFixed(2)}</span>
            <span>{dte}d to expiry</span>
          </div>
        </section>
      )}

      <p className="text-xs text-center text-muted-foreground border-t pt-4">
        Premiums are synthetic · For education &amp; practice only · Not financial advice
      </p>
    </main>
  );
}
