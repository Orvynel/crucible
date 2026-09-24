import { Fragment, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Cohort, Dataset, Scenario } from "@shared/types";
import { COHORTS } from "@shared/types";
import type { Rule } from "@shared/backtest";
import { firedScenarios } from "@shared/backtest";
import { COHORT_LABEL } from "../lib/presets";
import { pct, signedClass, usdCompact } from "../lib/format";

// The receipts: one row per fired trade, sortable and paginated so 900 rows
// never dump at once. Click a row to open the full scenario — all six cohorts,
// price, the return at every horizon, drawdown, and provenance. Everything here
// is already in the baked dataset; nothing is invented.
const PAGE = 15;
type SortKey = "date" | "flow" | "wallets" | "return" | "drawdown";

const CHAIN_TINT: Record<string, { bg: string; fg: string }> = {
  ethereum: { bg: "rgba(91,99,232,0.1)", fg: "#4a52d4" },
  base: { bg: "rgba(37,99,235,0.1)", fg: "#2563eb" },
  solana: { bg: "rgba(21,157,99,0.12)", fg: "#159d63" },
};

function ChainBadge({ chain }: { chain: string }) {
  const t = CHAIN_TINT[chain] ?? { bg: "var(--surface-2)", fg: "var(--muted)" };
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize"
      style={{ background: t.bg, color: t.fg }}
    >
      {chain}
    </span>
  );
}

