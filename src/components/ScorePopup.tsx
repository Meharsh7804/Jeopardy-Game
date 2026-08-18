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
 * and reconnects never replay old popups. Only the latest change is ever shown —
 * a new change replaces whatever is on screen — and the whole enter-hold-exit
 * cycle stays around a second so nothing lingers into the next question.
 */
export const ScorePopup: React.FC<ScorePopupProps> = ({ entries, playerId }) => {
  const seen = useRef<Set<string>>(new Set());
  const [active, setActive] = useState<ScoreHistoryEntry[]>([]);

  useEffect(() => {
    if (!entries) return;
    Object.values(entries).forEach((e) => {
      if (!e || e.teamId !== playerId || seen.current.has(e.id)) return;
      seen.current.add(e.id);
      // Replace whatever is showing — only the latest change is displayed.
      setActive([e]);
      window.setTimeout(() => {
        setActive((prev) => prev.filter((x) => x.id !== e.id));
      }, 1000);
    });
  }, [entries, playerId]);

  return (
    <AnimatePresence>
      {active.map((e, i) => (
        <motion.span
          key={e.id}
          initial={{ opacity: 0, y: 2, scale: 0.9 }}
          animate={{ opacity: 1, y: -12, scale: 1 }}
          exit={{ opacity: 0, y: -16, transition: { duration: 0.2, ease: "easeIn" } }}
          transition={{ duration: 0.3, ease: "easeOut" }}
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