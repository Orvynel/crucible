// The backtest engine. Pure functions, zero dependencies — runs identically in
// the offline builder and in the browser. No look-ahead: a scenario's `signal`
// is measured strictly before `as_of`, its `outcome.forward_return` strictly
// after, so evaluating a rule here can never peek at the future.

import type { Cohort, Dataset, Scenario } from "./types.ts";

export type Op = "gt" | "lt";

/** One clause: a cohort's net USD flow is above/below a threshold. */
export interface Condition {
  cohort: Cohort;
  op: Op;
  /** Threshold in USD (e.g. 1_000_000 = $1M net inflow). */
  value: number;
}

export interface Rule {
  conditions: Condition[];
  combine: "all" | "any";
  /** Forward horizon in days; must be one of dataset.horizons. */
  horizon: number;
}

export interface BacktestResult {
  horizon: number;
  total: number; // scenarios considered
  n: number; // scenarios where the rule fired
  coverage: number; // n / total
  hitRate: number; // fraction of fired trades with forward return > 0
  medianReturn: number; // robust central return of fired trades
  avgReturn: number; // mean of WINSORIZED fired returns (see WINSOR)
  equity: EquityPoint[]; // cumulative growth over fired trades (winsorized), time-ordered
  maxDrawdown: number; // most negative peak-to-trough of the equity curve (<= 0)
  baselineHitRate: number; // same horizon, ALL scenarios ("always in")
  baselineMedianReturn: number;
  baselineAvgReturn: number;
  edgeHitRate: number; // hitRate - baselineHitRate (primary, robust to outliers)
  edgeMedianReturn: number; // medianReturn - baselineMedianReturn (robust)
  edgeReturn: number; // avgReturn - baselineAvgReturn (winsorized means)
}

// Crypto forward returns are ferociously fat-tailed: a single memecoin in this
// universe ran +86,000% in a week, which alone drags the raw mean to absurdity
// (mean 7d ≈ +88% vs median ≈ 0%). Hit rate and median are reported untouched
// because they are outlier-robust. Any MEAN or COMPOUNDED figure (avg return,
// equity curve) is computed on returns winsorized to this band so one lottery
// ticket can't masquerade as edge. Stated plainly in the app's method note.
const WINSOR_LO = -0.95;
const WINSOR_HI = 2.0;
const winsor = (r: number): number => Math.max(WINSOR_LO, Math.min(WINSOR_HI, r));

export interface EquityPoint {
  as_of: string;
  value: number; // starts at 1.0
}

function clause(cond: Condition, s: Scenario): boolean {
  const v = s.signal[cond.cohort]?.net_flow_usd ?? 0;
  return cond.op === "gt" ? v > cond.value : v < cond.value;
}

export function fires(rule: Rule, s: Scenario): boolean {
  if (rule.conditions.length === 0) return true;
  const results = rule.conditions.map((c) => clause(c, s));
  return rule.combine === "all" ? results.every(Boolean) : results.some(Boolean);
}

function fwd(s: Scenario, horizon: number): number | null {
  const r = s.outcome.forward_return[String(horizon)];
  return typeof r === "number" && Number.isFinite(r) ? r : null;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function hit(xs: number[]): number {
  return xs.length ? xs.filter((r) => r > 0).length / xs.length : 0;
}

/**
 * Equity curve. Trades that share an `as_of` are the same decision — you can't
 * put 100% of capital into each of them in turn — so we compound an EQUAL-WEIGHT
 * basket per decision date: on each date, average the (winsorized) forward
 * returns of everything the rule flagged, then chain those dates chronologically.
 * That's an executable strategy (diversify across the day's picks, hold, repeat)
 * and it stops one token's run from compounding into a fantasy number.
 */
function equityCurve(trades: { as_of: string; r: number }[]): {
  equity: EquityPoint[];
  maxDrawdown: number;
} {
  const byDate = new Map<string, number[]>();
  for (const t of trades) {
    const arr = byDate.get(t.as_of) ?? [];
    arr.push(winsor(t.r));
    byDate.set(t.as_of, arr);
  }
  const dates = [...byDate.keys()].sort((a, b) => a.localeCompare(b));
  const equity: EquityPoint[] = [];
  let value = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (const d of dates) {
    const rs = byDate.get(d) as number[];
    const basket = rs.reduce((a, b) => a + b, 0) / rs.length;
    value *= 1 + basket;
    peak = Math.max(peak, value);
    maxDrawdown = Math.min(maxDrawdown, value / peak - 1);
    equity.push({ as_of: d, value });
  }
  return { equity, maxDrawdown };
}

/**
 * The exact scenarios a rule fired on at its horizon — the trades behind the
 * numbers. Uses the SAME filter the backtest does (usable at the horizon AND
 * fires), so the receipts list can never disagree with the aggregates.
 */
export function firedScenarios(rule: Rule, dataset: Dataset): Scenario[] {
  return dataset.scenarios.filter((s) => fwd(s, rule.horizon) !== null && fires(rule, s));
}

/**
 * Run a rule against every scenario in the dataset and score it against the
 * "always in" baseline at the same horizon. The edge fields answer the only
 * question that matters: does the Smart Money signal beat doing nothing?
 */
export function backtest(rule: Rule, dataset: Dataset): BacktestResult {
  const usable = dataset.scenarios.filter((s) => fwd(s, rule.horizon) !== null);

  const firedTrades: { as_of: string; r: number }[] = [];
  const allReturns: number[] = [];
  for (const s of usable) {
    const r = fwd(s, rule.horizon) as number;
    allReturns.push(r);
    if (fires(rule, s)) firedTrades.push({ as_of: s.as_of, r });
  }

  const firedReturns = firedTrades.map((t) => t.r);
  const { equity, maxDrawdown } = equityCurve(firedTrades);

  const hitRate = hit(firedReturns);
  const medianReturn = median(firedReturns);
  const avgReturn = mean(firedReturns.map(winsor));
  const baselineHitRate = hit(allReturns);
  const baselineMedianReturn = median(allReturns);
  const baselineAvgReturn = mean(allReturns.map(winsor));

  return {
    horizon: rule.horizon,
    total: usable.length,
    n: firedTrades.length,
    coverage: usable.length ? firedTrades.length / usable.length : 0,
    hitRate,
    medianReturn,
    avgReturn,
    equity,
    maxDrawdown,
    baselineHitRate,
    baselineMedianReturn,
    baselineAvgReturn,
    edgeHitRate: hitRate - baselineHitRate,
    edgeMedianReturn: medianReturn - baselineMedianReturn,
    edgeReturn: avgReturn - baselineAvgReturn,
  };
}
