// The Crucible mark. A crucible is the vessel where raw material is melted down
// under heat and only what's real survives — which is exactly what a backtester
// does to a trading signal. The glyph is a crucible cup with a refined spark
// rising from it: the edge that made it through. Drawn as inline SVG so it stays
// crisp at every size and needs no raster asset.

export function Logo({ size = 36, radius = 12 }: { size?: number; radius?: number }) {
  const g = Math.round(size * 0.62);
  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden text-white"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "linear-gradient(150deg,#8f97f7,#5b63e8)",
        boxShadow: "0 6px 16px -6px rgba(91,99,232,0.85), inset 0 1px 0 rgba(255,255,255,0.35)",
      }}
      aria-hidden
    >
      {/* soft top-lit sheen so the tile reads as a crafted object, not a flat fill */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 30% 0%, rgba(255,255,255,0.4), transparent 55%)" }}
      />
      <svg viewBox="0 0 32 32" width={g} height={g} fill="none" className="relative">
        {/* rising refined spark — the surviving edge */}
        <path
          d="M22 4.4 l1.15 2.75 2.75 1.15 -2.75 1.15 -1.15 2.75 -1.15 -2.75 -2.75 -1.15 2.75 -1.15 z"
          fill="#fff"
        />
        {/* crucible rim */}
        <rect x="6.4" y="12.2" width="19.2" height="3" rx="1.5" fill="#fff" />
        {/* crucible body — tapers to a rounded base, like a melting pot */}
        <path
          d="M8.6 16.2 h14.8 l-1.5 6.9 a4.6 4.6 0 0 1 -4.5 3.6 h-2.8 a4.6 4.6 0 0 1 -4.5 -3.6 z"
          fill="#fff"
          fillOpacity="0.92"
        />
      </svg>
    </span>
  );
}
