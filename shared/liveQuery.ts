// Runtime-agnostic core for the live Nansen API explorer. Runs SERVER-SIDE only
// (the Vercel function api/nansen.ts and the Vite dev middleware) — it reads the
// API key from the environment and it never reaches the browser. Uses only fetch
// + process.env so it runs on any server runtime. Endpoint definitions mirror the
// offline builder in scripts/nansen/api.ts.
import type { Cohort } from "./types.js";
import { COHORTS } from "./types.js";
import type { LiveChain } from "./liveChains.js";
import { addrHint, CHAIN_LABELS, isChainAllowed, tokenLooksValid } from "./liveChains.js";
import type {
  CandleRow,
  CohortFlowRow,
  LiveCall,
  LiveData,
  LiveResponseBody,
  RestoreResponseBody,
  ScreenerToken,
  WalletRow,
} from "./liveTypes";
import { loadLast, saveLast, storeConfigured } from "./liveStore.js";

const V1 = "https://api.nansen.ai/api/v1";
const V1BETA = "https://api.nansen.ai/api/v1beta1";

const CALLS: LiveCall[] = ["screener", "flows", "ohlcv", "wallets"];

// Bounds so any single public call stays cheap and predictable.
const MAX_PER_PAGE = 25;
const MAX_RANGE_DAYS = 90;
const RATE_MAX_DEFAULT = 8; // requests per window, per IP (override with NANSEN_RATE_MAX)
const RATE_WINDOW_MS = 60_000;
const CACHE_TTL_MS = 5 * 60_000;
const DEFAULT_MIN_CREDITS = 300;
const DAY_MS = 86_400_000;

// TEMP recording mode: when true, the per-IP rate limit and the credit-floor
// pause are lifted so the public demo never blocks mid-recording. Set back to
// false to restore both guards.
const RECORDING_MODE = true;

// The skilled-trader / fund / whale label tiers worth surfacing as "the traders".
const SMART_MONEY_LABELS = [
  "30D Smart Trader",
  "90D Smart Trader",
  "180D Smart Trader",
  "Smart Trader",
  "Fund",
  "Public Figure",
  "Whale",
];

export interface NormalizedInput {
  call: LiveCall;
  chain: LiveChain;
  token_address: string;
  from: string;
  to: string;
  per_page: number;
}

type ValidateResult =
  | { ok: true; input: NormalizedInput }
  | { ok: false; error: "invalid_input" | "invalid_token"; message: string };

const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const daysBetween = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
const clampInt = (n: unknown, lo: number, hi: number, dflt: number): number => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
};

/** Pure input validation + normalization. No env, no network — unit tested. */
export function validateInput(raw: unknown): ValidateResult {
  const q = (raw ?? {}) as Record<string, unknown>;
  const call = q.call as LiveCall;
  if (!CALLS.includes(call)) return { ok: false, error: "invalid_input", message: "Unknown call type." };
  const chain = q.chain as LiveChain;
  if (!isChainAllowed(call, chain)) {
    return { ok: false, error: "invalid_input", message: "That chain isn't available for this call." };
  }

  const per_page = clampInt(q.per_page, 1, MAX_PER_PAGE, call === "wallets" ? 8 : MAX_PER_PAGE);

  // Dates default to a recent, closed window (screener ignores them). Today can be
  // partial, so the window ends yesterday.
  const end = new Date(Date.now() - DAY_MS);
  const span = call === "ohlcv" ? 30 : 7;
  const start = new Date(end.getTime() - span * DAY_MS);
  let to = isYmd(q.to) ? q.to : iso(end);
  let from = isYmd(q.from) ? q.from : iso(start);
  if (Date.parse(from) > Date.parse(to)) [from, to] = [to, from];
  if (daysBetween(from, to) > MAX_RANGE_DAYS) {
    from = iso(new Date(Date.parse(to) - MAX_RANGE_DAYS * DAY_MS));
  }

  let token_address = typeof q.token_address === "string" ? q.token_address.trim() : "";
  if (call !== "screener") {
    if (!token_address) return { ok: false, error: "invalid_token", message: "Enter a token address." };
    if (!tokenLooksValid(chain, token_address)) {
      const label = CHAIN_LABELS[chain] ?? chain;
      const hint = addrHint(chain);
      const message =
        hint === "evm"
          ? `That isn't a valid 0x… contract address on ${label}.`
          : hint === "solana"
            ? `That isn't a valid ${label} mint address.`
            : `That doesn't look like a valid token address on ${label}.`;
      return { ok: false, error: "invalid_token", message };
    }
  } else {
    token_address = "";
  }
  return { ok: true, input: { call, chain, token_address, from, to, per_page } };
}

