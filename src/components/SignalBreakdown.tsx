import { useMemo } from "react";
import type { Dataset } from "@shared/types";
import type { Rule } from "@shared/backtest";
import { firedScenarios } from "@shared/backtest";
import { COHORT_LABEL } from "../lib/presets";
import { pct, signedClass, usdCompact } from "../lib/format";

// The summary of the receipts: how many trades the signal actually fired, how
// they split win/loss, how much Smart Money money stood behind them, and the
// single best and worst outcome. All from the fired scenarios — no new data.
export function SignalBreakdown({ rule, dataset }: { rule: Rule; dataset: Dataset }) {
  const cohort = rule.conditions[0]?.cohort ?? "smart_trader";
  const hz = String(rule.horizon);

  const s = useMemo(() => {
    const fired = firedScenarios(rule, dataset);
    const rows = fired.map((sc) => ({
      sc,
      ret: sc.outcome.forward_return[hz],
      flow: sc.signal[cohort]?.net_flow_usd ?? 0,
      wallets: sc.signal[cohort]?.wallet_count ?? 0,
    }));
    const rets = rows.map((r) => r.ret);
    const wins = rets.filter((r) => r > 0).length;
    const losses = rets.filter((r) => r < 0).length;
    const totalFlow = rows.reduce((a, r) => a + r.flow, 0);
    const totalWallets = rows.reduce((a, r) => a + r.wallets, 0);
    let best: (typeof rows)[number] | null = null;
    let worst: (typeof rows)[number] | null = null;
    for (const r of rows) {
      if (!best || r.ret > best.ret) best = r;
      if (!worst || r.ret < worst.ret) worst = r;
    }
    return {
      n: rows.length,
      wins,
      losses,
      totalFlow,
      avgFlow: rows.length ? totalFlow / rows.length : 0,
      avgWallets: rows.length ? totalWallets / rows.length : 0,
      best,
      worst,
    };
  }, [rule, dataset, cohort, hz]);

  if (s.n === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Cell label="Trades fired" value={String(s.n)} sub={`${COHORT_LABEL[cohort]} signal`} />
      <Cell
        label="Win / loss"
        value={`${s.wins} / ${s.losses}`}
        sub={`${((s.wins / s.n) * 100).toFixed(0)}% closed up`}
      />
      <Cell label="Avg wallets / signal" value={s.avgWallets.toFixed(1)} sub="in the triggering cohort" />
      <Cell label="Net flow behind signal" value={usdCompact(s.totalFlow)} sub={`${usdCompact(s.avgFlow)} avg / trade`} />
      <Cell
        label="Best single trade"
        value={pct(s.best?.ret ?? 0)}
        valueCls={signedClass(s.best?.ret ?? 0)}
        sub={s.best ? `${s.best.sc.token.symbol} · ${s.best.sc.as_of}` : ""}
      />
      <Cell
        label="Worst single trade"
        value={pct(s.worst?.ret ?? 0)}
        valueCls={signedClass(s.worst?.ret ?? 0)}
        sub={s.worst ? `${s.worst.sc.token.symbol} · ${s.worst.sc.as_of}` : ""}
      />
    </div>
  );
}

function Cell({
  label,
  value,
  valueCls,
  sub,
}: {
  label: string;
  value: string;
  valueCls?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-line bg-[var(--surface-2)] px-4 py-[15px]">
      <div className="text-[11px] font-medium leading-tight text-faint">{label}</div>
      <div className={`nums mt-2 text-[20px] font-bold leading-none tabular-nums ${valueCls ?? "text-text"}`}>
        {value}
      </div>
      {sub && <div className="mt-1.5 truncate text-[11px] text-faint">{sub}</div>}
    </div>
  );
}
