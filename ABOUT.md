<div align="center">

# Crucible — the full walkthrough

### Does Smart Money actually predict price?

**Compose an onchain Smart Money signal, backtest it against real point-in-time history, and see the honest edge over buy-and-hold — with no look-ahead.**

[**▶ Try it live**](https://crucible-gules-six.vercel.app) · [**Source**](https://github.com/Orvynel/crucible) · Built on **Nansen** point-in-time data

The quick overview is in the [README](README.md). This document walks through every part of the site and project, in full.

</div>

---

## The question this project answers

"Smart Money" is the most repeated phrase in onchain research. Follow the whales. Copy the top-PnL wallets. Watch what the funds and public figures are buying. The pitch is always the same: *these people know something, so their flows are free alpha.*

Almost nobody checks whether that is true.

**Crucible is the check.** It takes Nansen's labelled Smart Money cohorts — the actual wallets Nansen classifies as skilled traders, whales, top-PnL, public figures, exchanges and fresh wallets — and asks a single, testable question: **when a cohort was net-buying (or net-selling) a token, did the price actually move the way the story says it should?**

Not "did it work once for one lucky token." Across **990 point-in-time scenarios**, on **27 tokens**, across **3 chains**, with **no look-ahead** — measured the only honest way: against what would have happened if you had simply held.

Some signals have a real edge. Some are worth fading. Most are noise. Crucible shows you which is which, and shows its work.

---

## How it works, in one loop

1. **Compose a signal.** Pick one or more Smart Money cohorts and a condition — *net-buying ≥ $X*, or *net-selling ≤ –$X*. Combine several with **match all** or **match any**. Choose how long you'd hold: **1, 3, 7, 14 or 30 days**.
2. **Backtest it instantly.** Crucible replays that rule across every historical decision date in the dataset and pairs each firing with the price move that came *strictly after* it.
3. **Read the verdict.** A plain-English answer — *has an edge / fade this / no real edge / too few trades* — headlined by the numbers that survive outliers.
4. **Check the receipts.** Every trade behind the verdict is listed: the cohort flows that fired it, the forward return, the drawdown, the price at the decision date, and — on most trades — the exact Nansen wallets, labels and dollar amounts.
5. **Test the data yourself.** A built-in **live Nansen API explorer** lets anyone run the same endpoints Crucible is built on, live, against real onchain data — proof the numbers aren't invented.

No wallet. No sign-up. Nothing to install. Open the link and interrogate it.

---

## The honesty methodology — why you can trust the number

Most "alpha" tools flatter their own signal. Crucible is built to be hard on itself. Five design decisions make the difference:

### 1. No look-ahead, ever
Every scenario is **point-in-time**. The signal is a cohort's net-flow measured over the **7 days ending on a decision date**. The outcome is the price move measured **strictly after** that date. A rule can never see the future it is tested on — the data model itself enforces the split, so there is no way to accidentally peek.

### 2. Hit rate and median headline the verdict — not the average
Crypto returns are fat-tailed: one lottery-ticket token can drag an average anywhere. So the verdict is driven by two outlier-robust measures:
- **Hit rate** — how often price was *higher* after the hold. The honest "was this better than a coin flip?" question.
- **Median return** — the *typical* trade, the middle outcome of every firing. One 40× can't fake it.

### 3. Everything is measured as an *edge over holding*
A 60% hit rate means nothing if simply holding won 60% of the time too. So every signal is scored against the **"always-in" baseline** at the same horizon — what you'd have gotten by ignoring the signal and just holding. The headline figure is the **edge in percentage points (pp)**: the signal minus the baseline. Positive = Smart Money added something. Negative = you'd have done better doing nothing.

### 4. Averages and the equity curve are winsorized
Where an average *is* shown — the mean return and the compounding equity curve — every trade's return is **capped at ±200%** before it's counted. A single moonshot can't manufacture a fake edge. (The hit rate and median use raw, uncapped returns; they don't need the cap.)

### 5. The verdict refuses to overclaim
- Fewer than **30 firing trades** → *"Too few trades"*. The tool tells you to loosen the rule instead of pretending a 5-sample result means anything.
- A hit-rate edge inside **±3 percentage points** → *"No real edge"*. That band is treated as statistical noise, not signal.
- Only a clear, sufficiently-sampled edge earns *"This signal has an edge"* — or, if the crowd was consistently wrong, *"Fade this signal."*

The result is a tool that will happily tell you a beloved signal is worthless. That's the point.

---

## A guided tour of the site

### The landing
The entry screen states the question directly — **"Does Smart Money actually predict price?"** — and, underneath it, the promise: *compose a Smart Money flow signal, backtest it against real point-in-time history, and see the honest edge over buy-and-hold, with no look-ahead.* Three live preset cards float in, each already showing its real edge in percentage points and its hold length, so the value is visible before you click anything. A single call to action — **"Run the backtest →"** — drops you into the workspace, next to the count of point-in-time scenarios behind it.

A short glossary sits at the foot of the page so no term is a mystery on arrival:
- **pp** — percentage points.
- **edge vs holding** — better or worse than simply buying and holding.
- **no look-ahead** — only prices *after* the signal are ever counted.

