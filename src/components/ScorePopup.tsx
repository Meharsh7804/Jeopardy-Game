import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ScoreHistoryEntry } from "../types/jeopardy";

interface ScorePopupProps {
  entries: Record<string, ScoreHistoryEntry> | undefined;
  playerId: string;
}

/**
 * Floating +$X / −$X popup shown next to a player's row whenever a new score
 * change for that player lands. Mount inside a `relative` row container; each
 * score-history entry animates exactly once (diffed by entry id), so remounts
 * and reconnects never replay old popups. Popups stack vertically instead of
 * overlapping, and emerge from above the row so they never cover the score.
 */
export const ScorePopup: React.FC<ScorePopupProps> = ({ entries, playerId }) => {
  const seen = useRef<Set<string>>(new Set());
  const [active, setActive] = useState<ScoreHistoryEntry[]>([]);

  useEffect(() => {
    if (!entries) return;
    Object.values(entries).forEach((e) => {
      if (!e || e.teamId !== playerId || seen.current.has(e.id)) return;
      seen.current.add(e.id);
      setActive((prev) => [...prev.slice(-2), e]);
      window.setTimeout(() => {
        setActive((prev) => prev.filter((x) => x.id !== e.id));
      }, 1800);
    });
  }, [entries, playerId]);

  return (
    <AnimatePresence>
      {active.map((e, i) => (
        <motion.span
          key={e.id}
          initial={{ opacity: 0, y: 0, scale: 0.85 }}
          animate={{ opacity: 1, y: -14, scale: 1 }}
          exit={{ opacity: 0, y: -20, transition: { duration: 0.3, ease: "easeIn" } }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{ top: -12 - i * 20 }}
          className={`absolute right-2 font-display font-black text-base sm:text-lg pointer-events-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] ${
            e.changeAmount >= 0 ? "text-success-accent" : "text-danger-accent"
          }`}
        >
          {e.changeAmount >= 0 ? "+" : "−"}${Math.abs(e.changeAmount)}
        </motion.span>
      ))}
    </AnimatePresence>
  );
};