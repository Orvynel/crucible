// Offline dataset builder. Fetches real Nansen point-in-time signals + forward
// prices ONCE, caches every call to disk, and bakes public/data/dataset.json for
// the static app. Run tiny first, then the full build:
//
//   npm run build:dataset -- --sample      (2 tokens, cheap end-to-end proof)
//   CONFIRM=1 npm run build:dataset          (full run; needs the credit gate)
//
// Credit math (full): ~25 tokens x (1 OHLCV + ~40 flow) = ~1,025 calls ~= 5,125
// credits. One OHLCV call per token covers every as_of; only flow is per-date.
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Chain, Dataset, Scenario, TokenRef } from "../shared/types.ts";

const { screenTokens, fetchFlow, fetchOhlcv } = await import("./nansen/api.ts");
const { stats } = await import("./nansen/client.ts");

const SAMPLE = process.argv.includes("--sample");

const CFG = {
  chains: ["ethereum", "base", "solana"] as Chain[],
  perChain: SAMPLE ? 1 : 9, // tokens kept per chain after filtering
  horizons: [1, 3, 7, 14, 30],
  flowWindowDays: 7,
  asOfStart: "2026-02-01",
  asOfEnd: "2026-08-20", // + 30d forward stays before today (2026-09-23)
  asOfStepDays: SAMPLE ? 60 : 5,
  ohlcvEnd: "2026-09-23",
  minLiquidityUsd: 2_000_000,
  minMarketCapUsd: 20_000_000,
};

const STABLE = /^(usdt|usdc|dai|usds|usde|fdusd|tusd|usdg|pyusd|frax|lusd|gusd|susd|usd0|usdl|usd1|crvusd|usdz|usdd|buidl)$/i;

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const parse = (d: string) => Date.parse(d + "T00:00:00Z");

function asOfDates(): string[] {
  const out: string[] = [];
  for (let t = parse(CFG.asOfStart); t <= parse(CFG.asOfEnd); t += CFG.asOfStepDays * DAY) {
    out.push(iso(t));
  }
  return out;
}

async function pickUniverse(): Promise<TokenRef[]> {
  const universe: TokenRef[] = [];
  for (const chain of CFG.chains) {
    const rows = await screenTokens(chain, 100);
    const kept = rows
      .filter(
        (r) =>
          !STABLE.test(r.token_symbol ?? "") &&
          Math.abs(r.price_usd - 1) > 0.05 && // drop $1-pegged stablecoins (no signal to backtest)
          r.liquidity >= CFG.minLiquidityUsd &&
          r.market_cap_usd >= CFG.minMarketCapUsd &&
          !!r.token_address,
      )
      .sort((a, b) => b.liquidity - a.liquidity)
      .slice(0, CFG.perChain)
      .map((r) => ({ chain, token_address: r.token_address, symbol: r.token_symbol }));
    universe.push(...kept);
  }
  return universe;
}

type CloseSeries = { dates: string[]; close: Record<string, number>; low: Record<string, number> };

function closeAtOrBefore(s: CloseSeries, target: string): number | null {
  let found: number | null = null;
  for (const d of s.dates) {
    if (d <= target) found = s.close[d];
    else break;
  }
  return found;
}

function buildScenario(token: TokenRef, asOf: string, s: CloseSeries, flows: Scenario["signal"]): Scenario | null {
  const base = closeAtOrBefore(s, asOf);
  if (!base || base <= 0) return null;

  const forward_return: Record<string, number> = {};
  for (const h of CFG.horizons) {
    const future = closeAtOrBefore(s, iso(parse(asOf) + h * DAY));
    if (future && future > 0) forward_return[String(h)] = future / base - 1;
  }
  if (Object.keys(forward_return).length === 0) return null;

  const maxH = Math.max(...CFG.horizons);
  let maxDrawdown = 0;
  for (const d of s.dates) {
    if (d > asOf && d <= iso(parse(asOf) + maxH * DAY)) {
      maxDrawdown = Math.min(maxDrawdown, (s.low[d] ?? s.close[d]) / base - 1);
    }
  }

  return {
    id: `${token.chain}:${token.symbol}:${asOf}`,
    token,
    as_of: asOf,
    signal: flows,
    price_at_as_of: base,
    outcome: { forward_return, max_drawdown: maxDrawdown },
    provenance: { flow_window_days: CFG.flowWindowDays, fetched_at: new Date().toISOString() },
  };
}

async function main() {
  const dates = asOfDates();
  const universe = await pickUniverse();
  const projectedCalls = universe.length * (1 + dates.length);
  console.log(`universe: ${universe.length} tokens  as_of dates: ${dates.length}`);
  console.log(`projected network calls (first run): ~${projectedCalls}  (~${projectedCalls * 5} credits max)`);
  console.log(universe.map((t) => `${t.chain}/${t.symbol}`).join(", "));

  if (!SAMPLE && process.env.CONFIRM !== "1") {
    console.log("\nFull run guard: re-run with CONFIRM=1 to spend credits. (Cached calls are free.)");
    return;
  }

  const scenarios: Scenario[] = [];
  for (const token of universe) {
    const candles = await fetchOhlcv(token.chain, token.token_address, CFG.asOfStart, CFG.ohlcvEnd);
    const series: CloseSeries = { dates: [], close: {}, low: {} };
    for (const c of candles.sort((a, b) => a.interval_start.localeCompare(b.interval_start))) {
      const d = c.interval_start.slice(0, 10);
      series.dates.push(d);
      series.close[d] = c.close;
      series.low[d] = c.low;
    }
    if (series.dates.length === 0) {
      console.log(`  ! no OHLCV for ${token.chain}/${token.symbol}, skipping`);
      continue;
    }
    let kept = 0;
    for (const asOf of dates) {
      const from = iso(parse(asOf) - CFG.flowWindowDays * DAY);
      const flow = await fetchFlow(token.chain, token.token_address, from, asOf);
      if (!flow) continue;
      const sc = buildScenario(token, asOf, series, flow.flows);
      if (sc) {
        scenarios.push(sc);
        kept++;
      }
    }
    console.log(`  ${token.chain}/${token.symbol}: ${kept} scenarios  (credits so far ${stats.creditsSpent}, ~${stats.creditsRemaining} left)`);
  }

  const dataset: Dataset = {
    version: "1.0.0",
    built_at: new Date().toISOString(),
    horizons: CFG.horizons,
    flow_window_days: CFG.flowWindowDays,
    tokens: universe,
    scenarios,
    meta: { api_calls_made: stats.networkCalls, credits_spent: stats.creditsSpent, source: "Nansen API" },
  };

  const outDir = path.resolve(process.cwd(), "public", "data");
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, SAMPLE ? "dataset.sample.json" : "dataset.json");
  await writeFile(outFile, JSON.stringify(dataset, null, 2), "utf8");

  console.log(`\nwrote ${outFile}`);
  console.log(`scenarios: ${scenarios.length}  network calls: ${stats.networkCalls}  cache hits: ${stats.cacheHits}`);
  console.log(`credits spent this run: ${stats.creditsSpent}  remaining: ${stats.creditsRemaining ?? "n/a"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
