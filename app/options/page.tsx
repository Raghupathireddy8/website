"use client";
// MarketGreeks — Options Simulator v2
// Changes:
// 1. NIFTY lot=65, BANKNIFTY lot=30
// 2. Show only ±50 strikes from ATM (i.e. 50 strikes ITM and 50 OTM = 101 total)
// 3. Spot label shows "Spot @ <replay date>" instead of just "Spot"
// 4. Quick Mode removed; left-click = Buy, right-click = Sell (clean hint bar)
// 5. Position rows show expiry date label (e.g. "28 Jul 26")
// 6. Positions close on expiry (positions with expired legExpiry are auto-removed)
// 7. Non-expiry positions (different expiry) persist when switching base expiry
// 8. Live spot-price vertical line moves on chart so user sees distance to breakeven
// 9. Buy/Sell buttons enabled directly on the strike price row

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type IndexKey = "NIFTY" | "BANKNIFTY";
type OptionType = "C" | "P";

interface Position {
  id: number;
  K: number;
  type: OptionType;
  dir: 1 | -1;
  lots: number;
  entryPrem: number;
  legExpiryDate: string;   // actual ISO date string — position closes on/after this date
  legExpiryLabel: string;  // display label e.g. "28 Jul 26"
}

interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

interface Expiry {
  label: string;
  date: string;
  type: "Weekly" | "Monthly" | "Quarterly";
}

interface StratResult {
  name: string;
  bias: string;
}

// ─────────────────────────────────────────────
// CONFIG — CORRECTED LOT SIZES
// ─────────────────────────────────────────────
const CFG: Record<IndexKey, { lot: number; step: number; pct: number; span: number; label: string }> = {
  NIFTY:     { lot: 65,  step: 50,  pct: 0.15, span: 175000, label: "NIFTY" },
  BANKNIFTY: { lot: 30,  step: 100, pct: 0.15, span: 120000, label: "BANK NIFTY" },
};

const EXPIRIES: Record<IndexKey, Expiry[]> = {
  NIFTY: [
    { label: "26 Jun 26", date: "2026-06-26", type: "Monthly" },
    { label: "28 Jul 26", date: "2026-07-28", type: "Monthly" },
    { label: "25 Aug 26", date: "2026-08-25", type: "Monthly" },
    { label: "29 Sep 26", date: "2026-09-29", type: "Quarterly" },
  ],
  BANKNIFTY: [
    { label: "18 Jun 26", date: "2026-06-18", type: "Weekly" },
    { label: "25 Jun 26", date: "2026-06-25", type: "Monthly" },
    { label: "23 Jul 26", date: "2026-07-23", type: "Monthly" },
  ],
};

// ─────────────────────────────────────────────
// MATH UTILITIES
// ─────────────────────────────────────────────
function normCDF(x: number): number {
  const a = [0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429];
  const k = 1 / (1 + 0.2316419 * Math.abs(x));
  const p = 1 - 0.3989422803 * Math.exp(-x * x / 2) * (((((a[4] * k + a[3]) * k) + a[2]) * k + a[1]) * k + a[0]) * k;
  return x >= 0 ? p : 1 - p;
}
function normPDF(x: number): number { return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); }

function bsPrice(S: number, K: number, T: number, r: number, sig: number, type: OptionType): number {
  if (T <= 0.0001) return type === "C" ? Math.max(0, S - K) : Math.max(0, K - S);
  const d1 = (Math.log(S / K) + (r + sig * sig / 2) * T) / (sig * Math.sqrt(T));
  const d2 = d1 - sig * Math.sqrt(T);
  return type === "C"
    ? S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2)
    : K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1);
}

function bsGreeks(S: number, K: number, T: number, r: number, sig: number, type: OptionType): Greeks {
  if (T <= 0.0001) return { delta: type === "C" ? (S >= K ? 1 : 0) : -(S <= K ? 1 : 0), gamma: 0, theta: 0, vega: 0, rho: 0 };
  const sqT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + sig * sig / 2) * T) / (sig * sqT);
  const d2 = d1 - sig * sqT;
  const phi = normPDF(d1);
  const delta = type === "C" ? normCDF(d1) : normCDF(d1) - 1;
  const gamma = phi / (S * sig * sqT);
  const theta = type === "C"
    ? (-S * phi * sig / (2 * sqT) - r * K * Math.exp(-r * T) * normCDF(d2)) / 365
    : (-S * phi * sig / (2 * sqT) + r * K * Math.exp(-r * T) * normCDF(-d2)) / 365;
  const vega = S * phi * sqT / 100;
  const rho = type === "C" ? K * T * Math.exp(-r * T) * normCDF(d2) / 100 : -K * T * Math.exp(-r * T) * normCDF(-d2) / 100;
  return { delta, gamma, theta, vega, rho };
}

function smileIV(baseIV: number, S: number, K: number, T: number): number {
  const m = Math.log(K / S) / Math.sqrt(Math.max(T, 0.001));
  return Math.max(0.05, baseIV + (-0.025 * m) + (0.004 * m * m));
}

// ─────────────────────────────────────────────
// FORMATTING
// ─────────────────────────────────────────────
const fmtN = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fmtP = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fmtDate = (d: Date) => d.toISOString().split("T")[0];

// ─────────────────────────────────────────────
// CHART (imperative, canvas)
// ─────────────────────────────────────────────
interface ChartData { spots: number[]; payoffs: number[]; mtmPayoffs: number[]; bes: number[]; S: number; }

declare global { interface Window { Chart: any } }

