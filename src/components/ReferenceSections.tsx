import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Dataset } from "@shared/types";
import { COHORTS } from "@shared/types";
import { COHORT_HINT, COHORT_LABEL } from "../lib/presets";

// Reference: the full universe under test and the vocabulary. Proof that the
// tokens are real coins across real chains, and a plain-English key to the six
// Nansen cohorts the signals are built from.
const CHAIN_FG: Record<string, string> = {
  ethereum: "#4a52d4",
  base: "#2563eb",
  solana: "#159d63",
};

export function ReferenceSections({
  dataset,
  selectedToken,
  onSelectToken,
}: {
  dataset: Dataset;
  selectedToken?: string | null;
  onSelectToken?: (addr: string) => void;
}) {
  const byChain = useMemo(() => {
    const counts = new Map<string, number>();
    const key = (chain: string, addr: string) => `${chain}::${addr}`;
    for (const s of dataset.scenarios) {
      const k = key(s.token.chain, s.token.token_address);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const groups = new Map<string, { symbol: string; address: string; count: number }[]>();
    for (const t of dataset.tokens) {
      const arr = groups.get(t.chain) ?? [];
      arr.push({ symbol: t.symbol, address: t.token_address, count: counts.get(key(t.chain, t.token_address)) ?? 0 });
      groups.set(t.chain, arr);
    }
    for (const arr of groups.values()) arr.sort((a, b) => b.count - a.count);
    return [...groups.entries()];
  }, [dataset]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Collapsible
        title="Tokens tested"
        count={`${dataset.tokens.length} across ${byChain.length} chains`}
        defaultOpen
      >
        <p className="-mt-1 mb-3 text-[11.5px] text-faint">Click any token to see just its trades above.</p>
        <div className="space-y-4">
          {byChain.map(([chain, tokens]) => (
            <div key={chain}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[12px] font-bold capitalize" style={{ color: CHAIN_FG[chain] ?? "var(--muted)" }}>
                  {chain}
                </span>
                <span className="text-[11px] text-faint">{tokens.length} tokens</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tokens.map((t) => {
                  const on = selectedToken === t.address;
                  return (
                    <button
                      key={t.symbol}
                      onClick={() => onSelectToken?.(t.address)}
                      title={on ? "Clear filter" : `Show ${t.symbol} trades (${t.count} scenarios)`}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] transition-colors ${
                        on
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-line bg-[var(--surface-2)] hover:border-[var(--line-strong)] hover:bg-white"
                      }`}
                    >
                      <span className={`font-semibold ${on ? "text-accent" : "text-text"}`}>{t.symbol}</span>
                      <span className="nums tabular-nums text-faint">{t.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Smart Money cohorts" count="6 groups" defaultOpen>
        <div className="space-y-2">
          {COHORTS.map((c) => (
            <div key={c} className="rounded-lg border border-line bg-[var(--surface-2)] px-3 py-2">
              <div className="text-[12.5px] font-bold text-text">{COHORT_LABEL[c]}</div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-muted">{COHORT_HINT[c]}</div>
            </div>
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

function Collapsible({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card p-5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[15px] font-bold">{title}</h3>
          <span className="text-[12px] text-faint">{count}</span>
        </div>
        <span className={`text-faint transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}
