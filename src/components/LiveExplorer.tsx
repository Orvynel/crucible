import { useEffect, useState } from "react";
import type {
  CandleRow,
  CohortFlowRow,
  LiveCall,
  LiveQueryInput,
  LiveResponseBody,
  ScreenerToken,
  WalletRow,
} from "@shared/liveTypes";
import type { LiveChain } from "@shared/liveChains";
import { CALL_CHAINS, CHAIN_LABELS, tokenPlaceholder } from "@shared/liveChains";
import { runLiveQuery, restoreLastQuery } from "../lib/liveClient";
import { usdCompact, pct, signedClass } from "../lib/format";
import { COHORT_LABEL, COHORT_HINT } from "../lib/presets";

// A live, hands-on twin of the offline pipeline: pick a Nansen call, run it against
// real onchain data, see the exact request/response. The API key never reaches the
// browser — every query goes through Crucible's own /api/nansen proxy (see
// src/lib/liveClient.ts). Reuses the app's design tokens throughout.

const CALL_META: Record<LiveCall, { name: string; purpose: string; cost: number; needsToken: boolean }> = {
  screener: { name: "Token screener", purpose: "Top tokens on a chain, ranked by Smart Money activity right now.", cost: 1, needsToken: false },
  flows: { name: "Smart Money flows", purpose: "Net USD in and out per cohort for one token, over a date range.", cost: 5, needsToken: true },
  ohlcv: { name: "Price history", purpose: "Daily open / high / low / close and volume for one token.", cost: 5, needsToken: true },
  wallets: { name: "Who bought & sold", purpose: "The labelled Smart Money wallets trading one token.", cost: 1, needsToken: true },
};
const CALL_ORDER: LiveCall[] = ["screener", "flows", "ohlcv", "wallets"];

const short = (a: string): string => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
const fmtPrice = (n: number): string => (n >= 1 ? `$${n.toFixed(2)}` : n > 0 ? `$${n.toPrecision(3)}` : "—");
function defaultRange(): { from: string; to: string } {
  const iso = (d: Date): string => d.toISOString().slice(0, 10);
  const to = new Date(Date.now() - 86_400_000);
  return { from: iso(new Date(to.getTime() - 30 * 86_400_000)), to: iso(to) };
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}

