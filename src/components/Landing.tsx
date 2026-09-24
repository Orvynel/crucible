import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Dataset } from "@shared/types";
import { backtest } from "@shared/backtest";
import { PRESETS } from "../lib/presets";
import { pp } from "../lib/format";
import { Logo } from "./Logo";

// Our take on the floating-card hero: a soft violet field, a whisper-faint
// giant headline, and real preset signals floating in front of it — each
// showing its true edge. Inspired by the mood, drawn from our own data.
const TILT = [-7, 0, 6];
const RAISE = [26, -8, 34];

export function Landing({ dataset, onEnter }: { dataset: Dataset; onEnter: () => void }) {
  const cards = useMemo(
    () =>
      PRESETS.slice(0, 3).map((p) => {
        const edge = backtest(p.rule, dataset).edgeHitRate;
        return { name: p.name, blurb: p.blurb, edge, horizon: p.rule.horizon };
      }),
    [dataset],
  );

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* dreamy soft gradient field */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 620px at 18% 4%, #efeafe, transparent 60%)," +
            "radial-gradient(780px 620px at 90% 18%, #f7ecfb, transparent 58%)," +
            "radial-gradient(1080px 760px at 60% 122%, #e5ddfb, transparent 62%)," +
            "linear-gradient(180deg, #f8f6ff, #f1edfb)",
        }}
      />
      {/* drifting aurora */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-6 h-[460px] w-[460px] rounded-full blur-[90px]"
        style={{ background: "radial-gradient(circle, rgba(154,140,245,0.45), transparent 70%)" }}
        animate={{ x: [0, 44, 0], y: [0, 28, 0] }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full blur-[100px]"
        style={{ background: "radial-gradient(circle, rgba(236,196,247,0.5), transparent 70%)" }}
        animate={{ x: [0, -32, 0], y: [0, -22, 0] }}
        transition={{ duration: 23, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* top bar */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <Brand />
        <div className="hidden items-center gap-2 rounded-full border border-line bg-white/60 px-3.5 py-1.5 text-[12.5px] text-muted backdrop-blur sm:flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          Real Nansen point-in-time data
        </div>
      </header>

      {/* hero */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-10 text-center">
        {/* whisper-faint giant headline behind everything */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[42%] -translate-y-1/2 select-none">
          <div className="text-center text-[18vw] font-extrabold leading-none tracking-tighter text-white/50">
            smart money
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-3.5 py-1.5 text-[12.5px] font-semibold text-accent backdrop-blur">
            Onchain signal backtester
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-[clamp(32px,5.4vw,64px)] font-extrabold leading-[1.03] tracking-tight text-text">
            Does Smart Money actually
            <br className="hidden sm:block" /> predict price?
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-muted">
            Compose a Smart Money flow signal, backtest it against real point-in-time history, and see the honest edge
            over buy-and-hold — with no look-ahead.
          </p>
        </motion.div>

        {/* real signals, floating */}
        <div className="relative z-10 mt-12 flex items-end justify-center gap-4 sm:gap-6">
          {cards.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 46, rotate: TILT[i] }}
              animate={{ opacity: 1, y: 0, rotate: TILT[i] }}
              transition={{ duration: 0.7, delay: 0.28 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              style={{ marginTop: RAISE[i] }}
              className="w-[168px] sm:w-[218px]"
            >
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-[24px] border border-line bg-white p-5 text-left"
                style={{ boxShadow: "var(--shadow-lift)" }}
              >
                <SignalCard {...c} />
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* call to action */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75, duration: 0.6 }}
          className="relative z-10 mt-12 flex flex-col items-center gap-3"
        >
          <button
            onClick={onEnter}
            className="group inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_16px_34px_-12px_rgba(91,99,232,0.75)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Run the backtest
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </button>
          <span className="text-[12.5px] text-faint">
            {dataset.scenarios.length.toLocaleString()} point-in-time scenarios · no look-ahead
          </span>
        </motion.div>
      </main>

      {/* quiet footer: a tiny glossary for the jargon, plus the honest disclaimer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.95, duration: 0.6 }}
        className="relative z-10 px-8 pb-6"
      >
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-2 border-t border-line/70 pt-4 text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
            <span>
              <b className="font-semibold text-text">pp</b> = percentage points
            </span>
            <span className="text-line">·</span>
            <span>
              <b className="font-semibold text-text">edge vs holding</b> = better or worse than buy-and-hold
            </span>
            <span className="text-line">·</span>
            <span>
              <b className="font-semibold text-text">no look-ahead</b> = only prices after the signal count
            </span>
          </div>
          <p className="text-[11.5px] text-faint">
            Educational research built on real Nansen data — not investment advice. Full method walkthrough in our post.
          </p>
        </div>
      </motion.footer>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={36} radius={12} />
      <span className="text-[15px] font-extrabold tracking-tight text-text">Crucible</span>
    </div>
  );
}

function SignalCard({ name, blurb, edge, horizon }: { name: string; blurb: string; edge: number; horizon: number }) {
  const tone = edge >= 0.03 ? "pos" : edge <= -0.03 ? "neg" : "muted";
  const color = tone === "pos" ? "var(--pos)" : tone === "neg" ? "var(--neg)" : "var(--muted)";
  const tint = tone === "pos" ? "var(--pos-soft)" : tone === "neg" ? "var(--neg-soft)" : "var(--accent-soft)";
  return (
    <>
      <div className="flex items-center justify-between">
        <Logo size={32} radius={10} />
        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: tint, color }}>
          {horizon}d hold
        </span>
      </div>
      <div className="mt-4 text-[13.5px] font-bold leading-tight text-text">{name}</div>
      <div className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-faint">{blurb}</div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="nums text-[28px] font-extrabold tracking-tight" style={{ color }}>
          {pp(edge)}
        </span>
        <span className="text-[11.5px] text-muted">edge</span>
      </div>
    </>
  );
}
