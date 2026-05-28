"use client";
// MarketGreeks — Options Simulator v3
// Layout: Left = Option Chain (scrollable), Right = Controls + Positions + Graph (scrollable)
// Controls (entry date, spot, replay, etc.) moved to top of right panel
// Load Strategy removed
// Spot line animates on Next/Prev Day
// Navigation uses Next.js Link — won't break other pages

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";

type IndexKey = "NIFTY" | "BANKNIFTY";
type OptionType = "C" | "P";

interface Position {
  id: number;
  K: number;
  type: OptionType;
  dir: 1 | -1;
  lots: number;
  entryPrem: number;
  legExpiryDate: string;
  legExpiryLabel: string;
}

interface Greeks {
  delta: number; gamma: number; theta: number; vega: number; rho: number;
}

interface Expiry {
  label: string; date: string; type: "Weekly" | "Monthly" | "Quarterly";
}

interface StratResult { name: string; bias: string; }

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

const fmtN = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fmtP = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fmtDate = (d: Date) => d.toISOString().split("T")[0];

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

      const yZero = y.getPixelForValue(0);
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(chartArea.left, yZero);
      ctx.lineTo(chartArea.right, yZero);
      ctx.stroke();

      const spotIdx = spots.reduce((bi: number, s: number, i: number) =>
        Math.abs(s - S) < Math.abs(spots[bi] - S) ? i : bi, 0);
      const xSpot = x.getPixelForValue(spotIdx);

      ctx.shadowColor = "#6366f1";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.strokeStyle = "#6366f1";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.moveTo(xSpot, chartArea.top);
      ctx.lineTo(xSpot, chartArea.bottom);
      ctx.stroke();
      ctx.shadowBlur = 0;

      const spotPrice = S.toFixed(0);
      const labelW = ctx.measureText("SPOT " + spotPrice).width + 14;
      ctx.fillStyle = "#6366f1";
      ctx.beginPath();
      ctx.roundRect?.(xSpot - labelW / 2, chartArea.top - 1, labelW, 18, 3);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px 'Sora', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SPOT " + spotPrice, xSpot, chartArea.top + 12);

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

        const beLabel = "BE " + be.toFixed(0);
        const beLabelW = ctx.measureText(beLabel).width + 10;
        ctx.setLineDash([]);
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.roundRect?.(xBE - beLabelW / 2, chartArea.bottom + 2, beLabelW, 16, 3);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 8.5px 'Sora', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(beLabel, xBE, chartArea.bottom + 13);

        const distPts = Math.abs(be - S);
        const distPct = ((distPts / S) * 100).toFixed(1);
        const midX = (xSpot + xBE) / 2;
        const midY = y.getPixelForValue(0);
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(245,158,11,0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xSpot, midY);
        ctx.lineTo(xBE, midY);
        ctx.stroke();
        ctx.fillStyle = "#f59e0b";
        ctx.font = "9px 'Sora', sans-serif";
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
            above: "rgba(22,163,74,0.10)",
            below: "rgba(220,38,38,0.10)",
          },
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300, easing: "easeInOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#ffffff",
          borderColor: "#d4d8e8",
          borderWidth: 1,
          titleColor: "#6b7494",
          bodyColor: "#1a1f35",
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
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            color: "#9aa0b8",
            font: { size: 10 },
            maxTicksLimit: 10,
            callback: (_v: any, i: number) => i % 20 === 0 ? spots[i]?.toFixed(0) ?? null : null,
          },
        },
        y: {
          grid: { color: "rgba(0,0,0,0.06)" },
          ticks: {
            color: "#9aa0b8",
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
  const [spotFlash, setSpotFlash] = useState(false);

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

  const atm = useMemo(() => Math.round(replaySpot / cfg.step) * cfg.step, [replaySpot, cfg.step]);

  const strikes = useMemo(() => {
    const step = cfg.step;
    const arr: number[] = [];
    for (let i = -50; i <= 50; i++) arr.push(atm + i * step);
    return arr;
  }, [atm, cfg.step]);

  useEffect(() => {
    const rDate = new Date(replayDate);
    setPositions(prev => prev.filter(p => new Date(p.legExpiryDate) >= rDate));
  }, [replayDate]);

  const addPos = useCallback((K: number, type: OptionType, prem: number, dir: 1 | -1, expLabel: string, expDate: string) => {
    setPositions(prev => {
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
    return all.some(p => p.dir === 1 && p.type === pos.type && Math.abs(p.K - pos.K) <= cfg.step * 6 && p.lots >= pos.lots);
  }

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
      popPct = ((profitAbove ? (1 - normCDF(d)) : normCDF(d)) * 100).toFixed(0) + "%";
    } else if (bes.length === 2) {
      const d1 = Math.log(bes[0] / S) / (iv0 * Math.sqrt(Math.max(T, 0.001)));
      const d2 = Math.log(bes[1] / S) / (iv0 * Math.sqrt(Math.max(T, 0.001)));
      popPct = ((normCDF(d2) - normCDF(d1)) * 100).toFixed(0) + "%";
    } else if (bes.length === 0) {
      popPct = active[150] > 0 ? ">95%" : "<5%";
    }

    const rr = !isUnlimP && !isUnlimL && maxP > 0 && minP < 0
      ? "1 : " + (Math.abs(minP) / maxP).toFixed(2) : "—";

    let netPrem = 0, totalMargin = 0;
    positions.forEach(p => {
      const notional = p.entryPrem * lot * p.lots;
      const hedged = isHedged(p, positions);
      const m = p.dir === 1 ? notional : hedged ? cfg.span * p.lots * 0.25 : cfg.span * p.lots;
      netPrem += p.dir === 1 ? -notional : notional;
      totalMargin += m;
    });

    return { spots, payoffs, mtmPayoffs, bes, S, maxP, minP, isUnlimP, isUnlimL, pD, pG, pTh, pV, pR, mtmPnl, popPct, rr, strat: detectStrat(positions), netPrem, totalMargin };
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
    // Flash the spot line
    setSpotFlash(true);
    setTimeout(() => setSpotFlash(false), 600);
  }

  const dte = getDTE();
  const dteDisplay = Math.max(0, Math.round(dte));
  const replayDateObj = new Date(replayDate + "T00:00:00");
  const replayDateDisplay = replayDateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });

  function handleChainClick(K: number, type: OptionType, prem: number, e: React.MouseEvent, forceDir?: 1 | -1) {
    e.preventDefault();
    const dir = forceDir ?? (e.type === "contextmenu" ? -1 : 1);
    const currentExpiry = exps[selectedExp];
    addPos(K, type, prem, dir, currentExpiry.label, currentExpiry.date);
  }

  return (
    <div className="mg-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}

        :root {
          --bg: #ffffff;
          --bg1: #f8f9fb;
          --bg2: #f0f2f7;
          --bg3: #e8eaf2;
          --border: #e2e5ee;
          --border2: #d4d8e8;
          --text: #1a1f35;
          --muted: #6b7494;
          --muted2: #9aa0b8;
          --accent: #6366f1;
          --accent2: #0d9488;
          --green: #16a34a;
          --red: #dc2626;
          --amber: #d97706;
          --blue: #2563eb;
          --purple: #7c3aed;
          --call: #2563eb;
          --put: #dc2626;
        }

        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#d4d8e8;border-radius:2px}
        ::-webkit-scrollbar-thumb:hover{background:#b0b8d0}

        .mg-root {
          background: var(--bg);
          color: var(--text);
          font-family: 'Sora', sans-serif;
          min-height: 100vh;
          font-size: 13px;
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        /* ── TOP NAV ── */
        .mg-nav {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 20px;
          height: 52px;
          border-bottom: 1px solid var(--border);
          background: #ffffff;
          flex-shrink: 0;
          flex-wrap: wrap;
        }
        .mg-logo {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.5px;
          margin-right: 4px;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 0;
        }
        .mg-logo span:first-child { color: var(--accent); }
        .mg-logo span:last-child { color: var(--accent2); }
        .mg-badge {
          background: rgba(99,102,241,0.10);
          color: var(--accent);
          font-size: 9px;
          padding: 3px 9px;
          border-radius: 100px;
          font-weight: 600;
          letter-spacing: 0.5px;
          border: 1px solid rgba(99,102,241,0.25);
        }
        .idx-btn {
          background: var(--bg2);
          border: 1px solid var(--border2);
          color: var(--muted);
          font-size: 12px;
          padding: 5px 14px;
          border-radius: 100px;
          cursor: pointer;
          font-family: 'Sora', sans-serif;
          font-weight: 400;
          transition: all .15s;
        }
        .idx-btn:hover { border-color: var(--accent); color: var(--accent); }
        .idx-btn.active { background: rgba(99,102,241,0.12); border-color: var(--accent); color: var(--accent); font-weight: 500; }
        .vix-pill {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          padding: 5px 14px;
          border-radius: 8px;
          font-size: 11px;
        }

        /* ── SPLIT LAYOUT ── */
        .mg-split {
          display: grid;
          grid-template-columns: 1fr 480px;
          flex: 1;
          overflow: hidden;
          min-height: 0;
        }

        /* ── LEFT PANEL (Option Chain) ── */
        .mg-left {
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border);
          overflow: hidden;
          min-height: 0;
        }
        .mg-left-header {
          padding: 8px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--bg1);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .chain-scroll {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
        }
        .exp-tab {
          background: transparent;
          border: 1px solid var(--border2);
          color: var(--muted);
          font-size: 10px;
          padding: 3px 9px;
          border-radius: 100px;
          cursor: pointer;
          font-family: 'Sora', sans-serif;
          transition: all .15s;
          white-space: nowrap;
        }
        .exp-tab:hover { border-color: var(--accent); color: var(--accent); }
        .exp-tab.active { background: rgba(99,102,241,0.12); border-color: var(--accent); color: var(--accent); font-weight: 500; }

        /* chain hint */
        .chain-hint {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: var(--muted);
          padding: 4px 14px;
          background: var(--bg1);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }

        /* chain table */
        table.ct { width: 100%; border-collapse: collapse; font-size: 11px; }
        table.ct th {
          padding: 5px 6px;
          color: var(--muted);
          font-weight: 500;
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: .4px;
          border-bottom: 1px solid var(--border);
          background: #f0f2f7;
          white-space: nowrap;
          position: sticky;
          top: 0;
          z-index: 2;
        }
        table.ct th.call-h { text-align: right; color: var(--call); }
        table.ct th.put-h  { text-align: left;  color: var(--put);  }
        table.ct th.strike-h { text-align: center; background: #e8eaf2; color: var(--muted); }
        table.ct td { padding: 4px 6px; border-bottom: 1px solid rgba(200,205,220,.3); white-space: nowrap; font-family: 'JetBrains Mono', monospace; font-size: 11px; }
        .tc { text-align: right; } .tp { text-align: left; }
        .td-strike { text-align: center; font-weight: 600; font-size: 12px; color: var(--text); background: #eef0f8 !important; padding: 3px 6px; position: relative; }
        .chain-row:hover td { background: #eef0f8 !important; }
        .chain-row.atm td { background: #f0fdf4; }
        .chain-row.atm:hover td { background: #dcfce7 !important; }
        .chain-row.atm .td-strike { color: var(--green); background: #f0fdf4 !important; border-top: 2px solid var(--green) !important; border-bottom: 2px solid var(--green) !important; }
        .chain-row.atm td { border-top: 2px solid rgba(22,163,74,0.35) !important; border-bottom: 2px solid rgba(22,163,74,0.35) !important; }
        .chain-row.has-pos td { background: #eff1ff; }
        .chain-row.otm td.cv, .chain-row.otm td.pv { opacity: .55; }
        .cv { color: var(--call); cursor: pointer; transition: all .1s; user-select: none; padding: 4px 6px !important; }
        .cv:hover { color: #1d4ed8; background: rgba(37,99,235,0.10) !important; border-radius: 4px; }
        .pv { color: var(--put); cursor: pointer; transition: all .1s; user-select: none; padding: 4px 6px !important; }
        .pv:hover { color: #b91c1c; background: rgba(220,38,38,0.10) !important; border-radius: 4px; }
        .atm-pill { display: inline-block; background: #dcfce7; color: var(--green); font-size: 8px; padding: 0 4px; border-radius: 3px; margin-right: 3px; font-family: 'Sora', sans-serif; font-weight: 500; }
        .bs-btn { font-size: 9px; padding: 1px 5px; border-radius: 3px; border: none; cursor: pointer; font-family: 'Sora', sans-serif; font-weight: 600; letter-spacing: .3px; transition: all .15s; }
        .bs-buy { background: #f0fdf4; color: var(--green); border: 1px solid #bbf7d0; }
        .bs-buy:hover { background: var(--green); color: #fff; }
        .bs-sell { background: #fef2f2; color: var(--red); border: 1px solid #fecaca; }
        .bs-sell:hover { background: var(--red); color: #fff; }
        .bs-buy-call { background: #f0fdf4; color: var(--green); border: 1px solid #bbf7d0; }
        .bs-buy-call:hover { background: var(--green); color: #fff; box-shadow: 0 0 0 2px rgba(22,163,74,0.3); }
        .bs-sell-call { background: #fef2f2; color: var(--red); border: 1px solid #fecaca; }
        .bs-sell-call:hover { background: var(--red); color: #fff; box-shadow: 0 0 0 2px rgba(220,38,38,0.3); }
        .bs-buy-put { background: #eff6ff; color: var(--blue); border: 1px solid #bfdbfe; }
        .bs-buy-put:hover { background: var(--blue); color: #fff; box-shadow: 0 0 0 2px rgba(37,99,235,0.3); }
        .bs-sell-put { background: #faf5ff; color: var(--purple); border: 1px solid #ddd6fe; }
        .bs-sell-put:hover { background: var(--purple); color: #fff; box-shadow: 0 0 0 2px rgba(124,58,237,0.3); }
        .strike-cell-inner { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 90px; }
        .strike-bs-row { display: flex; gap: 3px; margin-top: 1px; }
        .added-x { display: inline-block; background: #fef2f2; color: var(--red); font-size: 8px; padding: 1px 4px; border-radius: 3px; margin-left: 3px; cursor: pointer; vertical-align: middle; border: 1px solid #fecaca; }
        .added-x:hover { background: var(--red); color: #fff; }
        .iv-v { color: #b45309; } .dv { color: var(--accent2); } .gv { color: var(--purple); } .tv { color: #c2410c; }

        /* ── RIGHT PANEL ── */
        .mg-right {
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          background: var(--bg1);
          min-height: 0;
        }

        /* controls panel */
        .ctrl-panel {
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--bg1);
          flex-shrink: 0;
        }
        .ctrl-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 10px;
        }
        .ctrl-field {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .ctrl-label {
          font-size: 9.5px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: .5px;
        }
        input, select {
          background: var(--bg2);
          border: 1px solid var(--border2);
          color: var(--text);
          padding: 5px 9px;
          border-radius: 6px;
          font-family: 'Sora', sans-serif;
          font-size: 12px;
          outline: none;
          color-scheme: dark;
          width: 100%;
        }
        input:focus, select:focus { border-color: var(--accent); }
        input[type=number] { -moz-appearance: textfield; }
        input[type=number]::-webkit-inner-spin-button { opacity: .3; }

        /* replay nav */
        .replay-nav {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .rnav-btn {
          flex: 1;
          background: var(--bg2);
          border: 1px solid var(--border2);
          color: var(--muted);
          padding: 7px 12px;
          border-radius: 7px;
          cursor: pointer;
          font-size: 12px;
          font-family: 'Sora', sans-serif;
          transition: all .15s;
          text-align: center;
          font-weight: 500;
        }
        .rnav-btn:hover { border-color: var(--purple); color: var(--purple); background: #f3f0ff; }
        .rnav-btn.accent { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.4); color: var(--accent); }
        .rnav-btn.accent:hover { background: var(--accent); color: #fff; }
        .clear-btn {
          background: #fef2f2;
          color: var(--red);
          border: 1px solid #fecaca;
          padding: 7px 12px;
          border-radius: 7px;
          cursor: pointer;
          font-size: 12px;
          font-family: 'Sora', sans-serif;
          transition: all .15s;
        }
        .clear-btn:hover { background: var(--red); color: #fff; }

        /* status row */
        .status-row {
          display: flex;
          gap: 10px;
          align-items: center;
          padding: 8px 16px;
          background: #f0f2f7;
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
          font-size: 11px;
          flex-shrink: 0;
        }
        .sb-sep { width: 1px; height: 24px; background: var(--border); }
        .sb-item { display: flex; flex-direction: column; gap: 1px; }
        .sb-lbl { color: var(--muted); font-size: 9px; text-transform: uppercase; letter-spacing: .4px; }

        /* spot flash */
        @keyframes spotFlash {
          0% { background: rgba(99,102,241,0.2); }
          100% { background: transparent; }
        }
        .spot-flash { animation: spotFlash 0.6s ease-out; }

        /* right content */
        .right-content { padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; }

        /* positions */
        .panel { background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
        .panel-hdr { padding: 9px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .panel-hdr-title { font-size: 11px; font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; }

        .pos-item { display: flex; align-items: flex-start; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: 11px; flex-wrap: wrap; }
        .qty-btn { background: var(--bg); border: 1px solid var(--border2); color: var(--text); width: 20px; height: 20px; border-radius: 4px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; }
        .qty-btn:hover { background: var(--bg3); }
        .pos-rm { color: var(--muted2); cursor: pointer; font-size: 18px; line-height: 1; transition: color .15s; padding: 0 2px; }
        .pos-rm:hover { color: var(--red); }

        /* summary cards */
        .sum-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .sum-card { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 9px 12px; }
        .sc-label { font-size: 9.5px; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; margin-bottom: 3px; }
        .sc-val { font-family: 'JetBrains Mono', monospace; font-size: 15px; font-weight: 500; }

        /* strategy detect */
        .sd-item { background: var(--bg2); border-radius: 6px; padding: 7px 10px; border: 1px solid var(--border); }
        .sd-ilabel { font-size: 9.5px; color: var(--muted); margin-bottom: 2px; }
        .sd-ival { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 500; }

        /* greeks */
        .gk { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; }
        .gk-sym { font-family: Georgia, serif; font-size: 13px; color: var(--purple); margin-right: 3px; }
        .gk-name { font-size: 9.5px; color: var(--muted); margin-bottom: 3px; }
        .gk-val { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 500; }
        .gk-hint { font-size: 9px; color: var(--muted2); margin-top: 3px; line-height: 1.3; }

        /* chart tabs */
        .vtab { background: transparent; border: 1px solid var(--border2); color: var(--muted); font-size: 10px; padding: 4px 11px; border-radius: 100px; cursor: pointer; font-family: 'Sora', sans-serif; transition: all .15s; }
        .vtab:hover { border-color: var(--accent); color: var(--accent); }
        .vtab.active { background: rgba(99,102,241,0.12); border-color: var(--accent); color: var(--accent); }

        /* misc */
        .mono { font-family: 'JetBrains Mono', monospace; }
        .c-green { color: var(--green); } .c-red { color: var(--red); } .c-amber { color: var(--amber); }
        .c-blue { color: var(--blue); } .c-purple { color: var(--purple); } .c-muted { color: var(--muted); }

        /* spot flash on chart when stepping */
        .chart-wrap { position: relative; height: 300px; transition: box-shadow .3s; }
        .chart-wrap.flashing { box-shadow: 0 0 0 2px rgba(99,102,241,0.4); border-radius: 8px; }
      `}</style>

      {/* ── NAV ── */}
      <nav className="mg-nav">
        <Link href="/" className="mg-logo">
          <span>market</span><span>greeks</span>
        </Link>
        <div className="mg-badge">OPTIONS SIMULATOR</div>
        {(["NIFTY", "BANKNIFTY"] as IndexKey[]).map(idx => (
          <button key={idx} onClick={() => switchIndex(idx)} className={`idx-btn ${currentIndex === idx ? "active" : ""}`}>
            {CFG[idx].label} <span style={{ fontSize: 9, opacity: .6 }}>Lot {CFG[idx].lot}</span>
          </button>
        ))}
        <div className="vix-pill">
          <span style={{ color: "var(--muted)", fontSize: 9, textTransform: "uppercase", letterSpacing: .5 }}>India VIX</span>
          <span className="mono" style={{ fontSize: 15, fontWeight: 500, color: "var(--amber)" }}>{replayVIX.toFixed(2)}</span>
        </div>
      </nav>

      {/* ── SPLIT ── */}
      <div className="mg-split">

        {/* ════ LEFT: OPTION CHAIN ════ */}
        <div className="mg-left">
          <div className="mg-left-header">
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: .4 }}>Option Chain</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--bg2)", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: 100, fontSize: 10, color: "var(--muted)" }}>
              FUT: <b className="mono" style={{ color: "var(--text)", marginLeft: 3 }}>{fmtN(Math.round(replaySpot * (1 + rhoRate / 100 * dte / 365) * 0.5 + replaySpot * 0.5))}</b>
            </span>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {exps.map((e, i) => (
                <button key={e.date} className={`exp-tab ${i === selectedExp ? "active" : ""}`} onClick={() => selectExp(i)}>
                  {e.label} <span style={{ fontSize: 8, opacity: .6 }}>{e.type}</span>
                </button>
              ))}
            </div>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--muted)", fontStyle: "italic" }}>±50 strikes from ATM</span>
          </div>

          {/* Spot bar */}
          <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "6px 14px", background: "var(--bg)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: "var(--muted)" }}>Spot @ {replayDateDisplay}</span>
            <span className="mono" style={{ fontSize: 16, fontWeight: 500 }}>{fmtN(replaySpot)}</span>
            <span style={{ fontSize: 12 }} className={replaySpot >= entrySpot ? "c-green" : "c-red"}>
              {(replaySpot >= entrySpot ? "+" : "") + fmtN(replaySpot - entrySpot)} ({((replaySpot - entrySpot) / entrySpot * 100).toFixed(2)}%)
            </span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--muted2)" }}>DTE: <span style={{ color: "var(--amber)" }}>{dteDisplay}d</span></span>
          </div>

          <div className="chain-hint">
            <span>Left-click CALL = Buy &nbsp;|&nbsp; Right-click = Sell</span>
            <span>Left-click PUT = Buy &nbsp;|&nbsp; Right-click = Sell</span>
          </div>

          <div className="chain-scroll">
            <table className="ct">
              <thead>
                <tr>
                  <th className="call-h tc">Θ Theta</th>
                  <th className="call-h tc">Δ Delta</th>
                  <th className="call-h tc">IV%</th>
                  <th className="call-h tc" style={{ minWidth: 70 }}>Call LTP</th>
                  <th className="strike-h" style={{ minWidth: 110 }}>Strike</th>
                  <th className="put-h tp" style={{ minWidth: 70 }}>Put LTP</th>
                  <th className="put-h tp">IV%</th>
                  <th className="put-h tp">Δ Delta</th>
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
                  const currentExpiry = exps[selectedExp];
                  return (
                    <tr key={K} className={`chain-row ${isATM ? "atm" : ""} ${hasAny ? "has-pos" : ""} ${isOTM && !isATM ? "otm" : ""}`}>
                      <td className="tc tv">{cg.theta.toFixed(2)}</td>
                      <td className="tc dv">{cg.delta.toFixed(2)}</td>
                      <td className="tc iv-v">{cIV}</td>
                      <td className="tc cv"
                        onClick={e => handleChainClick(K, "C", cp, e, 1)}
                        onContextMenu={e => handleChainClick(K, "C", cp, e, -1)}>
                        <b>{cp.toFixed(2)}</b>
                        {(hasBuyC || hasSellC) && (
                          <span className="added-x" onClick={e => { e.stopPropagation(); removeByKType(K, "C"); }}>✕</span>
                        )}
                      </td>
                      <td className="td-strike">
                        <div className="strike-cell-inner">
                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            {isATM && <span className="atm-pill">ATM</span>}
                            <b>{K}</b>
                          </div>
                          <div className="strike-bs-row">
                            <button className="bs-btn bs-buy bs-buy-call" onClick={() => addPos(K, "C", cp, 1, currentExpiry.label, currentExpiry.date)} title="Buy Call">BC</button>
                            <button className="bs-btn bs-sell bs-sell-call" onClick={() => addPos(K, "C", cp, -1, currentExpiry.label, currentExpiry.date)} title="Sell Call">SC</button>
                            <button className="bs-btn bs-buy-put" onClick={() => addPos(K, "P", pp, 1, currentExpiry.label, currentExpiry.date)} title="Buy Put">BP</button>
                            <button className="bs-btn bs-sell-put" onClick={() => addPos(K, "P", pp, -1, currentExpiry.label, currentExpiry.date)} title="Sell Put">SP</button>
                          </div>
                        </div>
                      </td>
                      <td className="tp pv"
                        onClick={e => handleChainClick(K, "P", pp, e, 1)}
                        onContextMenu={e => handleChainClick(K, "P", pp, e, -1)}>
                        <b>{pp.toFixed(2)}</b>
                        {(hasBuyP || hasSellP) && (
                          <span className="added-x" onClick={e => { e.stopPropagation(); removeByKType(K, "P"); }}>✕</span>
                        )}
                      </td>
                      <td className="tp iv-v">{cIV}</td>
                      <td className="tp dv">{pg.delta.toFixed(2)}</td>
                      <td className="tp tv">{pg.theta.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: "5px 14px", background: "var(--bg1)", borderTop: "1px solid var(--border)", fontSize: 9.5, color: "var(--muted)", fontStyle: "italic" }}>
              ◉ ATM &nbsp;|&nbsp; Premiums are <b style={{ color: "var(--amber)" }}>synthetic</b> — Black-Scholes + VIX smile/skew
            </div>
          </div>
        </div>

        {/* ════ RIGHT: CONTROLS + POSITIONS + CHART ════ */}
        <div className="mg-right">

          {/* ── REPLAY DAY NAV (sticky top) ── */}
          <div style={{ padding: "10px 16px", borderBottom: "2px solid var(--accent)", background: "rgba(99,102,241,0.04)", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <button className="rnav-btn" style={{ flex: "0 0 auto", padding: "8px 18px", fontWeight: 600, fontSize: 13 }} onClick={() => stepReplay(-1)}>← Prev Day</button>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>{replayDateDisplay}</div>
              {analytics && (
                <div className={`mono ${analytics.mtmPnl >= 0 ? "c-green" : "c-red"}`} style={{ fontSize: 16, fontWeight: 700 }}>
                  MTM {analytics.mtmPnl >= 0 ? "+" : ""}{fmtP(analytics.mtmPnl)}
                </div>
              )}
            </div>
            <button className="rnav-btn accent" style={{ flex: "0 0 auto", padding: "8px 18px", fontWeight: 600, fontSize: 13 }} onClick={() => stepReplay(1)}>Next Day →</button>
          </div>

          {/* ── CONTROLS (entry date, entry spot, etc.) ── */}
          <div className="ctrl-panel">
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>Simulation Controls</div>
            <div className="ctrl-grid">
              <div className="ctrl-field">
                <span className="ctrl-label">Replay Date</span>
                <input type="date" value={replayDate} onChange={e => setReplayDate(e.target.value)} />
              </div>
              <div className="ctrl-field">
                <span className="ctrl-label">Entry Date</span>
                <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
              </div>
              <div className="ctrl-field">
                <span className="ctrl-label">Spot @ {replayDateDisplay}</span>
                <input type="number" value={replaySpot} onChange={e => setReplaySpot(+e.target.value)} />
              </div>
              <div className="ctrl-field">
                <span className="ctrl-label">Entry Spot</span>
                <input type="number" value={entrySpot} onChange={e => setEntrySpot(+e.target.value)} />
              </div>
              <div className="ctrl-field">
                <span className="ctrl-label">VIX / IV%</span>
                <input type="number" value={replayVIX} step={0.1} onChange={e => setReplayVIX(+e.target.value)} />
              </div>
              <div className="ctrl-field">
                <span className="ctrl-label">Expiry Date</span>
                <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
              </div>
              <div className="ctrl-field">
                <span className="ctrl-label">Rate % (ρ)</span>
                <input type="number" value={rhoRate} step={0.1} min={0} max={20} onChange={e => setRhoRate(+e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button className="clear-btn" onClick={() => setPositions([])}>✕ Clear All</button>
            </div>
          </div>

          {/* ── STATUS BAR ── */}
          <div className={`status-row ${spotFlash ? "spot-flash" : ""}`}>
            {[
              { label: "Index", val: CFG[currentIndex].label, cls: "" },
              { label: "Entry Spot", val: fmtN(entrySpot), cls: "" },
              { label: `Spot @ ${replayDateDisplay}`, val: fmtN(replaySpot), cls: "" },
              { label: "DTE", val: dteDisplay + "d", cls: "c-amber" },
              { label: "Lot Size", val: CFG[currentIndex].lot + " units", cls: "" },
            ].map(({ label, val, cls }, i) => (
              <React.Fragment key={label}>
                {i > 0 && <div className="sb-sep" />}
                <div className="sb-item">
                  <div className="sb-lbl">{label}</div>
                  <div className={`mono ${cls}`} style={{ fontSize: 13, fontWeight: 500 }}>{val}</div>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* ── RIGHT CONTENT ── */}
          <div className="right-content">

            {/* POSITIONS */}
            <div className="panel">
              <div className="panel-hdr">
                <span className="panel-hdr-title">
                  Positions <span style={{ color: "var(--accent)", fontSize: 10 }}>{positions.length} leg{positions.length !== 1 ? "s" : ""}</span>
                </span>
                {positions.length > 0 && (
                  <span style={{ fontSize: 9, color: "var(--muted)", marginLeft: "auto" }}>Auto-expire on expiry date</span>
                )}
              </div>
              {positions.length === 0 ? (
                <div style={{ padding: 18, textAlign: "center", color: "var(--muted)", fontSize: 11, fontStyle: "italic" }}>
                  No positions. Click Call/Put premiums or use BC/SC/BP/SP buttons.
                </div>
              ) : (
                positions.map((p) => {
                  const isBuy = p.dir === 1;
                  const curPrem = calcPremium(replaySpot, p.K, getDTE(p.legExpiryDate), p.type);
                  const lot = cfg.lot;
                  const mtm = (curPrem - p.entryPrem) * lot * p.lots * p.dir;
                  const hedged = isHedged(p, positions);
                  const legDTE = Math.max(0, Math.round(getDTE(p.legExpiryDate)));
                  return (
                    <div key={p.id} className="pos-item">
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 600, letterSpacing: .3, background: isBuy ? "#f0fdf4" : "#fef2f2", color: isBuy ? "var(--green)" : "var(--red)", border: `1px solid ${isBuy ? "#bbf7d0" : "#fecaca"}` }}>
                            {isBuy ? "BUY" : "SELL"}
                          </span>
                          <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{p.K}</span>
                          <span style={{ color: p.type === "C" ? "var(--call)" : "var(--put)", fontSize: 11, fontWeight: 500 }}>{p.type === "C" ? "CE" : "PE"}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <button className="qty-btn" onClick={() => changeLots(p.id, -1)}>−</button>
                            <span className="mono" style={{ fontSize: 11, minWidth: 46, textAlign: "center" }}>{p.lots} lot{p.lots !== 1 ? "s" : ""}</span>
                            <button className="qty-btn" onClick={() => changeLots(p.id, 1)}>+</button>
                          </div>
                          <span className="mono" style={{ color: "var(--amber)" }}>@{p.entryPrem.toFixed(2)}</span>
                          <span className={`mono ${mtm >= 0 ? "c-green" : "c-red"}`} style={{ fontSize: 11 }}>
                            {mtm >= 0 ? "+" : ""}{fmtP(mtm)}
                          </span>
                          {hedged && !isBuy && (
                            <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "#eff6ff", color: "var(--blue)", border: "1px solid #bfdbfe" }}>Hedged</span>
                          )}
                          <button className="pos-rm" style={{ marginLeft: "auto" }} onClick={() => removePosIdx(p.id)}>×</button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 9, color: "var(--muted)" }}>Expiry:</span>
                          {exps.map((e) => (
                            <button key={e.date}
                              onClick={() => changeExpiryForPos(p.id, e)}
                              style={{
                                fontSize: 8.5, padding: "1px 6px", borderRadius: 3, cursor: "pointer",
                                background: p.legExpiryDate === e.date ? "rgba(99,102,241,0.12)" : "var(--bg)",
                                border: `1px solid ${p.legExpiryDate === e.date ? "var(--accent)" : "var(--border2)"}`,
                                color: p.legExpiryDate === e.date ? "var(--accent)" : "var(--muted)",
                                fontFamily: "'Sora', sans-serif",
                                fontWeight: p.legExpiryDate === e.date ? 600 : 400,
                              }}>{e.label}</button>
                          ))}
                          <span style={{ fontSize: 9, color: legDTE <= 3 ? "var(--red)" : legDTE <= 7 ? "var(--amber)" : "var(--muted)" }}>
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
                  <div style={{ background: "var(--bg1)", borderTop: "1px solid var(--border)", padding: "8px 12px", fontSize: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                      <span style={{ color: "var(--muted)" }}>Premium {netPrem >= 0 ? "Collected" : "Paid"}</span>
                      <span className="mono">{fmtP(netPrem)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                      <span style={{ color: "var(--muted)" }}>Approx Margin Required</span>
                      <span className="mono" style={{ color: "var(--amber)", fontWeight: 500 }}>{fmtP(totalMargin)}</span>
                    </div>
                    <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 3 }}>
                      Buy = premium × lot × qty | Sell = SPAN ~₹{fmtN(cfg.span)}/lot | Hedged ≈ 25% margin
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* SUMMARY CARDS */}
            <div className="sum-grid">
              {[
                { label: "Max Profit", val: analytics?.isUnlimP ? "Unlimited ∞" : analytics ? fmtP(analytics.maxP) : "—", cls: "c-green" },
                { label: "Max Loss", val: analytics?.isUnlimL ? "Unlimited ∞" : analytics ? fmtP(analytics.minP) : "—", cls: "c-red" },
                { label: "Breakeven(s)", val: analytics?.bes.length ? analytics.bes.join(" / ") : "—", cls: "" },
                { label: "POP", val: analytics?.popPct ?? "—", cls: "c-blue" },
              ].map(({ label, val, cls }) => (
                <div key={label} className="sum-card">
                  <div className="sc-label">{label}</div>
                  <div className={`sc-val ${cls}`} style={{ fontSize: 14 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* STRATEGY DETECT */}
            <div className="panel" style={{ padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{analytics?.strat.name ?? "No Strategy"}</span>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "rgba(167,139,250,0.1)", color: "var(--purple)", border: "1px solid rgba(167,139,250,0.2)" }}>{analytics?.strat.bias ?? "—"}</span>
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
            <div className="panel">
              <div style={{ padding: "9px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: .4 }}>Portfolio Greeks</span>
                <span style={{ fontSize: 9.5, color: "var(--muted)", marginLeft: "auto" }}>BS + VIX smile model</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7, padding: "10px 12px" }}>
                {[
                  { sym: "Δ", name: "Delta", val: analytics?.pD.toFixed(2) ?? "—", hint: "₹/+1pt spot" },
                  { sym: "Γ", name: "Gamma", val: analytics?.pG.toFixed(4) ?? "—", hint: "Delta/+1pt" },
                  { sym: "Θ", name: "Theta", val: analytics?.pTh.toFixed(2) ?? "—", hint: "₹ decay/day", cls: "c-red" },
                  { sym: "V", name: "Vega",  val: analytics?.pV.toFixed(2) ?? "—", hint: "₹/1% IV" },
                  { sym: "ρ", name: "Rho",   val: analytics?.pR.toFixed(2) ?? "—", hint: "₹/1% rate" },
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
            <div className="panel" style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Payoff Chart</span>
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
              <div className={`chart-wrap ${spotFlash ? "flashing" : ""}`}>
                <canvas ref={canvasRef} role="img" aria-label="Options payoff P&L chart" />
              </div>
              {analytics && analytics.bes.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {analytics.bes.map(be => {
                    const dist = Math.abs(be - replaySpot);
                    const distPct = ((dist / replaySpot) * 100).toFixed(1);
                    const above = be > replaySpot;
                    return (
                      <span key={be} style={{ fontSize: 10, background: "#fffbeb", color: "var(--amber)", border: "1px solid #fde68a", borderRadius: 4, padding: "2px 8px" }}>
                        BE: {fmtN(be)} &nbsp;
                        <span style={{ color: "var(--muted)" }}>{distPct}% {above ? "above" : "below"} spot &nbsp; ({fmtN(dist)} pts away)</span>
                      </span>
                    );
                  })}
                </div>
              )}
              <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 10, color: "var(--muted)", flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 2, background: "var(--green)", display: "inline-block", borderRadius: 1 }} />Profit</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 2, background: "var(--red)", display: "inline-block", borderRadius: 1 }} />Loss</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 1, background: "var(--amber)", display: "inline-block" }} />Breakeven</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 2, background: "var(--accent)", display: "inline-block" }} />Spot @ {replayDateDisplay}</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
