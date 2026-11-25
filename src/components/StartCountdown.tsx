import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { soundManager } from "../utils/sound";
import { useRoom } from "../context/RoomContext";

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
 * Full-screen broadcast film-leader countdown shown on every screen when the
 * host starts the game. Driven locally from mount time so it is smooth and never
 * skewed by server clock differences; the host flips phase to "board" shortly
 * after the window elapses.
 */
export const StartCountdown: React.FC<StartCountdownProps> = (_props) => {
  const { room } = useRoom();
  const reduce = useReducedMotion();
  const [remaining, setRemaining] = useState(5);
  const [done, setDone] = useState(false);
  const mountRef = useRef<number>(Date.now());
  const prevRef = useRef(6);
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
      soundManager.playCorrect();
    }
  }, [done]);

  const cue =
    remaining >= 4 ? "ALL CONTESTANTS SEATED — LOCKING BOARD..." :
    remaining === 3 ? "CHECK YOUR POWER-UPS & BUZZERS..." :
    remaining === 2 ? "HANDS ON SPACEBAR / BUZZER..." :
    remaining === 1 ? "STANDBY FOR ROUND 1..." :
    "● LIVE ON AIR — GOOD LUCK!";

  const filled = done ? 5 : Math.min(5, Math.max(0, 5 - remaining));
  const blockColors = ["#FF3B1D", "#FF3B1D", "#FFD60A", "#FFD60A", "#00C271"];
  const roomLabel = room ? `ROOM: ${room.id}${room.quizTitle ? ` • ${room.quizTitle.toUpperCase()}` : ""}` : "STUDIO SYNC";

  const numeralClass =
    done
      ? "text-5xl sm:text-6xl text-[#FFFFFF] bg-[#FF3B1D] px-6 py-3 border-2 border-[#111111] shadow-[4px_4px_0_#111111]"
      : remaining === 1
        ? "text-8xl sm:text-9xl text-[#FFFFFF] bg-[#FF3B1D] px-6 py-2 border-2 border-[#111111] shadow-[4px_4px_0_#111111]"
        : remaining === 2
          ? "text-8xl sm:text-9xl text-[#111111] bg-[#FFD60A] px-6 py-2 border-2 border-[#111111] shadow-[4px_4px_0_#111111]"
          : "text-8xl sm:text-9xl text-[#111111]";

  return (
    <div
      className="fixed inset-0 z-50 bg-[#F4EFE6] flex flex-col justify-between p-5 sm:p-8 select-none overflow-hidden"
      style={{
        backgroundImage: "linear-gradient(to right, #E5DEC9 1px, transparent 1px), linear-gradient(to bottom, #E5DEC9 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      {/* Corner viewfinder marks */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute top-4 left-4 w-6 h-6 border-t-[3px] border-l-[3px] border-[#111111]" />
        <span className="absolute top-4 right-4 w-6 h-6 border-t-[3px] border-r-[3px] border-[#111111]" />
        <span className="absolute bottom-4 left-4 w-6 h-6 border-b-[3px] border-l-[3px] border-[#111111]" />
        <span className="absolute bottom-4 right-4 w-6 h-6 border-b-[3px] border-r-[3px] border-[#111111]" />
      </div>

      {/* Top production slate bar */}
      <div className="relative z-10 bg-[#111111] text-[#FFFFFF] border-2 border-[#111111] shadow-[4px_4px_0_#111111] px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF3B1D] animate-pulse shrink-0" />
          <span className="font-mono text-xs font-bold tracking-[0.08em] uppercase truncate">Studio Control // Pre-Show Sequence</span>
        </div>
        <span className="font-mono text-xs font-bold tracking-[0.08em] uppercase text-[#FFD60A] shrink-0">{roomLabel}</span>
      </div>

      {/* Center slate card */}
      <div className="relative z-10 flex-1 flex items-center justify-center py-6">
        <div className="max-w-md w-full mx-auto bg-[#FFFFFF] border-[3px] border-[#111111] shadow-[10px_10px_0_#111111] overflow-hidden">
          <div className="h-3 border-b-2 border-[#111111]" style={{ backgroundImage: "repeating-linear-gradient(-45deg, #FFD60A 0 10px, #111111 10px 20px)" }} />
          <div className="px-5 py-2.5 bg-[#F4EFE6] border-b-2 border-[#111111] flex items-center justify-between font-mono text-xs font-bold uppercase tracking-[0.06em]">
            <span className="text-[#111111]">Cue Sheet // Take 01</span>
            <span className="text-[#00C271]">Synced to All Podiums</span>
          </div>

          <div className="p-8 flex flex-col items-center justify-center relative bg-[#FFFFFF] min-h-[280px] sm:min-h-[320px]">
            {/* Film-leader reticle */}
            <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="absolute w-[240px] h-[240px] sm:w-[280px] sm:h-[280px] rounded-full border-2 border-[#111111]/20" />
              <div className="absolute w-[180px] h-[180px] sm:w-[210px] sm:h-[210px] rounded-full border-2 border-[#111111]/20" />
              <div className="absolute w-[120px] h-[120px] sm:w-[140px] sm:h-[140px] rounded-full border-2 border-[#111111]/15" />
              <div className="absolute w-px h-[260px] sm:h-[300px] bg-[#111111]/10" />
              <div className="absolute h-px w-[260px] sm:w-[300px] bg-[#111111]/10" />
              <div
                className="absolute w-[240px] h-[240px] sm:w-[280px] sm:h-[280px] rounded-full bwq-countdown-sweep"
                style={{
                  background: "conic-gradient(from -90deg, rgba(255,214,10,0.35) 0deg, rgba(255,214,10,0.0) 95deg, rgba(255,214,10,0.0) 360deg)",
                }}
              />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={done ? "go" : remaining}
                initial={reduce ? { opacity: 0 } : { scale: 1.5, opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { scale: 0.92, opacity: 0 }}
                transition={reduce ? { duration: 0.01 } : { type: "spring", stiffness: 500, damping: 24 }}
                className="relative z-10 flex items-center justify-center"
              >
                <div
                  className={`${numeralClass} leading-none tracking-tighter uppercase text-center`}
                  style={{ fontFamily: "'Archivo Black', sans-serif" }}
                >
                  {done ? "ON AIR!" : remaining}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="bg-[#111111] text-[#FFD60A] px-5 py-3.5 text-center font-['Archivo_Black'] text-sm sm:text-base tracking-wider uppercase border-t-2 border-[#111111]">
            {cue}
          </div>
        </div>
      </div>

      {/* Bottom segmented progress */}
      <div className="relative z-10 max-w-md w-full mx-auto bg-[#FFFFFF] border-2 border-[#111111] p-1.5 shadow-[4px_4px_0_#111111]">
        <div className="grid grid-cols-5 gap-1.5 h-3">
          {blockColors.map((color, i) => (
            <div
              key={i}
              className="border border-[#111111]/20 transition-colors duration-150"
              style={{ backgroundColor: i < filled ? color : "#E5DEC9" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
