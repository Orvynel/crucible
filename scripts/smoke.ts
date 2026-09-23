// Tiny, cheap smoke test: proves the client + cache + auth work and reveals the
// EXACT response envelopes before we write typed normalizers. Makes at most a
// handful of network calls (~11 credits) the first time; free on every rerun.
//
//   npm run smoke
import { config } from "dotenv";
config({ path: ".env.local" });

const { post, stats, bases } = await import("./nansen/client.ts");

function show(label: string, data: unknown) {
  const json = JSON.stringify(data, null, 2);
  console.log(`\n===== ${label} =====`);
  console.log(json.length > 2500 ? json.slice(0, 2500) + "\n... [truncated]" : json);
}

const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";

try {
  // 1) token-screener (1 credit) — pick a token universe later from this.
  const screener = await post(
    "token-screener",
    { chains: ["ethereum"], timeframe: "24h", pagination: { page: 1, per_page: 5 } },
    { base: bases.V1, cost: 1 },
  );
  show("token-screener (ethereum, top 5)", screener);

  // 2) historical-token-flow-summary (5 credits) — THE SIGNAL.
  const flow = await post(
    "tgm/historical-token-flow-summary",
    { chain: "ethereum", token_address: USDT, date_range: { from: "2026-08-08", to: "2026-08-15" } },
    { cost: 5 },
  );
  show("historical-token-flow-summary (USDT, 2026-08-08..15)", flow);

  // 3) historical-token-ohlcv (5 credits) — THE OUTCOME.
  const ohlcv = await post(
    "tgm/historical-token-ohlcv",
    { chain: "ethereum", token_address: USDT, timeframe: "1d", date_from: "2026-08-15", as_of_date: "2026-09-15" },
    { cost: 5 },
  );
  show("historical-token-ohlcv (USDT, 2026-08-15..09-15, 1d)", ohlcv);
} finally {
  console.log("\n----- ledger -----");
  console.log(`network calls: ${stats.networkCalls}  cache hits: ${stats.cacheHits}`);
  console.log(`credits spent this run: ${stats.creditsSpent}`);
  console.log(`credits remaining (from header): ${stats.creditsRemaining ?? "n/a"}`);
}
