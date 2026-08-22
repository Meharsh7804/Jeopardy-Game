import React from "react";
import { motion } from "framer-motion";

// Dynamic, witty "lobby life" copy that reacts to how many players have
// gathered — so the waiting room feels alive instead of static. Curiosity
// (watching the room fill up) is the whole point; nothing here affects play.

export const lobbyVibe = (count: number, isHost: boolean): string => {
  if (isHost) {
    if (count === 0) return "The arena is quiet… perhaps too quiet.";
    if (count === 1) return "Just you so far. The silence is majestic.";
    if (count === 2) return "A challenger appears. The board stirs.";
    if (count === 3) return "Three strong — rivalries are forming.";
    if (count < 6) return `${count} explorers have gathered. The map is waking.`;
    return "A packed house! The lobby is electric.";
  }
  if (count <= 1) return "You're here. The host is somewhere, probably plotting.";
  if (count === 2) return "Just the two of you. Intimate. Deadly.";
  if (count < 5) return `${count} players in the room. The tension is warm.`;
  return `${count} players assembled. Something grand is coming.`;
};

/**
 * The "buzz motif": a thin electric current that sweeps across a track, a
 * quiet nod to the game's heart (the buzzer) while players wait. Purely
 * cosmetic — no gameplay effect.
 */
export const LobbyCurrent: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`relative h-[3px] w-full overflow-hidden rounded-full bg-white/5 ${className}`}>
    <motion.div
      className="absolute inset-y-0 w-1/3 rounded-full"
      style={{
        background:
          "linear-gradient(90deg, transparent, rgba(99,102,241,0.9), rgba(139,92,246,0.9), transparent)",
      }}
      animate={{ x: ["-120%", "320%"] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);
