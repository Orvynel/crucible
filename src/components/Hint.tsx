import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// A quiet "?" that reveals a one- or two-line plain-English note on hover or
// keyboard focus. The note is rendered in a portal on <body> and positioned
// with fixed viewport coordinates, so it escapes every card and scroll-area
// clip. It opens upward by default and flips downward when it sits too close
// to the top of the viewport, so it can never be cut off.
type Pos = { left: number; top: number; place: "top" | "bottom" };

export function Hint({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);

  const open = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const GAP = 8;
    const HALF = 124; // half of max-w-[248px] — guarantees no horizontal overflow
    const place: "top" | "bottom" = r.top < 150 ? "bottom" : "top";
    const cx = r.left + r.width / 2;
    const left = Math.max(HALF + 8, Math.min(cx, window.innerWidth - HALF - 8));
    const top = place === "top" ? r.top - GAP : r.bottom + GAP;
    setPos({ left, top, place });
  }, []);

  const close = useCallback(() => setPos(null), []);

  return (
    <span
      ref={ref}
      className={`relative inline-flex align-middle ${className}`}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
    >
      <span
        role="note"
        tabIndex={0}
        aria-label="What this means"
        className="grid h-4 w-4 cursor-help place-items-center rounded-full border border-line bg-white text-[10px] font-bold leading-none text-faint outline-none transition-colors hover:border-[var(--accent)] hover:text-accent focus-visible:border-[var(--accent)] focus-visible:text-accent"
      >
        ?
      </span>
      {pos &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[9999] w-max max-w-[248px] rounded-xl border border-line bg-white px-3 py-2 text-left text-[11.5px] font-normal normal-case leading-snug tracking-normal text-muted shadow-[var(--shadow-lift)]"
            style={{
              left: pos.left,
              top: pos.top,
              transform: pos.place === "top" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
            }}
          >
            {children}
          </span>,
          document.body,
        )}
    </span>
  );
}
