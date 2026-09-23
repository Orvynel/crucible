# Crucible

**Does Smart Money actually predict price? Compose a rule. Backtest it against real history. See the edge over buy-and-hold — with no look-ahead.**

Crucible turns Nansen cohort flow data into a hypothesis tester. Pick a cohort (Smart Traders, Whales, Top-PnL wallets, Public Figures, Exchanges, Fresh Wallets), say what they must be doing (net buying or net selling, over any threshold), choose a holding period, and Crucible replays the rule across **990 point-in-time scenarios** built from **27 tokens across Ethereum, Base and Solana** — then scores it against the honest baseline: doing nothing.

The verdict is deliberately hard to game. It leads with **hit rate** and **median return** versus an "always in" baseline, because crypto forward returns are ferociously fat-tailed and a raw mean lies. Some signals win, some lose, some are noise — and Crucible says so.

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

- **Offline builder** ([scripts/build-dataset.ts](scripts/build-dataset.ts)) screens a liquid universe, then for each token pulls one flow-summary per decision date and one OHLCV series, and assembles no-look-ahead scenarios. Every call is disk-cached by `sha256(endpoint + body)`, so re-runs cost **zero credits** and the build is fully resumable.
- **Baked dataset** is a single static JSON. The live app is therefore crash-proof and offline-safe — no key, no rate limits, no runtime spend.
- **Backtest engine** ([shared/backtest.ts](shared/backtest.ts)) is pure, dependency-free, and identical in the builder and the browser.

Building the full shipped dataset cost **5,645 Nansen credits across 1,129 network calls** — comfortably over the buildathon's 1,000-call bar, with most of the budget left untouched.

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

## Stack

Vite · React 18 · TypeScript (strict) · Tailwind. The equity curve is hand-drawn SVG — no chart dependency. Offline scripts run on `tsx`.

## Limits

Spot cohort flows only; no fees, slippage, or position sizing. Past behavior isn't predictive. Small trade counts are flagged, not hidden. This is research tooling, not financial advice.

