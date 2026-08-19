import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 * Renders a floating-emoji layer over the question card. The emojis are
 * rendered through a portal into a fixed, full-viewport layer so they can fly
 * up and over the app header instead of getting clipped or hidden behind it.
 * The card's on-screen rectangle is measured from an anchor element and the
 * emojis spawn near the bottom of that rectangle, then rise and fade out.
 */
export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({ reactions }) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const seen = useRef<Set<string>>(new Set());

  // Keep the measured card rectangle in sync with layout, scroll and resize.
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, []);

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
      }, 1600);
    });
  }, [reactions]);

  return (
    <>
      {/* Invisible anchor used to measure the card's on-screen rectangle. */}
      <div ref={anchorRef} className="absolute inset-0 pointer-events-none" aria-hidden />

      {rect &&
        floating.length > 0 &&
        createPortal(
          <div className="fixed inset-0 pointer-events-none z-[46] overflow-visible" aria-hidden>
            <AnimatePresence>
              {floating.map((f) => (
                <motion.span
                  key={f.id}
                  initial={{ opacity: 0, y: 0, scale: 0.4, rotate: f.rot }}
                  animate={{ opacity: 1, y: -140, scale: 1, rotate: 0 }}
                  exit={{
                    opacity: 0,
                    y: -320,
                    scale: 1.15,
                    transition: { duration: 0.55, ease: "easeIn" },
                  }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  style={{
                    position: "absolute",
                    top: rect.top + rect.height * 0.72,
                    left: rect.left + (f.x / 100) * rect.width,
                    fontSize: f.size,
                    lineHeight: 1,
                    filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.5))",
                  }}
                >
                  {f.emoji}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </>
  );
};