export function LiveExplorer({ onBack }: { onBack: () => void }) {
  const [call, setCall] = useState<LiveCall>("screener");
  const [chain, setChain] = useState<LiveChain>("ethereum");
  const [token, setToken] = useState("");
  const range = defaultRange();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<LiveResponseBody | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [browse, setBrowse] = useState<{ loading: boolean; tokens: ScreenerToken[] } | null>(null);
  const [restored, setRestored] = useState(false);

  // Restore the visitor's last search on load. The record lives on the SERVER, keyed to
  // their IP (see shared/liveStore.ts) — nothing is read from or written to their device —
  // so a reload brings back exactly their own search + results, and no one else's.
  useEffect(() => {
    let alive = true;
    void restoreLastQuery().then((r) => {
      if (!alive || !r.ok || !r.saved) return;
      const { input, body } = r.saved;
      setCall(input.call);
      setChain(input.chain);
      if (input.token_address) setToken(input.token_address);
      if (input.from) setFrom(input.from);
      if (input.to) setTo(input.to);
      setRes(body);
      setRestored(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const meta = CALL_META[call];
  const chains = CALL_CHAINS[call];
  const canBrowse = (CALL_CHAINS.screener as readonly string[]).includes(chain);

  // Some chains a call doesn't support (e.g. the screener lists bitcoin/citrea that
  // flows can't take). When switching calls, keep the chain if it's still valid, else
  // fall back to Ethereum — every call supports it.
  function chooseCall(id: LiveCall) {
    setCall(id);
    if (!(CALL_CHAINS[id] as readonly string[]).includes(chain)) setChain("ethereum");
    setBrowse(null);
    setRes(null);
    setInputError(null);
    setRestored(false);
  }

  async function run() {
    if (meta.needsToken && !token.trim()) {
      setInputError("Enter a token address, or use “Browse tokens”.");
      return;
    }
    setInputError(null);
    setRestored(false);
    setLoading(true);
    const input: LiveQueryInput = { call, chain };
    if (meta.needsToken) input.token_address = token.trim();
    if (call !== "screener") {
      input.from = from;
      input.to = to;
    }
    setRes(await runLiveQuery(input));
    setLoading(false);
  }

  async function browseTokens() {
    setBrowse({ loading: true, tokens: [] });
    const body = await runLiveQuery({ call: "screener", chain });
    setBrowse({ loading: false, tokens: body.ok ? ((body.data ?? []) as ScreenerToken[]) : [] });
  }

  function pickFromScreener(addr: string) {
    setToken(addr);
    // Drill from a screened token into the richest call that supports this chain.
    const target: LiveCall = (CALL_CHAINS.flows as readonly string[]).includes(chain)
      ? "flows"
      : (CALL_CHAINS.ohlcv as readonly string[]).includes(chain)
        ? "ohlcv"
        : (CALL_CHAINS.wallets as readonly string[]).includes(chain)
          ? "wallets"
          : "screener";
    setCall(target);
    setRes(null);
    setInputError(null);
    setRestored(false);
  }

  return (
    <>
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line bg-[var(--bg)]/70 px-6 py-[18px] backdrop-blur-xl xl:px-9">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            title="Back to backtest"
            className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-[var(--surface-1)] text-muted transition hover:text-text"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-[18px] font-extrabold tracking-tight">Live Nansen API explorer</h1>
            <p className="mt-0.5 text-[13px] text-muted">Run the same Nansen endpoints Crucible is built on — live, against real onchain data.</p>
          </div>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold sm:inline-flex" style={{ background: "rgba(91,99,232,0.12)", color: "var(--accent)" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Powered by Nansen
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1100px] px-6 py-7 xl:px-9">
          <span className="kicker">1 · Choose a call</span>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {CALL_ORDER.map((id) => {
              const m = CALL_META[id];
              const sel = id === call;
              return (
                <button
                  key={id}
                  onClick={() => chooseCall(id)}
                  className="card p-4 text-left transition hover:-translate-y-0.5"
                  style={sel ? { borderColor: "var(--accent)", boxShadow: "0 0 0 2px var(--accent-soft), var(--shadow-card)" } : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-extrabold tracking-tight">{m.name}</span>
                    <span className="nums shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                      {m.cost} cr
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{m.purpose}</p>
                </button>
              );
            })}
          </div>

          <span className="kicker mt-8 block">2 · Parameters</span>
          <div className="card mt-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-[64px] text-[12.5px] font-semibold text-muted">Chain</span>
              <div className="relative">
                <select
                  value={chain}
                  onChange={(e) => {
                    setChain(e.target.value as LiveChain);
                    setBrowse(null);
                  }}
                  className="nums appearance-none rounded-xl border border-line bg-[var(--surface-2)] py-2 pl-3.5 pr-9 text-[13px] font-semibold text-text outline-none transition focus:border-accent"
                >
                  {chains.map((c) => (
                    <option key={c} value={c}>
                      {CHAIN_LABELS[c]}
                    </option>
                  ))}
                </select>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
              <span className="text-[11.5px] text-faint">{chains.length} chains supported</span>
            </div>

            {meta.needsToken && (
              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-[64px] text-[12.5px] font-semibold text-muted">Token</span>
                  <input
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      setInputError(null);
                    }}
                    spellCheck={false}
                    placeholder={tokenPlaceholder(chain)}
                    className="nums min-w-0 flex-1 rounded-xl border border-line bg-[var(--surface-2)] px-3 py-2 text-[13px] outline-none transition focus:border-accent"
                  />
                  {canBrowse && (
                    <button onClick={browseTokens} className="rounded-xl border border-line px-3 py-2 text-[12.5px] font-semibold text-muted transition hover:text-text">
                      Browse tokens
                    </button>
                  )}
                </div>
                {browse && (
                  <div className="mt-2 rounded-xl border border-line bg-[var(--surface-2)] p-2">
                    {browse.loading ? (
                      <div className="px-2 py-3 text-[12.5px] text-muted">Loading top tokens on {CHAIN_LABELS[chain]}…</div>
                    ) : browse.tokens.length === 0 ? (
                      <div className="px-2 py-3 text-[12.5px] text-muted">Couldn’t load tokens right now — enter an address manually.</div>
                    ) : (
                      <div className="max-h-56 space-y-0.5 overflow-y-auto">
                        {browse.tokens.map((t) => (
                          <button
                            key={t.token_address}
                            onClick={() => {
                              setToken(t.token_address);
                              setBrowse(null);
                              setInputError(null);
                            }}
                            className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-[var(--surface-1)]"
                          >
                            <span className="text-[13px] font-bold">{t.symbol}</span>
                            <span className="nums text-[11.5px] text-faint">{short(t.token_address)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {call !== "screener" && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="w-[64px] text-[12.5px] font-semibold text-muted">Dates</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="nums rounded-xl border border-line bg-[var(--surface-2)] px-3 py-2 text-[13px] outline-none transition focus:border-accent" />
                <span className="text-muted">→</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="nums rounded-xl border border-line bg-[var(--surface-2)] px-3 py-2 text-[13px] outline-none transition focus:border-accent" />
                <span className="text-[11.5px] text-faint">max 90 days</span>
              </div>
            )}

            {inputError && <p className="mt-3 text-[12.5px] font-semibold text-neg">{inputError}</p>}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={run}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--accent-dim)] disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Spinner /> Querying Nansen live…
                  </>
                ) : (
                  <>Run query · {meta.cost} credit{meta.cost > 1 ? "s" : ""}</>
                )}
              </button>
              <span className="text-[12px] text-faint">Live call — spends real credits.</span>
            </div>
          </div>

          {restored && res && (
            <p className="mt-6 flex items-center gap-2 text-[12.5px] text-muted">
              <span
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                  <path d="M3 3v5h5" />
                  <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
                  <path d="M12 7v5l4 2" />
                </svg>
              </span>
              Picked up where you left off — your last search is saved for you on our side, so a reload won’t lose it.
            </p>
          )}
          {res && <div className={restored ? "mt-3" : "mt-6"}>{res.ok ? <Results res={res} onPickToken={pickFromScreener} /> : <ErrorCard res={res} />}</div>}

          <p className="mt-8 flex items-start gap-2 text-[12px] leading-relaxed text-faint">
            <span className="mt-[1px] shrink-0 font-bold text-muted">Server-side key.</span>
            <span>
              Your browser only calls Crucible’s own <span className="nums">/api/nansen</span> — the Nansen key stays on the server and never reaches the page. Public
              calls are rate-limited and capped by a credit floor. Not investment advice.
            </span>
          </p>
        </div>
      </div>
    </>
  );
}

function Results({ res, onPickToken }: { res: LiveResponseBody; onPickToken: (addr: string) => void }) {
  const [raw, setRaw] = useState(false);
  const data = res.data ?? [];
  return (
    <div className="space-y-4 rise">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-extrabold tracking-tight">{res.call ? CALL_META[res.call].name : "Result"}</span>
          <span className="text-[12.5px] text-faint">
            {res.count ?? data.length} rows · {res.chain ? CHAIN_LABELS[res.chain] : ""}
          </span>
          {res.cached && <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-muted">cached</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="nums rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            {res.credits?.cost ?? "?"} credits used
          </span>
          <button onClick={() => setRaw((v) => !v)} className="rounded-full border border-line px-2.5 py-0.5 text-[11.5px] font-semibold text-muted transition hover:text-text">
            {raw ? "Hide raw" : "View raw request & response"}
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="card p-6 text-center text-[13px] text-muted">No rows returned for this query. Try a different token, chain, or date range.</div>
      ) : res.call === "screener" ? (
        <ScreenerTable rows={data as ScreenerToken[]} onPick={onPickToken} />
      ) : res.call === "flows" ? (
        <FlowCards rows={data as CohortFlowRow[]} />
      ) : res.call === "ohlcv" ? (
        <OhlcvView rows={data as CandleRow[]} />
      ) : (
        <WalletsTable rows={data as WalletRow[]} />
      )}

      {raw && <RawPanel res={res} />}
    </div>
  );
}

function ScreenerTable({ rows, onPick }: { rows: ScreenerToken[]; onPick: (addr: string) => void }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
              <th className="px-4 py-2.5 font-semibold">Token</th>
              <th className="px-4 py-2.5 text-right font-semibold">Price</th>
              <th className="px-4 py-2.5 text-right font-semibold">24h</th>
              <th className="px-4 py-2.5 text-right font-semibold">Market cap</th>
              <th className="px-4 py-2.5 text-right font-semibold">Volume</th>
              <th className="px-4 py-2.5 text-right font-semibold">Net flow</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.token_address} className="border-b border-line last:border-0 hover:bg-[var(--surface-2)]">
                <td className="px-4 py-2.5">
                  <button onClick={() => onPick(t.token_address)} title="Use this token for a flows query" className="text-left">
                    <div className="font-bold">{t.symbol}</div>
                    <div className="nums text-[11px] text-faint">{short(t.token_address)}</div>
                  </button>
                </td>
                <td className="nums px-4 py-2.5 text-right">{fmtPrice(t.price_usd)}</td>
                <td className={`nums px-4 py-2.5 text-right ${signedClass(t.price_change)}`}>{pct(t.price_change)}</td>
                <td className="nums px-4 py-2.5 text-right">{usdCompact(t.market_cap_usd)}</td>
                <td className="nums px-4 py-2.5 text-right">{usdCompact(t.volume)}</td>
                <td className={`nums px-4 py-2.5 text-right ${signedClass(t.netflow)}`}>{usdCompact(t.netflow)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FlowCards({ rows }: { rows: CohortFlowRow[] }) {
  const tints = ["--tint-violet", "--tint-mint", "--tint-peach", "--tint-blush", "--tint-violet", "--tint-mint"];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r, i) => (
        <div key={r.cohort} className="rounded-[var(--radius-sm)] border border-line p-4" style={{ background: `var(${tints[i % tints.length]})` }}>
          <div className="text-[13px] font-extrabold tracking-tight">{COHORT_LABEL[r.cohort]}</div>
          <div className="text-[11.5px] leading-snug text-muted">{COHORT_HINT[r.cohort]}</div>
          <div className={`nums mt-2 text-[20px] font-extrabold ${signedClass(r.net_flow_usd)}`}>{usdCompact(r.net_flow_usd)}</div>
          <div className="mt-1 flex items-center justify-between text-[11.5px] text-muted">
            <span>net flow</span>
            <span className="nums">{r.wallet_count} wallets</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 640;
  const h = 72;
  const pad = 5;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - (v - lo) / span) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const color = values[values.length - 1] >= values[0] ? "var(--pos)" : "var(--neg)";
  return (
    <div className="card p-3">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[72px] w-full">
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function OhlcvView({ rows }: { rows: CandleRow[] }) {
  return (
    <div className="space-y-3">
      <Spark values={rows.map((r) => r.close)} />
      <div className="card overflow-hidden">
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 py-2.5 font-semibold">Date</th>
                <th className="px-4 py-2.5 text-right font-semibold">Open</th>
                <th className="px-4 py-2.5 text-right font-semibold">Close</th>
                <th className="px-4 py-2.5 text-right font-semibold">Day</th>
                <th className="px-4 py-2.5 text-right font-semibold">Volume</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const chg = c.open > 0 ? c.close / c.open - 1 : 0;
                return (
                  <tr key={c.interval_start} className="border-b border-line last:border-0">
                    <td className="nums px-4 py-2 text-muted">{c.interval_start.slice(0, 10)}</td>
                    <td className="nums px-4 py-2 text-right">{fmtPrice(c.open)}</td>
                    <td className="nums px-4 py-2 text-right">{fmtPrice(c.close)}</td>
                    <td className={`nums px-4 py-2 text-right ${signedClass(chg)}`}>{pct(chg)}</td>
                    <td className="nums px-4 py-2 text-right">{usdCompact(c.volume_usd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function WalletsTable({ rows }: { rows: WalletRow[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
              <th className="px-4 py-2.5 font-semibold">Wallet</th>
              <th className="px-4 py-2.5 font-semibold">Label</th>
              <th className="px-4 py-2.5 text-center font-semibold">Side</th>
              <th className="px-4 py-2.5 text-right font-semibold">Volume</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w, i) => (
              <tr key={`${w.address}-${i}`} className="border-b border-line last:border-0 hover:bg-[var(--surface-2)]">
                <td className="nums px-4 py-2.5">{short(w.address)}</td>
                <td className="px-4 py-2.5 text-muted">{w.label ?? "—"}</td>
                <td className="px-4 py-2.5 text-center">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${w.side === "buy" ? "text-pos" : "text-neg"}`}
                    style={{ background: w.side === "buy" ? "var(--pos-soft)" : "var(--neg-soft)" }}
                  >
                    {w.side === "buy" ? "Bought" : "Sold"}
                  </span>
                </td>
                <td className="nums px-4 py-2.5 text-right font-semibold">{usdCompact(w.volume_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RawPanel({ res }: { res: LiveResponseBody }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-[var(--radius-sm)] border border-line p-4" style={{ background: "#161320" }}>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-white/45">Request</div>
        <div className="nums mb-2 break-all text-[12px]" style={{ color: "var(--accent-2)" }}>
          POST {res.request?.endpoint}
        </div>
        <pre className="overflow-x-auto text-[11.5px] leading-relaxed text-white/80">{JSON.stringify(res.request?.body ?? {}, null, 2)}</pre>
      </div>
      <div className="rounded-[var(--radius-sm)] border border-line p-4" style={{ background: "#161320" }}>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-white/45">Response · mapped</div>
        <pre className="max-h-72 overflow-auto text-[11.5px] leading-relaxed text-white/80">{JSON.stringify(res.data ?? [], null, 2)}</pre>
      </div>
    </div>
  );
}

function ErrorCard({ res }: { res: LiveResponseBody }) {
  const soft = res.error === "not_configured" || res.error === "paused";
  const title =
    res.error === "not_configured"
      ? "Live explorer not enabled here"
      : res.error === "paused"
        ? "Live explorer paused"
        : res.error === "rate_limited"
          ? "Slow down a moment"
          : res.error === "invalid_token"
            ? "Check the token address"
            : "Couldn’t complete the query";
  return (
    <div className="rounded-[var(--radius)] border border-line p-6" style={{ background: soft ? "var(--tint-peach)" : "var(--tint-blush)" }}>
      <div className="text-[14px] font-extrabold tracking-tight text-text">{title}</div>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">{res.message ?? "Something went wrong. Try again."}</p>
      {res.error === "not_configured" && (
        <p className="mt-2 text-[12px] leading-relaxed text-faint">
          The deployment owner sets <span className="nums">NANSEN_API_KEY</span> in the hosting environment to switch live calls on. The rest of Crucible works without it.
        </p>
      )}
    </div>
  );
}
