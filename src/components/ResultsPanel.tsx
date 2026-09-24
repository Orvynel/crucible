import { useState } from "react";
import type { ReactNode } from "react";
import type { BacktestResult, Rule } from "@shared/backtest";
import { pct, pp, signedClass, usd, verdict } from "../lib/format";
import { describeRule } from "../lib/presets";
import { EquityChart } from "./EquityChart";
import { Hint } from "./Hint";

// Small stroke glyphs give each metric a colored identity, so the grid reads as
// a designed dashboard rather than a wall of white boxes. 18px, color inherited
// from the chip behind them.
const ICON: Record<string, ReactNode> = {
  hit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  ),
  median: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <path d="M3 12h3l3-7 5 15 3-8h4" />
    </svg>
  ),
  trades: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <path d="M12 3.2l8.5 4.8-8.5 4.8L3.5 8z" />
      <path d="M3.5 12.5l8.5 4.8 8.5-4.8" />
    </svg>
  ),
  coverage: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 12V3.5a8.5 8.5 0 0 1 7.4 4.3z" fill="currentColor" stroke="none" />
    </svg>
  ),
  drawdown: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <path d="M3 7l6 6 4-4 8 8" />
      <path d="M21 15v4h-4" />
    </svg>
  ),
  baseline: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <path d="M6 4v16" />
      <path d="M6 5h10.5l-2.4 3.4L16.5 12H6" />
    </svg>
  ),
};
// Each KPI tints by its own sign (mint = edge, rose = fade, violet = noise); the
// four supporting stats each own a calm hue so no two cards look alike.
const KPI_TINT: Record<string, { bg: string; fg: string; chip: string }> = {
  pos: { bg: "linear-gradient(155deg, var(--pos-soft), #ffffff 72%)", fg: "var(--pos)", chip: "rgba(21,157,99,0.16)" },
  neg: { bg: "linear-gradient(155deg, var(--neg-soft), #ffffff 72%)", fg: "var(--neg)", chip: "rgba(224,75,102,0.15)" },
  muted: { bg: "linear-gradient(155deg, var(--accent-soft), #ffffff 72%)", fg: "var(--accent)", chip: "rgba(91,99,232,0.15)" },
};
const STAT_PALETTE: Record<string, { bg: string; fg: string; chip: string; border: string }> = {
  violet: { bg: "linear-gradient(160deg, var(--tint-violet), #ffffff 80%)", fg: "var(--accent)", chip: "rgba(91,99,232,0.14)", border: "rgba(91,99,232,0.22)" },
  indigo: { bg: "linear-gradient(160deg, #e7ecfd, #ffffff 80%)", fg: "#3f57cf", chip: "rgba(63,87,207,0.13)", border: "rgba(63,87,207,0.2)" },
  peach: { bg: "linear-gradient(160deg, var(--tint-peach), #ffffff 80%)", fg: "#c07d1c", chip: "rgba(192,125,28,0.15)", border: "rgba(192,125,28,0.22)" },
  rose: { bg: "linear-gradient(160deg, var(--tint-blush), #ffffff 80%)", fg: "var(--neg)", chip: "rgba(224,75,102,0.13)", border: "rgba(224,75,102,0.2)" },
};
const toneOf = (x: number): "pos" | "neg" | "muted" => (x > 0 ? "pos" : x < 0 ? "neg" : "muted");

// The verdict hero is a soft tinted card — its wash follows the tone (mint for
// an edge, rose for a fade, violet for noise) so the answer reads at a glance
// without shouting. Everything sits on the same warm light surface.
const TINT: Record<string, string> = {
  pos: "linear-gradient(150deg, var(--pos-soft), #ffffff 62%)",
  neg: "linear-gradient(150deg, var(--neg-soft), #ffffff 62%)",
  muted: "linear-gradient(150deg, var(--accent-soft), #ffffff 62%)",
};
const TONE: Record<string, string> = { pos: "var(--pos)", neg: "var(--neg)", muted: "var(--accent)" };

