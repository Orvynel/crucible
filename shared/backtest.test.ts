// Pure-engine tests for the backtest core. These lock the invariants the whole
// product rests on: no look-ahead (horizon filtering), outlier-robust headline
// metrics (raw median vs winsorized mean), the equal-weight-basket equity curve,
// and that the "receipts" list can never disagree with the aggregate count.
import { describe, it, expect } from "vitest";
import { backtest, fires, firedScenarios, type Rule } from "./backtest.ts";
import { COHORTS, type Cohort, type CohortFlow, type Dataset, type Scenario } from "./types.ts";

const flow = (net: number): CohortFlow => ({ net_flow_usd: net, avg_flow_usd: net, wallet_count: 1 });

// Build a full six-cohort signal, defaulting every cohort we don't name to zero.
function signal(partial: Partial<Record<Cohort, number>>): Record<Cohort, CohortFlow> {
  const base = {} as Record<Cohort, CohortFlow>;
  for (const c of COHORTS) base[c] = flow(partial[c] ?? 0);
  return base;
}

function scenario(opts: {
  id: string;
  as_of: string;
  flows?: Partial<Record<Cohort, number>>;
  forward: Record<string, number>;
  maxDD?: number;
}): Scenario {
  return {
    id: opts.id,
    token: { chain: "ethereum", token_address: "0xtest", symbol: "TST" },
    as_of: opts.as_of,
    signal: signal(opts.flows ?? {}),
    price_at_as_of: 1,
    outcome: { forward_return: opts.forward, max_drawdown: opts.maxDD ?? 0 },
    provenance: { flow_window_days: 7, fetched_at: "2024-01-01T00:00:00Z" },
  };
}

const dataset = (scenarios: Scenario[], horizons = [1, 3, 7, 14, 30]): Dataset => ({
  version: "test",
  built_at: "2024-01-01T00:00:00Z",
  horizons,
  flow_window_days: 7,
  tokens: [{ chain: "ethereum", token_address: "0xtest", symbol: "TST" }],
  scenarios,
  meta: { api_calls_made: 0, credits_spent: 0, source: "Nansen API" },
});

const rule = (partial: Partial<Rule>): Rule => ({ conditions: [], combine: "all", horizon: 7, ...partial });

describe("fires", () => {
  const s = scenario({
    id: "s",
    as_of: "2024-01-01",
    flows: { smart_trader: 2_000_000, whale: -1_000_000 },
    forward: { "7": 0.1 },
  });

  it("an empty rule fires on everything", () => {
    expect(fires(rule({}), s)).toBe(true);
  });

  it("honors the gt and lt operators against the threshold", () => {
    expect(fires(rule({ conditions: [{ cohort: "smart_trader", op: "gt", value: 1_000_000 }] }), s)).toBe(true);
    expect(fires(rule({ conditions: [{ cohort: "smart_trader", op: "gt", value: 3_000_000 }] }), s)).toBe(false);
    expect(fires(rule({ conditions: [{ cohort: "whale", op: "lt", value: -500_000 }] }), s)).toBe(true);
  });

  it("treats a cohort absent from the signal as zero net flow (defensive ?? 0)", () => {
    const bare = scenario({ id: "bare", as_of: "2024-01-01", forward: { "7": 0.1 } });
    const holed = { ...bare, signal: {} as Record<Cohort, CohortFlow> };
    expect(fires(rule({ conditions: [{ cohort: "whale", op: "gt", value: 0 }] }), holed)).toBe(false);
    expect(fires(rule({ conditions: [{ cohort: "whale", op: "lt", value: 1 }] }), holed)).toBe(true);
  });

  it("combines multiple conditions with all vs any", () => {
    const conds = [
      { cohort: "smart_trader" as Cohort, op: "gt" as const, value: 1_000_000 }, // true
      { cohort: "whale" as Cohort, op: "gt" as const, value: 0 }, // false: whale is -1M
    ];
    expect(fires(rule({ conditions: conds, combine: "all" }), s)).toBe(false);
    expect(fires(rule({ conditions: conds, combine: "any" }), s)).toBe(true);
  });
});

