// Server-side per-visitor persistence for the live explorer. Each visitor's LAST
// query + its result are stored on OUR side (a Redis store reached over its REST API
// with fetch — no SDK, matching liveQuery.ts's fetch-only design) so a page reload
// restores them, and keyed by a SALTED HASH of the client IP so raw IPs are never
// written down and one visitor never sees another's. Entries carry a TTL and
// self-expire. If no store is configured the whole module quietly no-ops: the
// explorer still works, searches just don't survive a reload. Runs server-side only;
// the store credentials never reach the browser.
import { createHash } from "node:crypto";
import type { LiveQueryInput, LiveResponseBody } from "./liveTypes";

const TTL_SECONDS = 7 * 24 * 60 * 60; // a visitor's last search persists 7 days, then auto-expires
const KEY_PREFIX = "crucible:live:last:";

export interface SavedQuery {
  input: LiveQueryInput;
  body: LiveResponseBody;
  at: number;
}

// Vercel's Redis integrations inject one of these credential pairs; both speak the
// identical Upstash REST protocol, so we accept whichever the deployment provides.
function creds(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? "";
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

export const storeConfigured = (): boolean => creds() !== null;

// A salted hash, so the datastore holds only an opaque per-visitor key — never a raw IP.
function ipKey(ip: string): string {
  const salt = process.env.CRUCIBLE_IP_SALT ?? "crucible-live-v1";
  return KEY_PREFIX + createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

// One Redis command over the REST API: POST the command array, read back { result }.
async function command(c: { url: string; token: string }, args: (string | number)[]): Promise<unknown> {
  const res = await fetch(c.url, {
    method: "POST",
    headers: { authorization: `Bearer ${c.token}`, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`store HTTP ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result;
}

/** Persist this visitor's last query. Best-effort: a store hiccup never breaks a query. */
export async function saveLast(ip: string, saved: SavedQuery): Promise<void> {
  const c = creds();
  if (!c) return;
  try {
    await command(c, ["SET", ipKey(ip), JSON.stringify(saved), "EX", TTL_SECONDS]);
  } catch {
    // swallow — persistence is a nicety, never a hard dependency of the live call
  }
}

/** Load this visitor's last saved query, or null if none / not configured / on error. */
export async function loadLast(ip: string): Promise<SavedQuery | null> {
  const c = creds();
  if (!c) return null;
  try {
    const result = await command(c, ["GET", ipKey(ip)]);
    if (typeof result !== "string") return null;
    return JSON.parse(result) as SavedQuery;
  } catch {
    return null;
  }
}
