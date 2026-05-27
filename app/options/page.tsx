"use client";
// MarketGreeks — Options Simulator
// Next.js / React TSX — drop in as app/simulator/page.tsx or components/OptionsSimulator.tsx
// External deps: chart.js (install: npm i chart.js)

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
  K: number;
  type: OptionType;
  dir: 1 | -1;
  lots: number;
  entryPrem: number;
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
// CONFIG
// ─────────────────────────────────────────────
const CFG: Record<IndexKey, { lot: number; step: number; pct: number; span: number; label: string }> = {
  NIFTY:     { lot: 75,  step: 50,  pct: 0.15, span: 175000, label: "NIFTY" },
  BANKNIFTY: { lot: 30, step: 100, pct: 0.15, span: 120000, label: "BANK NIFTY" },
};

const EXPIRIES: Record<IndexKey, Expiry[]> = {
  NIFTY: [
    { label: "26 Jun", date: "2026-06-26", type: "Monthly" },
    { label: "28 Jul", date: "2026-07-28", type: "Monthly" },
    { label: "25 Aug", date: "2026-08-25", type: "Monthly" },
    { label: "29 Sep", date: "2026-09-29", type: "Quarterly" },
  ],
  BANKNIFTY: [
    { label: "18 Jun", date: "2026-06-18", type: "Weekly" },
    { label: "25 Jun", date: "2026-06-25", type: "Monthly" },
    { label: "23 Jul", date: "2026-07-23", type: "Monthly" },
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
const fmtDisplay = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// ─────────────────────────────────────────────
// CHART (imperative, canvas)
// ─────────────────────────────────────────────
interface ChartData { spots: number[]; payoffs: number[]; mtmPayoffs: number[]; bes: number[]; S: number; }

function drawPayoffChart(
  canvas: HTMLCanvasElement,
  data: ChartData,
  view: "expiry" | "mtm"
): void {
  // Dynamically import Chart.js to keep SSR-safe
  import("chart.js/auto").then(({ default: Chart }) => {
    // Destroy existing
    const existing = (Chart as any).getChart(canvas);
    if (existing) existing.destroy();

    const { spots, payoffs, mtmPayoffs, bes, S } = data;
    const active = view === "expiry" ? payoffs : mtmPayoffs;

    const zero = { id: "zeroLine", afterDraw(chart: any) {
      const { ctx, scales: { x, y } } = chart;
      const yZero = y.getPixelForValue(0);
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(x.left, yZero);
      ctx.lineTo(x.right, yZero);
      ctx.stroke();
      // Spot line
      const spotIdx = spots.reduce((bi, s, i) => Math.abs(s - S) < Math.abs(spots[bi] - S) ? i : bi, 0);
      const xSpot = x.getPixelForValue(spotIdx);
      ctx.beginPath();
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]);
      ctx.moveTo(xSpot, chart.chartArea.top);
      ctx.lineTo(xSpot, chart.chartArea.bottom);
      ctx.stroke();
      // Breakeven lines
      bes.forEach(be => {
        const beIdx = spots.reduce((bi, s, i) => Math.abs(s - be) < Math.abs(spots[bi] - be) ? i : bi, 0);
        const xBE = x.getPixelForValue(beIdx);
        ctx.beginPath();
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.moveTo(xBE, chart.chartArea.top);
        ctx.lineTo(xBE, chart.chartArea.bottom);
        ctx.stroke();
      });
      ctx.restore();
    }};

    new Chart(canvas, {
      type: "line",
      plugins: [zero],
      data: {
        labels: spots.map(s => s.toFixed(0)),
        datasets: [
          {
            label: "P&L",
            data: active,
            segment: { borderColor: (ctx: any) => active[ctx.p0DataIndex] >= 0 ? "#22c55e" : "#ef4444" },
            borderWidth: 3,
            pointRadius: 0,
            fill: {
              target: { value: 0 },
              above: "rgba(34,197,94,0.12)",
              below: "rgba(239,68,68,0.12)",
            } as any,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
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
              title: (c) => "Spot ₹" + parseFloat(c[0].label).toLocaleString("en-IN"),
              label: (c) => {
                const v = c.raw as number;
                return `MTM P&L: ${v >= 0 ? "+" : ""}₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
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
              callback: (v, i) => i % 20 === 0 ? spots[i].toFixed(0) : null,
            },
          },
          y: {
            grid: { color: "rgba(255,255,255,0.05)" },
            ticks: {
              color: "#3a4060",
              font: { size: 10 },
              callback: (v: any) => "₹" + (Math.abs(v) >= 100000 ? (v / 100000).toFixed(1) + "L" : Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + "K" : v.toFixed(0)),
            },
          },
        },
      },
    });
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
    if (buys.length === 1 && sells.length === 1) {
      const b = buys[0], s = sells[0];
      // Calendar spread: same type, same strike but different expiries would be detected here
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
export default function OptionsSimulator() {
  // ── State ──
  const [currentIndex, setCurrentIndex] = useState<IndexKey>("NIFTY");
  const [selectedExp, setSelectedExp] = useState(0);
  const [entryDate, setEntryDate] = useState("2026-05-20");
  const [replayDate, setReplayDate] = useState("2026-05-20");
  const [expiryDate, setExpiryDate] = useState("2026-06-26");
  const [entrySpot, setEntrySpot] = useState(23421);
  const [replaySpot, setReplaySpot] = useState(23421);
  const [replayVIX, setReplayVIX] = useState(19.14);
  const [rhoRate, setRhoRate] = useState(6.5);
  const [positions, setPositions] = useState<Position[]>([]);
  const [chartView, setChartView] = useState<"expiry" | "mtm">("expiry");

  // Premium selection mode: null = normal, 'buy' | 'sell' = lock mode
  const [premiumMode, setPremiumMode] = useState<null | "buy" | "sell">(null);

  // Calendar expiry per leg (for calendar spread support)
  // Each position can optionally have a legExpiry index
  const [legExpiries, setLegExpiries] = useState<Record<number, number>>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Derived ──
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

  // Strikes: restrict to ±15%
  const strikes = useMemo(() => {
    const step = cfg.step;
    const low = Math.floor(replaySpot * 0.85 / step) * step;
    const high = Math.ceil(replaySpot * 1.15 / step) * step;
    const arr: number[] = [];
    for (let k = low; k <= high; k += step) arr.push(k);
    return arr;
  }, [replaySpot, cfg.step]);

  const atm = useMemo(() => Math.round(replaySpot / cfg.step) * cfg.step, [replaySpot, cfg.step]);

  // ── Position helpers ──
  const addPos = useCallback((K: number, type: OptionType, prem: number, dir: 1 | -1) => {
    setPositions(prev => {
      const idx = prev.findIndex(p => p.K === K && p.type === type && p.dir === dir);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], lots: next[idx].lots + 1 };
        return next;
      }
      return [...prev, { K, type, dir, lots: 1, entryPrem: prem }];
    });
  }, []);

  const removeByKType = useCallback((K: number, type: OptionType) => {
    setPositions(prev => prev.filter(p => !(p.K === K && p.type === type)));
  }, []);

  const removePosIdx = useCallback((i: number) => {
    setPositions(prev => prev.filter((_, idx) => idx !== i));
  }, []);

  const changeLots = useCallback((i: number, d: number) => {
    setPositions(prev => {
      const next = [...prev];
      next[i] = { ...next[i], lots: Math.max(1, next[i].lots + d) };
      return next;
    });
  }, []);

  // Hedge detection: whether each sell leg has a buy hedge (same type, close strike)
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
        const legDTE = legExpiries[positions.indexOf(p)] !== undefined
          ? getDTE(exps[legExpiries[positions.indexOf(p)]]?.date)
          : dte;
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

    // Correct unlimited detection:
    // Buy-only: max profit is unlimited (maxP keeps growing)
    const onlyBuys = positions.every(p => p.dir === 1);
    const onlySells = positions.every(p => p.dir === -1);
    // Single leg detection
    const singleBuy = positions.length === 1 && positions[0].dir === 1;
    const singleSell = positions.length === 1 && positions[0].dir === -1;
    const isUnlimP = singleBuy || onlyBuys || maxP > lot * S * 1.5;
    const isUnlimL = singleSell || onlySells || minP < -lot * S * 1.5;

    // Breakevens
    const bes: number[] = [];
    for (let i = 1; i < active.length; i++) {
      if ((active[i - 1] < 0) !== (active[i] < 0)) {
        const s = spots[i - 1] + (spots[i] - spots[i - 1]) * (0 - active[i - 1]) / (active[i] - active[i - 1]);
        bes.push(Math.round(s));
      }
    }

    // Portfolio greeks
    let pD = 0, pG = 0, pTh = 0, pV = 0, pR = 0;
    positions.forEach(p => {
      const iv = getIV(S, p.K, T);
      const g = bsGreeks(S, p.K, T, r, iv, p.type);
      const m = p.dir * p.lots * lot;
      pD += g.delta * m; pG += g.gamma * m; pTh += g.theta * m; pV += g.vega * m; pR += g.rho * m;
    });

    // MTM P&L at current spot
    const mtmPnl = calcAt(S, false);

    // POP
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

    // Net premium
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
  }, [positions, replaySpot, replayVIX, rhoRate, expiryDate, replayDate, chartView, cfg, getDTE, getIV, calcPremium, legExpiries, exps]);

  // ── Chart effect ──
  useEffect(() => {
    if (!canvasRef.current) return;
    if (!analytics) {
      import("chart.js/auto").then(({ default: Chart }) => {
        const ex = (Chart as any).getChart(canvasRef.current!);
        if (ex) ex.destroy();
      });
      return;
    }
    drawPayoffChart(canvasRef.current, analytics, chartView);
  }, [analytics, chartView]);

  // ── Index switch ──
  function switchIndex(idx: IndexKey) {
    setCurrentIndex(idx);
    setSelectedExp(0);
    setPositions([]);
    const defSpot = idx === "NIFTY" ? 23421 : 51850;
    setEntrySpot(defSpot);
    setReplaySpot(defSpot);
    setExpiryDate(EXPIRIES[idx][0].date);
  }

  // ── Expiry select ──
  function selectExp(i: number) {
    setSelectedExp(i);
    setExpiryDate(exps[i].date);
  }

  // ── Replay step ──
  function stepReplay(dir: number) {
    const d = new Date(replayDate);
    d.setDate(d.getDate() + dir);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + dir);
    setReplayDate(fmtDate(d));
    const move = Math.round((Math.random() - 0.48) * cfg.step * 6);
    setReplaySpot(prev => Math.max(Math.round(prev * 0.9), prev + move));
    setReplayVIX(prev => parseFloat(Math.max(10, Math.min(40, prev + (Math.random() - 0.5) * 0.8)).toFixed(2)));
  }

  // ── Prebuilt strategies ──
  function loadStrat(name: string) {
    const S = replaySpot;
    const dte = getDTE();
    const a = Math.round(S / cfg.step) * cfg.step;
    const p = (K: number, t: OptionType, d: 1 | -1) => ({ K, type: t, dir: d, lots: 1, entryPrem: calcPremium(S, K, dte, t) });
    const map: Record<string, Position[]> = {
      bull_call: [p(a, "C", 1), p(a + cfg.step * 3, "C", -1)],
      bear_put: [p(a, "P", 1), p(a - cfg.step * 3, "P", -1)],
      straddle: [p(a, "C", -1), p(a, "P", -1)],
      strangle: [p(a + cfg.step * 2, "C", -1), p(a - cfg.step * 2, "P", -1)],
      condor: [p(a + cfg.step * 3, "C", -1), p(a + cfg.step * 6, "C", 1), p(a - cfg.step * 3, "P", -1), p(a - cfg.step * 6, "P", 1)],
      calendar: [p(a, "C", 1), p(a, "C", -1)], // user then adjusts expiries
    };
    setPositions(map[name] ?? []);
  }

  // ── DTE display ──
  const dte = getDTE();
  const dteDisplay = Math.max(0, Math.round(dte));

  // ── Chain click handler ──
  function handleChainClick(K: number, type: OptionType, prem: number, e: React.MouseEvent) {
    e.preventDefault();
    if (premiumMode === "buy") { addPos(K, type, prem, 1); return; }
    if (premiumMode === "sell") { addPos(K, type, prem, -1); return; }
    if (e.type === "contextmenu") { addPos(K, type, prem, -1); return; }
    addPos(K, type, prem, 1);
  }

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
        .cv{color:#60a5fa;cursor:pointer;transition:color .1s;user-select:none}
        .cv:hover,.cv.mode-active{color:#93c5fd;background:rgba(59,130,246,0.15);border-radius:4px}
        .pv{color:#f87171;cursor:pointer;transition:color .1s;user-select:none}
        .pv:hover,.pv.mode-active{color:#fca5a5;background:rgba(239,68,68,0.15);border-radius:4px}
        .buy-mode-on .cv{outline:2px solid #22c55e;border-radius:4px}
        .sell-mode-on .cv{outline:2px solid #ef4444;border-radius:4px}
        .buy-mode-on .pv{outline:2px solid #22c55e;border-radius:4px}
        .sell-mode-on .pv{outline:2px solid #ef4444;border-radius:4px}
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
        .prem-mode-btn{padding:6px 14px;border-radius:6px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;border:1.5px solid transparent;transition:all .15s;display:flex;align-items:center;gap:6px}
        .prem-mode-buy{background:#0d2010;color:#22c55e;border-color:#1a3a20}
        .prem-mode-buy:hover,.prem-mode-buy.active{background:#22c55e;color:#000;border-color:#22c55e}
        .prem-mode-sell{background:#200d0d;color:#ef4444;border-color:#3a1a1a}
        .prem-mode-sell:hover,.prem-mode-sell.active{background:#ef4444;color:#fff;border-color:#ef4444}
        .prem-mode-neutral{background:#161a24;color:#6b7494;border-color:#252c3f;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;font-family:'DM Sans',sans-serif}
        .prem-mode-neutral:hover{border-color:#6b7494;color:#e2e6f0}
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
        .td-strike{text-align:center;font-weight:600;font-size:12px;color:#e2e6f0;background:#0b0d12 !important;padding:4px 10px;position:relative}
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
          {/* VIX */}
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
            <span style={{ fontSize: 10, color: "#6b7494" }}>Replay Spot</span>
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
            <button className="rnav-btn" onClick={() => stepReplay(-1)}>← Prev</button>
            <button className="rnav-btn" onClick={() => stepReplay(1)}>Next →</button>
            <button onClick={() => setPositions([])} style={{ background: "#200d0d", color: "#ef4444", border: "1px solid #3a1515", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans',sans-serif", marginLeft: 4 }}>✕ Clear</button>
          </div>
        </div>

        {/* ── STATUS BAR ── */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "7px 14px", background: "#161a24", border: "1px solid #1e2333", borderRadius: 8, marginBottom: 10, flexWrap: "wrap", fontSize: 11 }}>
          {[
            { label: "Index", val: cfg.label, cls: "" },
            { label: "Entry Spot", val: fmtN(entrySpot), cls: "" },
            { label: "Replay Spot", val: fmtN(replaySpot), cls: "" },
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
          {/* Expiry tabs in status bar */}
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

        {/* ── PREMIUM MODE SELECTOR ── */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, padding: "8px 14px", background: "#161a24", border: "1px solid #1e2333", borderRadius: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "#6b7494", textTransform: "uppercase", letterSpacing: .5 }}>Quick Mode</span>
          <button className={`prem-mode-btn prem-mode-buy ${premiumMode === "buy" ? "active" : ""}`}
            onClick={() => setPremiumMode(premiumMode === "buy" ? null : "buy")}>
            {premiumMode === "buy" ? "✓ " : ""}Buy Mode
          </button>
          <button className={`prem-mode-btn prem-mode-sell ${premiumMode === "sell" ? "active" : ""}`}
            onClick={() => setPremiumMode(premiumMode === "sell" ? null : "sell")}>
            {premiumMode === "sell" ? "✓ " : ""}Sell Mode
          </button>
          {premiumMode && (
            <button className="prem-mode-neutral" onClick={() => setPremiumMode(null)}>× Normal</button>
          )}
          <span style={{ fontSize: 10, color: "#6b7494", marginLeft: 6 }}>
            {premiumMode === "buy" ? "🟢 All clicks = BUY. Click any Call/Put premium to buy." : premiumMode === "sell" ? "🔴 All clicks = SELL. Click any Call/Put premium to sell." : "Left-click = Buy  |  Right-click = Sell  |  Or enable a Quick Mode above"}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["bull_call", "bear_put", "straddle", "strangle", "condor", "calendar"].map(s => (
              <button key={s} className="strat-btn" onClick={() => loadStrat(s)}>
                {s === "bull_call" ? "Bull Call" : s === "bear_put" ? "Bear Put" : s === "calendar" ? "📅 Calendar" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 440px", gap: 12 }}>

          {/* ── OPTION CHAIN ── */}
          <div style={{ background: "#161a24", border: "1px solid #1e2333", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "9px 14px", borderBottom: "1px solid #1e2333", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7494", textTransform: "uppercase", letterSpacing: .4 }}>Option Chain</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#161a24", border: "1px solid #1e2333", padding: "2px 8px", borderRadius: 100, fontSize: 10, color: "#6b7494" }}>
                FUT: <b className="mono" style={{ color: "#e2e6f0", marginLeft: 3 }}>{fmtN(Math.round(replaySpot * (1 + rhoRate / 100 * dte / 365) * 0.5 + replaySpot * 0.5))}</b>
              </span>
              <span style={{ fontSize: 10, color: "#6b7494" }}>{strikes.length} strikes · ±15% from spot</span>
            </div>
            {/* Spot bar */}
            <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "7px 14px", background: "#10131a", borderBottom: "1px solid #1e2333" }}>
              <span style={{ fontSize: 10, color: "#6b7494" }}>Spot</span>
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
              <span>← Left-click CALL = Buy Call | Right-click = Sell Call</span>
              <span>Left-click PUT = Buy Put | Right-click = Sell Put →</span>
            </div>
            {/* Chain table */}
            <div style={{ maxHeight: 520, overflowY: "auto" }}>
              <table className="ct">
                <thead>
                  <tr>
                    <th className="call-h tc">Θ Theta</th>
                    <th className="call-h tc">Γ Gamma</th>
                    <th className="call-h tc">Δ Delta</th>
                    <th className="call-h tc">IV%</th>
                    <th className="call-h tc" style={{ minWidth: 64 }}>Call LTP</th>
                    <th className="strike-h" style={{ minWidth: 80 }}>Strike</th>
                    <th className="put-h tp" style={{ minWidth: 64 }}>Put LTP</th>
                    <th className="put-h tp">IV%</th>
                    <th className="put-h tp">Δ Delta</th>
                    <th className="put-h tp">Γ Gamma</th>
                    <th className="put-h tp">Θ Theta</th>
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
                    return (
                      <tr key={K} className={`chain-row ${isATM ? "atm" : ""} ${hasAny ? "has-pos" : ""} ${isOTM && !isATM ? "otm" : ""}`}>
                        <td className="tc tv">{cg.theta.toFixed(2)}</td>
                        <td className="tc gv">{cg.gamma.toFixed(4)}</td>
                        <td className="tc dv">{cg.delta.toFixed(2)}</td>
                        <td className="tc iv-v">{cIV}</td>
                        <td className={`tc cv ${premiumMode ? "mode-active" : ""}`}
                          onClick={e => handleChainClick(K, "C", cp, e)}
                          onContextMenu={e => handleChainClick(K, "C", cp, e)}>
                          <b>{cp.toFixed(2)}</b>
                          {(hasBuyC || hasSellC) && (
                            <span className="added-x" onClick={e => { e.stopPropagation(); removeByKType(K, "C"); }}>✕</span>
                          )}
                        </td>
                        <td className="td-strike">
                          {isATM && <span className="atm-pill">ATM</span>}
                          <b>{K}</b>
                        </td>
                        <td className={`tp pv ${premiumMode ? "mode-active" : ""}`}
                          onClick={e => handleChainClick(K, "P", pp, e)}
                          onContextMenu={e => handleChainClick(K, "P", pp, e)}>
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
              ◉ ATM | Premiums are <b style={{ color: "#f59e0b" }}>synthetic</b> — Black-Scholes with VIX-based IV + smile/skew.
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* POSITIONS */}
            <div style={{ background: "#161a24", border: "1px solid #1e2333", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "9px 14px", borderBottom: "1px solid #1e2333", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: "#6b7494", textTransform: "uppercase", letterSpacing: .4 }}>
                  Positions <span style={{ color: "#3b82f6", fontSize: 10 }}>{positions.length} legs</span>
                </span>
              </div>

              {positions.length === 0 ? (
                <div style={{ padding: 18, textAlign: "center", color: "#6b7494", fontSize: 11, fontStyle: "italic" }}>
                  No positions yet. Click Call/Put premiums to add legs.
                </div>
              ) : (
                positions.map((p, i) => {
                  const isBuy = p.dir === 1;
                  const curPrem = calcPremium(replaySpot, p.K, getDTE(), p.type);
                  const lot = cfg.lot;
                  const mtm = (curPrem - p.entryPrem) * lot * p.lots * p.dir;
                  const hedged = isHedged(p, positions);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderBottom: "1px solid #1e2333", fontSize: 11, flexWrap: "wrap" }}>
                      {/* Buy/Sell badge */}
                      <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 600, letterSpacing: .3, background: isBuy ? "#0d2010" : "#200d0d", color: isBuy ? "#22c55e" : "#ef4444", border: `1px solid ${isBuy ? "#1a3a20" : "#3a1a1a"}` }}>
                        {isBuy ? "BUY" : "SELL"}
                      </span>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{p.K}</span>
                      <span style={{ color: "#6b7494", fontSize: 10 }}>{p.type === "C" ? "CE" : "PE"}</span>
                      {/* Lot control */}
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <button className="qty-btn" onClick={() => changeLots(i, -1)}>−</button>
                        <span className="mono" style={{ fontSize: 11, minWidth: 50, textAlign: "center" }}>
                          {p.lots} {p.lots === 1 ? "lot" : "lots"}
                        </span>
                        <button className="qty-btn" onClick={() => changeLots(i, 1)}>+</button>
                      </div>
                      {/* Premium */}
                      <span className="mono" style={{ color: "#f59e0b", marginLeft: "auto" }}>₹{p.entryPrem.toFixed(2)}</span>
                      {/* Calendar expiry switcher (shown always) */}
                      <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                        {exps.map((e, ei) => (
                          <button key={e.date}
                            onClick={() => setLegExpiries(prev => ({ ...prev, [i]: ei }))}
                            style={{
                              fontSize: 8.5, padding: "1px 5px", borderRadius: 3, cursor: "pointer",
                              background: (legExpiries[i] ?? selectedExp) === ei ? "#1a2a4a" : "#10131a",
                              border: `1px solid ${(legExpiries[i] ?? selectedExp) === ei ? "#3b82f6" : "#252c3f"}`,
                              color: (legExpiries[i] ?? selectedExp) === ei ? "#3b82f6" : "#6b7494",
                              fontFamily: "'DM Sans',sans-serif",
                            }}>{e.label}</button>
                        ))}
                      </div>
                      {/* Hedged badge */}
                      {hedged && !isBuy && (
                        <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "#0d1a30", color: "#60a5fa", border: "1px solid #1a2a4a" }}>Hedged</span>
                      )}
                      <button className="pos-rm" onClick={() => removePosIdx(i)}>×</button>
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

            {/* PAYOFF CHART — large */}
            <div style={{ background: "#161a24", border: "1px solid #1e2333", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e6f0" }}>MTM P&L Chart</span>
                  {analytics && (
                    <span className={`mono ${analytics.mtmPnl >= 0 ? "c-green" : "c-red"}`} style={{ fontSize: 14, fontWeight: 600, marginLeft: 12 }}>
                      {analytics.mtmPnl >= 0 ? "+" : ""}{fmtP(analytics.mtmPnl)}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <button className={`vtab ${chartView === "expiry" ? "active" : ""}`} onClick={() => setChartView("expiry")}>At Expiry</button>
                  <button className={`vtab ${chartView === "mtm" ? "active" : ""}`} onClick={() => setChartView("mtm")}>MTM Now</button>
                </div>
              </div>
              {/* Bigger chart */}
              <div style={{ position: "relative", height: 360 }}>
                <canvas ref={canvasRef} role="img" aria-label="Options payoff P&L chart" />
              </div>
              {/* Breakeven callout */}
              {analytics && analytics.bes.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {analytics.bes.map(be => (
                    <span key={be} style={{ fontSize: 10, background: "#1a150a", color: "#f59e0b", border: "1px solid #3a2a0a", borderRadius: 4, padding: "2px 8px" }}>
                      BE: {fmtN(be)} &nbsp;
                      <span style={{ color: "#6b7494" }}>({((be / replaySpot - 1) * 100).toFixed(1)}% from spot)</span>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 10, color: "#6b7494", flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 2, background: "#22c55e", display: "inline-block", borderRadius: 1 }} />Profit</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 2, background: "#ef4444", display: "inline-block", borderRadius: 1 }} />Loss</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 1, background: "#f59e0b", display: "inline-block", borderStyle: "dashed" }} />Breakeven</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 1, background: "#3b82f6", display: "inline-block", borderStyle: "dashed" }} />Spot</span>
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
                <li>For Supabase: Upload to a <b>Storage bucket</b> named <code style={{ background: "#161a24", padding: "1px 5px", borderRadius: 3, color: "#f59e0b" }}>market-data</code> — the app fetches via Supabase client on load.</li>
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
