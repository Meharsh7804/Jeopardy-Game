import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ScoreHistoryEntry } from "../types/jeopardy";
import { soundManager } from "../utils/sound";

interface ScorePopupProps {
  entries: Record<string, ScoreHistoryEntry> | undefined;
  playerId: string;
}

/**
 * Module-scoped "already seen" ledger, keyed by player id. Lives outside the
 * component so it survives remounts between phases.
 */
const seenLedger = new Map<string, Set<string>>();

/**
 * Floating +$X / −$X popup shown next to a player's score row *only* when
 * that specific player's score actually changed in the most-recent round.
 *
 * Key invariants:
 *  - Players whose score did NOT change stay silent (no stale animations).
 *  - Only the newest entry for each player is ever shown.
 *  - History that predates this client's first mount is seeded as "already
 *    seen" so reconnects / remounts never replay old changes.
 */
export const ScorePopup: React.FC<ScorePopupProps> = ({ entries, playerId }) => {
  const [active, setActive] = useState<ScoreHistoryEntry[]>([]);
  const instanceSeen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const global = seenLedger.get(playerId);

    // First time we see this player on this device: seed the ledger so that
    // every entry that already exists is treated as "already animated".
    if (!global) {
      const seeded = new Set<string>();
      if (entries) {
        Object.values(entries).forEach((e) => {
          if (e) seeded.add(e.id);
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

    // Collect only entries that belong to THIS player and are genuinely new.
    const newForMe: ScoreHistoryEntry[] = [];
    Object.values(entries).forEach((e) => {
      if (!e || e.teamId !== playerId || instanceSeen.current!.has(e.id)) return;
      instanceSeen.current!.add(e.id);
      global.add(e.id);
      newForMe.push(e);
    });

    if (newForMe.length === 0) return;

    // Only show the most-recent change for this player.
    const latest = newForMe.sort((a, b) => b.timestamp - a.timestamp)[0];
    if (latest.changeAmount >= 0) soundManager.playScoreUp();
    else soundManager.playScoreDown();
    setActive([latest]);
    window.setTimeout(() => {
      setActive((prev) => prev.filter((x) => x.id !== latest.id));
    }, 1400);
  }, [entries, playerId]);

  return (
    <AnimatePresence>
      {active.map((e) => (
        <motion.span
          key={e.id}
          initial={{ opacity: 0, y: 2, scale: 0.85 }}
          animate={{ opacity: 1, y: -14, scale: 1 }}
          exit={{ opacity: 0, y: -20, transition: { duration: 0.25, ease: "easeIn" } }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={`absolute right-2 top-0 font-display font-black text-base sm:text-lg pointer-events-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] z-20 ${
            e.changeAmount >= 0 ? "text-success-accent" : "text-danger-accent"
          }`}
        >
          {e.changeAmount >= 0 ? "+" : "−"}${Math.abs(e.changeAmount)}
        </motion.span>
      ))}
    </AnimatePresence>
  );
};