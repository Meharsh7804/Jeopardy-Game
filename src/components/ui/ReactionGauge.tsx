import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Gauge } from "lucide-react";

const BONUS_WINDOW_MS = 1000; // first-buzz bonus cutoff, matches RoomContext

interface ReactionGaugeProps {
  openedAt?: number;
  /** Player's committed reaction time (ms) after they buzzed, else null. */
  myReactionMs?: number | null;
  /** True while a question is open and this player has not buzzed. */
  live?: boolean;
}

/**
 * Live digital reaction clock for the question display. While a question is
 * open it ticks a running ms counter (CPU-cheap: no per-frame CSS repaint, just
 * a text node). Inside the first-buzz bonus window it glows hot; the instant
 * the player buzzes it pins to their committed reaction time and colors it:
 * hot/bonus inside the 1s window, cool outside.
 */
export const ReactionGauge: React.FC<ReactionGaugeProps> = ({
  openedAt,
  myReactionMs,
  live,
}) => {
  const [now, setNow] = useState<number>(() => Date.now());
  const rafRef = useRef<number | null>(null);

  // Drive the elapsed ticker from the server `openedAt` so every client sees
  // the same reaction window regardless of device clock skew.
  useEffect(() => {
    if (!live || !openedAt) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      setNow(Date.now());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [live, openedAt]);

  const elapsedMs = live && openedAt ? Math.max(0, now - openedAt) : 0;
  const locked = !live && myReactionMs !== null && myReactionMs !== undefined;
  const inBonus = locked ? (myReactionMs ?? 1e9) <= BONUS_WINDOW_MS : elapsedMs <= BONUS_WINDOW_MS;
  const displayMs = locked ? (myReactionMs ?? 0) : elapsedMs;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative shrink-0"
    >
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors duration-300 ${
          inBonus
            ? "border-warning-accent/50 bg-warning-accent/10 text-warning-accent shadow-[0_0_18px_rgba(245,158,11,0.25)]"
            : "border-white/10 bg-white/5 text-primary-accent"
        }`}
      >
        <AnimatePresence mode="wait">
          {locked ? (
            <motion.span
              key="locked"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              className="flex items-center gap-1.5"
            >
              <Gauge className={`w-3.5 h-3.5 ${inBonus ? "text-warning-accent" : "text-primary-accent"}`} />
              <span
                className={`min-w-[3.6rem] text-center text-lg font-black font-mono tabular-nums leading-none ${
                  inBonus ? "text-warning-accent" : "text-primary-accent"
                }`}
              >
                {(displayMs / 1000).toFixed(2)}s
              </span>
            </motion.span>
          ) : (
            <motion.span
              key="live"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5"
            >
              <Zap
                className={`w-3.5 h-3.5 ${inBonus ? "text-warning-accent animate-pulse" : "text-text-muted"}`}
              />
              <span
                className={`min-w-[3.6rem] text-center text-lg font-black font-mono tabular-nums leading-none ${
                  inBonus ? "text-warning-accent" : "text-text-muted"
                }`}
              >
                {(displayMs / 1000).toFixed(2)}s
              </span>
            </motion.span>
          )}
        </AnimatePresence>
        {inBonus && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-warning-accent"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-warning-accent animate-pulse" />
            Bonus
          </motion.span>
        )}
      </div>
    </motion.div>
  );
};