interface BuiltRequest {
  endpoint: string;
  body: unknown;
  cost: number;
}

/** Map a normalized query to the exact Nansen endpoint + request body. Unit tested. */
export function buildNansenRequest(i: NormalizedInput): BuiltRequest {
  switch (i.call) {
    case "screener":
      return {
        endpoint: `${V1}/token-screener`,
        cost: 1,
        body: { chains: [i.chain], timeframe: "24h", pagination: { page: 1, per_page: i.per_page } },
      };
    case "flows":
      return {
        endpoint: `${V1BETA}/tgm/historical-token-flow-summary`,
        cost: 5,
        body: { chain: i.chain, token_address: i.token_address, date_range: { from: i.from, to: i.to } },
      };
    case "ohlcv":
      return {
        endpoint: `${V1BETA}/tgm/historical-token-ohlcv`,
        cost: 5,
        body: {
          chain: i.chain,
          token_address: i.token_address,
          timeframe: "1d",
          date_from: i.from,
          as_of_date: i.to,
        },
      };
    case "wallets":
      return {
        endpoint: `${V1}/tgm/who-bought-sold`,
        cost: 1,
        body: {
          chain: i.chain,
          token_address: i.token_address,
          date: { from: `${i.from}T00:00:00Z`, to: `${i.to}T23:59:59Z` },
          filters: { include_smart_money_labels: SMART_MONEY_LABELS },
          order_by: [{ field: "bought_volume_usd", direction: "DESC" }],
          pagination: { page: 1, per_page: i.per_page },
        },
      };
  }
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown, dflt = ""): string => (typeof v === "string" ? v : v == null ? dflt : String(v));

// Nansen envelopes are read tolerantly (field names vary a little by endpoint),
// matching the offline mappers in scripts/nansen/api.ts.
function mapResponse(call: LiveCall, json: unknown, perPage: number): LiveData {
  const raw = (json as { data?: unknown } | null)?.data;
  const rows = (Array.isArray(raw) ? raw : []) as Record<string, unknown>[];

  if (call === "screener") {
    return rows.slice(0, perPage).map(
      (r): ScreenerToken => ({
        symbol: str(r.token_symbol ?? r.symbol, "—"),
        token_address: str(r.token_address),
        price_usd: num(r.price_usd),
        market_cap_usd: num(r.market_cap_usd),
        liquidity: num(r.liquidity),
        volume: num(r.volume),
        netflow: num(r.netflow),
        price_change: num(r.price_change),
      }),
    );
  }
  if (call === "flows") {
    const row = rows[0] ?? {};
    return COHORTS.map(
      (c: Cohort): CohortFlowRow => ({
        cohort: c,
        net_flow_usd: num(row[`${c}_net_flow_usd`]),
        avg_flow_usd: num(row[`${c}_avg_flow_usd`]),
        wallet_count: num(row[`${c}_wallet_count`]),
      }),
    );
  }
  if (call === "ohlcv") {
    return rows.map((d): CandleRow => {
      const mc = d.market_cap as Record<string, unknown> | undefined;
      return {
        interval_start: str(d.interval_start),
        open: num(d.open),
        high: num(d.high),
        low: num(d.low),
        close: num(d.close),
        volume_usd: num(d.volume_usd),
        market_cap_close: num(mc?.close),
      };
    });
  }
  return rows
    .map((r): WalletRow => {
      const bought = num(r.bought_volume_usd ?? r.buy_volume_usd ?? r.total_bought_usd);
      const sold = num(r.sold_volume_usd ?? r.sell_volume_usd ?? r.total_sold_usd);
      const side: WalletRow["side"] = bought >= sold ? "buy" : "sell";
      const rawLabel = str(r.address_label ?? r.label ?? r.name).replace(/\s*\[[0-9a-zA-Z]{4,}\]\s*$/, "").trim();
      return {
        address: str(r.address ?? r.wallet_address ?? r.wallet),
        label: rawLabel || undefined,
        side,
        volume_usd: side === "buy" ? bought : sold,
      };
    })
    .filter((w) => w.address && w.volume_usd >= 100)
    .slice(0, perPage);
}

// --- best-effort in-memory guards (per server instance) ---
const hits = new Map<string, number[]>();
const cache = new Map<string, { at: number; body: LiveResponseBody }>();
// Anchored to Nansen's own reported balance, so it self-heals across instances:
// every real call refreshes it from the response header.
let lastRemaining: number | null = null;