function buildChart(canvas: HTMLCanvasElement, data: ChartData, view: "expiry" | "mtm"): void {
  const Chart = window.Chart;
  if (!Chart) return;

  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const { spots, payoffs, mtmPayoffs, bes, S } = data;
  const active = view === "expiry" ? payoffs : mtmPayoffs;

  const annotationPlugin = {
    id: "mgAnnotations",
    afterDraw(chart: any) {
      const { ctx, scales: { x, y }, chartArea } = chart;
      ctx.save();

      // Zero line
      const yZero = y.getPixelForValue(0);
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(chartArea.left, yZero);
      ctx.lineTo(chartArea.right, yZero);
      ctx.stroke();

      // Current spot vertical line — animated feel via prominent style
      const spotIdx = spots.reduce((bi: number, s: number, i: number) =>
        Math.abs(s - S) < Math.abs(spots[bi] - S) ? i : bi, 0);
      const xSpot = x.getPixelForValue(spotIdx);

      // Glow effect for spot line
      ctx.shadowColor = "#3b82f6";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.moveTo(xSpot, chartArea.top);
      ctx.lineTo(xSpot, chartArea.bottom);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Spot label box
      const spotPrice = S.toFixed(0);
      const labelW = ctx.measureText("SPOT " + spotPrice).width + 14;
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.roundRect?.(xSpot - labelW / 2, chartArea.top - 1, labelW, 18, 3);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px 'DM Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SPOT " + spotPrice, xSpot, chartArea.top + 12);

      // Breakeven verticals
      bes.forEach((be: number) => {
        const beIdx = spots.reduce((bi: number, s: number, i: number) =>
          Math.abs(s - be) < Math.abs(spots[bi] - be) ? i : bi, 0);
        const xBE = x.getPixelForValue(beIdx);
        ctx.beginPath();
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.moveTo(xBE, chartArea.top);
        ctx.lineTo(xBE, chartArea.bottom);
        ctx.stroke();

        // BE label
        const beLabel = "BE " + be.toFixed(0);
        const beLabelW = ctx.measureText(beLabel).width + 10;
        ctx.setLineDash([]);
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.roundRect?.(xBE - beLabelW / 2, chartArea.bottom + 2, beLabelW, 16, 3);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.font = "bold 8.5px 'DM Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(beLabel, xBE, chartArea.bottom + 13);

        // Distance from spot to BE line label
        const distPts = Math.abs(be - S);
        const distPct = ((distPts / S) * 100).toFixed(1);
        const midX = (xSpot + xBE) / 2;
        const midY = y.getPixelForValue(0);
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(245,158,11,0.15)";
        ctx.strokeStyle = "rgba(245,158,11,0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xSpot, midY);
        ctx.lineTo(xBE, midY);
        ctx.stroke();
        ctx.fillStyle = "#f59e0b";
        ctx.font = "9px 'DM Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${fmtN(distPts)}pts (${distPct}%)`, midX, midY - 6);
      });

      ctx.restore();
    },
  };

  new Chart(canvas, {
    type: "line",
    plugins: [annotationPlugin],
    data: {
      labels: spots.map((s: number) => s.toFixed(0)),
      datasets: [
        {
          label: "P&L",
          data: active,
          segment: {
            borderColor: (ctx: any) => active[ctx.p0DataIndex] >= 0 ? "#22c55e" : "#ef4444",
          },
          borderWidth: 3,
          pointRadius: 0,
          fill: {
            target: { value: 0 },
            above: "rgba(34,197,94,0.10)",
            below: "rgba(239,68,68,0.10)",
          },
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 200 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1a1e2a",
          borderColor: "#1e2333",
          borderWidth: 1,
          titleColor: "#6b7494",
          bodyColor: "#e2e6f0",
          padding: 10,
          callbacks: {
            title: (c: any) => "Spot ₹" + parseFloat(c[0].label).toLocaleString("en-IN"),
            label: (c: any) => {
              const v = c.raw as number;
              return `P&L: ${v >= 0 ? "+" : ""}₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: {
            color: "#3a4060",
            font: { size: 10 },
            maxTicksLimit: 10,
            callback: (_v: any, i: number) => i % 20 === 0 ? spots[i]?.toFixed(0) ?? null : null,
          },
        },
        y: {
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: {
            color: "#3a4060",
            font: { size: 10 },
            callback: (v: any) => {
              const abs = Math.abs(v);
              return "₹" + (abs >= 100000 ? (v / 100000).toFixed(1) + "L" : abs >= 1000 ? (v / 1000).toFixed(0) + "K" : v.toFixed(0));
            },
          },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────
// STRATEGY DETECTION
// ─────────────────────────────────────────────
function detectStrat(positions: Position[]): StratResult {
  const n = positions.length;
  if (!n) return { name: "No Strategy", bias: "—" };
  if (n === 1) {
    const p = positions[0];
    if (p.dir === 1 && p.type === "C") return { name: "Long Call", bias: "Bullish" };
    if (p.dir === 1 && p.type === "P") return { name: "Long Put", bias: "Bearish" };
    if (p.dir === -1 && p.type === "C") return { name: "Short (Naked) Call", bias: "Bearish/Neutral" };
    if (p.dir === -1 && p.type === "P") return { name: "Short (Cash Secured) Put", bias: "Bullish/Neutral" };
  }
  if (n === 2) {
    const buys = positions.filter(p => p.dir === 1), sells = positions.filter(p => p.dir === -1);
    // Calendar spread: same type, same strike, different expiries
    if (buys.length === 1 && sells.length === 1) {
      const b = buys[0], s = sells[0];
      if (b.type === s.type && b.K === s.K && b.legExpiryDate !== s.legExpiryDate)
        return { name: "Calendar Spread", bias: b.type === "C" ? "Neutral/Bullish" : "Neutral/Bearish" };
      if (b.type === "C" && s.type === "C") return { name: b.K < s.K ? "Bull Call Spread" : "Bear Call Spread", bias: b.K < s.K ? "Bullish" : "Bearish" };
      if (b.type === "P" && s.type === "P") return { name: b.K > s.K ? "Bear Put Spread" : "Bull Put Spread", bias: b.K > s.K ? "Bearish" : "Bullish" };
    }
    const types = positions.map(p => p.type);
    const dirs = positions.map(p => p.dir);
    if (types.includes("C") && types.includes("P")) {
      if (dirs.every(d => d === 1)) return { name: "Long Straddle", bias: "High Volatility" };
      if (dirs.every(d => d === -1)) return { name: "Short Straddle", bias: "Neutral / Range" };
    }
  }
  if (n === 4) {
    const cc = positions.filter(p => p.type === "C"), pp = positions.filter(p => p.type === "P");
    if (cc.length === 2 && pp.length === 2 && cc.some(p => p.dir === 1) && cc.some(p => p.dir === -1)) return { name: "Iron Condor", bias: "Range-bound / Low Vol" };
    if (positions.every(p => p.type === "C") || positions.every(p => p.type === "P")) return { name: "Butterfly Spread", bias: "Neutral" };
  }
  if (n === 3) return { name: "Custom 3-leg", bias: "Complex" };
  return { name: `Custom ${n}-leg Strategy`, bias: "Complex" };
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
let posIdCounter = 1;

export default function OptionsSimulator() {
  const [currentIndex, setCurrentIndex] = useState<IndexKey>("NIFTY");
  const [selectedExp, setSelectedExp] = useState(0);
  const [entryDate, setEntryDate] = useState("2026-05-28");
  const [replayDate, setReplayDate] = useState("2026-05-28");
  const [expiryDate, setExpiryDate] = useState("2026-06-26");
  const [entrySpot, setEntrySpot] = useState(24009);
  const [replaySpot, setReplaySpot] = useState(24009);
  const [replayVIX, setReplayVIX] = useState(14.82);
  const [rhoRate, setRhoRate] = useState(6.5);
  const [positions, setPositions] = useState<Position[]>([]);
  const [chartView, setChartView] = useState<"expiry" | "mtm">("expiry");

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cfg = CFG[currentIndex];
  const exps = EXPIRIES[currentIndex];

  const getDTE = useCallback((expD?: string) => {
    const eDate = new Date(expD ?? expiryDate);
    const rDate = new Date(replayDate);
    return Math.max(0.001, (eDate.getTime() - rDate.getTime()) / (1000 * 60 * 60 * 24));
  }, [expiryDate, replayDate]);

  const getIV = useCallback((S: number, K: number, T: number) => smileIV(replayVIX / 100, S, K, T), [replayVIX]);

  const calcPremium = useCallback((S: number, K: number, dte: number, type: OptionType) => {
    const T = dte / 365, r = rhoRate / 100;
    return Math.max(0.05, bsPrice(S, K, T, r, getIV(S, K, T), type));
  }, [getIV, rhoRate]);

  // ── STRIKES: ±50 from ATM only ──
  const atm = useMemo(() => Math.round(replaySpot / cfg.step) * cfg.step, [replaySpot, cfg.step]);

  const strikes = useMemo(() => {
    const step = cfg.step;
    const arr: number[] = [];
    // 50 strikes below ATM, ATM itself, 50 strikes above ATM = 101 strikes
    for (let i = -50; i <= 50; i++) {
      arr.push(atm + i * step);
    }
    return arr;
  }, [atm, cfg.step]);

  // ── Auto-expire positions when replayDate advances past legExpiryDate ──
  useEffect(() => {
    const rDate = new Date(replayDate);
    setPositions(prev => prev.filter(p => {
      const expDate = new Date(p.legExpiryDate);
      // Keep if not yet expired (expiry is still in future or today)
      return expDate >= rDate;
    }));
  }, [replayDate]);

  // ── Position helpers ──
  const addPos = useCallback((K: number, type: OptionType, prem: number, dir: 1 | -1, expLabel: string, expDate: string) => {
    setPositions(prev => {
      // Check for existing same leg (same strike, type, direction, AND same expiry)
      const idx = prev.findIndex(p => p.K === K && p.type === type && p.dir === dir && p.legExpiryDate === expDate);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], lots: next[idx].lots + 1 };
        return next;
      }
      return [...prev, { id: posIdCounter++, K, type, dir, lots: 1, entryPrem: prem, legExpiryDate: expDate, legExpiryLabel: expLabel }];
    });
  }, []);

  const removeByKType = useCallback((K: number, type: OptionType) => {
    setPositions(prev => prev.filter(p => !(p.K === K && p.type === type)));
  }, []);

  const removePosIdx = useCallback((id: number) => {
    setPositions(prev => prev.filter(p => p.id !== id));
  }, []);

  const changeLots = useCallback((id: number, d: number) => {
    setPositions(prev => {
      const next = [...prev];
      const idx = next.findIndex(p => p.id === id);
      if (idx >= 0) next[idx] = { ...next[idx], lots: Math.max(1, next[idx].lots + d) };
      return next;
    });
  }, []);

  const changeExpiryForPos = useCallback((id: number, exp: Expiry) => {
    setPositions(prev => {
      const next = [...prev];
      const idx = next.findIndex(p => p.id === id);
      if (idx >= 0) next[idx] = { ...next[idx], legExpiryDate: exp.date, legExpiryLabel: exp.label };
      return next;
    });
  }, []);

  function isHedged(pos: Position, all: Position[]): boolean {
    if (pos.dir !== -1) return false;
    return all.some(p => p.dir === 1 && p.type === pos.type &&
      Math.abs(p.K - pos.K) <= cfg.step * 6 && p.lots >= pos.lots);
  }

  // ── Analytics ──
  const analytics = useMemo(() => {
    const S = replaySpot;
    const dte = getDTE();
    const T = dte / 365;
    const r = rhoRate / 100;
    const lot = cfg.lot;

    if (!positions.length) return null;

    const range = S * 0.18;
    const steps = 300;
    const spots = Array.from({ length: steps + 1 }, (_, i) => S - range + i * (2 * range / steps));

    function calcAt(spot: number, expiry: boolean) {
      return positions.reduce((sum, p) => {
        let pnl: number;
        const legDTE = getDTE(p.legExpiryDate);
        if (expiry) {
          const intr = p.type === "C" ? Math.max(0, spot - p.K) : Math.max(0, p.K - spot);
          pnl = (intr - p.entryPrem) * lot * p.lots * p.dir;
        } else {
          const cur = calcPremium(spot, p.K, legDTE, p.type);
          pnl = (cur - p.entryPrem) * lot * p.lots * p.dir;
        }
        return sum + pnl;
      }, 0);
    }

    const payoffs = spots.map(s => calcAt(s, true));
    const mtmPayoffs = spots.map(s => calcAt(s, false));
    const active = chartView === "expiry" ? payoffs : mtmPayoffs;

    const maxP = Math.max(...payoffs);
    const minP = Math.min(...payoffs);

    const onlyBuys = positions.every(p => p.dir === 1);
    const onlySells = positions.every(p => p.dir === -1);
    const singleBuy = positions.length === 1 && positions[0].dir === 1;
    const singleSell = positions.length === 1 && positions[0].dir === -1;
    const isUnlimP = singleBuy || onlyBuys || maxP > lot * S * 1.5;
    const isUnlimL = singleSell || onlySells || minP < -lot * S * 1.5;

    const bes: number[] = [];
    for (let i = 1; i < active.length; i++) {
      if ((active[i - 1] < 0) !== (active[i] < 0)) {
        const s = spots[i - 1] + (spots[i] - spots[i - 1]) * (0 - active[i - 1]) / (active[i] - active[i - 1]);
        bes.push(Math.round(s));
      }
    }

    let pD = 0, pG = 0, pTh = 0, pV = 0, pR = 0;
    positions.forEach(p => {
      const iv = getIV(S, p.K, T);
      const g = bsGreeks(S, p.K, T, r, iv, p.type);
      const m = p.dir * p.lots * lot;
      pD += g.delta * m; pG += g.gamma * m; pTh += g.theta * m; pV += g.vega * m; pR += g.rho * m;
    });

    const mtmPnl = calcAt(S, false);

    const iv0 = replayVIX / 100;
    let popPct = "—";
    if (bes.length === 1) {
      const d = Math.log(bes[0] / S) / (iv0 * Math.sqrt(Math.max(T, 0.001)));
      const profitAbove = calcAt(S * 1.01, chartView === "expiry") > 0;
      popPct = (profitAbove ? (1 - normCDF(d)) : normCDF(d)) * 100 > 0
        ? ((profitAbove ? (1 - normCDF(d)) : normCDF(d)) * 100).toFixed(0) + "%"
        : "—";
    } else if (bes.length === 2) {
      const d1 = Math.log(bes[0] / S) / (iv0 * Math.sqrt(Math.max(T, 0.001)));
      const d2 = Math.log(bes[1] / S) / (iv0 * Math.sqrt(Math.max(T, 0.001)));
      popPct = ((normCDF(d2) - normCDF(d1)) * 100).toFixed(0) + "%";
    } else if (bes.length === 0) {
      popPct = active[150] > 0 ? ">95%" : "<5%";
    }

    const rr = !isUnlimP && !isUnlimL && maxP > 0 && minP < 0
      ? "1 : " + (Math.abs(minP) / maxP).toFixed(2)
      : "—";

    let netPrem = 0, totalMargin = 0;
    positions.forEach(p => {
      const notional = p.entryPrem * lot * p.lots;
      const hedged = isHedged(p, positions);
      const m = p.dir === 1 ? notional : hedged ? cfg.span * p.lots * 0.25 : cfg.span * p.lots;
      netPrem += p.dir === 1 ? -notional : notional;
      totalMargin += m;
    });

    return {
      spots, payoffs, mtmPayoffs, bes, S,
      maxP, minP, isUnlimP, isUnlimL,
      pD, pG, pTh, pV, pR,
      mtmPnl, popPct, rr,
      strat: detectStrat(positions),
      netPrem, totalMargin,
    };
  }, [positions, replaySpot, replayVIX, rhoRate, expiryDate, replayDate, chartView, cfg, getDTE, getIV, calcPremium]);

  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Chart) { setChartReady(true); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    script.async = true;
    script.onload = () => setChartReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!chartReady || !canvasRef.current) return;
    if (!analytics) {
      const ex = window.Chart?.getChart(canvasRef.current);
      if (ex) ex.destroy();
      return;
    }
    buildChart(canvasRef.current, analytics, chartView);
  }, [chartReady, analytics, chartView]);

  function switchIndex(idx: IndexKey) {
    setCurrentIndex(idx);
    setSelectedExp(0);
    setPositions([]);
    const defSpot = idx === "NIFTY" ? 24009 : 54250;
    setEntrySpot(defSpot);
    setReplaySpot(defSpot);
    setExpiryDate(EXPIRIES[idx][0].date);
  }

  function selectExp(i: number) {
    setSelectedExp(i);
    setExpiryDate(exps[i].date);
  }

  function stepReplay(dir: number) {
    const d = new Date(replayDate);
    d.setDate(d.getDate() + dir);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + dir);
    setReplayDate(fmtDate(d));
    const move = Math.round((Math.random() - 0.48) * cfg.step * 6);
    setReplaySpot(prev => Math.max(Math.round(prev * 0.9), prev + move));
    setReplayVIX(prev => parseFloat(Math.max(10, Math.min(40, prev + (Math.random() - 0.5) * 0.8)).toFixed(2)));
  }

  function loadStrat(name: string) {
    const S = replaySpot;
    const dte = getDTE();
    const a = Math.round(S / cfg.step) * cfg.step;
    const currentExpiry = exps[selectedExp];
    const p = (K: number, t: OptionType, d: 1 | -1): Position => ({
      id: posIdCounter++,
      K, type: t, dir: d, lots: 1,
      entryPrem: calcPremium(S, K, dte, t),
      legExpiryDate: currentExpiry.date,
      legExpiryLabel: currentExpiry.label,
    });
    // For calendar, use two different expiries
    const nextExpiry = exps[Math.min(selectedExp + 1, exps.length - 1)];
    const map: Record<string, Position[]> = {
      bull_call: [p(a, "C", 1), p(a + cfg.step * 3, "C", -1)],
      bear_put: [p(a, "P", 1), p(a - cfg.step * 3, "P", -1)],
      straddle: [p(a, "C", -1), p(a, "P", -1)],
      strangle: [p(a + cfg.step * 2, "C", -1), p(a - cfg.step * 2, "P", -1)],
      condor: [p(a + cfg.step * 3, "C", -1), p(a + cfg.step * 6, "C", 1), p(a - cfg.step * 3, "P", -1), p(a - cfg.step * 6, "P", 1)],
      calendar: [
        { ...p(a, "C", 1), legExpiryDate: nextExpiry.date, legExpiryLabel: nextExpiry.label },
        { ...p(a, "C", -1), legExpiryDate: currentExpiry.date, legExpiryLabel: currentExpiry.label },
      ],
    };
    setPositions(map[name] ?? []);
  }

  const dte = getDTE();
  const dteDisplay = Math.max(0, Math.round(dte));

  // Chain click — left=buy, right=sell, no quick mode
  function handleChainClick(K: number, type: OptionType, prem: number, e: React.MouseEvent, forceDir?: 1 | -1) {
    e.preventDefault();
    const dir = forceDir ?? (e.type === "contextmenu" ? -1 : 1);
    const currentExpiry = exps[selectedExp];
    addPos(K, type, prem, dir, currentExpiry.label, currentExpiry.date);
  }

  // Format replay date for spot label
  const replayDateObj = new Date(replayDate + "T00:00:00");
  const replayDateDisplay = replayDateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });

  return (
    <div style={{ background: "#0b0d12", color: "#e2e6f0", fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", fontSize: 13 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:#252c3f;border-radius:2px}
        input,select{background:#161a24;border:1px solid #252c3f;color:#e2e6f0;padding:5px 9px;border-radius:6px;font-family:'DM Sans',sans-serif;font-size:12px;outline:none;color-scheme:dark}
        input:focus,select:focus{border-color:#3b82f6}
        input[type=number]{-moz-appearance:textfield}
        input[type=number]::-webkit-inner-spin-button{opacity:.3}
        .chain-row:hover td{background:#1a1f2e !important}
        .chain-row.atm td{background:#0c1a0c}
        .chain-row.atm:hover td{background:#112010 !important}
        .chain-row.has-pos td{background:#0d1520}
        /* Call side — clickable cells */
        .cv{color:#60a5fa;cursor:pointer;transition:all .1s;user-select:none;padding:4px 6px !important}
        .cv:hover{color:#93c5fd;background:rgba(59,130,246,0.18) !important;border-radius:4px}
        .pv{color:#f87171;cursor:pointer;transition:all .1s;user-select:none;padding:4px 6px !important}
        .pv:hover{color:#fca5a5;background:rgba(239,68,68,0.18) !important;border-radius:4px}
        /* B/S inline buttons on strike row */
        .bs-btn{font-size:9px;padding:1px 5px;border-radius:3px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;letter-spacing:.3px;transition:all .15s}
        .bs-buy{background:#0d2010;color:#22c55e;border:1px solid #1a4020}
        .bs-buy:hover{background:#22c55e;color:#000}
        .bs-sell{background:#200d0d;color:#ef4444;border:1px solid #3a1515}
        .bs-sell:hover{background:#ef4444;color:#fff}
        .otm td.cv,.otm td.pv{opacity:.65}
        .vtab{background:transparent;border:1px solid #252c3f;color:#6b7494;font-size:10px;padding:4px 11px;border-radius:100px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
        .vtab:hover{border-color:#3b82f6;color:#3b82f6}
        .vtab.active{background:#1a2a4a;border-color:#3b82f6;color:#3b82f6}
        .strat-btn{background:#10131a;border:1px solid #252c3f;color:#6b7494;font-size:10px;padding:3px 9px;border-radius:100px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
        .strat-btn:hover{border-color:#14b8a6;color:#14b8a6}
        .exp-tab{background:transparent;border:1px solid #252c3f;color:#6b7494;font-size:10px;padding:3px 9px;border-radius:100px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;white-space:nowrap}
        .exp-tab:hover{border-color:#3b82f6;color:#3b82f6}
        .exp-tab.active{background:#1a2a4a;border-color:#3b82f6;color:#3b82f6;font-weight:500}
        .rnav-btn{background:#161a24;border:1px solid #252c3f;color:#6b7494;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:'DM Sans',sans-serif;transition:all .15s}
        .rnav-btn:hover{border-color:#a78bfa;color:#a78bfa}
        .qty-btn{background:#10131a;border:1px solid #252c3f;color:#e2e6f0;width:20px;height:20px;border-radius:4px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center}
        .qty-btn:hover{background:#1e2333}
        .pos-rm{color:#2a3045;cursor:pointer;font-size:18px;line-height:1;transition:color .15s;padding:0 2px}
        .pos-rm:hover{color:#ef4444}
        .iico{display:inline-flex;width:12px;height:12px;border-radius:50%;background:#2a3045;color:#6b7494;font-size:8px;align-items:center;justify-content:center;cursor:help}
        .added-x{display:inline-block;background:#200d0d;color:#ef4444;font-size:8px;padding:1px 4px;border-radius:3px;margin-left:3px;cursor:pointer;vertical-align:middle}
        .added-x:hover{background:#3a1010}
        table.ct{width:100%;border-collapse:collapse;font-size:11px}
        table.ct th{padding:5px 6px;color:#6b7494;font-weight:400;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #1e2333;background:#10131a;white-space:nowrap}
        table.ct th.call-h{text-align:right;color:#60a5fa}
        table.ct th.put-h{text-align:left;color:#f87171}
        table.ct th.strike-h{text-align:center;background:#0b0d12;color:#6b7494}
        table.ct td{padding:4px 6px;border-bottom:1px solid rgba(19,23,32,.3);white-space:nowrap;font-family:'JetBrains Mono',monospace;font-size:11px}
        .tc{text-align:right}.tp{text-align:left}
        .td-strike{text-align:center;font-weight:600;font-size:12px;color:#e2e6f0;background:#0b0d12 !important;padding:3px 6px;position:relative}
        .atm .td-strike{color:#22c55e;background:#091409 !important}
        .iv-v{color:#f59e0b}.dv{color:#14b8a6}.gv{color:#c084fc}.tv{color:#fb923c}
        .atm-pill{display:inline-block;background:#0d2010;color:#22c55e;font-size:8px;padding:0 4px;border-radius:3px;margin-right:3px;font-family:'DM Sans',sans-serif;font-weight:500}
        .sb-sep{width:1px;height:28px;background:#1e2333}
        .mono{font-family:'JetBrains Mono',monospace}
        .c-green{color:#22c55e}.c-red{color:#ef4444}.c-amber{color:#f59e0b}.c-blue{color:#3b82f6}.c-purple{color:#a78bfa}.c-muted{color:#6b7494}
        .sum-card{background:#10131a;border:1px solid #1e2333;border-radius:8px;padding:9px 12px}
        .sc-label{font-size:9.5px;color:#6b7494;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px;display:flex;align-items:center;gap:4px}
        .sc-val{font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:500}
        .gk{background:#10131a;border:1px solid #1e2333;border-radius:8px;padding:8px 10px}
        .gk-sym{font-family:Georgia,serif;font-size:13px;color:#a78bfa;margin-right:3px}
        .gk-name{font-size:9.5px;color:#6b7494;margin-bottom:3px}
        .gk-val{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:500}
        .gk-hint{font-size:9px;color:#2a3045;margin-top:3px;line-height:1.3}
        .sd-item{background:#161a24;border-radius:6px;padding:7px 10px}
        .sd-ilabel{font-size:9.5px;color:#6b7494;margin-bottom:2px;display:flex;align-items:center;gap:3px}
        .sd-ival{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:500}
        /* Strike BS buttons layout */
        .strike-cell-inner{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:90px}
        .strike-bs-row{display:flex;gap:3px;margin-top:1px}
      `}</style>

      <div style={{ maxWidth: 1640, margin: "0 auto", padding: "0 14px 40px" }}>

        {/* ── NAV ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1e2333", marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: -0.5, marginRight: 6 }}>
            <span style={{ color: "#3b82f6" }}>market</span><span style={{ color: "#14b8a6" }}>greeks</span>
          </div>
          <div style={{ background: "#1a2a4a", color: "#3b82f6", fontSize: 10, padding: "3px 9px", borderRadius: 100, fontWeight: 500, letterSpacing: .3 }}>OPTIONS SIMULATOR</div>
          {(["NIFTY", "BANKNIFTY"] as IndexKey[]).map(idx => (
            <button key={idx} onClick={() => switchIndex(idx)}
              style={{ background: currentIndex === idx ? "#1a2a4a" : "#161a24", border: `1px solid ${currentIndex === idx ? "#3b82f6" : "#252c3f"}`, color: currentIndex === idx ? "#3b82f6" : "#6b7494", fontSize: 12, padding: "5px 14px", borderRadius: 100, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: currentIndex === idx ? 500 : 400 }}>
              {CFG[idx].label} <span style={{ fontSize: 9, opacity: .6 }}>Lot {CFG[idx].lot}</span>
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, background: "#161a24", border: "1px solid #1e2333", padding: "5px 14px", borderRadius: 8 }}>
            <span style={{ fontSize: 10, color: "#6b7494", textTransform: "uppercase", letterSpacing: .5 }}>India VIX</span>
            <span className="mono" style={{ fontSize: 15, fontWeight: 500, color: "#f59e0b" }}>{replayVIX.toFixed(2)}</span>
          </div>
        </div>

        {/* ── DATE ROW ── */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 10, flexWrap: "wrap", background: "#10131a", border: "1px solid #1e2333", borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 10, color: "#6b7494", textTransform: "uppercase", letterSpacing: .5 }}>Entry Date</span>
            <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} style={{ width: 140 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 10, color: "#6b7494" }}>Entry Spot</span>
            <input type="number" value={entrySpot} onChange={e => setEntrySpot(+e.target.value)} style={{ width: 95 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, borderLeft: "1px solid #1e2333", paddingLeft: 12 }}>
            <span style={{ fontSize: 10, color: "#6b7494", textTransform: "uppercase", letterSpacing: .5 }}>Replay Date</span>
            <input type="date" value={replayDate} onChange={e => setReplayDate(e.target.value)} style={{ width: 140 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 10, color: "#6b7494" }}>Spot @ {replayDateDisplay}</span>
            <input type="number" value={replaySpot} onChange={e => setReplaySpot(+e.target.value)} style={{ width: 95 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 10, color: "#6b7494" }}>VIX / IV%</span>
            <input type="number" value={replayVIX} step={0.1} onChange={e => setReplayVIX(+e.target.value)} style={{ width: 80 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, borderLeft: "1px solid #1e2333", paddingLeft: 12 }}>
            <span style={{ fontSize: 10, color: "#6b7494", textTransform: "uppercase", letterSpacing: .5 }}>Expiry</span>
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} style={{ width: 140 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 10, color: "#6b7494" }}>Rate % (ρ)</span>
            <input type="number" value={rhoRate} step={0.1} min={0} max={20} onChange={e => setRhoRate(+e.target.value)} style={{ width: 70 }} />
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", paddingLeft: 6 }}>
            <button className="rnav-btn" onClick={() => stepReplay(-1)}>← Prev Day</button>
            <button className="rnav-btn" onClick={() => stepReplay(1)}>Next Day →</button>
            <button onClick={() => setPositions([])} style={{ background: "#200d0d", color: "#ef4444", border: "1px solid #3a1515", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans',sans-serif", marginLeft: 4 }}>✕ Clear All</button>
          </div>
        </div>

        {/* ── STATUS BAR ── */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "7px 14px", background: "#161a24", border: "1px solid #1e2333", borderRadius: 8, marginBottom: 10, flexWrap: "wrap", fontSize: 11 }}>
          {[
            { label: "Index", val: cfg.label, cls: "" },
            { label: "Entry Spot", val: fmtN(entrySpot), cls: "" },
            { label: `Spot @ ${replayDateDisplay}`, val: fmtN(replaySpot), cls: "" },
            { label: "DTE", val: dteDisplay + "d", cls: "c-amber" },
            { label: "Lot Size", val: cfg.lot + " units", cls: "" },
          ].map(({ label, val, cls }, i) => (
            <React.Fragment key={label}>
              {i > 0 && <div className="sb-sep" />}
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <div style={{ color: "#6b7494", fontSize: 9, textTransform: "uppercase", letterSpacing: .4 }}>{label}</div>
                <div className={`mono ${cls}`} style={{ fontSize: 13, fontWeight: 500 }}>{val}</div>
              </div>
            </React.Fragment>
          ))}
          <div className="sb-sep" />
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ color: "#6b7494", fontSize: 9, textTransform: "uppercase", letterSpacing: .4 }}>Selected Expiry</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {exps.map((e, i) => (
                <button key={e.date} className={`exp-tab ${i === selectedExp ? "active" : ""}`} onClick={() => selectExp(i)}>
                  {e.label} <span style={{ fontSize: 8, opacity: .6 }}>{e.type}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 10, color: "#6b7494", fontStyle: "italic", maxWidth: 340, lineHeight: 1.4, textAlign: "right" }}>
            ⚠ Synthetic premiums via Black-Scholes + VIX smile/skew.
          </div>
        </div>

        {/* ── STRATEGY PRESETS (moved here, no Quick Mode) ── */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, padding: "8px 14px", background: "#161a24", border: "1px solid #1e2333", borderRadius: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "#6b7494", textTransform: "uppercase", letterSpacing: .5 }}>Load Strategy</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["bull_call", "bear_put", "straddle", "strangle", "condor", "calendar"].map(s => (
              <button key={s} className="strat-btn" onClick={() => loadStrat(s)}>
                {s === "bull_call" ? "Bull Call" : s === "bear_put" ? "Bear Put" : s === "calendar" ? "📅 Calendar" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 10, color: "#6b7494", marginLeft: 8 }}>
            Left-click = <span style={{ color: "#22c55e" }}>Buy</span> &nbsp;|&nbsp; Right-click = <span style={{ color: "#ef4444" }}>Sell</span> &nbsp;|&nbsp; Or use B/S buttons on the strike row
          </span>
        </div>

        {/* ── MAIN GRID ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 460px", gap: 12 }}>

          {/* ── OPTION CHAIN ── */}
          <div style={{ background: "#161a24", border: "1px solid #1e2333", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "9px 14px", borderBottom: "1px solid #1e2333", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7494", textTransform: "uppercase", letterSpacing: .4 }}>Option Chain</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#161a24", border: "1px solid #1e2333", padding: "2px 8px", borderRadius: 100, fontSize: 10, color: "#6b7494" }}>
                FUT: <b className="mono" style={{ color: "#e2e6f0", marginLeft: 3 }}>{fmtN(Math.round(replaySpot * (1 + rhoRate / 100 * dte / 365) * 0.5 + replaySpot * 0.5))}</b>
              </span>
              <span style={{ fontSize: 10, color: "#6b7494" }}>Showing ±50 strikes from ATM ({strikes.length} total)</span>
            </div>
            {/* Spot bar — shows "Spot @ <date>" */}
            <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "7px 14px", background: "#10131a", borderBottom: "1px solid #1e2333" }}>
              <span style={{ fontSize: 10, color: "#6b7494" }}>Spot @ {replayDateDisplay}</span>
              <span className="mono" style={{ fontSize: 16, fontWeight: 500 }}>{fmtN(replaySpot)}</span>
              <span style={{ fontSize: 12 }} className={replaySpot >= entrySpot ? "c-green" : "c-red"}>
                {(replaySpot >= entrySpot ? "+" : "") + fmtN(replaySpot - entrySpot)} ({((replaySpot - entrySpot) / entrySpot * 100).toFixed(2)}%)
              </span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#6b7494" }}>
                Range: <span style={{ color: "#14b8a6" }}>{fmtN(strikes[0])} – {fmtN(strikes[strikes.length - 1])}</span>
              </span>
            </div>
            {/* Hint bar */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6b7494", padding: "4px 14px", background: "#10131a", borderBottom: "1px solid #1e2333" }}>
              <span>← Left-click CALL premium = Buy Call &nbsp;|&nbsp; Right-click = Sell Call</span>
              <span>Left-click PUT premium = Buy Put &nbsp;|&nbsp; Right-click = Sell Put →</span>
            </div>
            {/* Chain table */}
            <div style={{ maxHeight: 560, overflowY: "auto" }}>
              <table className="ct">
                <thead>
                  <tr>
                    <th className="call-h tc">Θ</th>
                    <th className="call-h tc">Γ</th>
                    <th className="call-h tc">Δ</th>
                    <th className="call-h tc">IV%</th>
                    <th className="call-h tc" style={{ minWidth: 70 }}>Call LTP</th>
                    {/* Strike column: wider to fit B/S buttons */}
                    <th className="strike-h" style={{ minWidth: 110 }}>Strike</th>
                    <th className="put-h tp" style={{ minWidth: 70 }}>Put LTP</th>
                    <th className="put-h tp">IV%</th>
                    <th className="put-h tp">Δ</th>
                    <th className="put-h tp">Γ</th>
                    <th className="put-h tp">Θ</th>
                  </tr>
                </thead>
                <tbody>
                  {strikes.map(K => {
                    const isATM = K === atm;
                    const isOTM = K > atm;
                    const dte_ = getDTE();
                    const T_ = dte_ / 365;
                    const r_ = rhoRate / 100;
                    const iv_ = getIV(replaySpot, K, T_);
                    const cp = calcPremium(replaySpot, K, dte_, "C");
                    const pp = calcPremium(replaySpot, K, dte_, "P");
                    const cIV = (iv_ * 100).toFixed(1);
                    const cg = bsGreeks(replaySpot, K, T_, r_, iv_, "C");
                    const pg = bsGreeks(replaySpot, K, T_, r_, iv_, "P");
                    const hasBuyC = positions.some(p => p.K === K && p.type === "C" && p.dir === 1);
                    const hasSellC = positions.some(p => p.K === K && p.type === "C" && p.dir === -1);
                    const hasBuyP = positions.some(p => p.K === K && p.type === "P" && p.dir === 1);
                    const hasSellP = positions.some(p => p.K === K && p.type === "P" && p.dir === -1);
                    const hasAny = hasBuyC || hasSellC || hasBuyP || hasSellP;
                    const currentExpiry = exps[selectedExp];
                    return (
                      <tr key={K} className={`chain-row ${isATM ? "atm" : ""} ${hasAny ? "has-pos" : ""} ${isOTM && !isATM ? "otm" : ""}`}>
                        <td className="tc tv">{cg.theta.toFixed(2)}</td>
                        <td className="tc gv">{cg.gamma.toFixed(4)}</td>
                        <td className="tc dv">{cg.delta.toFixed(2)}</td>
                        <td className="tc iv-v">{cIV}</td>
                        {/* Call LTP — left click buy, right click sell */}
                        <td className={`tc cv`}
                          onClick={e => handleChainClick(K, "C", cp, e, 1)}
                          onContextMenu={e => handleChainClick(K, "C", cp, e, -1)}>
                          <b>{cp.toFixed(2)}</b>
                          {(hasBuyC || hasSellC) && (
                            <span className="added-x" onClick={e => { e.stopPropagation(); removeByKType(K, "C"); }}>✕</span>
                          )}
                        </td>
                        {/* Strike cell with B/S buttons */}
                        <td className="td-strike">
                          <div className="strike-cell-inner">
                            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              {isATM && <span className="atm-pill">ATM</span>}
                              <b>{K}</b>
                            </div>
                            {/* Buy/Sell buttons below the strike */}
                            <div className="strike-bs-row">
                              <button className="bs-btn bs-buy"
                                onClick={() => addPos(K, "C", cp, 1, currentExpiry.label, currentExpiry.date)}
                                title="Buy Call">BC</button>
                              <button className="bs-btn bs-sell"
                                onClick={() => addPos(K, "C", cp, -1, currentExpiry.label, currentExpiry.date)}
                                title="Sell Call">SC</button>
                              <button className="bs-btn bs-buy" style={{ background: "#0d1020", color: "#60a5fa", borderColor: "#1a2540" }}
                                onClick={() => addPos(K, "P", pp, 1, currentExpiry.label, currentExpiry.date)}
                                title="Buy Put">BP</button>
                              <button className="bs-btn bs-sell" style={{ background: "#1a0d20", color: "#c084fc", borderColor: "#2a1540" }}
                                onClick={() => addPos(K, "P", pp, -1, currentExpiry.label, currentExpiry.date)}
                                title="Sell Put">SP</button>
                            </div>
                          </div>
                        </td>
                        {/* Put LTP — left click buy, right click sell */}
                        <td className={`tp pv`}
                          onClick={e => handleChainClick(K, "P", pp, e, 1)}
                          onContextMenu={e => handleChainClick(K, "P", pp, e, -1)}>
                          <b>{pp.toFixed(2)}</b>
                          {(hasBuyP || hasSellP) && (
                            <span className="added-x" onClick={e => { e.stopPropagation(); removeByKType(K, "P"); }}>✕</span>
                          )}
                        </td>
                        <td className="tp iv-v">{cIV}</td>
                        <td className="tp dv">{pg.delta.toFixed(2)}</td>
                        <td className="tp gv">{pg.gamma.toFixed(4)}</td>
                        <td className="tp tv">{pg.theta.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "5px 14px", background: "#10131a", borderTop: "1px solid #1e2333", fontSize: 9.5, color: "#6b7494", fontStyle: "italic" }}>
              ◉ ATM &nbsp;|&nbsp; Premiums are <b style={{ color: "#f59e0b" }}>synthetic</b> — Black-Scholes with VIX-based IV + smile/skew. &nbsp;|&nbsp; BC/SC/BP/SP buttons on strike = quick Buy/Sell
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* POSITIONS — with expiry date on each leg */}
            <div style={{ background: "#161a24", border: "1px solid #1e2333", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "9px 14px", borderBottom: "1px solid #1e2333", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7494", textTransform: "uppercase", letterSpacing: .4 }}>
                  Positions <span style={{ color: "#3b82f6", fontSize: 10 }}>{positions.length} leg{positions.length !== 1 ? "s" : ""}</span>
                </span>
                {positions.length > 0 && (
                  <span style={{ fontSize: 9, color: "#6b7494", marginLeft: "auto" }}>
                    Positions auto-expire on expiry date
                  </span>
                )}
              </div>

              {positions.length === 0 ? (
                <div style={{ padding: 18, textAlign: "center", color: "#6b7494", fontSize: 11, fontStyle: "italic" }}>
                  No positions yet. Click Call/Put premiums or use BC/SC/BP/SP buttons to add legs.
                </div>
              ) : (
                positions.map((p) => {
                  const isBuy = p.dir === 1;
                  const curPrem = calcPremium(replaySpot, p.K, getDTE(p.legExpiryDate), p.type);
                  const lot = cfg.lot;
                  const mtm = (curPrem - p.entryPrem) * lot * p.lots * p.dir;
                  const hedged = isHedged(p, positions);
                  // Days to expiry for this specific leg
                  const legDTE = Math.max(0, Math.round(getDTE(p.legExpiryDate)));
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "8px 12px", borderBottom: "1px solid #1e2333", fontSize: 11, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          {/* Buy/Sell badge */}
                          <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 600, letterSpacing: .3, background: isBuy ? "#0d2010" : "#200d0d", color: isBuy ? "#22c55e" : "#ef4444", border: `1px solid ${isBuy ? "#1a3a20" : "#3a1a1a"}` }}>
                            {isBuy ? "BUY" : "SELL"}
                          </span>
                          <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{p.K}</span>
                          <span style={{ color: p.type === "C" ? "#60a5fa" : "#f87171", fontSize: 11, fontWeight: 500 }}>{p.type === "C" ? "CE" : "PE"}</span>
                          {/* Lot control */}
                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <button className="qty-btn" onClick={() => changeLots(p.id, -1)}>−</button>
                            <span className="mono" style={{ fontSize: 11, minWidth: 46, textAlign: "center" }}>
                              {p.lots} lot{p.lots !== 1 ? "s" : ""}
                            </span>
                            <button className="qty-btn" onClick={() => changeLots(p.id, 1)}>+</button>
                          </div>
                          <span className="mono" style={{ color: "#f59e0b" }}>@{p.entryPrem.toFixed(2)}</span>
                          <span className={`mono ${mtm >= 0 ? "c-green" : "c-red"}`} style={{ fontSize: 11 }}>
                            {mtm >= 0 ? "+" : ""}{fmtP(mtm)}
                          </span>
                          {hedged && !isBuy && (
                            <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "#0d1a30", color: "#60a5fa", border: "1px solid #1a2a4a" }}>Hedged</span>
                          )}
                          <button className="pos-rm" style={{ marginLeft: "auto" }} onClick={() => removePosIdx(p.id)}>×</button>
                        </div>
                        {/* Expiry info row — shows the date prominently for calendar strategy clarity */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 9, color: "#6b7494" }}>Expiry:</span>
                          {exps.map((e) => (
                            <button key={e.date}
                              onClick={() => changeExpiryForPos(p.id, e)}
                              style={{
                                fontSize: 8.5, padding: "1px 6px", borderRadius: 3, cursor: "pointer",
                                background: p.legExpiryDate === e.date ? "#1a2a4a" : "#10131a",
                                border: `1px solid ${p.legExpiryDate === e.date ? "#3b82f6" : "#252c3f"}`,
                                color: p.legExpiryDate === e.date ? "#3b82f6" : "#6b7494",
                                fontFamily: "'DM Sans',sans-serif",
                                fontWeight: p.legExpiryDate === e.date ? 600 : 400,
                              }}>{e.label}</button>
                          ))}
                          <span style={{ fontSize: 9, color: legDTE <= 3 ? "#ef4444" : legDTE <= 7 ? "#f59e0b" : "#6b7494" }}>
                            {legDTE}d left
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {positions.length > 0 && (() => {
                let netPrem = 0, totalMargin = 0;
                positions.forEach(p => {
                  const notional = p.entryPrem * cfg.lot * p.lots;
                  const hedged = isHedged(p, positions);
                  const m = p.dir === 1 ? notional : hedged ? cfg.span * p.lots * 0.25 : cfg.span * p.lots;
                  netPrem += p.dir === 1 ? -notional : notional;
                  totalMargin += m;
                });
                return (
                  <div style={{ background: "#10131a", borderTop: "1px solid #1e2333", padding: "8px 12px", fontSize: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                      <span style={{ color: "#6b7494" }}>Premium {netPrem >= 0 ? "Collected" : "Paid"}</span>
                      <span className="mono">{fmtP(netPrem)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                      <span style={{ color: "#6b7494" }}>Approx Margin Required</span>
                      <span className="mono" style={{ color: "#f59e0b", fontWeight: 500 }}>{fmtP(totalMargin)}</span>
                    </div>
                    <div style={{ fontSize: 9.5, color: "#6b7494", marginTop: 3 }}>
                      Buy = premium × lot × qty | Sell = SPAN ~₹{fmtN(cfg.span)}/lot | Hedged sell ≈ 25% margin
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* SUMMARY CARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "Max Profit", val: analytics?.isUnlimP ? "Unlimited ∞" : analytics ? fmtP(analytics.maxP) : "—", cls: "c-green" },
                { label: "Max Loss", val: analytics?.isUnlimL ? "Unlimited ∞" : analytics ? fmtP(analytics.minP) : "—", cls: "c-red" },
                { label: "Breakeven(s)", val: analytics?.bes.length ? analytics.bes.join(" / ") : "—", cls: "" },
                { label: "POP (Prob. of Profit)", val: analytics?.popPct ?? "—", cls: "c-blue" },
              ].map(({ label, val, cls }) => (
                <div key={label} className="sum-card">
                  <div className="sc-label">{label}</div>
                  <div className={`sc-val ${cls}`} style={{ fontSize: 14 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* STRATEGY DETECT */}
            <div style={{ background: "#10131a", border: "1px solid #1e2333", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{analytics?.strat.name ?? "No Strategy"}</span>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "#1a1030", color: "#a78bfa", border: "1px solid #3a2060" }}>{analytics?.strat.bias ?? "—"}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[
                  { label: "Max Profit", val: analytics?.isUnlimP ? "Unlimited ∞" : analytics ? fmtP(analytics.maxP) : "—", cls: "c-green" },
                  { label: "Max Loss", val: analytics?.isUnlimL ? "Unlimited ∞" : analytics ? fmtP(analytics.minP) : "—", cls: "c-red" },
                  { label: "Risk : Reward", val: analytics?.rr ?? "—", cls: "" },
                  { label: "MTM P&L Now", val: analytics ? (analytics.mtmPnl >= 0 ? "+" : "") + fmtP(analytics.mtmPnl) : "—", cls: analytics ? (analytics.mtmPnl >= 0 ? "c-green" : "c-red") : "" },
                  { label: "Breakeven(s)", val: analytics?.bes.length ? analytics.bes.join(" / ") : "No crossover", cls: "" },
                  { label: "POP", val: analytics?.popPct ?? "—", cls: "c-blue" },
                ].map(({ label, val, cls }) => (
                  <div key={label} className="sd-item">
                    <div className="sd-ilabel">{label}</div>
                    <div className={`sd-ival ${cls}`}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* GREEKS */}
            <div style={{ background: "#161a24", border: "1px solid #1e2333", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "9px 14px", borderBottom: "1px solid #1e2333", display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7494", textTransform: "uppercase", letterSpacing: .4 }}>Portfolio Greeks</span>
                <span style={{ fontSize: 9.5, color: "#6b7494", marginLeft: "auto" }}>BS + VIX smile model</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7, padding: "10px 12px" }}>
                {[
                  { sym: "Δ", name: "Delta", val: analytics?.pD.toFixed(2) ?? "—", hint: "₹/+1pt spot" },
                  { sym: "Γ", name: "Gamma", val: analytics?.pG.toFixed(4) ?? "—", hint: "Delta/+1pt" },
                  { sym: "Θ", name: "Theta", val: analytics?.pTh.toFixed(2) ?? "—", hint: "₹ decay/day", cls: "c-red" },
                  { sym: "V", name: "Vega", val: analytics?.pV.toFixed(2) ?? "—", hint: "₹/1% IV" },
                  { sym: "ρ", name: "Rho", val: analytics?.pR.toFixed(2) ?? "—", hint: "₹/1% rate" },
                ].map(({ sym, name, val, hint, cls }) => (
                  <div key={name} className="gk">
                    <div className="gk-name"><span className="gk-sym">{sym}</span>{name}</div>
                    <div className={`gk-val ${cls ?? ""}`}>{val}</div>
                    <div className="gk-hint">{hint}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* PAYOFF CHART */}
            <div style={{ background: "#161a24", border: "1px solid #1e2333", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e6f0" }}>Payoff Chart</span>
                  {analytics && (
                    <span className={`mono ${analytics.mtmPnl >= 0 ? "c-green" : "c-red"}`} style={{ fontSize: 14, fontWeight: 600, marginLeft: 12 }}>
                      MTM {analytics.mtmPnl >= 0 ? "+" : ""}{fmtP(analytics.mtmPnl)}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <button className={`vtab ${chartView === "expiry" ? "active" : ""}`} onClick={() => setChartView("expiry")}>At Expiry</button>
                  <button className={`vtab ${chartView === "mtm" ? "active" : ""}`} onClick={() => setChartView("mtm")}>MTM Now</button>
                </div>
              </div>
              <div style={{ position: "relative", height: 340 }}>
                <canvas ref={canvasRef} role="img" aria-label="Options payoff P&L chart" />
              </div>
              {/* Breakeven callout with distance from spot */}
              {analytics && analytics.bes.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {analytics.bes.map(be => {
                    const dist = Math.abs(be - replaySpot);
                    const distPct = ((dist / replaySpot) * 100).toFixed(1);
                    const above = be > replaySpot;
                    return (
                      <span key={be} style={{ fontSize: 10, background: "#1a150a", color: "#f59e0b", border: "1px solid #3a2a0a", borderRadius: 4, padding: "2px 8px" }}>
                        BE: {fmtN(be)} &nbsp;
                        <span style={{ color: "#6b7494" }}>{distPct}% {above ? "above" : "below"} spot &nbsp; ({fmtN(dist)} pts away)</span>
                      </span>
                    );
                  })}
                </div>
              )}
              <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 10, color: "#6b7494", flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 2, background: "#22c55e", display: "inline-block", borderRadius: 1 }} />Profit</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 2, background: "#ef4444", display: "inline-block", borderRadius: 1 }} />Loss</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 1, background: "#f59e0b", display: "inline-block" }} />Breakeven</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 2, background: "#3b82f6", display: "inline-block" }} />Spot @ {replayDateDisplay}</span>
              </div>
            </div>

          </div>
        </div>

        {/* ── UPLOAD GUIDANCE ── */}
        <div style={{ marginTop: 16, background: "#10131a", border: "1px solid #1e2333", borderRadius: 10, padding: "14px 18px", fontSize: 12, color: "#6b7494", lineHeight: 1.7 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e6f0", marginBottom: 6 }}>📂 Historical Data Upload — OHLCV + VIX (Replay Engine)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ color: "#a78bfa", fontWeight: 500, marginBottom: 4 }}>Where to upload your data files:</div>
              <ol style={{ paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
                <li>Place CSV files in <code style={{ background: "#161a24", padding: "1px 5px", borderRadius: 3, color: "#f59e0b" }}>public/data/</code> in your Next.js project root.</li>
                <li>Name them: <code style={{ background: "#161a24", padding: "1px 5px", borderRadius: 3, color: "#f59e0b" }}>nifty_ohlcv.csv</code>, <code style={{ background: "#161a24", padding: "1px 5px", borderRadius: 3, color: "#f59e0b" }}>banknifty_ohlcv.csv</code>, <code style={{ background: "#161a24", padding: "1px 5px", borderRadius: 3, color: "#f59e0b" }}>vix_history.csv</code></li>
                <li>Push to GitHub → Vercel auto-deploys and serves them from <code style={{ background: "#161a24", padding: "1px 5px", borderRadius: 3, color: "#f59e0b" }}>/data/</code></li>
                <li>For Supabase: Upload to a <b>Storage bucket</b> named <code style={{ background: "#161a24", padding: "1px 5px", borderRadius: 3, color: "#f59e0b" }}>market-data</code></li>
              </ol>
            </div>
            <div>
              <div style={{ color: "#14b8a6", fontWeight: 500, marginBottom: 4 }}>Required CSV columns:</div>
              <div style={{ background: "#161a24", borderRadius: 6, padding: "8px 12px", fontSize: 11 }}>
                <div style={{ color: "#f59e0b" }}>nifty_ohlcv.csv / banknifty_ohlcv.csv</div>
                <div style={{ color: "#3a4060", marginTop: 2 }}>date, open, high, low, close, volume</div>
                <div style={{ color: "#f59e0b", marginTop: 6 }}>vix_history.csv</div>
                <div style={{ color: "#3a4060", marginTop: 2 }}>date, vix_open, vix_high, vix_low, vix_close</div>
                <div style={{ color: "#6b7494", marginTop: 6, fontSize: 10 }}>Date format: YYYY-MM-DD | 5 years of daily data recommended</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
