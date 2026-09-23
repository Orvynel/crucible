import type { BacktestResult } from "@shared/backtest";
import { pct, pp, signedClass, verdict } from "../lib/format";
import { EquityChart } from "./EquityChart";

const TONE: Record<string, string> = { pos: "text-pos", neg: "text-neg", muted: "text-muted" };
const GLOW: Record<string, string> = {
  pos: "rgba(87,224,141,0.10)",
  neg: "rgba(255,93,115,0.10)",
  muted: "rgba(255,255,255,0.04)",
};

function Stat({ label, value, cls, sub }: { label: string; value: string; cls?: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface2 px-3.5 py-3">
      <div className="kicker">{label}</div>
      <div className={`mt-1 font-mono text-xl font-semibold tabular-nums ${cls ?? "text-text"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

export function ResultsPanel({ r }: { r: BacktestResult }) {
  const v = verdict(r);

  return (
    <div className="space-y-4">
      <div
        className="card rise relative overflow-hidden p-6"
        style={{ background: `radial-gradient(600px 220px at 82% -40%, ${GLOW[v.tone]}, transparent 70%), var(--surface-1)` }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="kicker">Verdict · {r.horizon}-day hold</span>
            <h2 className={`mt-1.5 text-2xl font-bold tracking-tight ${TONE[v.tone]}`}>{v.label}</h2>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">{v.line}</p>
          </div>
          <div className="text-right">
            <div className={`font-mono text-4xl font-bold tabular-nums ${signedClass(r.edgeHitRate)}`}>
              {pp(r.edgeHitRate)}
            </div>
            <div className="kicker mt-1">hit-rate edge</div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Equity curve</h3>
          <span className="text-xs text-faint">$1 in an equal-weight basket per decision date · log scale</span>
        </div>
        <EquityChart equity={r.equity} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Hit rate"
          value={`${(r.hitRate * 100).toFixed(0)}%`}
          cls={signedClass(r.edgeHitRate)}
          sub={`hold ${(r.baselineHitRate * 100).toFixed(0)}%`}
        />
        <Stat
          label="Median return"
          value={pct(r.medianReturn)}
          cls={signedClass(r.edgeMedianReturn)}
          sub={`hold ${pct(r.baselineMedianReturn)}`}
        />
        <Stat label="Trades" value={`${r.n}`} sub={`of ${r.total} · ${(r.coverage * 100).toFixed(0)}% coverage`} />
        <Stat label="Max drawdown" value={pct(r.maxDrawdown)} cls={signedClass(r.maxDrawdown)} sub="peak to trough" />
      </div>
    </div>
  );
}
