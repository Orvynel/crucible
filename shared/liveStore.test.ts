import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadLast, saveLast, storeConfigured, type SavedQuery } from "./liveStore";

// Pure-ish tests for the persistence adapter: the store is reached over fetch, so we
// stub fetch and assert the exact Redis commands. No network, no real store.
const SAVED: SavedQuery = {
  input: { call: "flows", chain: "ethereum", token_address: "0xabc" },
  body: { ok: true, call: "flows", chain: "ethereum", count: 6, data: [] },
  at: 1_700_000_000_000,
};

function clearEnv(): void {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearEnv();
});

describe("liveStore without a configured store", () => {
  it("reports not-configured and quietly no-ops", async () => {
    clearEnv();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(storeConfigured()).toBe(false);
    expect(await loadLast("1.2.3.4")).toBeNull();
    await saveLast("1.2.3.4", SAVED); // must resolve, not throw
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("liveStore with a configured store", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://demo.upstash.io/";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  });

  it("is reported as configured", () => {
    expect(storeConfigured()).toBe(true);
  });

  it("SETs the serialized query under a hashed, IP-derived key with a TTL", async () => {
    const bodies: (string | number)[][] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(init.body as string));
        return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
      }),
    );
    await saveLast("203.0.113.7", SAVED);
    expect(bodies).toHaveLength(1);
    const cmd = bodies[0];
    expect(cmd[0]).toBe("SET");
    expect(String(cmd[1])).toMatch(/^crucible:live:last:/);
    expect(String(cmd[1])).not.toContain("203.0.113.7"); // raw IP is never written down
    expect(cmd[2]).toBe(JSON.stringify(SAVED));
    expect(cmd[3]).toBe("EX");
    expect(Number(cmd[4])).toBeGreaterThan(0);
  });

  it("round-trips a saved query via GET", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ result: JSON.stringify(SAVED) }), { status: 200 })),
    );
    expect(await loadLast("203.0.113.7")).toEqual(SAVED);
  });

  it("isolates visitors: distinct IPs get distinct keys, one IP stays stable", async () => {
    const keys: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        keys.push((JSON.parse(init.body as string) as string[])[1]);
        return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
      }),
    );
    await saveLast("10.0.0.1", SAVED);
    await saveLast("10.0.0.2", SAVED);
    await saveLast("10.0.0.1", SAVED);
    expect(keys[0]).not.toBe(keys[1]); // one visitor never collides with another
    expect(keys[0]).toBe(keys[2]); // the same visitor maps to the same record
  });

  it("returns null and never throws when the store errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream boom", { status: 500 })),
    );
    expect(await loadLast("10.0.0.1")).toBeNull();
    await saveLast("10.0.0.1", SAVED); // must resolve, not throw
  });
});