export function ResultsPanel({ r, label, rule }: { r: BacktestResult; label: string; rule: Rule }) {
  const v = verdict(r);
  const tone = TONE[v.tone];
  return (
    <div className="space-y-5">
      {/* Row 1 — verdict hero + the two headline KPIs */}
      <div className="grid grid-cols-12 gap-5">
        <div
          className="rise relative col-span-12 overflow-hidden rounded-[var(--radius)] border border-line xl:col-span-8"
          style={{ background: TINT[v.tone], boxShadow: "var(--shadow-card)" }}
        >
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: tone, opacity: 0.9 }} />
          <div className="p-7 lg:p-8">
            <div className="flex items-center gap-2 text-[12px]">
              <span className="font-semibold text-muted">{label}</span>
              <span className="text-faint">·</span>
              <span className="text-faint">{r.horizon}-day hold</span>
            </div>
            <div className="mt-5 flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
              <div className="min-w-0">
                <h2 className="text-[30px] font-extrabold leading-tight tracking-tight" style={{ color: tone }}>
                  {v.label}
                </h2>
                <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-muted">{v.line}</p>
                <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-line bg-white/70 px-3 py-1.5 text-[12.5px] font-medium text-muted">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
                  {describeRule(rule)}
                </div>
              </div>
              <div className="shrink-0 lg:text-right">
                <div className="nums text-[64px] font-extrabold leading-[0.9] tracking-tighter" style={{ color: tone }}>
                  {pp(r.edgeHitRate)}
                </div>
                <div className="mt-2 text-[12px] font-medium text-muted">hit-rate edge vs holding</div>
              </div>
            </div>
          </div>
        </div>

        <div className="rise-2 col-span-12 grid gap-5 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          <Kpi
            label="Hit rate"
            tone={v.tone}
            icon={ICON.hit}
            value={`${(r.hitRate * 100).toFixed(0)}%`}
            cls={signedClass(r.edgeHitRate)}
            sub={`vs ${(r.baselineHitRate * 100).toFixed(0)}% holding`}
            delta={pp(r.edgeHitRate)}
            deltaCls={signedClass(r.edgeHitRate)}
            hint={
              <>
                How often price was higher after the hold. The pill is the <b>edge vs holding</b> in{" "}
                <b>pp (percentage points)</b> — this signal's hit rate minus the hit rate of always holding. Built from
                real Nansen cohort flows.
              </>
            }
          />
          <Kpi
            label="Median return"
            tone={toneOf(r.edgeMedianReturn)}
            icon={ICON.median}
            value={pct(r.medianReturn)}
            cls={signedClass(r.edgeMedianReturn)}
            sub={`vs ${pct(r.baselineMedianReturn)} holding`}
            delta={pct(r.edgeMedianReturn)}
            deltaCls={signedClass(r.edgeMedianReturn)}
            hint={
              <>
                The typical trade — the middle return of every fired scenario. We headline the median, not the average,
                so one lucky token can't fake an edge.
              </>
            }
          />
        </div>
      </div>
      {/* Row 2 — equity curve + supporting stats */}
      <div className="rise-3 grid grid-cols-12 gap-5">
        <div className="card col-span-12 p-5 xl:col-span-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="inline-flex items-center gap-1.5 text-[15px] font-bold">
              Equity curve
              <Hint>
                Rolls one equal-weight basket through every decision date in order, compounding the real forward
                returns. Log scale, so equal vertical steps mean equal percentage moves.
              </Hint>
            </h3>
            <span className="text-[12px] text-faint">equal-weight basket per decision date · log scale</span>
          </div>
          <InvestOutcome r={r} />
          <EquityChart equity={r.equity} />
        </div>

        <div className="col-span-12 grid grid-cols-2 gap-5 xl:col-span-4">
          <Stat label="Trades" color="violet" icon={ICON.trades} value={`${r.n}`} sub={`of ${r.total} scenarios`} hint="How many point-in-time scenarios this signal actually fired on — the sample behind the verdict." />
          <Stat
            label="Coverage"
            color="indigo"
            icon={ICON.coverage}
            value={`${(r.coverage * 100).toFixed(0)}%`}
            sub="scenarios that fired"
            hint="Share of all scenarios where the rule's condition was met. Low coverage means a rare, selective signal."
          />
          <Stat
            label="Max drawdown"
            color="rose"
            icon={ICON.drawdown}
            value={pct(r.maxDrawdown)}
            cls={signedClass(r.maxDrawdown)}
            sub="peak to trough"
            hint="The deepest fall from a high point along the equity curve — the worst stretch you'd have sat through."
          />
          <Stat
            label="Baseline hit"
            color="peach"
            icon={ICON.baseline}
            value={`${(r.baselineHitRate * 100).toFixed(0)}%`}
            sub="always-in reference"
            hint="How often price was higher if you simply held every scenario, ignoring the signal. The bar the edge is measured against."
          />
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  cls,
  delta,
  deltaCls,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  cls?: string;
  delta?: string;
  deltaCls?: string;
  hint?: ReactNode;
  tone: "pos" | "neg" | "muted";
  icon: ReactNode;
}) {
  const t = KPI_TINT[tone];
  return (
    <div
      className="relative flex flex-col justify-between overflow-hidden rounded-[var(--radius)] border border-line p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-lift)]"
      style={{ background: t.bg, boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: t.chip, color: t.fg }}>
            {icon}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-text">
            {label}
            {hint && <Hint>{hint}</Hint>}
          </span>
        </span>
        {delta && (
          <span
            className={`nums rounded-full bg-white/70 px-2.5 py-1 text-[12px] font-extrabold tabular-nums ${deltaCls ?? "text-muted"}`}
          >
            {delta}
          </span>
        )}
      </div>
      <div className={`nums mt-4 text-[40px] font-extrabold leading-none tracking-tight tabular-nums ${cls ?? "text-text"}`}>
        {value}
      </div>
      <div className="mt-2 text-[13px] font-semibold text-muted">{sub}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  cls,
  sub,
  hint,
  color,
  icon,
}: {
  label: string;
  value: string;
  cls?: string;
  sub?: string;
  hint?: ReactNode;
  color: "violet" | "indigo" | "peach" | "rose";
  icon: ReactNode;
}) {
  const p = STAT_PALETTE[color];
  return (
    <div
      className="rounded-[var(--radius-sm)] border px-4 py-[18px] transition-shadow duration-200 hover:shadow-[var(--shadow-card)]"
      style={{ background: p.bg, borderColor: p.border }}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: p.chip, color: p.fg }}>
          {icon}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-text">
          {label}
          {hint && <Hint>{hint}</Hint>}
        </span>
      </div>
      <div className={`nums mt-3 text-[30px] font-extrabold leading-none tabular-nums ${cls ?? "text-text"}`}>{value}</div>
      {sub && <div className="mt-1.5 text-[12px] font-medium text-muted">{sub}</div>}
    </div>
  );
}

