// Typed wrappers over the raw Nansen client. Each returns clean domain objects
// (see shared/types.ts) so the rest of the pipeline never touches raw envelopes.
import { post, bases } from "./client.ts";
import type { Candle, Chain, Cohort, CohortFlow } from "../../shared/types.ts";
import { COHORTS } from "../../shared/types.ts";

interface ScreenerRow {
  chain: Chain;
  token_address: string;
  token_symbol: string;
  market_cap_usd: number;
  liquidity: number;
  price_usd: number;
  price_change: number;
  volume: number;
  netflow: number;
}

export async function screenTokens(chain: Chain, perPage = 100): Promise<ScreenerRow[]> {
  const res = await post<{ data: ScreenerRow[] }>(
    "token-screener",
    { chains: [chain], timeframe: "24h", pagination: { page: 1, per_page: perPage } },
    { base: bases.V1, cost: 1 },
  );
  return res.data ?? [];
}

/** Cohort net flows over [from, to]. THE SIGNAL. Returns null if no data row. */
export async function fetchFlow(
  chain: Chain,
  token_address: string,
  from: string,
  to: string,
): Promise<{ flows: Record<Cohort, CohortFlow>; request_id?: string } | null> {
  const res = await post<{ data: Record<string, number | null>[] }>(
    "tgm/historical-token-flow-summary",
    { chain, token_address, date_range: { from, to } },
    { cost: 5 },
  );
  const row = res.data?.[0];
  if (!row) return null;
  const flows = {} as Record<Cohort, CohortFlow>;
  for (const c of COHORTS) {
    flows[c] = {
      net_flow_usd: Number(row[`${c}_net_flow_usd`] ?? 0),
      avg_flow_usd: Number(row[`${c}_avg_flow_usd`] ?? 0),
      wallet_count: Number(row[`${c}_wallet_count`] ?? 0),
    };
  }
  return { flows };
}

/** Daily candles from date_from up to as_of_date. THE OUTCOME. */
export async function fetchOhlcv(
  chain: Chain,
  token_address: string,
  date_from: string,
  as_of_date: string,
): Promise<Candle[]> {
  const res = await post<{ data: RawCandle[] }>(
    "tgm/historical-token-ohlcv",
    { chain, token_address, timeframe: "1d", date_from, as_of_date },
    { cost: 5 },
  );
  return (res.data ?? []).map((d) => ({
    interval_start: d.interval_start,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: d.volume,
    volume_usd: d.volume_usd,
    market_cap_close: d.market_cap?.close ?? 0,
  }));
}

interface RawCandle {
  interval_start: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volume_usd: number;
  market_cap?: { open: number; high: number; low: number; close: number };
}
