export function pct(x: number, digits = 1): string {
  const s = (x * 100).toFixed(digits);
  return `${x > 0 ? "+" : ""}${s}%`;
}

/** Signed percentage points, e.g. +14pp — for hit-rate deltas. */
export function pp(x: number, digits = 0): string {
  const s = (x * 100).toFixed(digits);
  return `${x > 0 ? "+" : ""}${s}pp`;
}

export function usdCompact(x: number): string {
  const a = Math.abs(x);
  const sign = x < 0 ? "-" : "";
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

/** Full dollars with thousands separators, e.g. $12,340 — for the invest outcome. */
export function usd(x: number): string {
  const sign = x < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(x)).toLocaleString("en-US")}`;
}

export function signedClass(x: number): string {
  return x > 0 ? "text-pos" : x < 0 ? "text-neg" : "text-muted";
}

import type { BacktestResult } from "@shared/backtest";

export interface Verdict {
  label: string;
  tone: "pos" | "neg" | "muted";
  line: string;
}

// Minimum fired trades before a hit-rate delta is worth reading at all.
const MIN_N = 30;
// A hit-rate edge inside ±3pp is statistical noise, not a signal.
const EDGE_BAND = 0.03;

/**
 * Plain-English read of the signal, driven by HIT RATE vs the "always in"
 * baseline — the outlier-robust question "was price higher more often than
 * chance?". Mean returns are too fat-tailed to headline (see backtest WINSOR).
 */
export function verdict(r: BacktestResult): Verdict {
  if (r.n < MIN_N) {
    return {
      label: "Too few trades",
      tone: "muted",
      line: `Only ${r.n} matches — not enough to trust. Loosen the rule.`,
    };
  }
  const e = r.edgeHitRate;
  const base = `Price was up after ${r.horizon}d in ${(r.hitRate * 100).toFixed(0)}% of ${r.n} trades vs ${(r.baselineHitRate * 100).toFixed(0)}% baseline`;
  if (e >= EDGE_BAND) {
    return {
      label: "This signal has an edge",
      tone: "pos",
      line: `${base} — ${pp(e)} better than doing nothing, median return ${pct(r.medianReturn)}.`,
    };
  }
  if (e <= -EDGE_BAND) {
    return {
      label: "Fade this signal",
      tone: "neg",
      line: `${base} — ${pp(e)} worse than doing nothing. Following the crowd hurt here.`,
    };
  }
  return {
    label: "No real edge",
    tone: "muted",
    line: `${base} — ${pp(e)}, inside the noise. Not predictive on its own.`,
  };
}

