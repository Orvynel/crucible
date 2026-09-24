# Crucible

[![CI](https://github.com/Orvynel/crucible/actions/workflows/ci.yml/badge.svg)](https://github.com/Orvynel/crucible/actions/workflows/ci.yml)

**Does Smart Money actually predict price? Compose a rule. Backtest it against real history. See the edge over buy-and-hold — with no look-ahead.**

Crucible turns Nansen cohort flow data into a hypothesis tester. Pick a cohort (Smart Traders, Whales, Top-PnL wallets, Public Figures, Exchanges, Fresh Wallets), say what they must be doing (net buying or net selling, over any threshold), choose a holding period, and Crucible replays the rule across **990 point-in-time scenarios** built from **27 tokens across Ethereum, Base and Solana** — then scores it against the honest baseline: doing nothing.

The verdict is deliberately hard to game. It leads with **hit rate** and **median return** versus an "always in" baseline, because crypto forward returns are ferociously fat-tailed and a raw mean lies. Some signals win, some lose, some are noise — and Crucible says so.

Nothing is hidden behind the headline. Below every verdict sit **the receipts**: a sortable, paginated table of every scenario the signal fired on, and a per-trade drill-down showing all six cohorts' net-flow, the price at the decision date, the forward return at each horizon, the drawdown, and the **actual Smart Money wallets** behind that move — label, address, and dollars bought or sold — pulled from Nansen. Type any dollar amount into the equity panel to see what that stake would have done. It is research tooling, not financial advice.

## What it found

Straight from the shipped dataset (your own runs may refine these):

| Rule | Horizon | Hit rate | Baseline | Edge |
|---|---|---|---|---|
| **Public figures accumulating** | 30d | **73%** (182 trades) | 59% | **+14pp** |
| Fade Smart-Trader selling | 14d | 62% (225) | 55% | +8pp |
| Top-PnL wallets buying | 30d | 61% (399) | 59% | +2pp |
| **Following Smart-Trader buys** | 30d | **54%** (205) | 59% | **−5pp** |

The last row is the point: naively copying "smart money is buying" **underperformed just holding** in this universe and period. A backtester worth trusting has to be able to tell you that.

## How it works

**No look-ahead, by construction.** Each scenario pairs:
- a **signal** — a cohort's net USD flow over the 7 days *ending* on a decision date, and
- an **outcome** — the forward price move measured *strictly after* that date, from OHLCV closes at 1/3/7/14/30 days.

A rule is evaluated only against the signal, so it can never see the future it is tested on.

**Edge = signal vs. "always in."** For every horizon, the baseline is the same-horizon return across *all* scenarios (holding regardless of signal). A rule earns an edge only by beating that.

**Robust to outliers.** One token in this universe ran +86,000% in a week — enough to drag the naive 7-day mean to +88% while the median sat near 0%. So the headline metrics are hit rate and median. Any averaged or compounded figure (the equity curve, the mean stat) winsorizes each trade to ±200% so a single lottery ticket can't manufacture an edge. The equity curve compounds an **equal-weight basket per decision date** — an executable strategy, not a fantasy of reinvesting 100% into every overlapping trade — on a log axis.

## Architecture

Crucible never ships an API key and never calls Nansen from the browser.

```
 scripts/build-dataset.ts        public/data/dataset.json        src/  (React)
 ─────────────────────────  →   ──────────────────────────  →  ─────────────────
 offline builder, uses the       baked point-in-time dataset     static app runs the
 Nansen key once, disk-cached     (990 scenarios, committed)      backtest math live
```

- **Offline builder** ([scripts/build-dataset.ts](scripts/build-dataset.ts)) screens a liquid universe, then for each token pulls one flow-summary per decision date, one OHLCV series, and the top Smart Money wallets active in the signal window, and assembles no-look-ahead scenarios. Every call is disk-cached by `sha256(endpoint + body)`, so re-runs cost **zero credits** and the build is fully resumable.
- **Baked dataset** is a single static JSON. The live app is therefore crash-proof and offline-safe — no key, no rate limits, no runtime spend.
- **Backtest engine** ([shared/backtest.ts](shared/backtest.ts)) is pure, dependency-free, and identical in the builder and the browser.

Building the shipped dataset made **2,152 real Nansen calls** — 1,116 historical flow-summary, 1,002 who-bought-sold (the wallet identities), 30 OHLCV series, and 4 universe screens — comfortably over the buildathon's 1,000-call bar. At Nansen's per-endpoint pricing that is roughly **6,700 credits**.

## Run it (≈5 minutes)

```bash
npm install
npm run dev            # open http://localhost:5173 — uses the committed dataset, no key needed
```

To rebuild the dataset from live Nansen data:

```bash
cp .env.example .env.local     # then add your NANSEN_API_KEY
npm run smoke                  # ~11 credits: confirms auth + endpoint shapes
CONFIRM=1 npm run build:dataset   # full build (guarded; ~5.6k credits, resumable via cache)
```

`npm run build:dataset -- --sample` writes a tiny sample dataset for a near-free dry run.

## For judges — verify it in a minute

- **No key needed.** `npm install && npm run dev` runs the whole app against the committed dataset. Nothing calls the network at runtime.
- **No look-ahead, checkable.** Every scenario stores its decision date, the flow window *ending* on it, and forward returns measured *after* it ([shared/backtest.ts](shared/backtest.ts) is the single source of truth for both the builder and the browser — same math, no divergence).
- **Nansen drives the logic, not the decoration.** Four endpoints do the work: `tgm/historical-token-flow-summary` (the signal), `tgm/historical-token-ohlcv` (the outcome), `token-screener` (the universe), and `tgm/who-bought-sold` (the wallet identities in each drill-down).
- **Reproducible.** The disk cache makes a rebuild cost zero credits; delete `.cache/` and re-run to pay for a full rebuild from scratch. `npm run smoke` (~11 credits) confirms auth and endpoint shapes before any spend.
- **Honest by design.** Presets are calibrated to show winners, losers, *and* noise — including a signal that underperforms holding. The method and its limits are stated in-app and below.
- **Tested where it counts.** The backtest engine has a pure unit suite ([shared/backtest.test.ts](shared/backtest.test.ts)) that pins the invariants trust depends on: horizon filtering (no look-ahead leak), raw median vs winsorized mean, the equal-weight-basket equity curve and its drawdown, and that the receipts list always matches the aggregate count. `npm test` — green on every push via CI.

## Stack

Vite · React 18 · TypeScript (strict) · Tailwind. The equity curve is hand-drawn SVG — no chart dependency. Offline scripts run on `tsx`; the engine is unit-tested with Vitest and gated by GitHub Actions CI.

## Limits

Spot cohort flows only; no fees, slippage, or position sizing. Past behavior isn't predictive. Small trade counts are flagged, not hidden. This is research tooling, not financial advice.