describe("backtest", () => {
  // 3 scenarios fire (public_figure net inflow > $1M), 2 don't; all have a 7d outcome.
  const ds = dataset([
    scenario({ id: "S1", as_of: "2024-01-01", flows: { public_figure: 2_000_000 }, forward: { "7": 0.1 } }),
    scenario({ id: "S2", as_of: "2024-01-02", flows: { public_figure: 2_000_000 }, forward: { "7": 0.2 } }),
    scenario({ id: "S3", as_of: "2024-01-03", flows: { public_figure: 2_000_000 }, forward: { "7": -0.05 } }),
    scenario({ id: "S4", as_of: "2024-01-04", forward: { "7": 0.5 } }),
    scenario({ id: "S5", as_of: "2024-01-05", forward: { "7": -0.3 } }),
  ]);
  const pf = rule({ conditions: [{ cohort: "public_figure", op: "gt", value: 1_000_000 }], horizon: 7 });

  it("scores hit rate, median, coverage and the edge vs the always-in baseline", () => {
    const r = backtest(pf, ds);
    expect(r.total).toBe(5);
    expect(r.n).toBe(3);
    expect(r.coverage).toBeCloseTo(0.6, 10);
    expect(r.hitRate).toBeCloseTo(2 / 3, 10); // 0.10, 0.20 up; -0.05 down
    expect(r.medianReturn).toBeCloseTo(0.1, 10);
    expect(r.baselineHitRate).toBeCloseTo(0.6, 10); // 3 of 5 scenarios up
    expect(r.baselineMedianReturn).toBeCloseTo(0.1, 10);
    expect(r.edgeHitRate).toBeCloseTo(2 / 3 - 0.6, 10);
    expect(r.edgeMedianReturn).toBeCloseTo(0, 10);
  });

  it("reports a raw median but a winsorized mean, so one moonshot can't fake an edge", () => {
    const wds = dataset([
      scenario({ id: "A", as_of: "2024-01-01", forward: { "7": 5.0 } }), // +500% -> winsor caps at +200%
      scenario({ id: "B", as_of: "2024-01-02", forward: { "7": 1.0 } }),
    ]);
    const r = backtest(rule({ horizon: 7 }), wds);
    expect(r.medianReturn).toBeCloseTo(3.0, 10); // (1.0 + 5.0) / 2, untouched by winsor
    expect(r.avgReturn).toBeCloseTo(1.5, 10); // (2.0 + 1.0) / 2, capped
    expect(r.hitRate).toBeCloseTo(1, 10);
  });

  it("excludes scenarios with no finite return at the horizon (no look-ahead leak)", () => {
    const hds = dataset([
      scenario({ id: "has30", as_of: "2024-01-01", forward: { "30": 0.2 } }),
      scenario({ id: "no30", as_of: "2024-01-02", forward: { "7": 0.1 } }), // wrong horizon
      scenario({ id: "inf30", as_of: "2024-01-03", forward: { "30": Infinity } }), // non-finite
    ]);
    const r = backtest(rule({ horizon: 30 }), hds);
    expect(r.total).toBe(1);
    expect(r.n).toBe(1);
  });

  it("builds a chronological equal-weight-basket equity curve and its max drawdown", () => {
    const eds = dataset([
      scenario({ id: "d1a", as_of: "2024-01-01", forward: { "7": 0.1 } }),
      scenario({ id: "d1b", as_of: "2024-01-01", forward: { "7": -0.3 } }), // same date -> basket avg -0.10
      scenario({ id: "d2", as_of: "2024-01-02", forward: { "7": 0.5 } }),
    ]);
    const r = backtest(rule({ horizon: 7 }), eds);
    expect(r.equity).toHaveLength(2); // one point per decision date
    expect(r.equity[0].value).toBeCloseTo(0.9, 10); // 1 * (1 - 0.10)
    expect(r.equity[1].value).toBeCloseTo(1.35, 10); // 0.9 * (1 + 0.50)
    expect(r.maxDrawdown).toBeCloseTo(-0.1, 10);
  });

  it("returns safe zeros for an empty dataset instead of NaN", () => {
    const r = backtest(rule({ horizon: 7 }), dataset([]));
    expect(r.total).toBe(0);
    expect(r.n).toBe(0);
    expect(r.coverage).toBe(0);
    expect(r.hitRate).toBe(0);
    expect(r.medianReturn).toBe(0);
    expect(r.equity).toHaveLength(0);
    expect(r.maxDrawdown).toBe(0);
  });
});

describe("firedScenarios", () => {
  it("returns exactly the trades behind backtest().n, and only usable ones", () => {
    const ds = dataset([
      scenario({ id: "S1", as_of: "2024-01-01", flows: { public_figure: 2_000_000 }, forward: { "7": 0.1 } }),
      scenario({ id: "S2", as_of: "2024-01-02", flows: { public_figure: 2_000_000 }, forward: { "7": 0.2 } }),
      scenario({ id: "S3", as_of: "2024-01-03", flows: { public_figure: 0 }, forward: { "7": -0.05 } }), // no fire
      scenario({ id: "S4", as_of: "2024-01-04", flows: { public_figure: 2_000_000 }, forward: { "3": 0.9 } }), // no 7d
    ]);
    const pf = rule({ conditions: [{ cohort: "public_figure", op: "gt", value: 1_000_000 }], horizon: 7 });
    const fired = firedScenarios(pf, ds);
    expect(fired.map((s) => s.id)).toEqual(["S1", "S2"]);
    expect(fired).toHaveLength(backtest(pf, ds).n);
    expect(fired.every((s) => fires(pf, s))).toBe(true);
  });
});
