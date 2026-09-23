// Typed, cached, rate-limit-aware Nansen client used ONLY offline (scripts/).
// The API key is read from the environment and never leaves this process.
//
// Every response is cached to disk (see lib/cache.ts) so a given (endpoint, body)
// pair is fetched at most once across all runs. `stats` tracks real network calls
// and credits so the builder can print an honest ledger and stop before the budget.

import { readCache, writeCache } from "../lib/cache.ts";

const V1 = "https://api.nansen.ai/api/v1";
const V1BETA = "https://api.nansen.ai/api/v1beta1";

const KEY = process.env.NANSEN_API_KEY;
if (!KEY) {
  throw new Error("NANSEN_API_KEY is not set. Copy .env.example to .env.local and add your key.");
}

export const stats = {
  networkCalls: 0,
  cacheHits: 0,
  creditsSpent: 0,
  creditsRemaining: null as number | null,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PostOpts {
  base?: string; // defaults to V1BETA
  cost: number; // credit cost per network call, for the ledger
  maxRetries?: number;
}

/**
 * POST a Nansen endpoint. Returns parsed JSON. Uses the disk cache first; only
 * counts credits/among stats when an actual network call is made. Retries 429/5xx
 * with backoff, honoring Retry-After.
 */
export async function post<T = unknown>(
  path: string,
  body: unknown,
  opts: PostOpts,
): Promise<T> {
  const base = opts.base ?? V1BETA;
  const endpoint = `${base}/${path}`;

  const cached = await readCache<T>(endpoint, body);
  if (cached !== null) {
    stats.cacheHits++;
    return cached;
  }

  const maxRetries = opts.maxRetries ?? 5;
  let attempt = 0;
  for (;;) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: KEY as string },
      body: JSON.stringify(body),
    });

    const remaining = res.headers.get("x-nansen-credits-remaining");
    if (remaining !== null) stats.creditsRemaining = Number(remaining);

    if (res.status === 429 || res.status >= 500) {
      if (attempt++ >= maxRetries) {
        throw new Error(`Nansen ${res.status} on ${path} after ${maxRetries} retries`);
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500;
      await sleep(wait);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Nansen ${res.status} on ${path}: ${text.slice(0, 500)}`);
    }

    const data = (await res.json()) as T;
    stats.networkCalls++;
    stats.creditsSpent += opts.cost;
    await writeCache(endpoint, body, data);
    return data;
  }
}

export const bases = { V1, V1BETA };
