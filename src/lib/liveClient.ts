import type { LiveQueryInput, LiveResponseBody, RestoreResponseBody } from "@shared/liveTypes";

/**
 * Calls our own same-origin proxy (/api/nansen), which holds the Nansen key
 * server-side — the key never reaches the browser. Returns the proxy's structured
 * body for any HTTP status; only a transport/parse failure yields a synthetic
 * error (e.g. on a static host with no serverless function, like gh-pages).
 */
export async function runLiveQuery(input: LiveQueryInput): Promise<LiveResponseBody> {
  try {
    const res = await fetch("/api/nansen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const text = await res.text();
    try {
      return JSON.parse(text) as LiveResponseBody;
    } catch {
      return {
        ok: false,
        error: "network",
        message: res.ok
          ? "Unexpected response from the server."
          : "The live explorer isn't available on this host — it needs the deployed API.",
      };
    }
  } catch {
    return { ok: false, error: "network", message: "Network error — check your connection and try again." };
  }
}

/**
 * Asks the proxy for this visitor's last saved query, so a page reload restores their
 * search + results. The record lives on the SERVER (keyed to their IP), never in the
 * browser. Any failure resolves to "nothing saved" so the explorer just opens fresh.
 */
export async function restoreLastQuery(): Promise<RestoreResponseBody> {
  try {
    const res = await fetch("/api/nansen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    return JSON.parse(await res.text()) as RestoreResponseBody;
  } catch {
    return { ok: false, error: "none" };
  }
}
