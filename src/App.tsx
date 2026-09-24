import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Dataset } from "@shared/types";
import type { Rule } from "@shared/backtest";
import { backtest } from "@shared/backtest";
import { useDataset } from "./lib/useDataset";
import { PRESETS } from "./lib/presets";
import { pp, signedClass } from "./lib/format";
import { SignalComposer } from "./components/SignalComposer";
import { ResultsPanel } from "./components/ResultsPanel";
import { SignalBreakdown } from "./components/SignalBreakdown";
import { TradesTable } from "./components/TradesTable";
import { ReferenceSections } from "./components/ReferenceSections";
import { Landing } from "./components/Landing";
import { Logo } from "./components/Logo";

export default function App() {
  const state = useDataset();
  if (state.status !== "ready") {
    return (
      <div
        className="grid h-full place-items-center p-8"
        style={{ background: "linear-gradient(180deg, #f8f6ff, #f1edfb)" }}
      >
        {state.status === "loading" && (
          <div className="flex flex-col items-center gap-4 text-muted">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-line"
              style={{ borderTopColor: "var(--accent)" }}
            />
            <span className="text-sm">Loading point-in-time history…</span>
          </div>
        )}
        {state.status === "error" && <div className="card p-6 text-sm text-neg">{state.message}</div>}
      </div>
    );
  }
  return <Root dataset={state.dataset} />;
}