/** Sliding-window per-IP limiter. Returns seconds to wait, or 0 if allowed. */
function rateLimited(ip: string): number {
  if (RECORDING_MODE) return 0;
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= rateMax()) {
    hits.set(ip, arr);
    return Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - arr[0])) / 1000));
  }
  arr.push(now);
  hits.set(ip, arr);
  return 0;
}

const rateMax = (): number => {
  const v = Math.floor(Number(process.env.NANSEN_RATE_MAX));
  return Number.isFinite(v) && v > 0 ? v : RATE_MAX_DEFAULT;
};
const minCredits = (): number => {
  const v = Number(process.env.NANSEN_MIN_CREDITS);
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_MIN_CREDITS;
};
const liveEnabled = (): boolean => !/^(0|false|off)$/i.test(process.env.NANSEN_LIVE_ENABLED ?? "");

/**
 * The proxy entry point. Validates + rate-limits the request, enforces the credit
 * floor, serves from cache when possible, otherwise makes ONE live Nansen call
 * with the server-side key and maps the response. Returns an HTTP status + body.
 */
export async function handleLiveQuery(
  raw: unknown,
  clientIp: string,
): Promise<{ status: number; body: LiveResponseBody }> {
  const key = process.env.NANSEN_API_KEY;
  if (!key || !liveEnabled()) {
    return {
      status: 503,
      body: { ok: false, error: "not_configured", message: "The live explorer isn't available right now." },
    };
  }

  const wait = rateLimited(clientIp);
  if (wait > 0) {
    return {
      status: 429,
      body: { ok: false, error: "rate_limited", retryAfter: wait, message: `Too many live queries — try again in ${wait}s.` },
    };
  }

  const v = validateInput(raw);
  if (!v.ok) return { status: 400, body: { ok: false, error: v.error, message: v.message } };
  const input = v.input;

  const ck = `${input.call}:${input.chain}:${input.token_address}:${input.from}:${input.to}:${input.per_page}`;
  const cached = cache.get(ck);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    const body = { ...cached.body, cached: true };
    await saveLast(clientIp, { input, body, at: Date.now() });
    return { status: 200, body };
  }

  if (!RECORDING_MODE && lastRemaining !== null && lastRemaining < minCredits()) {
    return {
      status: 503,
      body: {
        ok: false,
        error: "paused",
        message: "The live explorer is paused to protect the research account's credits. Please try later.",
      },
    };
  }

  const { endpoint, body, cost } = buildNansenRequest(input);
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: key },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 502, body: { ok: false, error: "upstream_error", message: "Couldn't reach Nansen. Try again." } };
  }

  const remaining = Number(res.headers.get("x-nansen-credits-remaining"));
  if (Number.isFinite(remaining)) lastRemaining = remaining;
  const costHeader = Number(res.headers.get("x-nansen-credits-cost"));
  const realCost = Number.isFinite(costHeader) && costHeader > 0 ? costHeader : cost;

  if (res.status === 429) {
    return {
      status: 429,
      body: { ok: false, error: "rate_limited", retryAfter: 10, message: "Nansen is rate-limiting right now — try again shortly." },
    };
  }
  if (!res.ok) {
    return {
      status: 502,
      body: { ok: false, error: "upstream_error", message: `Nansen returned ${res.status}. Check the token and chain, then retry.` },
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { status: 502, body: { ok: false, error: "upstream_error", message: "Nansen sent an unreadable response." } };
  }

  const data = mapResponse(input.call, json, input.per_page);
  const out: LiveResponseBody = {
    ok: true,
    call: input.call,
    chain: input.chain,
    count: data.length,
    data,
    request: { endpoint, body },
    credits: { cost: realCost },
    cached: false,
  };
  cache.set(ck, { at: Date.now(), body: out });
  await saveLast(clientIp, { input, body: out, at: Date.now() });
  return { status: 200, body: out };
}

/**
 * Returns the caller's last saved query (see shared/liveStore.ts) so the client can
 * restore their search + results after a reload. Reads only our own server-side store —
 * it never calls Nansen — so it works regardless of the API key. `ok:false` means there
 * is nothing to restore, or no persistence store is configured on this deployment.
 */
export async function handleRestore(clientIp: string): Promise<{ status: number; body: RestoreResponseBody }> {
  if (!storeConfigured()) return { status: 200, body: { ok: false, error: "not_configured" } };
  const saved = await loadLast(clientIp);
  if (!saved) return { status: 200, body: { ok: false, error: "none" } };
  return { status: 200, body: { ok: true, saved } };
}
