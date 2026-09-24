import type { ReactNode } from "react";

// A quiet "?" that reveals a one- or two-line plain-English note on hover or
// keyboard focus. Pure CSS reveal (no state) so it can never crash, and it
// keeps the surface calm: jargon is explained on demand, never shouted. The
// note opens upward so it doesn't fight the content below it.
export function Hint({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`group/hint relative inline-flex align-middle ${className}`}>
      <span
        role="note"
        tabIndex={0}
        aria-label="What this means"
        className="grid h-4 w-4 cursor-help place-items-center rounded-full border border-line bg-white text-[10px] font-bold leading-none text-faint outline-none transition-colors hover:border-[var(--accent)] hover:text-accent focus-visible:border-[var(--accent)] focus-visible:text-accent"
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-40 w-max max-w-[248px] -translate-x-1/2 translate-y-1 rounded-xl border border-line bg-white px-3 py-2 text-left text-[11.5px] font-normal normal-case leading-snug tracking-normal text-muted opacity-0 shadow-[var(--shadow-lift)] transition-all duration-150 group-hover/hint:translate-y-0 group-hover/hint:opacity-100 group-focus-within/hint:translate-y-0 group-focus-within/hint:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}
