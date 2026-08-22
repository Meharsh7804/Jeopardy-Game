import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "../context/SettingsContext";
import { soundManager } from "../utils/sound";

export const COUNTDOWN_MS = 5000;

interface StartCountdownProps {
  // Retained for API compatibility. We intentionally do NOT derive the
  // countdown from `startAt`: it is a server timestamp, and any client↔server
  // clock skew would inflate/deflate the visible number (e.g. starting at 7 and
  // cutting off at 3). Instead each client counts from its own mount time, so
  // the sequence is always a clean 5-4-3-2-1 regardless of clock drift.
  startAt?: number;
}

/**
 * Full-screen 5-4-3-2-1 countdown shown on every screen when the host starts
 * the game. Driven locally from mount time so it is smooth and never skewed by
 * server clock differences; the host flips the phase to "board" shortly after
 * the window elapses, so the board reliably appears after "Let's Buzz!".
 */
export const StartCountdown: React.FC<StartCountdownProps> = () => {
  const { t } = useSettings();
  const [remaining, setRemaining] = useState(5);
  const [done, setDone] = useState(false);
  const mountRef = useRef<number>(Date.now());
  const prevRef = useRef(5);
  const playedGoRef = useRef(false);

  useEffect(() => {
    mountRef.current = Date.now();
    const tick = () => {
      const elapsed = Date.now() - mountRef.current;
      setRemaining(Math.max(0, Math.ceil((COUNTDOWN_MS - elapsed) / 1000)));
      setDone(elapsed >= COUNTDOWN_MS);
    };
    tick();
    const iv = window.setInterval(tick, 80);
    return () => window.clearInterval(iv);
  }, []);

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
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 22 }}
            className="text-center"
          >
            <p className="text-8xl sm:text-9xl font-display font-black text-success-accent drop-shadow-[0_0_60px_rgba(16,185,129,0.6)]">
              {t("letsBuzz")}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={remaining}
            initial={{ scale: 1.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 26, mass: 0.8 }}
            className="text-center"
          >
            <motion.p className="text-9xl sm:text-[12rem] font-display font-black text-white drop-shadow-[0_0_70px_rgba(99,102,241,0.7)]">
              {remaining}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