And, plainly: *educational research built on real Nansen data — not investment advice.*

### The workspace
Clicking through reveals a two-part layout: a fixed **sidebar** for choosing what to test, and a **main panel** that shows the answer and all of its evidence.

### The sidebar — choose or compose a signal
- **Signals.** Four calibrated presets, each showing its real edge in pp right in the list, coloured green or red so you can see at a glance which ones worked:
  - *Public figures accumulating* — when labelled public figures are net buyers, held 30 days.
  - *Following Smart Trader buys* — buy when Smart Traders are net buyers: does copying them actually work?
  - *Fade Smart Trader selling* — buy when Smart Traders are net *sellers*, held 14 days.
  - *Top PnL wallets buying* — when the highest-realized-profit wallets are net buyers, held 30 days.

  The spread is deliberate — some win, some lose, some are noise — because a tool that always flatters Smart Money isn't honest.
- **Compose your own.** A live rule builder (detailed below).
- **Live API explorer.** A pulsing entry point into the live Nansen explorer.

### The composer — build any signal
The composer turns a plain-English idea into a testable rule:
- **match all / match any** — require every condition at once, or fire when any one of them is true.
- Each **condition** is a Smart Money **cohort** plus a direction and threshold: **net-buy ≥ $X** or **net-sell ≤ –$X**, set with a dollar field and a slider that flips sign with the direction.
- **+ add condition** stacks as many cohorts as you want — e.g. *Whales net-buying ≥ $1M **and** Smart Traders net-buying*.
- **Then hold for** picks the horizon: 1, 3, 7, 14 or 30 days.

Every change re-runs the backtest instantly — there is no "submit," just a live answer.

### The backtest view — the answer, up top
The main panel opens on the question itself — **"Does Smart Money actually predict price?"** — with the reminder that it's *backtested against real Nansen history, no look-ahead*, and a live count of the scenarios, tokens and chains under test. A banner confirms the foundation: **built on Nansen point-in-time data**, every verdict, price and wallet derived from Nansen Smart Money cohort net-flows captured at each historical decision date. A standing **"Not investment advice"** note makes the nature of the tool unmistakable.