const PRESET_STAKES = [100, 1000, 10000];

// "What would my money have done?" — translate the winsorized equity multiple
// into real dollars for a stake the viewer types. It reads the same executable
// basket the equity curve plots (final value ÷ starting $1), so the dollar
// answer and the chart can never disagree. Local state only; typing never
// re-runs the backtest.
function InvestOutcome({ r }: { r: BacktestResult }) {
  const [amount, setAmount] = useState(1000);
  const multiple = r.equity.length ? r.equity[r.equity.length - 1].value : 1;
  const finalValue = amount * multiple;
  const profit = finalValue - amount;
  const roi = multiple - 1;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[var(--radius-sm)] border border-line bg-[var(--surface-2)] px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="text-[12.5px] font-semibold text-muted">If you invested</span>
        <span className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-faint">$</span>
          <input
            type="number"
            min={0}
            step={100}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
            aria-label="Investment amount in dollars"
            className="nums w-32 rounded-lg border border-line bg-white py-1.5 pl-6 pr-2.5 text-right text-[14px] font-bold tabular-nums outline-none transition-colors focus:border-[var(--accent)]"
          />
        </span>
        <div className="flex gap-1">
          {PRESET_STAKES.map((s) => (
            <button
              key={s}
              onClick={() => setAmount(s)}
              className={`nums rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums transition-colors ${
                amount === s ? "bg-[var(--accent-soft)] text-accent" : "text-faint hover:bg-white"
              }`}
            >
              {usd(s)}
            </button>
          ))}
        </div>
      </div>

      <span className="text-faint">→</span>

      <div className="flex items-baseline gap-2.5">
        <span className="nums text-[22px] font-extrabold leading-none tabular-nums text-text">{usd(finalValue)}</span>
        <span className={`nums text-[13.5px] font-bold tabular-nums ${signedClass(profit)}`}>
          {profit >= 0 ? "+" : "−"}
          {usd(Math.abs(profit))} ({pct(roi)})
        </span>
      </div>

      <p className="flex w-full flex-wrap items-center gap-x-1 text-[11px] leading-snug text-faint">
        <span>
          Rolling the whole stake into each decision date's equal-weight basket, compounded chronologically and
          winsorized — the exact curve plotted below, not a forecast.
        </span>
        <Hint>
          <b>Winsorized</b> means each trade's return is capped at ±200% before compounding, so a single lottery-ticket
          token can't manufacture a fake edge. It's a deliberately conservative estimate.
        </Hint>
      </p>
    </div>
  );
}
