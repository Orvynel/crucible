import { useMemo } from "react";
import type { EquityPoint } from "@shared/backtest";

interface Props {
  equity: EquityPoint[];
}

// Dependency-free SVG equity curve with an animated draw-in, gradient fill, and
// break-even reference line. Cumulative growth of $1 across every fired trade,
// plotted on a LOG y-axis — compounding is exponential, so a linear axis buries
// the whole path against the floor and shows only a final spike.
export function EquityChart({ equity }: Props) {
  const W = 760;
  const H = 300;
  const pad = { l: 52, r: 18, t: 20, b: 30 };

  const geom = useMemo(() => {
    if (equity.length < 2) return null;
    const values = equity.map((e) => e.value);
    const min = Math.min(1, ...values);
    const max = Math.max(1, ...values);
    const lmin = Math.log(min);
    const lmax = Math.log(max);
    const lspan = lmax - lmin || 1;
    const x = (i: number) => pad.l + (i / (equity.length - 1)) * (W - pad.l - pad.r);
    const y = (v: number) => pad.t + (1 - (Math.log(v) - lmin) / lspan) * (H - pad.t - pad.b);
    const line = equity.map((e, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(e.value).toFixed(1)}`).join(" ");
    const area = `${line} L${x(equity.length - 1).toFixed(1)},${(H - pad.b).toFixed(1)} L${x(0).toFixed(1)},${(H - pad.b).toFixed(1)} Z`;
    const mid = Math.exp((lmax + lmin) / 2);
    return { min, max, mid, x, y, line, area, end: values[values.length - 1] };
  }, [equity]);

  if (!geom) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted">
        Not enough trades to plot a curve — loosen the rule.
      </div>
    );
  }

  const up = geom.end >= 1;
  const stroke = up ? "var(--pos)" : "var(--neg)";
  const gridVals = [geom.max, geom.mid, geom.min];
  const fmtX = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Equity curve">
      <defs>
        <linearGradient id="eqfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={geom.y(v)} y2={geom.y(v)} stroke="var(--line)" />
          <text x={pad.l - 8} y={geom.y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--faint)" className="font-mono">
            {fmtX(v)}x
          </text>
        </g>
      ))}
      <line x1={pad.l} x2={W - pad.r} y1={geom.y(1)} y2={geom.y(1)} stroke="var(--line-strong)" strokeDasharray="3 4" />

      <path d={geom.area} fill="url(#eqfill)" />
      <path
        d={geom.line}
        fill="none"
        stroke={stroke}
        strokeWidth="2.25"
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: "draw 1.1s ease-out forwards" }}
      />
      <circle cx={geom.x(equity.length - 1)} cy={geom.y(geom.end)} r="4" fill={stroke}>
        <animate attributeName="opacity" values="0;1" begin="1s" dur="0.3s" fill="freeze" />
      </circle>

      <text x={pad.l} y={H - 10} fontSize="10" fill="var(--faint)" className="font-mono">
        {equity[0].as_of}
      </text>
      <text x={W - pad.r} y={H - 10} textAnchor="end" fontSize="10" fill="var(--faint)" className="font-mono">
        {equity[equity.length - 1].as_of}
      </text>
    </svg>
  );
}
