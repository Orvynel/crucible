// Every chain the four live Nansen "Token God Mode" calls support, with the EXACT
// slug each endpoint expects. VERIFIED against Nansen's live API — each endpoint's own
// 422 "Valid options are: …" body is the source of truth, NOT the published docs
// (which overstate the flow/OHLCV sets). The sets differ sharply per endpoint: the
// screener is broad (27 chains, incl. citrea + bitcoin) and who-bought-sold nearly as
// broad (26), but flow-summary accepts only 4 (base/bnb/ethereum/solana) and OHLCV
// only 5 (those + hyperliquid). So the allowlist is keyed by call, never one universal
// list. Pure data + validators: imported by BOTH the server core (liveQuery.ts) and
// the browser (LiveExplorer) — no env, no fetch, nothing that could drag the
// key-holding proxy into the client bundle.
import type { LiveCall } from "./liveTypes";

// Order here is display order (popular chains first); membership is what matters.
export const SCREENER_CHAINS = [
  "ethereum", "solana", "base", "bnb", "arbitrum", "optimism", "polygon", "avalanche",
  "sonic", "linea", "mantle", "hyperevm", "monad", "sei", "tron", "ton", "sui", "near",
  "starknet", "injective", "mantra", "iotaevm", "plasma", "arc", "robinhood", "citrea", "bitcoin",
] as const;

// flow-summary is the strictest endpoint: Nansen accepts exactly these 4 (verified
// live — a 422 "Valid options are: 'base', 'bnb', 'ethereum' or 'solana'" otherwise).
export const FLOW_CHAINS = ["ethereum", "solana", "base", "bnb"] as const;

// OHLCV adds hyperliquid to the flow set — and nothing else (verified live).
export const OHLCV_CHAINS = ["ethereum", "solana", "base", "bnb", "hyperliquid"] as const;

// who-bought-sold is broad — 26 chains (verified live), NOT the flow set. It has its
// own explicit list; do not re-alias it to FLOW_CHAINS.
export const WALLET_CHAINS = [
  "ethereum", "solana", "base", "bnb", "arbitrum", "optimism", "polygon", "avalanche",
  "sonic", "linea", "mantle", "hyperevm", "hyperliquid", "monad", "sei", "tron", "ton", "sui",
  "near", "starknet", "injective", "mantra", "iotaevm", "plasma", "arc", "robinhood",
] as const;

export type LiveChain =
  | (typeof SCREENER_CHAINS)[number]
  | (typeof FLOW_CHAINS)[number]
  | (typeof OHLCV_CHAINS)[number]
  | (typeof WALLET_CHAINS)[number];

export const CALL_CHAINS: Record<LiveCall, readonly LiveChain[]> = {
  screener: SCREENER_CHAINS,
  flows: FLOW_CHAINS,
  ohlcv: OHLCV_CHAINS,
  wallets: WALLET_CHAINS,
};

export const CHAIN_LABELS: Record<LiveChain, string> = {
  ethereum: "Ethereum", solana: "Solana", base: "Base", bnb: "BNB Chain",
  arbitrum: "Arbitrum", optimism: "Optimism", polygon: "Polygon", avalanche: "Avalanche",
  sonic: "Sonic", linea: "Linea", mantle: "Mantle", hyperevm: "HyperEVM",
  hyperliquid: "Hyperliquid", monad: "Monad", sei: "Sei", tron: "Tron",
  ton: "TON", sui: "Sui", near: "NEAR", starknet: "Starknet",
  injective: "Injective", mantra: "Mantra", iotaevm: "IOTA EVM", plasma: "Plasma",
  arc: "Arc", robinhood: "Robinhood", citrea: "Citrea", bitcoin: "Bitcoin",
};

export function isChainAllowed(call: LiveCall, chain: string): boolean {
  return (CALL_CHAINS[call] as readonly string[]).includes(chain);
}

// --- token-address shape checks ---
// We validate strictly for the two families we can verify with confidence (classic
// EVM 0x-addresses and Solana base58 mints) so obvious mistakes get instant feedback.
// Every other chain (Sui/Aptos long-hex, Cosmos bech32, Tron, TON, Bitcoin, Near, …)
// gets a permissive sanity check and Nansen is the final authority — a bad address
// there costs one bounded credit and returns a friendly upstream error, which is far
// safer than us guessing 30+ address formats and wrongly rejecting valid tokens.
const EVM_STRICT = new Set<string>([
  "ethereum", "base", "arbitrum", "optimism", "polygon", "bnb", "avalanche",
  "linea", "mantle", "sonic", "hyperevm", "hyperliquid", "iotaevm", "monad",
]);
const EVM_ADDR = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const GENERIC_ADDR = /^[A-Za-z0-9][A-Za-z0-9:._-]{5,119}$/;

export type AddrHint = "evm" | "solana" | "other";

export function addrHint(chain: string): AddrHint {
  if (chain === "solana") return "solana";
  return EVM_STRICT.has(chain) ? "evm" : "other";
}

export function tokenLooksValid(chain: string, addr: string): boolean {
  const a = addr.trim();
  if (!a) return false;
  const hint = addrHint(chain);
  if (hint === "evm") return EVM_ADDR.test(a);
  if (hint === "solana") return SOL_ADDR.test(a);
  return GENERIC_ADDR.test(a);
}

export function tokenPlaceholder(chain: string): string {
  const hint = addrHint(chain);
  if (hint === "evm") return "0x… token contract";
  if (hint === "solana") return "Mint address (base58)";
  return "Token address";
}
