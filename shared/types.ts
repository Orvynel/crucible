// Core domain + dataset contract shared by the offline builder (scripts/) and the
// browser app (src/). The app NEVER calls Nansen directly — it reads the baked
// dataset that the builder writes to public/data/.

export type Chain = "ethereum" | "base" | "solana";

/** The six Smart Money cohorts Nansen breaks token flow into. */
export type Cohort =
  | "smart_trader"
  | "whale"
  | "top_pnl"
  | "public_figure"
  | "exchange"
  | "fresh_wallets";

export const COHORTS: Cohort[] = [
  "smart_trader",
  "whale",
  "top_pnl",
  "public_figure",
  "exchange",
  "fresh_wallets",
];

/** Net flow for one cohort over one observation window. */
export interface CohortFlow {
  net_flow_usd: number;
  avg_flow_usd: number;
  wallet_count: number;
}

/** One OHLCV candle (daily) as returned by Nansen historical-token-ohlcv. */
export interface Candle {
  interval_start: string; // ISO date
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volume_usd: number;
  market_cap_close: number;
}

export interface TokenRef {
  chain: Chain;
  token_address: string;
  symbol: string;
}

/**
 * One point-in-time observation: what the Smart Money cohorts did in the window
 * ENDING at `as_of` (the signal), paired with the forward price path measured
 * strictly AFTER `as_of` (the outcome). No look-ahead: nothing in `signal` uses
 * data past `as_of`, and every field in `outcome` comes from candles dated after it.
 */
export interface Scenario {
  id: string;
  token: TokenRef;
  as_of: string; // ISO date — the decision point
  signal: Record<Cohort, CohortFlow>;
  /** Convenience: net flow in USD per cohort over the signal window. */
  price_at_as_of: number;
  outcome: {
    /** Forward return (fraction, e.g. 0.12 = +12%) at each horizon in days. */
    forward_return: Record<string, number>; // key = horizon days as string
    /** Max drawdown over the longest horizon window (fraction, <= 0). */
    max_drawdown: number;
  };
  provenance: {
    flow_request_id?: string;
    ohlcv_request_id?: string;
    flow_window_days: number;
    fetched_at: string;
  };
}

/** The full dataset baked to public/data/dataset.json. */
export interface Dataset {
  version: string;
  built_at: string;
  horizons: number[]; // forward-return horizons in days, e.g. [1, 3, 7, 14, 30]
  flow_window_days: number; // signal lookback used for cohort net flow
  tokens: TokenRef[];
  scenarios: Scenario[];
  meta: {
    api_calls_made: number;
    credits_spent: number;
    source: "Nansen API";
  };
}
