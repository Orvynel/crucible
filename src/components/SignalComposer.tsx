import type { Cohort } from "@shared/types";
import { COHORTS } from "@shared/types";
import type { Condition, Rule } from "@shared/backtest";
import { COHORT_HINT, COHORT_LABEL } from "../lib/presets";

interface Props {
  rule: Rule;
  horizons: number[];
  onChange: (rule: Rule) => void;
}

const M = 1_000_000;

function Seg<T extends string | number>({
  options,
  value,
  onSelect,
}: {
  options: { v: T; label: string }[];
  value: T;
  onSelect: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-[var(--sunken)] p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={String(o.v)}
          onClick={() => onSelect(o.v)}
          className={`rounded-[7px] px-2.5 py-1 transition-colors ${
            value === o.v ? "bg-raised text-text shadow-[0_1px_3px_rgba(27,24,38,0.1)]" : "text-muted hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SignalComposer({ rule, horizons, onChange }: Props) {
  const set = (patch: Partial<Rule>) => onChange({ ...rule, ...patch });
  const setCond = (i: number, patch: Partial<Condition>) =>
    set({ conditions: rule.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const addCond = () => set({ conditions: [...rule.conditions, { cohort: "whale", op: "gt", value: 1 * M }] });
  const removeCond = (i: number) => set({ conditions: rule.conditions.filter((_, j) => j !== i) });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="kicker">When</span>
        <Seg
          value={rule.combine}
          onSelect={(v) => set({ combine: v })}
          options={[
            { v: "all", label: "match all" },
            { v: "any", label: "match any" },
          ]}
        />
      </div>

      <div className="space-y-2.5">
        {rule.conditions.map((c, i) => (
          <div key={i} className="rounded-xl border border-line bg-[var(--surface-1)] p-3 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <select
                value={c.cohort}
                onChange={(e) => setCond(i, { cohort: e.target.value as Cohort })}
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface2 px-2.5 py-1.5 text-sm font-medium outline-none focus:border-[var(--line-strong)]"
              >
                {COHORTS.map((k) => (
                  <option key={k} value={k}>
                    {COHORT_LABEL[k]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeCond(i)}
                className="text-faint transition-colors hover:text-neg"
                aria-label="Remove condition"
              >
                ✕
              </button>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <Seg
                value={c.op}
                onSelect={(v) => setCond(i, { op: v })}
                options={[
                  { v: "gt", label: "net-buy ≥" },
                  { v: "lt", label: "net-sell ≤" },
                ]}
              />
              <div className="ml-auto flex items-center gap-1 font-mono text-sm">
                <span className="text-faint">$</span>
                <input
                  type="number"
                  step={0.5}
                  value={c.value / M}
                  onChange={(e) => setCond(i, { value: Number(e.target.value) * M })}
                  className="w-16 rounded-lg border border-line bg-surface2 px-2 py-1 text-right outline-none focus:border-[var(--line-strong)]"
                />
                <span className="text-faint">M</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={20}
              step={0.5}
              value={Math.min(20, Math.abs(c.value / M))}
              onChange={(e) => setCond(i, { value: Number(e.target.value) * M * (c.op === "lt" ? -1 : 1) })}
              className="mt-2.5 w-full accent-[var(--accent)]"
            />
            <p className="mt-1.5 text-xs text-faint">{COHORT_HINT[c.cohort]}</p>
          </div>
        ))}
        <button
          onClick={addCond}
          className="w-full rounded-xl border border-dashed border-line py-2 text-sm text-muted transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          + add condition
        </button>
      </div>

      <div>
        <span className="kicker">Then hold for</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {horizons.map((h) => (
            <button
              key={h}
              onClick={() => set({ horizon: h })}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                rule.horizon === h
                  ? "bg-[var(--accent)] text-white"
                  : "border border-line bg-[var(--surface-1)] text-muted hover:text-text"
              }`}
            >
              {h}d
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
