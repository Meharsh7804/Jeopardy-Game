import React from "react";

type Size = number | string;

/** Faint topographic contour field — an ambient map texture layer. */
export const TopoBackground: React.FC<{ className?: string; opacity?: number }> = ({
  className = "",
  opacity = 0.5,
}) => (
  <svg
    aria-hidden
    className={`pointer-events-none absolute inset-0 w-full h-full ${className}`}
    style={{ opacity }}
    preserveAspectRatio="xMidYMid slice"
    viewBox="0 0 800 600"
  >
    <defs>
      <pattern id="topo" width="260" height="260" patternUnits="userSpaceOnUse">
        <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeOpacity="1">
          <path d="M-40 40 Q60 -10 150 40 T340 40" />
          <path d="M-40 90 Q60 40 150 90 T340 90" />
          <path d="M-40 140 Q60 90 150 140 T340 140" />
          <path d="M-40 190 Q60 140 150 190 T340 190" />
          <path d="M-40 240 Q60 190 150 240 T340 240" />
          <path d="M30 -40 Q80 60 30 150 T30 340" />
          <path d="M130 -40 Q180 60 130 150 T130 340" />
          <path d="M230 -40 Q280 60 230 150 T230 340" />
        </g>
      </pattern>
    </defs>
    <rect width="800" height="600" fill="url(#topo)" />
  </svg>
);

/** A compass rose. `spin` rotates the needle ring slowly. */
export const Compass: React.FC<{ size?: Size; className?: string; spin?: boolean }> = ({
  size = 48,
  className = "",
  spin = false,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    className={`${spin ? "compass-spin" : ""} ${className}`}
    style={{ color: "var(--color-warm)" }}
    aria-hidden
  >
    <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" />
    <circle cx="50" cy="50" r="38" fill="none" stroke="var(--color-primary-accent)" strokeOpacity="0.55" strokeWidth="1" />
    {["N", "E", "S", "W"].map((d, i) => {
      const a = (i * Math.PI) / 2 - Math.PI / 2;
      const x = 50 + Math.cos(a) * 31;
      const y = 50 + Math.sin(a) * 31;
      return (
        <text
          key={d}
          x={x}
          y={y}
          fontSize="9"
          fontFamily="'IBM Plex Mono', monospace"
          fill="currentColor"
          textAnchor="middle"
          dominantBaseline="central"
          fontWeight="700"
        >
          {d}
        </text>
      );
    })}
    <g>
      <polygon points="50,14 56,50 50,46 44,50" fill="var(--color-danger-accent)" />
      <polygon points="50,86 44,50 50,54 56,50" fill="var(--color-ink)" opacity="0.85" />
    </g>
    <circle cx="50" cy="50" r="3.2" fill="currentColor" />
  </svg>
);

/** A small map marker pin. */
export const MapPin: React.FC<{ size?: Size; className?: string; color?: string }> = ({
  size = 22,
  className = "",
  color = "var(--color-warm)",
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <path
      d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 11.5 7.3 11.7.4.3 1 .3 1.4 0C13 21.5 20 15.4 20 10c0-4.4-3.6-8-8-8z"
      fill={color}
      stroke="var(--color-ink)"
      strokeWidth="1"
    />
    <circle cx="12" cy="10" r="3" fill="var(--color-ink)" />
  </svg>
);

/** A coordinate stamp, e.g. 47°N · 12°E. */
export const CoordinateTag: React.FC<{ value: string; className?: string; ink?: boolean }> = ({
  value,
  className = "",
  ink = false,
}) => (
  <span className={`coord ${ink ? "coord-ink" : ""} ${className}`}>{value}</span>
);

/** A stamped "DISCOVERY" / region tab. */
export const DiscoveryTag: React.FC<{ label?: string; className?: string }> = ({
  label = "Discovery",
  className = "",
}) => <span className={`discovery-tag ${className}`}>{label}</span>;

/** A dashed route line used as a divider with an optional midpoint glyph. */
export const RouteDivider: React.FC<{ className?: string; glyph?: React.ReactNode }> = ({
  className = "",
  glyph,
}) => (
  <div className={`route-divider ${className}`}>
    {glyph && <span className="text-[var(--color-warm)]">{glyph}</span>}
  </div>
);

/** A NatGeo-style title cartouche (double-rule frame with corner ticks). */
export const Cartouche: React.FC<{ className?: string; children?: React.ReactNode }> = ({
  className = "",
  children,
}) => (
  <div className={`relative ${className}`}>
    <div className="absolute inset-0 map-frame pointer-events-none" />
    <div className="relative p-1">{children}</div>
  </div>
);
