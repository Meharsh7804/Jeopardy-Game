import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { soundManager } from "../utils/sound";

export const COUNTDOWN_MS = 5000;

interface StartCountdownProps {
  startAt?: number; // server-resolved epoch ms
}

/**
 * Full-screen 5-4-3-2-1 countdown shown on every screen when the host starts
 * the game. The countdown is derived from the server-stamped `startAt`, so all
 * clients count from the same instant; the host flips the phase to "board"
 * shortly after the window elapses (plus a margin so every screen reliably
 * sees "1" and "Let's Buzz!" before the board appears).
 */
export const StartCountdown: React.FC<StartCountdownProps> = ({ startAt }) => {
  const { t } = useSettings();
  const [remaining, setRemaining] = useState(5);
  const [done, setDone] = useState(false);
  const prevRef = useRef(5);
  const playedGoRef = useRef(false);

  useEffect(() => {
    if (!startAt || typeof startAt !== "number") return;
    const tick = () => {
      const elapsed = Date.now() - startAt;
      setRemaining(Math.max(0, Math.ceil((COUNTDOWN_MS - elapsed) / 1000)));
      setDone(elapsed >= COUNTDOWN_MS);
    };
    tick();
    const iv = window.setInterval(tick, 100);
    return () => window.clearInterval(iv);
  }, [startAt]);

  useEffect(() => {
    if (remaining !== prevRef.current && remaining > 0) {
      prevRef.current = remaining;
      soundManager.playTimerTick();
    }
  }, [remaining]);

  useEffect(() => {
    if (done && !playedGoRef.current) {
      playedGoRef.current = true;
      soundManager.playReveal();
    }
  }, [done]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl">
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="go"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="text-center space-y-4"
          >
            <p className="text-8xl sm:text-9xl font-display font-black text-success-accent drop-shadow-[0_0_50px_rgba(16,185,129,0.6)]">
              {t("letsBuzz")}
            </p>
          </motion.div>
        ) : (
          <motion.p
            key={remaining}
            initial={{ scale: 2.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="text-9xl sm:text-[12rem] font-display font-black text-white drop-shadow-[0_0_60px_rgba(99,102,241,0.6)]"
          >
            {remaining}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};