export function TradesTable({
  rule,
  dataset,
  tokenAddress,
  onClearToken,
}: {
  rule: Rule;
  dataset: Dataset;
  tokenAddress?: string | null;
  onClearToken?: () => void;
}) {
  const cohort = rule.conditions[0]?.cohort ?? "smart_trader";
  const hz = String(rule.horizon);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [page, setPage] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const filterSymbol = tokenAddress
    ? dataset.tokens.find((t) => t.token_address === tokenAddress)?.symbol ?? "token"
    : null;

  const rows = useMemo(() => {
    return firedScenarios(rule, dataset)
      .filter((sc) => !tokenAddress || sc.token.token_address === tokenAddress)
      .map((sc) => ({
        sc,
        ret: sc.outcome.forward_return[hz] ?? 0,
        flow: sc.signal[cohort]?.net_flow_usd ?? 0,
        wallets: sc.signal[cohort]?.wallet_count ?? 0,
        dd: sc.outcome.max_drawdown,
      }));
  }, [rule, dataset, cohort, hz, tokenAddress]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    const mul = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sort.key) {
        case "date":
          return mul * a.sc.as_of.localeCompare(b.sc.as_of);
        case "flow":
          return mul * (a.flow - b.flow);
        case "wallets":
          return mul * (a.wallets - b.wallets);
        case "return":
          return mul * (a.ret - b.ret);
        case "drawdown":
          return mul * (a.dd - b.dd);
      }
    });
    return arr;
  }, [rows, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const clamped = Math.min(page, pages - 1);
  const visible = showAll ? sorted : sorted.slice(clamped * PAGE, clamped * PAGE + PAGE);

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
    setPage(0);
  };

  if (rows.length === 0) {
    return (
      <div className="card p-6 text-[13.5px] text-muted">
        {filterSymbol ? (
          <span>
            This signal didn't fire on <span className="font-semibold text-text">{filterSymbol}</span> at the{" "}
            {rule.horizon}-day horizon.{" "}
            <button onClick={onClearToken} className="font-semibold text-accent hover:opacity-70">
              Show all tokens
            </button>
          </span>
        ) : (
          <span>
            This signal didn't fire on any scenario at the {rule.horizon}-day horizon. Loosen the rule to see trades.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
        <div>
          <h3 className="text-[15px] font-bold">The trades</h3>
          <p className="mt-0.5 text-[12px] text-faint">
            Every scenario this signal fired on — the exact evidence behind the numbers above.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {filterSymbol && (
            <button
              onClick={onClearToken}
              title="Clear token filter"
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11.5px] font-semibold text-accent transition-opacity hover:opacity-70"
            >
              {filterSymbol}
              <span className="text-[13px] leading-none">✕</span>
            </button>
          )}
          <span className="nums text-[12px] font-semibold tabular-nums text-muted">{sorted.length} trades</span>
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-faint">
              <Th className="pl-5">Token</Th>
              <Th sortKey="date" sort={sort} onSort={toggleSort}>
                Date
              </Th>
              <Th sortKey="flow" sort={sort} onSort={toggleSort} align="right">
                {COHORT_LABEL[cohort]} net-flow
              </Th>
              <Th sortKey="wallets" sort={sort} onSort={toggleSort} align="right">
                Wallets
              </Th>
              <Th sortKey="return" sort={sort} onSort={toggleSort} align="right">
                Return {rule.horizon}d
              </Th>
              <Th sortKey="drawdown" sort={sort} onSort={toggleSort} align="right">
                Drawdown
              </Th>
              <th className="w-8 pr-4" />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const isOpen = open === row.sc.id;
              return (
                <Fragment key={row.sc.id}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : row.sc.id)}
                    className={`cursor-pointer border-b border-line transition-colors ${
                      isOpen ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <td className="py-3 pl-5">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold">{row.sc.token.symbol}</span>
                        <ChainBadge chain={row.sc.token.chain} />
                      </div>
                    </td>
                    <td className="nums py-3 text-[12.5px] tabular-nums text-muted">{row.sc.as_of}</td>
                    <td className={`nums py-3 text-right text-[12.5px] font-semibold tabular-nums ${signedClass(row.flow)}`}>
                      {usdCompact(row.flow)}
                    </td>
                    <td className="nums py-3 text-right text-[12.5px] tabular-nums text-muted">{row.wallets}</td>
                    <td className={`nums py-3 text-right text-[13px] font-bold tabular-nums ${signedClass(row.ret)}`}>
                      {pct(row.ret)}
                    </td>
                    <td className="nums py-3 text-right text-[12.5px] tabular-nums text-neg">{pct(row.dd)}</td>
                    <td className="pr-4 text-right text-faint">
                      <span className={`inline-block transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${row.sc.id}-detail`} className="border-b border-line bg-[var(--surface-2)]">
                      <td colSpan={7} className="px-5 pb-5 pt-1">
                        <Drilldown sc={row.sc} horizons={dataset.horizons} flowWindow={dataset.flow_window_days} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* pager */}
      {!showAll && pages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[12.5px]">
          <button
            onClick={() => setShowAll(true)}
            className="font-semibold text-accent transition-opacity hover:opacity-70"
          >
            Show all {sorted.length}
          </button>
          <div className="flex items-center gap-3 text-muted">
            <button
              disabled={clamped === 0}
              onClick={() => setPage(clamped - 1)}
              className="rounded-md px-2 py-1 transition-colors hover:bg-[var(--surface-2)] disabled:opacity-30"
            >
              ‹ Prev
            </button>
            <span className="nums tabular-nums">
              {clamped + 1} / {pages}
            </span>
            <button
              disabled={clamped >= pages - 1}
              onClick={() => setPage(clamped + 1)}
              className="rounded-md px-2 py-1 transition-colors hover:bg-[var(--surface-2)] disabled:opacity-30"
            >
              Next ›
            </button>
          </div>
        </div>
      )}
      {showAll && (
        <div className="border-t border-line px-5 py-3 text-[12.5px]">
          <button
            onClick={() => setShowAll(false)}
            className="font-semibold text-accent transition-opacity hover:opacity-70"
          >
            Show pages
          </button>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  sortKey,
  sort,
  onSort,
  align = "left",
  className = "",
}: {
  children: ReactNode;
  sortKey?: SortKey;
  sort?: { key: SortKey; dir: "asc" | "desc" };
  onSort?: (k: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sortKey && sort?.key === sortKey;
  const arrow = active ? (sort!.dir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th
      className={`py-2.5 text-[11px] font-semibold ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      {sortKey && onSort ? (
        <button
          onClick={() => onSort(sortKey)}
          className={`transition-colors hover:text-text ${active ? "text-text" : ""}`}
        >
          {children}
          <span className="nums">{arrow}</span>
        </button>
      ) : (
        children
      )}
    </th>
  );
}

function short(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function Drilldown({ sc, horizons, flowWindow }: { sc: Scenario; horizons: number[]; flowWindow: number }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* full cohort signal */}
      <div>
        <div className="mb-2 text-[11px] font-semibold text-muted">
          Cohort net-flow over the {flowWindow}d window before {sc.as_of}
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {COHORTS.map((c) => {
            const f = sc.signal[c as Cohort];
            const flow = f?.net_flow_usd ?? 0;
            return (
              <div key={c} className="rounded-lg border border-line bg-white px-2.5 py-2">
                <div className="truncate text-[10.5px] text-faint">{COHORT_LABEL[c as Cohort]}</div>
                <div className={`nums text-[13px] font-bold tabular-nums ${signedClass(flow)}`}>{usdCompact(flow)}</div>
                <div className="nums text-[10px] tabular-nums text-faint">
                  {f?.wallet_count ?? 0} {(f?.wallet_count ?? 0) === 1 ? "wallet" : "wallets"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* outcome path + provenance */}
      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-2 text-[11px] font-semibold text-muted">Forward return by horizon</div>
          <div className="flex flex-wrap gap-1.5">
            {horizons.map((h) => {
              const r = sc.outcome.forward_return[String(h)];
              const has = typeof r === "number" && Number.isFinite(r);
              return (
                <div key={h} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-center">
                  <div className="text-[10px] text-faint">{h}d</div>
                  <div className={`nums text-[12.5px] font-bold tabular-nums ${has ? signedClass(r) : "text-faint"}`}>
                    {has ? pct(r) : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-muted">
          <span>
            Price at decision <span className="nums font-semibold text-text">${sc.price_at_as_of.toLocaleString()}</span>
          </span>
          <span>
            Max drawdown <span className="nums font-semibold text-neg">{pct(sc.outcome.max_drawdown)}</span>
          </span>
          <span className="text-faint">
            Data fetched {sc.provenance.fetched_at.slice(0, 10)} · Source Nansen
          </span>
        </div>
        {/* top smart-money wallets behind this trade (baked offline) */}
        <div>
          <div className="mb-2 text-[11px] font-semibold text-muted">Top Smart Money wallets in this window</div>
          {sc.top_wallets && sc.top_wallets.length > 0 ? (
            <div className="space-y-1">
              {sc.top_wallets.map((w) => (
                <div
                  key={`${w.address}-${w.side}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-2.5 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[12px] font-semibold text-text">{w.label ?? "Smart Money wallet"}</span>
                    <span className="nums shrink-0 text-[10.5px] tabular-nums text-faint">{short(w.address)}</span>
                  </div>
                  <span className={`nums shrink-0 text-[12px] font-bold tabular-nums ${w.side === "buy" ? "text-pos" : "text-neg"}`}>
                    {w.side === "buy" ? "+" : "−"}
                    {usdCompact(w.volume_usd)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-line px-2.5 py-2 text-[11.5px] text-faint">
              Individual wallet identities aren't baked for this trade.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


