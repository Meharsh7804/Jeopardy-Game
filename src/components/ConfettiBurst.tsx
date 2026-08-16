import React, { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { useSettings, ANIM_MULT } from "../context/SettingsContext";

const CONFETTI_COLORS = [
  "#f59e0b",
  "#fbbf24",
  "#ef4444",
  "#f43f5e",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f97316",
  "#facc15",
];

interface ConfettiBurstProps {
  count?: number;
  /** Extra classes on the overlay layer (defaults to a fixed full-screen layer). */
  className?: string;
}

/**
 * One-shot confetti celebration. Uses the CSS `.confetti-piece` animation from
 * index.css, scaled by the user's animation-speed preference; fully hidden for
 * reduced-motion users. Unmount the component to stop the burst.
 */
export const ConfettiBurst: React.FC<ConfettiBurstProps> = ({
  count = 60,
  className = "",
}) => {
  const { settings } = useSettings();
  const reduce = !!useReducedMotion();

  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 3.2 + Math.random() * 2.8,
        drift: (Math.random() - 0.5) * 220,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() > 0.6,
        size: 6 + Math.random() * 7,
      })),
    [count],
  );

  if (reduce) return null;

  const mult = ANIM_MULT[settings.animationSpeed];

  return (
    <div
      className={`fixed inset-0 overflow-hidden pointer-events-none z-40 ${className}`}
      aria-hidden
    >
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.round ? p.size : p.size * 0.6,
            height: p.round ? p.size : p.size * 1.6,
            borderRadius: p.round ? "50%" : "2px",
            backgroundColor: p.color,
            opacity: 0.9,
            ["--confetti-x" as any]: `${p.drift}px`,
            animationDuration: `${p.duration * mult}s`,
            animationDelay: `${p.delay * mult}s`,
          }}
        />
      ))}
    </div>
  );
};