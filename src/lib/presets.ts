import type { Cohort } from "@shared/types";
import type { Rule } from "@shared/backtest";
import { usdCompact } from "./format";

export const COHORT_LABEL: Record<Cohort, string> = {
  smart_trader: "Smart Traders",
  whale: "Whales",
  top_pnl: "Top PnL",
  public_figure: "Public Figures",
  exchange: "Exchanges",
  fresh_wallets: "Fresh Wallets",
};

export const COHORT_HINT: Record<Cohort, string> = {
  smart_trader: "Wallets Nansen labels as consistently skilled traders",
  whale: "Very large holders",
  top_pnl: "Highest realized-profit wallets",
  public_figure: "Known public figures / funds",
  exchange: "Centralized exchange wallets",
  fresh_wallets: "Newly created wallets",
};

export interface Preset {
  name: string;
  blurb: string;
  rule: Rule;
}

/** Human-readable one-liner for a rule, e.g. "Public Figures net-buying · hold 30d". */
export function describeRule(rule: Rule): string {
  const parts = rule.conditions.map((c) => {
    const dir = c.op === "gt" ? "net-buying" : "net-selling";
    const thr = c.value !== 0 ? ` ≥ ${usdCompact(Math.abs(c.value))}` : "";
    return `${COHORT_LABEL[c.cohort]} ${dir}${thr}`;
  });
  const joined = parts.join(rule.combine === "all" ? " and " : " or ");
  return `${joined} · hold ${rule.horizon}d`;
}

// Calibrated on the baked dataset using outlier-robust hit rate vs the
// "always in" baseline. The spread is deliberate — some signals win, some
// lose, some are noise — so the tool reads as honest, not a toy that always
// flatters Smart Money. Sign-based (net buyer / net seller) for large samples.
export const PRESETS: Preset[] = [
  {
    name: "Public figures accumulating",
    blurb: "When labeled public figures are net buyers — 30-day hold",
    rule: { conditions: [{ cohort: "public_figure", op: "gt", value: 0 }], combine: "all", horizon: 30 },
  },
  {
    name: "Following Smart Trader buys",
    blurb: "Buy when Smart Traders are net buyers — does copying them work?",
    rule: { conditions: [{ cohort: "smart_trader", op: "gt", value: 0 }], combine: "all", horizon: 30 },
  },
  {
    name: "Fade Smart Trader selling",
    blurb: "Buy when Smart Traders are net sellers — 14-day hold",
    rule: { conditions: [{ cohort: "smart_trader", op: "lt", value: 0 }], combine: "all", horizon: 14 },
  },
  {
    name: "Top PnL wallets buying",
    blurb: "When the highest-profit wallets are net buyers — 30-day hold",
    rule: { conditions: [{ cohort: "top_pnl", op: "gt", value: 0 }], combine: "all", horizon: 30 },
  },
];
