import { describe, expect, it } from "vitest";
import { buildNansenRequest, validateInput, type NormalizedInput } from "./liveQuery";

// A real (checksummed) ERC-20 address and a real Solana mint, for shape checks.
const UNI = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
const WSOL = "So11111111111111111111111111111111111111112";

function pass(raw: unknown): NormalizedInput {
  const r = validateInput(raw);
  if (!r.ok) throw new Error(`expected valid, got: ${r.message}`);
  return r.input;
}

describe("validateInput", () => {
  it("rejects an unknown call type", () => {
    const r = validateInput({ call: "delete-everything", chain: "ethereum" });
    expect(r.ok).toBe(false);
  });

  it("rejects an unsupported chain", () => {
    const r = validateInput({ call: "screener", chain: "dogecoin" });
    expect(r.ok).toBe(false);
  });

  it("requires a token address for non-screener calls", () => {
    const r = validateInput({ call: "flows", chain: "ethereum" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_token");
  });

  it("rejects a malformed token address", () => {
    const r = validateInput({ call: "flows", chain: "ethereum", token_address: "0xnope" });
    expect(r.ok).toBe(false);
  });

  it("accepts a valid EVM address", () => {
    expect(pass({ call: "flows", chain: "ethereum", token_address: UNI }).token_address).toBe(UNI);
  });

  it("accepts a valid Solana address on solana", () => {
    expect(pass({ call: "wallets", chain: "solana", token_address: WSOL }).token_address).toBe(WSOL);
  });

  it("rejects a Solana address submitted on an EVM chain", () => {
    const r = validateInput({ call: "flows", chain: "ethereum", token_address: WSOL });
    expect(r.ok).toBe(false);
  });

  it("ignores any token address for the screener", () => {
    expect(pass({ call: "screener", chain: "base", token_address: UNI }).token_address).toBe("");
  });

  it("clamps per_page to the allowed maximum", () => {
    expect(pass({ call: "screener", chain: "ethereum", per_page: 999 }).per_page).toBe(25);
  });

  it("clamps an oversized date range to 90 days", () => {
    const i = pass({ call: "flows", chain: "ethereum", token_address: UNI, from: "2025-01-01", to: "2026-06-01" });
    const days = Math.round((Date.parse(i.to) - Date.parse(i.from)) / 86_400_000);
    expect(days).toBeLessThanOrEqual(90);
  });

  it("swaps a reversed date range", () => {
    const i = pass({ call: "flows", chain: "ethereum", token_address: UNI, from: "2026-02-10", to: "2026-02-01" });
    expect(Date.parse(i.from)).toBeLessThanOrEqual(Date.parse(i.to));
  });
});

describe("buildNansenRequest", () => {
  it("maps each call to its Nansen endpoint", () => {
    const base: Omit<NormalizedInput, "call"> = {
      chain: "ethereum",
      token_address: UNI,
      from: "2026-02-01",
      to: "2026-02-08",
      per_page: 10,
    };
    expect(buildNansenRequest({ ...base, call: "screener" }).endpoint).toContain("/token-screener");
    expect(buildNansenRequest({ ...base, call: "flows" }).endpoint).toContain("/historical-token-flow-summary");
    expect(buildNansenRequest({ ...base, call: "ohlcv" }).endpoint).toContain("/historical-token-ohlcv");
    expect(buildNansenRequest({ ...base, call: "wallets" }).endpoint).toContain("/who-bought-sold");
  });

  it("prices each call to match Nansen's per-endpoint credit cost", () => {
    const base: Omit<NormalizedInput, "call"> = {
      chain: "ethereum",
      token_address: UNI,
      from: "2026-02-01",
      to: "2026-02-08",
      per_page: 10,
    };
    expect(buildNansenRequest({ ...base, call: "screener" }).cost).toBe(1);
    expect(buildNansenRequest({ ...base, call: "flows" }).cost).toBe(5);
    expect(buildNansenRequest({ ...base, call: "ohlcv" }).cost).toBe(5);
    expect(buildNansenRequest({ ...base, call: "wallets" }).cost).toBe(1);
  });
});
