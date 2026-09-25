// Shared contract for the live Nansen API explorer. These types cross the
// server/client boundary: the serverless proxy (shared/liveQuery.ts, api/nansen.ts)
// produces them, and the browser (src/lib/liveClient.ts, LiveExplorer) consumes
// them. Types only — no runtime code — so importing this into the client bundle
// pulls in nothing executable and can never drag the key-holding proxy along.
import type { Chain, Cohort } from "./types";

export type LiveCall = "screener" | "flows" | "ohlcv" | "wallets";

export interface LiveQueryInput {
  call: LiveCall;
  chain: Chain;
  token_address?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  per_page?: number;
}

export interface ScreenerToken {
  symbol: string;
  token_address: string;
  price_usd: number;
  market_cap_usd: number;
  liquidity: number;
  volume: number;
  netflow: number;
  price_change: number;
}

export interface CohortFlowRow {
  cohort: Cohort;
  net_flow_usd: number;
  avg_flow_usd: number;
  wallet_count: number;
}

export interface CandleRow {
  interval_start: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume_usd: number;
  market_cap_close: number;
}

export interface WalletRow {
  address: string;
  label?: string;
  side: "buy" | "sell";
  volume_usd: number;
}

export type LiveData = ScreenerToken[] | CohortFlowRow[] | CandleRow[] | WalletRow[];

export type LiveError =
  | "invalid_input"
  | "invalid_token"
  | "rate_limited"
  | "paused"
  | "not_configured"
  | "upstream_error"
  | "network";

export interface LiveResponseBody {
  ok: boolean;
  call?: LiveCall;
  chain?: Chain;
  count?: number;
  data?: LiveData;
  request?: { endpoint: string; body: unknown };
  credits?: { cost: number | null };
  cached?: boolean;
  error?: LiveError;
  message?: string;
  retryAfter?: number;
}
