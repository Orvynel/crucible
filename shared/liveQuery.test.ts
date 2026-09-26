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

  it("accepts a widened EVM chain on wallets (arbitrum)", () => {
    expect(pass({ call: "wallets", chain: "arbitrum", token_address: UNI }).chain).toBe("arbitrum");
  });

  it("accepts a non-EVM/non-Solana chain with a plausible address (tron on wallets)", () => {
    const r = validateInput({ call: "wallets", chain: "tron", token_address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" });
    expect(r.ok).toBe(true);
  });

  it("rejects a chain the chosen call doesn't support (bitcoin on flows)", () => {
    const r = validateInput({ call: "flows", chain: "bitcoin", token_address: "irrelevant" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_input");
  });

  it("accepts bitcoin on the screener, where Nansen supports it — but not on OHLCV", () => {
    expect(pass({ call: "screener", chain: "bitcoin" }).chain).toBe("bitcoin");
    expect(validateInput({ call: "ohlcv", chain: "bitcoin", token_address: UNI }).ok).toBe(false);
  });

  // Regression for the exact 422 a user hit: Nansen flow-summary accepts only
  // base/bnb/ethereum/solana, so wider chains must be rejected before we ever spend.
  it("rejects robinhood on flows (verified live: flow-summary supports only eth/solana/base/bnb)", () => {
    const r = validateInput({ call: "flows", chain: "robinhood", token_address: UNI });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_input");
  });

  it("accepts hyperliquid on OHLCV but rejects it on flows (verified live)", () => {
    expect(pass({ call: "ohlcv", chain: "hyperliquid", token_address: UNI }).chain).toBe("hyperliquid");
    expect(validateInput({ call: "flows", chain: "hyperliquid", token_address: UNI }).ok).toBe(false);
  });

  it("accepts citrea on the screener but not on OHLCV", () => {
    expect(pass({ call: "screener", chain: "citrea" }).chain).toBe("citrea");
    expect(validateInput({ call: "ohlcv", chain: "citrea", token_address: UNI }).ok).toBe(false);
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

  it("passes the selected chain through to the screener body", () => {
    const req = buildNansenRequest({
      call: "screener",
      chain: "arbitrum",
      token_address: "",
      from: "2026-02-01",
      to: "2026-02-08",
      per_page: 10,
    });
    expect((req.body as { chains: string[] }).chains).toEqual(["arbitrum"]);
  });
});
