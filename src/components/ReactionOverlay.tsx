import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RoomReaction } from "../types/jeopardy";

interface FloatingReaction {
  id: string; // unique reaction id (animates exactly once per id)
  emoji: string;
  x: number; // horizontal position as % of the card
  size: number; // font-size px
  rot: number; // initial rotation deg
}

interface ReactionOverlayProps {
  reactions?: Record<string, RoomReaction>;
}

/**
 * Renders a floating-emoji layer over the question card. Mounted inside a
 * `relative` card container; every new reaction id spawns one pop animation,
 * rises a bit, then quickly flies up toward the top of the card while fading
 * out so it disappears faster than before.
 */
export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({ reactions }) => {
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!reactions) return;
    Object.values(reactions).forEach((r) => {
      if (!r || !r.id || seen.current.has(r.id)) return;
      seen.current.add(r.id);
      const item: FloatingReaction = {
        id: r.id,
        emoji: r.emoji,
        x: 15 + Math.random() * 70,
        size: 30 + Math.random() * 26,
        rot: (Math.random() - 0.5) * 50,
      };
      setFloating((prev) => [...prev.slice(-11), item]);
      window.setTimeout(() => {
        setFloating((prev) => prev.filter((f) => f.id !== item.id));
      }, 1500);
    });
  }, [reactions]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <AnimatePresence>
        {floating.map((f) => (
          <motion.span
            key={f.id}
            initial={{ opacity: 0, y: 0, scale: 0.4, rotate: f.rot }}
            animate={{ opacity: 1, y: -130, scale: 1, rotate: 0 }}
            exit={{
              opacity: 0,
              y: -300,
              scale: 1.15,
              transition: { duration: 0.55, ease: "easeIn" },
            }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            style={{
              position: "absolute",
              bottom: "18%",
              left: `${f.x}%`,
              fontSize: f.size,
              lineHeight: 1,
              filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.35))",
            }}
          >
            {f.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
};