function Root({ dataset }: { dataset: Dataset }) {
  const [entered, setEntered] = useState(false);
  return (
    <AnimatePresence mode="wait">
      {!entered ? (
        <motion.div
          key="landing"
          className="h-full"
          exit={{ opacity: 0, scale: 0.985, filter: "blur(4px)" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Landing dataset={dataset} onEnter={() => setEntered(true)} />
        </motion.div>
      ) : (
        <motion.div
          key="app"
          className="h-full"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Shell dataset={dataset} onHome={() => setEntered(false)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Shell({ dataset, onHome }: { dataset: Dataset; onHome: () => void }) {
  const [rule, setRule] = useState<Rule>(PRESETS[0].rule);
  const [active, setActive] = useState(0);
  const [tokenFilter, setTokenFilter] = useState<string | null>(null);
  const result = useMemo(() => backtest(rule, dataset), [rule, dataset]);
  const presetEdges = useMemo(() => PRESETS.map((p) => backtest(p.rule, dataset).edgeHitRate), [dataset]);

  const pick = (i: number) => {
    setActive(i);
    setRule(PRESETS[i].rule);
  };
  const compose = (r: Rule) => {
    setActive(-1);
    setRule(r);
  };
  const selectToken = (addr: string) => {
    setTokenFilter((cur) => (cur === addr ? null : addr));
    requestAnimationFrame(() => document.getElementById("trades")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="flex h-full">
      <Sidebar
        dataset={dataset}
        rule={rule}
        active={active}
        edges={presetEdges}
        onPick={pick}
        onCompose={compose}
        onHome={onHome}
      />
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar dataset={dataset} />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1440px] px-6 py-7 xl:px-9">
            <NansenBanner />
            <ResultsPanel r={result} label={active >= 0 ? PRESETS[active].name : "Custom signal"} rule={rule} />

            <SectionHead title="The evidence" hint="Every trade behind the verdict — click a row for the full scenario" />
            <div className="space-y-4">
              <SignalBreakdown rule={rule} dataset={dataset} />
              <div id="trades">
                <TradesTable
                  rule={rule}
                  dataset={dataset}
                  tokenAddress={tokenFilter}
                  onClearToken={() => setTokenFilter(null)}
                />
              </div>
            </div>

            <SectionHead title="Reference" hint="The full universe under test and the cohort key" />
            <ReferenceSections dataset={dataset} selectedToken={tokenFilter} onSelectToken={selectToken} />

            <MethodFooter dataset={dataset} />
          </div>
        </div>
      </main>
    </div>
  );
}

function Sidebar({
  dataset,
  rule,
  active,
  edges,
  onPick,
  onCompose,
  onHome,
}: {
  dataset: Dataset;
  rule: Rule;
  active: number;
  edges: number[];
  onPick: (i: number) => void;
  onCompose: (r: Rule) => void;
  onHome: () => void;
}) {
  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-r border-line bg-[var(--surface-1)]">
      <button
        onClick={onHome}
        className="flex items-center gap-3 border-b border-line px-5 py-[18px] text-left transition-opacity hover:opacity-80"
        title="Back to start"
      >
        <Logo size={36} radius={12} />
        <div>
          <div className="text-[15px] font-extrabold tracking-tight">Crucible</div>
          <div className="text-[11.5px] text-faint">Smart Money signal backtester</div>
        </div>
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <span className="kicker px-1.5">Signals</span>
        <div className="mt-3 space-y-1">
          {PRESETS.map((p, i) => (
            <button
              key={p.name}
              onClick={() => onPick(i)}
              title={p.blurb}
              className={`nav-item ${
                active === i
                  ? "bg-[var(--accent-soft)] text-text"
                  : "text-muted hover:bg-[var(--surface-2)] hover:text-text"
              }`}
            >
              <span className="flex-1 text-[13px] font-semibold leading-tight">{p.name}</span>
              <span className={`nums text-[12px] font-bold tabular-nums ${signedClass(edges[i])}`}>{pp(edges[i])}</span>
            </button>
          ))}
        </div>

        <div className="mt-7 border-t border-line pt-6">
          <span className="kicker px-1.5">Compose your own</span>
          <div className="mt-3">
            <SignalComposer rule={rule} horizons={dataset.horizons} onChange={onCompose} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line px-5 py-4 text-[11.5px]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
        <span className="text-muted">Real Nansen point-in-time data</span>
      </div>
    </aside>
  );
}

function TopBar({ dataset }: { dataset: Dataset }) {
  const chains = [...new Set(dataset.tokens.map((t) => t.chain))];
  const items: [string, string][] = [
    ["Scenarios", dataset.scenarios.length.toLocaleString()],
    ["Tokens", String(dataset.tokens.length)],
    ["Chains", String(chains.length)],
  ];
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line bg-[var(--bg)]/70 px-6 py-[18px] backdrop-blur-xl xl:px-9">
      <div>
        <h1 className="text-[18px] font-extrabold tracking-tight">Does Smart Money actually predict price?</h1>
        <p className="mt-0.5 text-[13px] text-muted">Backtested against real Nansen history — no look-ahead.</p>
      </div>
      <div className="hidden items-stretch overflow-hidden rounded-2xl border border-line bg-[var(--surface-2)] md:flex">
        {items.map(([k, v], i) => (
          <div key={k} className={`px-4 py-2 text-right ${i > 0 ? "border-l border-line" : ""}`}>
            <div className="nums text-sm font-bold tabular-nums leading-tight">{v}</div>
            <div className="mt-0.5 text-[11px] text-faint">{k}</div>
          </div>
        ))}
      </div>
    </header>
  );
}

function NansenBanner() {
  return (
    <div
      className="mb-6 overflow-hidden rounded-[var(--radius)] border border-line bg-[var(--surface-1)]"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="relative mt-1 flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <div>
            <div className="text-[13px] font-bold text-text">Built on Nansen point-in-time data</div>
            <p className="mt-0.5 max-w-2xl text-[12px] leading-snug text-muted">
              Every verdict, price, and wallet on this page is derived from Nansen Smart Money cohort net-flows,
              captured at each historical decision date — the labelled, point-in-time onchain data a no-look-ahead
              backtest depends on.
            </p>
          </div>
        </div>
        <span className="shrink-0 self-start rounded-full border border-line bg-[var(--surface-2)] px-3 py-1 text-[11px] font-semibold text-faint sm:self-center">
          Powered by Nansen
        </span>
      </div>
      <div className="flex items-start gap-2 border-t border-line bg-[var(--surface-2)] px-4 py-2.5 text-[11.5px] leading-snug text-muted">
        <span className="mt-[1px] shrink-0 font-bold text-text">Not investment advice.</span>
        <span>
          Crucible is a research tool for studying whether historical Smart Money flows preceded price moves. Nothing
          here is a recommendation to buy, sell, or hold any asset, and past behaviour does not predict future returns.
        </span>
      </div>
    </div>
  );
}

function SectionHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-4 mt-9 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line pt-6">
      <h2 className="text-[16px] font-extrabold tracking-tight">{title}</h2>
      <p className="text-[12.5px] text-faint">{hint}</p>
    </div>
  );
}

function MethodFooter({ dataset }: { dataset: Dataset }) {
  return (
    <footer className="mt-7 grid gap-4 border-t border-line pt-6 text-xs leading-relaxed text-faint md:grid-cols-2">
      <p>
        <strong className="font-semibold text-muted">Method.</strong> Each scenario pairs a cohort net-flow signal over
        the {dataset.flow_window_days} days ending on a decision date with the forward price move measured strictly
        after it — a rule can never see the future it's tested on. The verdict is driven by <em>hit rate</em> (how often
        price was higher) and <em>median</em> return vs the same-horizon baseline (holding regardless of signal),
        because both are robust to outliers.
      </p>
      <p>
        <strong className="font-semibold text-muted">Limits.</strong> Spot cohort flows only; no fees, slippage, or
        sizing. Mean and equity figures cap each trade at ±200% so one lottery-ticket token can't fake an edge. Past
        behavior isn't predictive; small trade counts are flagged, not hidden. Source: {dataset.meta.source}, built{" "}
        {dataset.built_at.slice(0, 10)}.
      </p>
    </footer>
  );
}
