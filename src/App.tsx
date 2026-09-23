import { useMemo, useState } from "react";
import type { Dataset } from "@shared/types";
import type { Rule } from "@shared/backtest";
import { backtest } from "@shared/backtest";
import { useDataset } from "./lib/useDataset";
import { PRESETS } from "./lib/presets";
import { SignalComposer } from "./components/SignalComposer";
import { ResultsPanel } from "./components/ResultsPanel";

export default function App() {
  const state = useDataset();
  return (
    <div className="relative z-[2] mx-auto max-w-6xl px-5 py-6">
      <Nav />
      {state.status === "loading" && <div className="card h-80 animate-pulse" />}
      {state.status === "error" && <div className="card p-6 text-sm text-neg">{state.message}</div>}
      {state.status === "ready" && <Board dataset={state.dataset} />}
    </div>
  );
}

function Nav() {
  return (
    <header className="mb-6 flex items-center justify-between border-b border-line pb-5">
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] text-black">
          <span className="text-lg font-black leading-none">C</span>
        </div>
        <div>
          <div className="text-[15px] font-bold tracking-tight">Crucible</div>
          <div className="text-[11px] text-faint">Smart Money signal backtester</div>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        </span>
        <span className="text-muted">Real Nansen point-in-time data</span>
      </div>
    </header>
  );
}

function Provenance({ dataset }: { dataset: Dataset }) {
  const chains = [...new Set(dataset.tokens.map((t) => t.chain))];
  const items: [string, string][] = [
    ["Scenarios", dataset.scenarios.length.toLocaleString()],
    ["Tokens", String(dataset.tokens.length)],
    ["Chains", chains.join(" · ")],
    ["Nansen calls", dataset.meta.api_calls_made.toLocaleString()],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-1.5">
          <span className="font-mono text-sm font-semibold tabular-nums">{v}</span>
          <span className="text-[11px] text-faint">{k}</span>
        </div>
      ))}
    </div>
  );
}

function Board({ dataset }: { dataset: Dataset }) {
  const [rule, setRule] = useState<Rule>(PRESETS[0].rule);
  const [active, setActive] = useState(0);
  const result = useMemo(() => backtest(rule, dataset), [rule, dataset]);

  const pick = (i: number) => {
    setActive(i);
    setRule(PRESETS[i].rule);
  };

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Does Smart Money actually predict price?</h1>
          <p className="mt-0.5 max-w-xl text-sm text-muted">
            Compose a cohort flow rule, test it against real history, and see the edge over buy-and-hold — no look-ahead.
          </p>
        </div>
        <Provenance dataset={dataset} />
      </div>

      <div className="mb-4">
        <span className="kicker">Starting points</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={p.name}
              onClick={() => pick(i)}
              title={p.blurb}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                active === i
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-line bg-surface text-muted hover:text-text"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[340px_1fr]">
        <section className="card p-5 lg:sticky lg:top-5">
          <h3 className="mb-4 text-sm font-semibold">Build a signal</h3>
          <SignalComposer rule={rule} horizons={dataset.horizons} onChange={(r) => setRule(r)} />
        </section>
        <section>
          <ResultsPanel r={result} />
        </section>
      </div>

      <footer className="mt-8 grid gap-4 border-t border-line pt-5 text-xs leading-relaxed text-faint md:grid-cols-2">
        <p>
          <strong className="text-muted">Method.</strong> Each scenario pairs a cohort net-flow signal over the{" "}
          {dataset.flow_window_days} days ending on a decision date with the forward price move measured strictly after
          it — a rule can never see the future it's tested on. The verdict is driven by <em>hit rate</em> (how often
          price was higher) and <em>median</em> return vs the same-horizon baseline (holding regardless of signal),
          because both are robust to outliers.
        </p>
        <p>
          <strong className="text-muted">Limits.</strong> Spot cohort flows only; no fees, slippage, or sizing. Mean
          and equity figures cap each trade at ±200% so one lottery-ticket token can't fake an edge. Past behavior
          isn't predictive; small trade counts are flagged, not hidden. Source: {dataset.meta.source},{" "}
          {dataset.meta.credits_spent.toLocaleString()} credits, built {dataset.built_at.slice(0, 10)}.
        </p>
      </footer>
    </>
  );
}
