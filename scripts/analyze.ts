// Offline calibration — reads the baked dataset (0 credits). Confirms outlier
// contamination and finds honest, compelling default rules using robust metrics.
import { readFileSync } from "node:fs";
import type { Dataset, Cohort } from "../shared/types.ts";
import { COHORTS } from "../shared/types.ts";
import { fires, type Rule } from "../shared/backtest.ts";

const ds = JSON.parse(readFileSync("public/data/dataset.json", "utf8")) as Dataset;
const HS = ds.horizons;
console.log(`scenarios ${ds.scenarios.length}  tokens ${ds.tokens.length}  horizons ${HS.join(",")}`);

const quant = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(p * (s.length - 1))];
};
const median = (xs: number[]) => quant(xs, 0.5);
const pctS = (x: number) => `${(x * 100).toFixed(1)}%`;

// 1. Forward-return distribution per horizon → confirm the fat right tail.
console.log("\n--- forward-return distribution (all scenarios) ---");
for (const h of HS) {
  const xs = ds.scenarios.map((s) => s.outcome.forward_return[String(h)]).filter((x) => Number.isFinite(x));
  console.log(
    `@${String(h).padStart(2)}d  min ${pctS(quant(xs, 0))}  p50 ${pctS(median(xs))}  ` +
      `mean ${pctS(xs.reduce((a, b) => a + b, 0) / xs.length)}  p99 ${pctS(quant(xs, 0.99))}  max ${pctS(quant(xs, 1))}`,
  );
}

// 2. Robust metrics for sign-based rules: hit-rate edge (pp) and median edge (pp).
function robust(name: string, cohort: Cohort, h: number, op: "gt" | "lt" = "gt") {
  const rule: Rule = { conditions: [{ cohort, op, value: 0 }], combine: "all", horizon: h };
  const all = ds.scenarios.map((s) => s.outcome.forward_return[String(h)]).filter((x) => Number.isFinite(x));
  const fired = ds.scenarios
    .filter((s) => fires(rule, s))
    .map((s) => s.outcome.forward_return[String(h)])
    .filter((x) => Number.isFinite(x));
  if (fired.length < 20) return;
  const hit = fired.filter((x) => x > 0).length / fired.length;
  const baseHit = all.filter((x) => x > 0).length / all.length;
  const medEdge = median(fired) - median(all);
  const hitEdge = hit - baseHit;
  console.log(
    `${name.padEnd(30)} n=${String(fired.length).padStart(4)}  ` +
      `hit ${(hit * 100).toFixed(0)}% (base ${(baseHit * 100).toFixed(0)}%) edge ${(hitEdge * 100 >= 0 ? "+" : "")}${(hitEdge * 100).toFixed(0)}pp  ` +
      `medEdge ${(medEdge * 100 >= 0 ? "+" : "")}${(medEdge * 100).toFixed(1)}pp`,
  );
}

console.log("\n--- robust edges: cohort net-buy (>0) ---");
for (const c of COHORTS) for (const h of [7, 14, 30]) robust(`${c} buy @${h}d`, c, h);

console.log("\n--- robust edges: cohort net-sell (<0) ---");
for (const c of COHORTS) for (const h of [14, 30]) robust(`${c} sell @${h}d`, c, h, "lt");
