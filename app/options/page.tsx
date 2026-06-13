"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RawRow {
  date: string;   // "Nov 14, 2024"
  price: number;
  open: number;
  high: number;
  low: number;
  change: number; // %
}

interface VixRow {
  date: string;
  price: number;
}

interface Position {
  id: string;
  type: "CE" | "PE";
  side: "BUY" | "SELL";
  strike: number;
  entryPrice: number;
  lots: number;
  entryDate: string;
}

interface StrikeGreeks {
  strike: number;
  callLTP: number;
  callIV: number;
  callDelta: number;
  callTheta: number;
  putLTP: number;
  putIV: number;
  putDelta: number;
  putTheta: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LOT_SIZE = 65;
const STRIKE_STEP = 50;
const STRIKES_EACH_SIDE = 2; // ±100pts = 2 strikes each side at 50pt step

// ─── Black-Scholes ────────────────────────────────────────────────────────────

function normCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422820 * Math.exp(-0.5 * x * x);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  return x >= 0 ? 1 - p : p;
}

function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function bsCall(S: number, K: number, T: number, r: number, sigma: number) {
  if (T <= 0) return Math.max(S - K, 0);
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const price = S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
  const delta = normCDF(d1);
  const gamma = normPDF(d1) / (S * sigma * sqrtT);
  const theta = (-(S * normPDF(d1) * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * normCDF(d2)) / 365;
  return { price: Math.max(price, 0.01), delta, gamma, theta, d1 };
}

function bsPut(S: number, K: number, T: number, r: number, sigma: number) {
  if (T <= 0) return Math.max(K - S, 0);
  const c = bsCall(S, K, T, r, sigma);
  const putPrice = c.price - S + K * Math.exp(-r * T);
  return {
    price: Math.max(putPrice, 0.01),
    delta: c.delta - 1,
    gamma: c.gamma,
    theta: c.theta,
    d1: c.d1,
  };
}

function impliedIV(vix: number, strike: number, spot: number): number {
  const moneyness = (strike - spot) / spot;
  const skew = moneyness > 0 ? 1.05 : 1.12; // simple skew: OTM puts have higher IV
  return (vix / 100) * skew;
}

function computeGreeks(spot: number, vix: number, dte: number): StrikeGreeks[] {
  const atm = Math.round(spot / 50) * 50;
  const strikes: number[] = [];
  for (let i = -STRIKES_EACH_SIDE; i <= STRIKES_EACH_SIDE; i++) {
    strikes.push(atm + i * STRIKE_STEP);
  }
  const T = dte / 365;
  const r = 0.065;
  return strikes.map((K) => {
    const iv = impliedIV(vix, K, spot);
    const call = bsCall(spot, K, T, r, iv);
    const put = bsPut(spot, K, T, r, iv);
    return {
      strike: K,
      callLTP: +call.price.toFixed(2),
      callIV: +(iv * 100).toFixed(1),
      callDelta: +call.delta.toFixed(2),
      callTheta: +call.theta.toFixed(2),
      putLTP: +put.price.toFixed(2),
      putIV: +(iv * 100).toFixed(1),
      putDelta: +put.delta.toFixed(2),
      putTheta: +put.theta.toFixed(2),
    };
  });
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

function parseInvestingCSV(text: string): RawRow[] {
  const lines = text.trim().split("\n").filter(Boolean);
  const rows: RawRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
    if (cols.length < 6) continue;
    const [date, price, open, high, low, , change] = cols;
    const parseNum = (s: string) => parseFloat(s.replace(/,/g, "")) || 0;
    const parseChange = (s: string) => parseFloat(s.replace("%", "").trim()) || 0;
    rows.push({ date, price: parseNum(price), open: parseNum(open), high: parseNum(high), low: parseNum(low), change: parseChange(change) });
  }
  return rows.reverse(); // oldest first
}

function parseVixCSV(text: string): VixRow[] {
  const lines = text.trim().split("\n").filter(Boolean);
  const rows: VixRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
    if (cols.length < 2) continue;
    rows.push({ date: cols[0], price: parseFloat(cols[1].replace(/,/g, "")) || 0 });
  }
  return rows.reverse();
}

// ─── Expiry helpers ───────────────────────────────────────────────────────────