### The results panel — the verdict and the proof it's real
This is where a signal earns its label.
- **The verdict hero.** A large, colour-coded read of the signal — *This signal has an edge*, *Fade this signal*, *No real edge*, or *Too few trades* — with a one-line explanation in real numbers (e.g. *"Price was up after 30d in 61% of 214 trades vs 52% baseline — +9pp better than doing nothing, median return +4.8%"*), and the headline **hit-rate edge** shown huge.
- **Hit rate** and **Median return** as the two lead KPIs, each shown against its own baseline so you always see the *edge*, not a naked number.
- **The equity curve.** This is the proof the data is real, not a table of abstractions: it rolls one **equal-weight basket** through every decision date in chronological order, compounding the actual forward returns, on a log scale. You watch real money grow or bleed through real history.
- **"If you invested $X."** Type any stake — or tap $100 / $1K / $10K — and Crucible translates that same executable basket into real dollars: final value, profit, and ROI. It reads the exact curve plotted below it (winsorized, capped at ±200%), so the dollar answer and the chart can never disagree. This is the "what would my money have done?" question, answered honestly and conservatively.
- **Supporting stats.** Trades (the sample size behind the verdict), Coverage (how often the rule fired at all), Max drawdown (the worst peak-to-trough stretch you'd have sat through), and Baseline hit (the always-in bar the edge is measured against).

### The evidence — every trade, on the table
Nothing is hidden behind the headline.
- **Signal breakdown** summarises what fired and how it scored.
- **The trades table** lists every scenario behind the verdict. Click any row to open the full receipt: the **cohort net-flows** that triggered it, the **forward return at each horizon**, the **price at the decision date**, the **max drawdown**, the Nansen source — and, on most trades, the **actual Smart Money wallets**, their Nansen labels, and the dollar volumes they traded. Where wallet identities weren't baked for a given trade, the tool says so plainly rather than inventing them.

### Reference — the universe under test
Two reference panels make the dataset fully inspectable: **Tokens tested** (all 27, grouped by chain, each clickable to filter the trades table down to just that token) and the **Smart Money cohort key** (all six groups, each in plain English).

### Method & limits — stated, not buried
A closing footer restates the method and — just as important — the limits: spot cohort flows only; no fees, slippage or position sizing; averages and equity capped at ±200%; small trade counts flagged rather than hidden; past behaviour isn't predictive. The source and build date are printed for the record.

---

## The live Nansen API explorer

A backtest is only as trustworthy as its data. So Crucible lets you check the source yourself — no screenshots, no "trust me." The explorer runs the same Nansen endpoints the whole project is built on, live, against real onchain data:

- **Token screener** — the top tokens on a chain, ranked by Smart Money activity right now.
- **Smart Money flows** — net USD in and out, per cohort, for one token over a date range. *(This is the exact signal the backtest is built on.)*
- **Price history** — daily open / high / low / close and volume for one token. *(This is the outcome the backtest measures.)*
- **Who bought & sold** — the labelled Smart Money wallets trading one token.

You **pick a call**, **pick a chain** (each call offers the chains Nansen actually supports for it), and set parameters — a token address and a date range, or just the chain for the screener. A **"Browse tokens"** helper runs the screener so you can click a real token instead of pasting an address. Then **Run query** returns live results in seconds: sortable tables for the screener and wallets, cohort cards for flows, a sparkline and candle table for price history — each with the **credits the call used** and a **"View raw request & response"** panel showing the exact endpoint, request body, and mapped response. It reads like a real API console because it is one.

The explorer also **remembers where you left off**: your last query is saved on the server side, so returning visitors pick up their previous search rather than a blank form.

It is a **public** explorer, and it is hardened accordingly — the calls it can make are a fixed allowlist, inputs are validated and bounded so every query costs only a few credits, requests are rate-limited, popular results are cached, and a **credit floor** pauses live calls before the account could ever be drained. When live queries aren't available, the explorer degrades to a friendly notice instead of breaking.

---

## The data

| | |
|---|---|
| **Point-in-time scenarios** | 990 |
| **Tokens** | 27 |
| **Chains** | 3 — Ethereum, Base, Solana |
| **Smart Money cohorts** | 6 |
| **Hold horizons** | 1, 3, 7, 14, 30 days |
| **Signal window** | 7 days of cohort net-flow ending on each decision date |
| **Source** | Nansen API |

Every scenario is a real Nansen observation: a cohort net-flow signal captured as of a historical decision date, paired with the forward price move measured strictly after it. The dataset ships with a manifest recording exactly which calls built it, and the entire build is reproducible from scratch with one command.

### The six Smart Money cohorts
- **Smart Traders** — wallets Nansen labels as consistently skilled traders.
- **Whales** — very large holders.
- **Top PnL** — the highest realized-profit wallets.
- **Public Figures** — known public figures and funds.
- **Exchanges** — centralized exchange wallets.
- **Fresh Wallets** — newly created wallets.

---

## Architecture & provenance

Crucible is deliberately built in two clean halves:

**1. An offline bake → a static dataset.** The backtest never calls Nansen at runtime. A typed build pipeline (`scripts/`) makes the real Nansen calls once — screener, historical token flow-summary, historical token OHLCV, who-bought-sold — assembles them into point-in-time scenarios, and writes a single static `dataset.json`. The app loads that file and runs the entire backtest **in the browser**, instantly, with zero runtime cost and nothing to rate-limit. Reproducible end-to-end with `npm run build:dataset`.

**2. A thin serverless proxy → the live explorer.** The one place that needs Nansen at runtime — the live explorer — goes through the project's own `/api/nansen` endpoint. The browser calls Crucible; Crucible calls Nansen. The Nansen key lives only as a server-side environment variable and never reaches the page, and the proxy enforces the allowlist, validation, rate limit, cache and credit floor described above. The core logic is runtime-agnostic and unit-tested.

The result: a site that is **fully static and free to host**, yet lets anyone run it live against Nansen — and whose every number can be traced back to a real API response.

---

## Tech stack

- **React 18** + **TypeScript** + **Vite** — fast, typed SPA.
- **Tailwind CSS** with a warm, custom design system (Plus Jakarta Sans).
- **Framer Motion** for transitions.
- **Vitest** for the engine's unit tests (no-look-ahead, verdict thresholds, input validation).
- **Vercel** for hosting the static build + the single serverless function.
- Pure, dependency-light backtest core shared between the build scripts, the browser and the proxy.

---

## Run it locally

```bash
npm install
npm run dev          # start the app (with the live-explorer dev proxy)
npm run test         # run the engine + validation tests
npm run build        # typecheck + production build
npm run build:dataset # rebuild dataset.json from live Nansen calls (needs a key)
```

The live explorer needs a `NANSEN_API_KEY` in the server environment. Without it, the static backtest works fully and the explorer shows a graceful "live queries unavailable" state.

---

## Glossary

- **pp (percentage points)** — the unit of the edge: this signal's hit rate minus the baseline's.
- **Edge vs holding** — how much better (or worse) the signal did than simply buying and holding over the same horizon.
- **No look-ahead** — only prices *after* the signal are ever counted; the signal window ends on the decision date.
- **Hit rate** — how often price was higher after the hold.
- **Median return** — the typical (middle) trade, robust to outliers.
- **Winsorized** — extreme returns capped at ±200% before averaging, so one moonshot can't fake an edge.
- **Coverage** — the share of all scenarios where a rule's condition was actually met.
- **Max drawdown** — the deepest peak-to-trough fall along the equity curve.
- **Cohort** — a Nansen-labelled group of wallets (Smart Traders, Whales, and so on).

---

## Not investment advice

Crucible is an educational research tool for studying whether historical Smart Money flows preceded price moves. Nothing here is a recommendation to buy, sell or hold any asset, and past behaviour does not predict future returns.

<div align="center">

**[Try it live →](https://crucible-gules-six.vercel.app)** · Built on Nansen point-in-time data

</div>






