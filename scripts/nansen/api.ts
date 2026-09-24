// Typed wrappers over the raw Nansen client. Each returns clean domain objects
// (see shared/types.ts) so the rest of the pipeline never touches raw envelopes.
import { post, bases } from "./client.ts";
import type { Candle, Chain, Cohort, CohortFlow, WalletTrade } from "../../shared/types.ts";
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

// One raw wallet row from who-bought-sold. Field names are accessed tolerantly
// (the endpoint is verified against a live --sample call before the full bake).
type RawWallet = Record<string, unknown>;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Nansen smart-money label categories worth surfacing as "the traders" — the
// skilled-trader tiers, funds, public figures and whales (bots excluded).
const SMART_MONEY_LABELS = [
  "30D Smart Trader",
  "90D Smart Trader",
  "180D Smart Trader",
  "Smart Trader",
  "Fund",
  "Public Figure",
  "Whale",
];

/**
 * Top Smart Money wallets trading a token over [from, to] — the actual traders
 * behind a signal (address + Nansen label + USD bought/sold). Smart-money-only,
 * ranked by USD bought, top `limit`. Runtime-priced (see client credit header).
 */
export async function fetchWhoBoughtSold(
  chain: Chain,
  token_address: string,
  from: string,
  to: string,
  limit = 5,
): Promise<WalletTrade[]> {
  const res = await post<{ data?: RawWallet[] }>(
    "tgm/who-bought-sold",
    {
      chain,
      token_address,
      date: { from: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` },
      filters: { include_smart_money_labels: SMART_MONEY_LABELS },
      order_by: [{ field: "bought_volume_usd", direction: "DESC" }],
      pagination: { page: 1, per_page: limit + 4 },
    },
    { base: bases.V1, cost: 5 },
  );
  const rows = res.data ?? [];
  return rows
    .map((r) => {
      const bought = num(r.bought_volume_usd ?? r.buy_volume_usd ?? r.total_bought_usd);
      const sold = num(r.sold_volume_usd ?? r.sell_volume_usd ?? r.total_sold_usd);
      const side: WalletTrade["side"] = bought >= sold ? "buy" : "sell";
      const raw = (r.address_label ?? r.label ?? r.name) as string | undefined;
      // Nansen labels often trail a shortened address, e.g. "Fund [0xabc123]" — we
      // show the real address separately, so strip the redundant bracket.
      const label = raw?.replace(/\s*\[[0-9a-zA-Z]{4,}\]\s*$/, "").trim();
      return {
        address: String(r.address ?? r.wallet_address ?? r.wallet ?? ""),
        label: label ? label : undefined,
        side,
        volume_usd: side === "buy" ? bought : sold,
      };
    })
    .filter((w) => w.address && w.volume_usd >= 100)
    .slice(0, limit);
}
