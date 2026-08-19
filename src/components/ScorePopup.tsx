import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ScoreHistoryEntry } from "../types/jeopardy";

interface ScorePopupProps {
  entries: Record<string, ScoreHistoryEntry> | undefined;
  playerId: string;
}

/**
 * Module-scoped "already seen" ledger, keyed by player id. It lives outside the
 * component so it survives the leaderboard remounting between phases. The
 * leaderboard (and every ScorePopup) unmounts while a question is live and
 * remounts when the board returns — without this ledger every remount would
 * replay the player's most recent (possibly old, from a previous round) score
 * change. With it, only entries that appeared *since* the board was first shown
 * animate, i.e. exactly the current round's marks.
 */
const seenLedger = new Map<string, Set<string>>();

/**
 * Floating +$X / −$X popup shown next to a player's row whenever a score change
 * for that player lands. Only the *current* round's change is ever animated —
 * history that predates this device's first sight of the player is seeded into
 * the ledger and never replays. A new change replaces whatever is on screen,
 * and the enter-hold-exit cycle stays around a second so nothing lingers into
 * the next question.
 */
export const ScorePopup: React.FC<ScorePopupProps> = ({ entries, playerId }) => {
  const [active, setActive] = useState<ScoreHistoryEntry[]>([]);
  // Per-instance mirror of the ledger so a single mounted instance never
  // re-shows an entry it already animated on a re-render.
  const instanceSeen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const global = seenLedger.get(playerId);

    // First time this device ever sees this player: seed the ledger with
    // whatever history already exists (even if empty) so nothing that happened
    // before now is replayed as a "new" animation.
    if (!global) {
      const seeded = new Set<string>();
      if (entries) {
        Object.values(entries).forEach((e) => {
          if (e && e.teamId === playerId) seeded.add(e.id);
        });
      }
      seenLedger.set(playerId, seeded);
      instanceSeen.current = new Set(seeded);
      return;
    }

    if (!entries) return;
    if (instanceSeen.current === null) {
      instanceSeen.current = new Set(global);
    }

    Object.values(entries).forEach((e) => {
      if (!e || e.teamId !== playerId || instanceSeen.current!.has(e.id)) return;
      instanceSeen.current!.add(e.id);
      global.add(e.id);
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