function lastThursdayOfMonth(year: number, month: number): Date {
  // NSE: monthly expiry = last Thursday of month
  const d = new Date(year, month + 1, 0); // last day of month
  while (d.getDay() !== 4) d.setDate(d.getDate() - 1);
  return d;
}

function nextWeeklyThursday(from: Date): Date {
  const d = new Date(from);
  // next Thursday >= from
  const day = d.getDay();
  const add = day <= 4 ? 4 - day : 4 + 7 - day;
  d.setDate(d.getDate() + add);
  return d;
}

function getExpiryOptions(entryDate: Date): { label: string; date: Date }[] {
  const options: { label: string; date: Date }[] = [];
  let d = nextWeeklyThursday(entryDate);
  for (let i = 0; i < 5; i++) {
    const lth = lastThursdayOfMonth(d.getFullYear(), d.getMonth());
    const isMonthly = d.toDateString() === lth.toDateString();
    options.push({ label: formatDate(d) + (isMonthly ? " (Monthly)" : " (Weekly)"), date: new Date(d) });
    d.setDate(d.getDate() + 7);
  }
  return options;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function parseISODate(s: string): Date {
  // "Nov 14, 2024" or "2024-11-14"
  return new Date(s);
}

function dte(current: Date, expiry: Date): number {
  const diff = expiry.getTime() - current.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ─── Position P&L ─────────────────────────────────────────────────────────────

function positionPnL(pos: Position, greeks: StrikeGreeks[]): number {
  const g = greeks.find((g) => g.strike === pos.strike);
  if (!g) return 0;
  const currentPrice = pos.type === "CE" ? g.callLTP : g.putLTP;
  const diff = currentPrice - pos.entryPrice;
  const multiplier = pos.side === "BUY" ? 1 : -1;
  return +(diff * multiplier * pos.lots * LOT_SIZE).toFixed(0);
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
function fmtPrice(n: number) { return fmt.format(n); }
function fmtPnL(n: number) { return (n >= 0 ? "+" : "") + "₹" + fmt.format(n); }

// ─── Main Component ────────────────────────────────────────────────────────────

export default function OptionsReplay() {
  const [niftyData, setNiftyData] = useState<RawRow[]>([]);
  const [vixData, setVixData] = useState<VixRow[]>([]);
  const [entryDate, setEntryDate] = useState<string>("");
  const [expiryOptions, setExpiryOptions] = useState<{ label: string; date: Date }[]>([]);
  const [selectedExpiryIdx, setSelectedExpiryIdx] = useState(0);
  const [currentDayIdx, setCurrentDayIdx] = useState(0);
  const [replayDays, setReplayDays] = useState<RawRow[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [replayStarted, setReplayStarted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const niftyInputRef = useRef<HTMLInputElement>(null);
  const vixInputRef = useRef<HTMLInputElement>(null);

  // Derived state
  const currentRow = replayDays[currentDayIdx] || null;
  const expiry = expiryOptions[selectedExpiryIdx]?.date || null;
  const currentDate = currentRow ? parseISODate(currentRow.date) : null;
  const daysLeft = currentDate && expiry ? dte(currentDate, expiry) : 0;
  const spot = currentRow?.price || 0;
  const vixRow = currentDate
    ? vixData.find((v) => new Date(v.date).toDateString() === currentDate.toDateString()) || vixData[0]
    : vixData[0];
  const vix = vixRow?.price || 15;
  const greeks = spot > 0 ? computeGreeks(spot, vix, daysLeft) : [];
  const atm = spot > 0 ? Math.round(spot / 50) * 50 : 0;
  const totalPnL = positions.reduce((sum, p) => sum + positionPnL(p, greeks), 0);
  const marginUsed = positions.length * 48000; // synthetic margin

  // On expiry day: close all (dte=0)
  const isExpired = daysLeft === 0 && replayStarted;

  // Build replay days when entry date & expiry change
  useEffect(() => {
    if (!entryDate || !niftyData.length || !expiryOptions.length) return;
    const expD = expiryOptions[selectedExpiryIdx]?.date;
    if (!expD) return;
    const entry = new Date(entryDate);
    const days = niftyData.filter((r) => {
      const d = new Date(r.date);
      return d >= entry && d <= expD;
    });
    setReplayDays(days);
    setCurrentDayIdx(0);
    setPositions([]);
    setReplayStarted(false);
    setIsPlaying(false);
  }, [entryDate, selectedExpiryIdx, niftyData, expiryOptions]);

  // Recompute expiry options when entry date changes
  useEffect(() => {
    if (!entryDate) return;
    const d = new Date(entryDate);
    const opts = getExpiryOptions(d);
    setExpiryOptions(opts);
    setSelectedExpiryIdx(0);
  }, [entryDate]);

  // Auto-play
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    const delay = 1500 / speed;
    timerRef.current = setTimeout(() => {
      setCurrentDayIdx((i) => {
        if (i < replayDays.length - 1) return i + 1;
        setIsPlaying(false);
        return i;
      });
    }, delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, currentDayIdx, speed, replayDays.length]);

  const handleNiftyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseInvestingCSV(text);
      setNiftyData(rows);
      if (rows.length > 0 && !entryDate) {
        const last = rows[rows.length - 1];
        setEntryDate(new Date(last.date).toISOString().split("T")[0]);
      }
    };
    reader.readAsText(file);
  };

  const handleVixUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setVixData(parseVixCSV(text));
    };
    reader.readAsText(file);
  };

  const handleBuy = (type: "CE" | "PE", strike: number, side: "BUY" | "SELL") => {
    if (!currentRow || !replayStarted) return;
    const g = greeks.find((g) => g.strike === strike);
    if (!g) return;
    const entryPrice = type === "CE" ? g.callLTP : g.putLTP;
    const pos: Position = {
      id: `${type}-${strike}-${side}-${Date.now()}`,
      type, side, strike,
      entryPrice,
      lots: 1,
      entryDate: currentRow.date,
    };
    setPositions((prev) => [...prev, pos]);
  };

  const handleSquareOff = (id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  };

  const handleReset = () => {
    setCurrentDayIdx(0);
    setPositions([]);
    setIsPlaying(false);
    setReplayStarted(false);
  };

  const startReplay = () => {
    setReplayStarted(true);
    setIsPlaying(true);
  };

  const progress = replayDays.length > 1 ? (currentDayIdx / (replayDays.length - 1)) * 100 : 0;

  const hasData = niftyData.length > 0;

  return (
    <div className="mg-replay-root">
      {/* ── Upload bar ── */}
      <div className="mg-card mg-upload-bar">
        <span className="mg-section-label">Data Upload</span>
        <div className="mg-upload-group">
          <label className="mg-upload-btn" onClick={() => niftyInputRef.current?.click()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {niftyData.length > 0 ? `Nifty ✓ (${niftyData.length} rows)` : "Upload Nifty CSV"}
          </label>
          <input ref={niftyInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleNiftyUpload} />
          <label className="mg-upload-btn" onClick={() => vixInputRef.current?.click()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {vixData.length > 0 ? `VIX ✓ (${vixData.length} rows)` : "Upload India VIX CSV"}
          </label>
          <input ref={vixInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleVixUpload} />
          <span className="mg-upload-hint">investing.com format: Date, Price, Open, High, Low, Vol., Change%</span>
        </div>
      </div>

      {!hasData && (
        <div className="mg-empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          <p>Upload Nifty CSV to start the replay</p>
        </div>
      )}

      {hasData && (
        <>
          {/* ── Top control bar ── */}
          <div className="mg-card mg-topbar">
            <div className="mg-topbar-left">
              <div className="mg-field">
                <label className="mg-label">Entry Date</label>
                <input
                  type="date"
                  className="mg-input"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>
              <div className="mg-divider" />
              <div className="mg-field">
                <label className="mg-label">Expiry</label>
                <select
                  className="mg-input"
                  value={selectedExpiryIdx}
                  onChange={(e) => setSelectedExpiryIdx(Number(e.target.value))}
                >
                  {expiryOptions.map((opt, i) => (
                    <option key={i} value={i}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="mg-divider" />
              <div className="mg-field">
                <div className="mg-label">Data as on</div>
                <div className="mg-val">{currentRow ? currentRow.date : "—"}</div>
                <div className="mg-sublabel">
                  {replayDays.length > 0
                    ? `Day ${currentDayIdx + 1} of ${replayDays.length}`
                    : "Select entry date"}
                </div>
              </div>
              <div className="mg-divider" />
              <div className="mg-field">
                <div className="mg-label">Nifty Spot</div>
                <div className="mg-spot">{spot > 0 ? fmtPrice(spot) : "—"}</div>
                {currentRow && (
                  <div className={`mg-change ${currentRow.change >= 0 ? "pos" : "neg"}`}>
                    {currentRow.change >= 0 ? "▲" : "▼"} {Math.abs(currentRow.change).toFixed(2)}%
                  </div>
                )}
              </div>
              <div className="mg-field">
                <div className="mg-label">India VIX</div>
                <div className="mg-vix">{vix.toFixed(2)}</div>
              </div>
              <div className="mg-field">
                <div className="mg-label">Days to Expiry</div>
                <div className={`mg-dte ${daysLeft <= 2 ? "urgent" : ""}`}>{daysLeft}</div>
              </div>
            </div>

            <div className="mg-play-controls">
              <button className="mg-ctrl-btn" onClick={handleReset} title="Reset">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.77"/></svg>
                Reset
              </button>
              {!replayStarted ? (
                <button className="mg-ctrl-btn primary" onClick={startReplay} disabled={replayDays.length === 0}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Start Replay
                </button>
              ) : (
                <>
                  <button
                    className={`mg-ctrl-btn ${isPlaying ? "" : "primary"}`}
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause</>
                    ) : (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>Play</>
                    )}
                  </button>
                  <button
                    className="mg-ctrl-btn"
                    onClick={() => setCurrentDayIdx((i) => Math.min(i + 1, replayDays.length - 1))}
                    disabled={currentDayIdx >= replayDays.length - 1}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                    Next Day
                  </button>
                </>
              )}
              <select className="mg-input" style={{ width: 90 }} value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                <option value={1}>1× speed</option>
                <option value={2}>2× speed</option>
                <option value={5}>5× speed</option>
              </select>
            </div>
          </div>

          {/* Progress scrubber */}
          <div className="mg-scrubber-wrap">
            <div className="mg-scrubber-track">
              <div className="mg-scrubber-fill" style={{ width: `${progress}%` }} />
              {replayDays.map((_, i) => (
                <button
                  key={i}
                  className={`mg-scrubber-dot ${i === currentDayIdx ? "active" : ""} ${i < currentDayIdx ? "past" : ""}`}
                  style={{ left: `${replayDays.length > 1 ? (i / (replayDays.length - 1)) * 100 : 0}%` }}
                  onClick={() => { setReplayStarted(true); setIsPlaying(false); setCurrentDayIdx(i); }}
                  title={replayDays[i].date}
                />
              ))}
            </div>
            <div className="mg-scrubber-labels">
              {replayDays.length > 0 && <span>{replayDays[0].date}</span>}
              {replayDays.length > 1 && <span>{replayDays[replayDays.length - 1].date}</span>}
            </div>
          </div>

          {/* ── Metric strip ── */}
          <div className="mg-metric-strip">
            <div className="mg-metric-card">
              <div className="mg-metric-label">ATM Strike</div>
              <div className="mg-metric-val">{atm > 0 ? fmtPrice(atm) : "—"}</div>
            </div>
            <div className="mg-metric-card">
              <div className="mg-metric-label">Days to Expiry</div>
              <div className={`mg-metric-val ${daysLeft <= 2 ? "text-amber" : ""}`}>{daysLeft}</div>
            </div>
            <div className="mg-metric-card">
              <div className="mg-metric-label">Total P&L</div>
              <div className={`mg-metric-val ${totalPnL >= 0 ? "text-green" : "text-red"}`}>{fmtPnL(totalPnL)}</div>
            </div>
            <div className="mg-metric-card">
              <div className="mg-metric-label">Margin Used</div>
              <div className="mg-metric-val">₹{fmtPrice(marginUsed)}</div>
            </div>
            <div className="mg-metric-card">
              <div className="mg-metric-label">Open Positions</div>
              <div className="mg-metric-val">{positions.length}</div>
            </div>
            <div className="mg-metric-card">
              <div className="mg-metric-label">India VIX</div>
              <div className="mg-metric-val text-amber">{vix.toFixed(2)}</div>
            </div>
          </div>

          {isExpired && (
            <div className="mg-expiry-banner">
              🎯 Expiry day! All positions settled at intrinsic value. Final P&L: <strong>{fmtPnL(totalPnL)}</strong>
            </div>
          )}

          {/* ── Main grid ── */}
          {replayStarted && spot > 0 && (
            <div className="mg-main-grid">
              {/* Options chain */}
              <div className="mg-card mg-chain-card">
                <div className="mg-chain-header">
                  <span className="mg-section-label">Options Chain</span>
                  <div className="mg-chain-meta">
                    <span className="mg-tag">1 lot = {LOT_SIZE} units</span>
                    <span className="mg-badge amber">{expiryOptions[selectedExpiryIdx]?.label.includes("Monthly") ? "Monthly" : "Weekly"} expiry</span>
                  </div>
                </div>
                <div className="mg-chain-scroll">
                  <table className="mg-chain-table">
                    <thead>
                      <tr>
                        <th colSpan={5} className="call-header">— CALL —</th>
                        <th className="strike-header">Strike</th>
                        <th colSpan={5} className="put-header">— PUT —</th>
                      </tr>
                      <tr className="subhead">
                        <th>Buy</th><th>Sell</th><th>LTP</th><th>IV</th><th>Δ Delta</th>
                        <th>Strike</th>
                        <th>Δ Delta</th><th>IV</th><th>LTP</th><th>Sell</th><th>Buy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {greeks.map((g) => {
                        const isATM = g.strike === atm;
                        return (
                          <tr key={g.strike} className={isATM ? "atm-row" : ""}>
                            <td>
                              <button className="action-btn buy" onClick={() => handleBuy("CE", g.strike, "BUY")}>B</button>
                            </td>
                            <td>
                              <button className="action-btn sell" onClick={() => handleBuy("CE", g.strike, "SELL")}>S</button>
                            </td>
                            <td className="ltp-call">{g.callLTP}</td>
                            <td>{g.callIV}%</td>
                            <td className="delta">{g.callDelta.toFixed(2)}</td>
                            <td className={`strike-cell ${isATM ? "atm" : ""}`}>
                              {fmtPrice(g.strike)}{isATM ? " ★" : ""}
                            </td>
                            <td className="delta">{g.putDelta.toFixed(2)}</td>
                            <td>{g.putIV}%</td>
                            <td className="ltp-put">{g.putLTP}</td>
                            <td>
                              <button className="action-btn sell" onClick={() => handleBuy("PE", g.strike, "SELL")}>S</button>
                            </td>
                            <td>
                              <button className="action-btn buy" onClick={() => handleBuy("PE", g.strike, "BUY")}>B</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mg-chain-footer">
                  Θ Theta per day shown in positions panel. IV computed from VIX with skew. Black-Scholes model.
                </div>
              </div>

              {/* Right panel */}
              <div className="mg-right-panel">
                {/* Greeks */}
                <div className="mg-card mg-greeks-card">
                  <div className="mg-section-label">ATM Greeks</div>
                  <div className="mg-greeks-grid">
                    {(() => {
                      const atmG = greeks.find((g) => g.strike === atm);
                      if (!atmG) return null;
                      return (
                        <>
                          <div className="mg-greek-item"><div className="mg-greek-label">IV</div><div className="mg-greek-val">{atmG.callIV}%</div></div>
                          <div className="mg-greek-item"><div className="mg-greek-label">Delta CE</div><div className="mg-greek-val blue">{atmG.callDelta.toFixed(2)}</div></div>
                          <div className="mg-greek-item"><div className="mg-greek-label">Theta /day</div><div className="mg-greek-val red">{atmG.callTheta.toFixed(2)}</div></div>
                          <div className="mg-greek-item"><div className="mg-greek-label">Delta PE</div><div className="mg-greek-val red">{atmG.putDelta.toFixed(2)}</div></div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Positions */}
                <div className="mg-card mg-positions-card">
                  <div className="mg-section-label">Open Positions</div>
                  {positions.length === 0 && (
                    <div className="mg-no-positions">No open positions. Click B/S on the chain.</div>
                  )}
                  {positions.map((pos) => {
                    const pnl = positionPnL(pos, greeks);
                    const g = greeks.find((g) => g.strike === pos.strike);
                    const currentPrice = g ? (pos.type === "CE" ? g.callLTP : g.putLTP) : 0;
                    return (
                      <div key={pos.id} className="mg-pos-row">
                        <div className="mg-pos-left">
                          <span className={`mg-badge ${pos.side === "BUY" ? "green" : "red"}`}>
                            {pos.side} {pos.type}
                          </span>
                          <span className="mg-pos-strike">{fmtPrice(pos.strike)}</span>
                          <span className="mg-pos-meta">× {LOT_SIZE}</span>
                        </div>
                        <div className="mg-pos-right">
                          <div className="mg-pos-price-change">
                            <span className="mg-pos-entry">Entry: {pos.entryPrice}</span>
                            <span className="mg-pos-curr">Now: {currentPrice}</span>
                          </div>
                          <span className={`mg-pos-pnl ${pnl >= 0 ? "pos" : "neg"}`}>{fmtPnL(pnl)}</span>
                          <button className="mg-sq-btn" onClick={() => handleSquareOff(pos.id)} title="Square off">✕</button>
                        </div>
                      </div>
                    );
                  })}
                  {positions.length > 0 && (
                    <div className="mg-net-pnl">
                      <span>Net P&L</span>
                      <span className={totalPnL >= 0 ? "pos" : "neg"}>{fmtPnL(totalPnL)}</span>
                    </div>
                  )}
                </div>

                {/* OHLC */}
                {currentRow && (
                  <div className="mg-card mg-ohlc-card">
                    <div className="mg-section-label">Day OHLC</div>
                    <div className="mg-ohlc-grid">
                      <div><div className="mg-ohlc-label">Open</div><div className="mg-ohlc-val">{fmtPrice(currentRow.open)}</div></div>
                      <div><div className="mg-ohlc-label">High</div><div className="mg-ohlc-val text-green">{fmtPrice(currentRow.high)}</div></div>
                      <div><div className="mg-ohlc-label">Low</div><div className="mg-ohlc-val text-red">{fmtPrice(currentRow.low)}</div></div>
                      <div><div className="mg-ohlc-label">Close</div><div className="mg-ohlc-val">{fmtPrice(currentRow.price)}</div></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!replayStarted && replayDays.length > 0 && (
            <div className="mg-empty-state">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <p>Click <strong>Start Replay</strong> to begin. You can buy/sell options as the market unfolds day by day.</p>
            </div>
          )}
        </>
      )}

      <style>{`
        .mg-replay-root {
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
          background: #f1f5f9;
          min-height: 100vh;
          padding: 1.25rem;
          color: #0f172a;
        }
        .mg-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 1rem 1.25rem;
          margin-bottom: 0.875rem;
        }
        .mg-section-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #64748b;
          display: block;
          margin-bottom: 0.625rem;
        }
        /* Upload */
        .mg-upload-bar { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
        .mg-upload-bar .mg-section-label { margin-bottom: 0; white-space: nowrap; }
        .mg-upload-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .mg-upload-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 14px; font-size: 12px; font-weight: 500;
          border: 1px dashed #94a3b8; border-radius: 6px;
          background: #f8fafc; color: #334155; cursor: pointer;
          transition: all 0.15s;
        }
        .mg-upload-btn:hover { border-color: #3b82f6; color: #3b82f6; background: #eff6ff; }
        .mg-upload-hint { font-size: 11px; color: #94a3b8; }
        /* Top bar */
        .mg-topbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding: 0.875rem 1.25rem; }
        .mg-topbar-left { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .mg-field { display: flex; flex-direction: column; }
        .mg-label { font-size: 11px; color: #64748b; margin-bottom: 3px; }
        .mg-val { font-size: 14px; font-weight: 500; color: #0f172a; }
        .mg-sublabel { font-size: 11px; color: #94a3b8; margin-top: 1px; }
        .mg-spot { font-size: 18px; font-weight: 600; color: #1d4ed8; }
        .mg-vix { font-size: 18px; font-weight: 600; color: #b45309; }
        .mg-dte { font-size: 18px; font-weight: 600; color: #0f172a; }
        .mg-dte.urgent { color: #dc2626; }
        .mg-change { font-size: 12px; font-weight: 500; margin-top: 2px; }
        .mg-change.pos { color: #16a34a; }
        .mg-change.neg { color: #dc2626; }
        .mg-divider { width: 1px; height: 36px; background: #e2e8f0; flex-shrink: 0; }
        .mg-input {
          font-size: 13px; padding: 6px 10px;
          border: 1px solid #e2e8f0; border-radius: 6px;
          background: #f8fafc; color: #0f172a; outline: none;
          transition: border-color 0.15s;
        }
        .mg-input:focus { border-color: #3b82f6; }
        /* Play controls */
        .mg-play-controls { display: flex; align-items: center; gap: 8px; }
        .mg-ctrl-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 7px 14px; font-size: 12px; font-weight: 500;
          border: 1px solid #e2e8f0; border-radius: 6px;
          background: #f8fafc; color: #334155; cursor: pointer;
          transition: all 0.15s;
        }
        .mg-ctrl-btn:hover { border-color: #94a3b8; background: #f1f5f9; }
        .mg-ctrl-btn.primary { background: #1d4ed8; color: #fff; border-color: #1d4ed8; }
        .mg-ctrl-btn.primary:hover { background: #1e40af; }
        .mg-ctrl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        /* Scrubber */
        .mg-scrubber-wrap { margin-bottom: 0.875rem; }
        .mg-scrubber-track {
          position: relative; height: 4px;
          background: #e2e8f0; border-radius: 99px;
          margin: 0 8px;
        }
        .mg-scrubber-fill {
          position: absolute; left: 0; top: 0; height: 100%;
          background: #3b82f6; border-radius: 99px;
          transition: width 0.3s ease;
        }
        .mg-scrubber-dot {
          position: absolute; top: 50%; transform: translate(-50%, -50%);
          width: 10px; height: 10px; border-radius: 50%;
          background: #cbd5e1; border: 2px solid #fff;
          cursor: pointer; transition: all 0.15s; padding: 0;
        }
        .mg-scrubber-dot.past { background: #93c5fd; }
        .mg-scrubber-dot.active { background: #1d4ed8; width: 14px; height: 14px; box-shadow: 0 0 0 3px #bfdbfe; }
        .mg-scrubber-labels { display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; color: #94a3b8; }
        /* Metric strip */
        .mg-metric-strip {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
          margin-bottom: 0.875rem;
        }
        .mg-metric-card {
          background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
          padding: 10px 14px;
        }
        .mg-metric-label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
        .mg-metric-val { font-size: 20px; font-weight: 600; color: #0f172a; }
        .text-green { color: #16a34a; }
        .text-red { color: #dc2626; }
        .text-amber { color: #b45309; }
        .text-blue { color: #1d4ed8; }
        /* Expiry banner */
        .mg-expiry-banner {
          background: #fef3c7; border: 1px solid #fcd34d;
          border-radius: 8px; padding: 10px 16px;
          font-size: 13px; color: #78350f;
          margin-bottom: 0.875rem;
        }
        /* Main grid */
        .mg-main-grid {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 0.875rem;
          align-items: start;
        }
        /* Chain */
        .mg-chain-card { padding: 0; overflow: hidden; }
        .mg-chain-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0.875rem 1.25rem 0.625rem;
        }
        .mg-chain-header .mg-section-label { margin-bottom: 0; }
        .mg-chain-meta { display: flex; gap: 8px; align-items: center; }
        .mg-tag {
          font-size: 11px; color: #64748b;
          background: #f1f5f9; padding: 2px 8px; border-radius: 99px;
        }
        .mg-badge {
          font-size: 11px; font-weight: 500;
          padding: 2px 8px; border-radius: 99px;
        }
        .mg-badge.green { background: #dcfce7; color: #15803d; }
        .mg-badge.red { background: #fee2e2; color: #b91c1c; }
        .mg-badge.amber { background: #fef3c7; color: #92400e; }
        .mg-badge.blue { background: #dbeafe; color: #1e40af; }
        .mg-chain-scroll { overflow-x: auto; }
        .mg-chain-table {
          width: 100%; border-collapse: collapse; font-size: 13px; min-width: 600px;
        }
        .mg-chain-table th {
          font-size: 11px; font-weight: 600; padding: 7px 10px;
          text-align: center; border-bottom: 1px solid #e2e8f0;
        }
        .call-header { background: #f0fdf4; color: #15803d; }
        .strike-header { background: #fef3c7; color: #92400e; }
        .put-header { background: #fef2f2; color: #b91c1c; }
        .subhead th { background: #f8fafc; color: #64748b; font-size: 11px; }
        .mg-chain-table td {
          padding: 8px 10px; text-align: center;
          border-bottom: 1px solid #f1f5f9;
        }
        .mg-chain-table tr:last-child td { border-bottom: none; }
        .mg-chain-table tr:hover td { background: #f8fafc; }
        .atm-row td { background: #fffbeb !important; }
        .atm-row:hover td { background: #fef3c7 !important; }
        .strike-cell { font-weight: 600; background: #f8fafc; }
        .strike-cell.atm { background: #fcd34d !important; color: #78350f; }
        .ltp-call { color: #15803d; font-weight: 500; }
        .ltp-put { color: #b91c1c; font-weight: 500; }
        .delta { color: #1d4ed8; }
        .action-btn {
          padding: 3px 10px; font-size: 12px; font-weight: 600;
          border-radius: 4px; cursor: pointer; border: 1px solid;
          transition: all 0.1s;
        }
        .action-btn.buy { background: #dcfce7; color: #15803d; border-color: #86efac; }
        .action-btn.buy:hover { background: #bbf7d0; }
        .action-btn.sell { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }
        .action-btn.sell:hover { background: #fecaca; }
        .mg-chain-footer {
          padding: 8px 1.25rem; font-size: 11px; color: #94a3b8;
          border-top: 1px solid #f1f5f9;
        }
        /* Right panel */
        .mg-right-panel { display: flex; flex-direction: column; gap: 0.875rem; }
        .mg-greeks-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
        }
        .mg-greek-item {
          background: #f8fafc; border-radius: 6px; padding: 8px 12px;
        }
        .mg-greek-label { font-size: 11px; color: #64748b; margin-bottom: 2px; }
        .mg-greek-val { font-size: 16px; font-weight: 600; color: #0f172a; }
        .mg-greek-val.blue { color: #1d4ed8; }
        .mg-greek-val.red { color: #dc2626; }
        /* Positions */
        .mg-no-positions { font-size: 12px; color: #94a3b8; padding: 8px 0; text-align: center; }
        .mg-pos-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 0; border-bottom: 1px solid #f1f5f9; gap: 8px;
        }
        .mg-pos-row:last-of-type { border-bottom: none; }
        .mg-pos-left { display: flex; align-items: center; gap: 6px; }
        .mg-pos-right { display: flex; align-items: center; gap: 8px; }
        .mg-pos-strike { font-size: 13px; font-weight: 600; }
        .mg-pos-meta { font-size: 11px; color: #94a3b8; }
        .mg-pos-price-change { display: flex; flex-direction: column; font-size: 10px; color: #94a3b8; }
        .mg-pos-pnl { font-size: 13px; font-weight: 600; min-width: 70px; text-align: right; }
        .mg-pos-pnl.pos { color: #16a34a; }
        .mg-pos-pnl.neg { color: #dc2626; }
        .mg-sq-btn {
          font-size: 11px; color: #94a3b8; background: none;
          border: 1px solid #e2e8f0; border-radius: 4px;
          padding: 2px 6px; cursor: pointer;
        }
        .mg-sq-btn:hover { color: #dc2626; border-color: #fca5a5; }
        .mg-net-pnl {
          display: flex; justify-content: space-between;
          padding-top: 10px; margin-top: 4px;
          border-top: 1px solid #e2e8f0;
          font-size: 14px; font-weight: 600;
        }
        .mg-net-pnl .pos { color: #16a34a; }
        .mg-net-pnl .neg { color: #dc2626; }
        /* OHLC */
        .mg-ohlc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .mg-ohlc-label { font-size: 11px; color: #64748b; margin-bottom: 2px; }
        .mg-ohlc-val { font-size: 14px; font-weight: 500; }
        /* Empty state */
        .mg-empty-state {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; padding: 3rem 1rem; color: #94a3b8; font-size: 14px;
          text-align: center;
        }
        /* Responsive */
        @media (max-width: 1100px) {
          .mg-main-grid { grid-template-columns: 1fr; }
          .mg-metric-strip { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 700px) {
          .mg-metric-strip { grid-template-columns: repeat(2, 1fr); }
          .mg-topbar { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
