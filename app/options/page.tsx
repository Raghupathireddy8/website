"use client";

import { useState, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NiftyRow {
  dateStr: string;   // raw string from CSV e.g. "Nov 14, 2024"
  dateObj: Date;
  price: number;
  open: number;
  high: number;
  low: number;
  change: number;
}

interface VixRow {
  dateObj: Date;
  price: number;
}

interface Position {
  id: string;
  type: "CE" | "PE";
  side: "BUY" | "SELL";
  strike: number;
  entryPrice: number;
  lots: number;
}

interface Greeks {
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

// ─── Constants ────────────────────────────────────────────────────────────────

const LOT_SIZE = 65;

// ─── Black-Scholes ────────────────────────────────────────────────────────────

function normCDF(x: number): number {
  const a1 = 0.319381530, a2 = -0.356563782, a3 = 1.781477937;
  const a4 = -1.821255978, a5 = 1.330274429;
  const k = 1.0 / (1.0 + 0.2316419 * Math.abs(x));
  const poly = k * (a1 + k * (a2 + k * (a3 + k * (a4 + k * a5))));
  const pdf = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const result = 1.0 - pdf * poly;
  return x >= 0 ? result : 1 - result;
}

function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function blackScholes(
  type: "call" | "put",
  S: number, K: number, T: number, r: number, sigma: number
): { price: number; delta: number; theta: number } {
  if (T <= 0.0001) {
    const intrinsic = type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
    return { price: Math.max(intrinsic, 0.05), delta: type === "call" ? (S > K ? 1 : 0) : (S < K ? -1 : 0), theta: 0 };
  }
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const Nd1 = normCDF(d1);
  const Nd2 = normCDF(d2);
  const Nd1neg = normCDF(-d1);
  const Nd2neg = normCDF(-d2);
  const discK = K * Math.exp(-r * T);

  if (type === "call") {
    const price = S * Nd1 - discK * Nd2;
    const delta = Nd1;
    const theta = (-(S * normPDF(d1) * sigma) / (2 * sqrtT) - r * discK * Nd2) / 365;
    return { price: Math.max(price, 0.05), delta, theta };
  } else {
    const price = discK * Nd2neg - S * Nd1neg;
    const delta = Nd1 - 1;
    const theta = (-(S * normPDF(d1) * sigma) / (2 * sqrtT) + r * discK * Nd2neg) / 365;
    return { price: Math.max(price, 0.05), delta, theta };
  }
}

function getIV(vix: number, strike: number, spot: number): number {
  const moneyness = (strike - spot) / spot;
  // simple vol smile: OTM puts higher IV, OTM calls slightly higher too
  let skew = 1.0;
  if (moneyness < -0.01) skew = 1.15;
  else if (moneyness < 0) skew = 1.08;
  else if (moneyness > 0.01) skew = 1.05;
  return (vix / 100) * skew;
}

function computeChain(spot: number, vix: number, daysToExpiry: number): Greeks[] {
  const atm = Math.round(spot / 50) * 50;
  const strikes = [atm - 100, atm - 50, atm, atm + 50, atm + 100];
  const T = Math.max(daysToExpiry, 0) / 365;
  const r = 0.065;

  return strikes.map((K) => {
    const iv = getIV(vix, K, spot);
    const call = blackScholes("call", spot, K, T, r, iv);
    const put  = blackScholes("put",  spot, K, T, r, iv);
    return {
      strike: K,
      callLTP:   +call.price.toFixed(2),
      callIV:    +(iv * 100).toFixed(1),
      callDelta: +call.delta.toFixed(2),
      callTheta: +call.theta.toFixed(2),
      putLTP:    +put.price.toFixed(2),
      putIV:     +(iv * 100).toFixed(1),
      putDelta:  +put.delta.toFixed(2),
      putTheta:  +put.theta.toFixed(2),
    };
  });
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function parseDate(s: string): Date {
  // Handles "Nov 14, 2024", "14-Nov-24", "2024-11-14", "11/14/2024" etc.
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // Try DD-Mon-YY
  const m = s.match(/(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
    return new Date(`${m[2]} ${m[1]}, ${year}`);
  }
  return new Date();
}

function toInputDate(d: Date): string {
  return d.toISOString().split("T")[0]; // "2024-11-14"
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function dteCalc(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function lastThursdayOfMonth(year: number, month: number): Date {
  const last = new Date(year, month + 1, 0);
  while (last.getDay() !== 4) last.setDate(last.getDate() - 1);
  return last;
}

function getExpiryOptions(from: Date) {
  const opts: { label: string; date: Date }[] = [];
  // find next Thursday on or after `from`
  const d = new Date(from);
  const dayOfWeek = d.getDay();
  const daysUntilThursday = dayOfWeek <= 4 ? 4 - dayOfWeek : 11 - dayOfWeek;
  d.setDate(d.getDate() + daysUntilThursday);

  for (let i = 0; i < 5; i++) {
    const lth = lastThursdayOfMonth(d.getFullYear(), d.getMonth());
    const isMonthly = sameDay(d, lth);
    const label = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      + (isMonthly ? " (Monthly)" : " (Weekly)");
    opts.push({ label, date: new Date(d) });
    d.setDate(d.getDate() + 7);
  }
  return opts;
}

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

function parseNiftyCSV(text: string): NiftyRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const rows: NiftyRow[] = [];
  for (const line of lines.slice(1)) {
    // handle quoted fields like "23,532.70"
    const cols: string[] = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    cols.push(cur.trim());

    if (cols.length < 6) continue;
    const parseNum = (s: string) => parseFloat(s.replace(/,/g, "")) || 0;
    const parseChg  = (s: string) => parseFloat(s.replace(/%/g, "").trim()) || 0;
    const dateObj = parseDate(cols[0]);
    if (isNaN(dateObj.getTime())) continue;
    rows.push({
      dateStr: cols[0],
      dateObj,
      price:  parseNum(cols[1]),
      open:   parseNum(cols[2]),
      high:   parseNum(cols[3]),
      low:    parseNum(cols[4]),
      change: parseChg(cols[6] ?? cols[5]),
    });
  }
  // Sort ascending (oldest first)
  return rows.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
}

function parseVixCSV(text: string): VixRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const rows: VixRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map(c => c.trim().replace(/"/g, ""));
    if (cols.length < 2) continue;
    const dateObj = parseDate(cols[0]);
    if (isNaN(dateObj.getTime())) continue;
    rows.push({ dateObj, price: parseFloat(cols[1].replace(/,/g, "")) || 0 });
  }
  return rows.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
}
function fmtPnL(n: number) {
  return (n >= 0 ? "+" : "") + "₹" + fmtNum(Math.abs(n));
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OptionsReplay() {
  const [niftyRows, setNiftyRows]         = useState<NiftyRow[]>([]);
  const [vixRows, setVixRows]             = useState<VixRow[]>([]);
  const [entryDate, setEntryDate]         = useState("");          // "2024-11-14"
  const [expiryOpts, setExpiryOpts]       = useState<{ label: string; date: Date }[]>([]);
  const [expiryIdx, setExpiryIdx]         = useState(0);
  const [replayDays, setReplayDays]       = useState<NiftyRow[]>([]);
  const [dayIdx, setDayIdx]               = useState(0);
  const [positions, setPositions]         = useState<Position[]>([]);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [speed, setSpeed]                 = useState(1);
  const [started, setStarted]             = useState(false);

  const niftyRef = useRef<HTMLInputElement>(null);
  const vixRef   = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Derived ──
  const today     = replayDays[dayIdx] ?? null;
  const expiry    = expiryOpts[expiryIdx]?.date ?? null;
  const spot      = today?.price ?? 0;
  const daysLeft  = today && expiry ? dteCalc(today.dateObj, expiry) : 0;

  const vixMatch  = today
    ? vixRows.find(v => sameDay(v.dateObj, today.dateObj))
    : null;
  const vix = vixMatch?.price ?? (vixRows[0]?.price ?? 15);

  const chain     = spot > 0 ? computeChain(spot, vix, daysLeft) : [];
  const atm       = spot > 0 ? Math.round(spot / 50) * 50 : 0;

  const getPnL = (pos: Position) => {
    const g = chain.find(g => g.strike === pos.strike);
    if (!g) return 0;
    const cur = pos.type === "CE" ? g.callLTP : g.putLTP;
    const mult = pos.side === "BUY" ? 1 : -1;
    return +((cur - pos.entryPrice) * mult * pos.lots * LOT_SIZE).toFixed(0);
  };

  const totalPnL = positions.reduce((s, p) => s + getPnL(p), 0);

  // ── Rebuild replay days when entry / expiry changes ──
  useEffect(() => {
    if (!entryDate || !niftyRows.length || !expiryOpts.length) return;
    const expD = expiryOpts[expiryIdx]?.date;
    if (!expD) return;
    const entryD = new Date(entryDate);
    const days = niftyRows.filter(r =>
      r.dateObj >= entryD && r.dateObj <= expD
    );
    setReplayDays(days);
    setDayIdx(0);
    setPositions([]);
    setStarted(false);
    setIsPlaying(false);
  }, [entryDate, expiryIdx, niftyRows, expiryOpts]);

  // ── Rebuild expiry options when entry date changes ──
  useEffect(() => {
    if (!entryDate) return;
    const d = new Date(entryDate);
    if (isNaN(d.getTime())) return;
    const opts = getExpiryOptions(d);
    setExpiryOpts(opts);
    setExpiryIdx(0);
  }, [entryDate]);

  // ── Auto-play ──
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isPlaying) return;
    const ms = Math.round(1200 / speed);
    timerRef.current = setInterval(() => {
      setDayIdx(prev => {
        if (prev >= replayDays.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, ms);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, speed, replayDays.length]);

  // ── File handlers ──
  const loadNifty = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = parseNiftyCSV(ev.target?.result as string);
      setNiftyRows(rows);
      if (rows.length && !entryDate) {
        // default to first date
        setEntryDate(toInputDate(rows[0].dateObj));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const loadVix = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setVixRows(parseVixCSV(ev.target?.result as string));
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Actions ──
  const handleTrade = (type: "CE" | "PE", strike: number, side: "BUY" | "SELL") => {
    if (!started || !today) return;
    const g = chain.find(g => g.strike === strike);
    if (!g) return;
    const entryPrice = type === "CE" ? g.callLTP : g.putLTP;
    setPositions(prev => [...prev, {
      id: `${type}-${strike}-${side}-${Date.now()}`,
      type, side, strike, entryPrice, lots: 1,
    }]);
  };

  const squareOff = (id: string) => setPositions(prev => prev.filter(p => p.id !== id));

  const handleReset = () => {
    setDayIdx(0);
    setPositions([]);
    setIsPlaying(false);
    setStarted(false);
  };

  const handlePlay = () => {
    if (!started) setStarted(true);
    setIsPlaying(true);
  };

  const handleEntryDateChange = (val: string) => {
    setIsPlaying(false);
    setEntryDate(val);
  };

  const progress = replayDays.length > 1
    ? (dayIdx / (replayDays.length - 1)) * 100
    : 0;

  const isExpiry = daysLeft === 0 && started && replayDays.length > 0;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>

      {/* ── Upload Bar ── */}
      <div style={S.card}>
        <div style={S.uploadRow}>
          <span style={S.sectionLabel}>Data Upload</span>
          <button style={S.uploadBtn} onClick={() => niftyRef.current?.click()}>
            ↑ {niftyRows.length > 0 ? `Nifty ✓ (${niftyRows.length} days)` : "Upload Nifty CSV"}
          </button>
          <input ref={niftyRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={loadNifty} />

          <button style={S.uploadBtn} onClick={() => vixRef.current?.click()}>
            ↑ {vixRows.length > 0 ? `VIX ✓ (${vixRows.length} days)` : "Upload India VIX CSV"}
          </button>
          <input ref={vixRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={loadVix} />

          <span style={S.hint}>investing.com format · Date, Price, Open, High, Low, Vol., Change%</span>
        </div>
      </div>

      {niftyRows.length === 0 && (
        <div style={S.emptyState}>
          <div style={{ fontSize: 36 }}>📈</div>
          <p style={{ color: "#64748b", fontSize: 14 }}>Upload Nifty CSV to start the historical replay</p>
        </div>
      )}

      {niftyRows.length > 0 && (
        <>
          {/* ── Control Bar ── */}
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>

              {/* Left controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={S.label}>Entry Date</div>
                  <input
                    type="date"
                    style={S.inputEl}
                    value={entryDate}
                    min={niftyRows.length ? toInputDate(niftyRows[0].dateObj) : undefined}
                    max={niftyRows.length ? toInputDate(niftyRows[niftyRows.length - 1].dateObj) : undefined}
                    onChange={e => handleEntryDateChange(e.target.value)}
                  />
                </div>

                <div style={S.divider} />

                <div>
                  <div style={S.label}>Expiry</div>
                  <select
                    style={S.inputEl}
                    value={expiryIdx}
                    onChange={e => { setIsPlaying(false); setExpiryIdx(Number(e.target.value)); }}
                  >
                    {expiryOpts.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
                  </select>
                </div>

                <div style={S.divider} />

                <div>
                  <div style={S.label}>Data as on</div>
                  <div style={S.val}>{today?.dateStr ?? "—"}</div>
                  {replayDays.length > 0 && (
                    <div style={S.sublabel}>Day {dayIdx + 1} of {replayDays.length}</div>
                  )}
                </div>

                <div style={S.divider} />

                <div>
                  <div style={S.label}>Nifty Spot</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#1d4ed8" }}>
                    {spot > 0 ? fmtNum(spot) : "—"}
                  </div>
                  {today && (
                    <div style={{ fontSize: 11, color: today.change >= 0 ? "#16a34a" : "#dc2626", fontWeight: 500 }}>
                      {today.change >= 0 ? "▲" : "▼"} {Math.abs(today.change).toFixed(2)}%
                    </div>
                  )}
                </div>

                <div>
                  <div style={S.label}>India VIX</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#b45309" }}>{vix.toFixed(2)}</div>
                </div>

                <div>
                  <div style={S.label}>Days to Expiry</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: daysLeft <= 2 ? "#dc2626" : "#0f172a" }}>{daysLeft}</div>
                </div>
              </div>

              {/* Play controls */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button style={S.ctrlBtn} onClick={handleReset}>↺ Reset</button>
                {!isPlaying
                  ? <button style={{ ...S.ctrlBtn, ...S.ctrlBtnPrimary }} onClick={handlePlay} disabled={replayDays.length === 0}>
                      ▶ {started ? "Play" : "Start"}
                    </button>
                  : <button style={S.ctrlBtn} onClick={() => setIsPlaying(false)}>⏸ Pause</button>
                }
                <button
                  style={S.ctrlBtn}
                  disabled={!started || dayIdx >= replayDays.length - 1}
                  onClick={() => { setDayIdx(i => Math.min(i + 1, replayDays.length - 1)); }}
                >
                  ⏭ Next
                </button>
                <select style={{ ...S.inputEl, width: 90 }} value={speed} onChange={e => setSpeed(Number(e.target.value))}>
                  <option value={1}>1× speed</option>
                  <option value={2}>2× speed</option>
                  <option value={5}>5× speed</option>
                </select>
              </div>
            </div>

            {/* Progress scrubber */}
            {replayDays.length > 1 && (
              <div style={{ marginTop: 14, position: "relative" }}>
                <div style={{ height: 4, background: "#e2e8f0", borderRadius: 99, position: "relative", margin: "0 6px" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${progress}%`, background: "#3b82f6", borderRadius: 99, transition: "width 0.3s" }} />
                  {replayDays.map((_, i) => (
                    <button
                      key={i}
                      title={replayDays[i].dateStr}
                      onClick={() => { setStarted(true); setIsPlaying(false); setDayIdx(i); }}
                      style={{
                        position: "absolute",
                        left: `${(i / (replayDays.length - 1)) * 100}%`,
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: i === dayIdx ? 14 : 8,
                        height: i === dayIdx ? 14 : 8,
                        borderRadius: "50%",
                        background: i === dayIdx ? "#1d4ed8" : i < dayIdx ? "#93c5fd" : "#cbd5e1",
                        border: i === dayIdx ? "2px solid #fff" : "none",
                        boxShadow: i === dayIdx ? "0 0 0 3px #bfdbfe" : "none",
                        cursor: "pointer",
                        padding: 0,
                        transition: "all 0.15s",
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
                  <span>{replayDays[0]?.dateStr}</span>
                  <span>{replayDays[replayDays.length - 1]?.dateStr}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Metric Strip ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 14 }}>
            {[
              { label: "ATM Strike",      val: atm > 0 ? fmtNum(atm) : "—",        color: "" },
              { label: "Days to Expiry",  val: String(daysLeft),                    color: daysLeft <= 2 ? "#dc2626" : "" },
              { label: "Total P&L",       val: positions.length ? fmtPnL(totalPnL) : "—", color: totalPnL >= 0 ? "#16a34a" : "#dc2626" },
              { label: "Open Positions",  val: String(positions.length),            color: "" },
              { label: "Margin Used",     val: positions.length ? "₹" + fmtNum(positions.length * 48000) : "—", color: "" },
              { label: "India VIX",       val: vix.toFixed(2),                      color: "#b45309" },
            ].map(m => (
              <div key={m.label} style={S.metricCard}>
                <div style={S.metricLabel}>{m.label}</div>
                <div style={{ ...S.metricVal, color: m.color || "#0f172a" }}>{m.val}</div>
              </div>
            ))}
          </div>

          {/* ── Expiry Banner ── */}
          {isExpiry && (
            <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#78350f", marginBottom: 14 }}>
              🎯 <strong>Expiry Day!</strong> Options settle at intrinsic value. Final P&L: <strong>{fmtPnL(totalPnL)}</strong>
            </div>
          )}

          {/* ── Not started hint ── */}
          {!started && replayDays.length > 0 && (
            <div style={S.emptyState}>
              <div style={{ fontSize: 32 }}>▶️</div>
              <p style={{ color: "#64748b", fontSize: 14 }}>
                Click <strong>Start</strong> to begin the replay. Buy/sell options as the market unfolds day by day.
              </p>
            </div>
          )}

          {/* ── Main Content (chain + right panel) ── */}
          {started && spot > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 310px", gap: 14, alignItems: "start" }}>

              {/* Options Chain */}
              <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px 8px" }}>
                  <span style={S.sectionLabel}>Options Chain</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={S.tag}>1 lot = {LOT_SIZE} units</span>
                    <span style={{ ...S.badge, background: "#fef3c7", color: "#92400e" }}>
                      {expiryOpts[expiryIdx]?.label.includes("Monthly") ? "Monthly" : "Weekly"} Expiry
                    </span>
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 600 }}>
                    <thead>
                      <tr>
                        <th colSpan={5} style={{ ...S.th, background: "#f0fdf4", color: "#15803d" }}>— CALL —</th>
                        <th style={{ ...S.th, background: "#fef3c7", color: "#92400e" }}>Strike</th>
                        <th colSpan={5} style={{ ...S.th, background: "#fef2f2", color: "#b91c1c" }}>— PUT —</th>
                      </tr>
                      <tr>
                        {["Buy","Sell","LTP","IV","Delta","Strike","Delta","IV","LTP","Sell","Buy"].map((h, i) => (
                          <th key={i} style={{ ...S.th, background: "#f8fafc", color: "#64748b", fontSize: 11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {chain.map(g => {
                        const isATM = g.strike === atm;
                        const rowBg = isATM ? "#fffbeb" : "transparent";
                        return (
                          <tr key={g.strike}>
                            <td style={{ ...S.td, background: rowBg }}>
                              <button style={S.buyBtn} onClick={() => handleTrade("CE", g.strike, "BUY")}>B</button>
                            </td>
                            <td style={{ ...S.td, background: rowBg }}>
                              <button style={S.sellBtn} onClick={() => handleTrade("CE", g.strike, "SELL")}>S</button>
                            </td>
                            <td style={{ ...S.td, background: rowBg, color: "#15803d", fontWeight: 600 }}>{g.callLTP}</td>
                            <td style={{ ...S.td, background: rowBg }}>{g.callIV}%</td>
                            <td style={{ ...S.td, background: rowBg, color: "#1d4ed8" }}>{g.callDelta}</td>
                            <td style={{
                              ...S.td,
                              fontWeight: 700,
                              background: isATM ? "#fcd34d" : "#f8fafc",
                              color: isATM ? "#78350f" : "#0f172a",
                              fontSize: isATM ? 13 : 13,
                            }}>
                              {fmtNum(g.strike)}{isATM ? " ★" : ""}
                            </td>
                            <td style={{ ...S.td, background: rowBg, color: "#1d4ed8" }}>{g.putDelta}</td>
                            <td style={{ ...S.td, background: rowBg }}>{g.putIV}%</td>
                            <td style={{ ...S.td, background: rowBg, color: "#b91c1c", fontWeight: 600 }}>{g.putLTP}</td>
                            <td style={{ ...S.td, background: rowBg }}>
                              <button style={S.sellBtn} onClick={() => handleTrade("PE", g.strike, "SELL")}>S</button>
                            </td>
                            <td style={{ ...S.td, background: rowBg }}>
                              <button style={S.buyBtn} onClick={() => handleTrade("PE", g.strike, "BUY")}>B</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "8px 16px", fontSize: 11, color: "#94a3b8", borderTop: "1px solid #f1f5f9" }}>
                  IV derived from VIX with vol-smile skew · Black-Scholes model · Theta shown per day
                </div>
              </div>

              {/* Right Panel */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* ATM Greeks */}
                <div style={S.card}>
                  <div style={S.sectionLabel}>ATM Greeks</div>
                  {(() => {
                    const g = chain.find(g => g.strike === atm);
                    if (!g) return null;
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[
                          { l: "IV",        v: g.callIV + "%",           c: "" },
                          { l: "Delta CE",  v: g.callDelta.toFixed(2),   c: "#1d4ed8" },
                          { l: "Theta/day", v: g.callTheta.toFixed(2),   c: "#dc2626" },
                          { l: "Delta PE",  v: g.putDelta.toFixed(2),    c: "#dc2626" },
                        ].map(item => (
                          <div key={item.l} style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 12px" }}>
                            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{item.l}</div>
                            <div style={{ fontSize: 17, fontWeight: 700, color: item.c || "#0f172a" }}>{item.v}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Positions */}
                <div style={S.card}>
                  <div style={S.sectionLabel}>Open Positions</div>
                  {positions.length === 0 && (
                    <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "12px 0" }}>
                      Click B or S on the chain to add a position
                    </div>
                  )}
                  {positions.map(pos => {
                    const pnl = getPnL(pos);
                    const g = chain.find(g => g.strike === pos.strike);
                    const cur = g ? (pos.type === "CE" ? g.callLTP : g.putLTP) : 0;
                    return (
                      <div key={pos.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f1f5f9", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            ...S.badge,
                            background: pos.side === "BUY" ? "#dcfce7" : "#fee2e2",
                            color: pos.side === "BUY" ? "#15803d" : "#b91c1c",
                          }}>{pos.side} {pos.type}</span>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{fmtNum(pos.strike)}</span>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>×{LOT_SIZE}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right" }}>
                            <div>Entry: {pos.entryPrice}</div>
                            <div>Now: {cur}</div>
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 13, color: pnl >= 0 ? "#16a34a" : "#dc2626", minWidth: 72, textAlign: "right" }}>
                            {fmtPnL(pnl)}
                          </span>
                          <button onClick={() => squareOff(pos.id)} style={{ fontSize: 11, border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px 6px", cursor: "pointer", background: "none", color: "#94a3b8" }}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                  {positions.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0", fontSize: 14, fontWeight: 700 }}>
                      <span style={{ color: "#64748b" }}>Net P&L</span>
                      <span style={{ color: totalPnL >= 0 ? "#16a34a" : "#dc2626" }}>{fmtPnL(totalPnL)}</span>
                    </div>
                  )}
                </div>

                {/* OHLC */}
                {today && (
                  <div style={S.card}>
                    <div style={S.sectionLabel}>Day OHLC</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        { l: "Open",  v: fmtNum(today.open),  c: "" },
                        { l: "High",  v: fmtNum(today.high),  c: "#16a34a" },
                        { l: "Low",   v: fmtNum(today.low),   c: "#dc2626" },
                        { l: "Close", v: fmtNum(today.price), c: "" },
                      ].map(item => (
                        <div key={item.l} style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 12px" }}>
                          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{item.l}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: item.c || "#0f172a" }}>{item.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Inline Styles ────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    background: "#f1f5f9",
    minHeight: "100vh",
    padding: "1.25rem",
    color: "#0f172a",
    boxSizing: "border-box",
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "1rem 1.25rem",
    marginBottom: 14,
  },
  uploadRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  uploadBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 500,
    border: "1px dashed #94a3b8",
    borderRadius: 6,
    background: "#f8fafc",
    color: "#334155",
    cursor: "pointer",
  },
  hint: { fontSize: 11, color: "#94a3b8" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#64748b",
    display: "block",
    marginBottom: 10,
  },
  label:    { fontSize: 11, color: "#64748b", marginBottom: 3 },
  val:      { fontSize: 14, fontWeight: 600, color: "#0f172a" },
  sublabel: { fontSize: 11, color: "#94a3b8", marginTop: 1 },
  divider:  { width: 1, height: 36, background: "#e2e8f0", flexShrink: 0 },
  inputEl: {
    fontSize: 13,
    padding: "6px 10px",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    background: "#f8fafc",
    color: "#0f172a",
    outline: "none",
  },
  ctrlBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 500,
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    background: "#f8fafc",
    color: "#334155",
    cursor: "pointer",
  },
  ctrlBtnPrimary: {
    background: "#1d4ed8",
    color: "#fff",
    borderColor: "#1d4ed8",
  },
  metricCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "10px 14px",
  },
  metricLabel: { fontSize: 11, color: "#64748b", marginBottom: 4 },
  metricVal:   { fontSize: 20, fontWeight: 700 },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "3rem 1rem",
    textAlign: "center",
  },
  th: {
    fontSize: 12,
    fontWeight: 600,
    padding: "7px 10px",
    textAlign: "center",
    borderBottom: "1px solid #e2e8f0",
  },
  td: {
    padding: "9px 10px",
    textAlign: "center",
    borderBottom: "1px solid #f1f5f9",
  },
  buyBtn: {
    padding: "3px 10px",
    fontSize: 12,
    fontWeight: 700,
    borderRadius: 4,
    cursor: "pointer",
    border: "1px solid #86efac",
    background: "#dcfce7",
    color: "#15803d",
  },
  sellBtn: {
    padding: "3px 10px",
    fontSize: 12,
    fontWeight: 700,
    borderRadius: 4,
    cursor: "pointer",
    border: "1px solid #fca5a5",
    background: "#fee2e2",
    color: "#b91c1c",
  },
  tag: {
    fontSize: 11,
    color: "#64748b",
    background: "#f1f5f9",
    padding: "2px 8px",
    borderRadius: 99,
  },
  badge: {
    fontSize: 11,
    fontWeight: 500,
    padding: "2px 8px",
    borderRadius: 99,
  },
};
