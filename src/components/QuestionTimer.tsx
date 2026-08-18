import React, { useEffect, useRef, useState } from "react";
import { Timer as TimerIcon } from "lucide-react";
import { soundManager } from "../utils/sound";

interface QuestionTimerProps {
  seconds: number; // total countdown length in seconds
  /** Changes whenever a new question is opened — restarts the countdown. */
  openedAt?: number;
}

/**
 * Per-question countdown pill rendered on the question card during the buzzing
 * phase. Each client counts from its own wall clock (started the moment the
 * active question arrived), so every device ticks the same duration without
 * depending on server/client clock alignment.
 *
 * Sound: a normal woodblock tick on every whole second while time remains, and
 * a faster, descending "urgency" blip every 500ms during the last 3 seconds.
 */
export const QuestionTimer: React.FC<QuestionTimerProps> = ({ seconds, openedAt }) => {
  const [remaining, setRemaining] = useState(seconds);
  const lastBoundaryRef = useRef<number>(-1);

  useEffect(() => {
    if (typeof openedAt !== "number" || openedAt <= 0) return;
    const start = Date.now();
    lastBoundaryRef.current = -1;

    const tick = () => {
      const remainingMs = seconds * 1000 - (Date.now() - start);
      setRemaining(Math.max(0, Math.ceil(remainingMs / 1000)));
      if (remainingMs <= 0) return;

      if (remainingMs <= 3000) {
        // Urgency phase: a warning blip every 500ms.
        const boundary = Math.floor(remainingMs / 500);
        if (boundary !== lastBoundaryRef.current) {
          lastBoundaryRef.current = boundary;
          soundManager.playTimerUrgent();
        }
      } else {
        // Normal phase: one tick per whole second.
        const boundary = Math.floor(remainingMs / 1000);
        if (boundary !== lastBoundaryRef.current) {
          lastBoundaryRef.current = boundary;
          soundManager.playTimerTick();
        }
      }
    };

    tick();
    const iv = window.setInterval(tick, 100);
    return () => window.clearInterval(iv);
  }, [seconds, openedAt]);

  const urgent = remaining <= 3;

  return (
    <span
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-widest shadow-inner transition-colors ${
        urgent
          ? "bg-danger-accent/20 border-danger-accent/50 text-danger-accent animate-pulse"
          : "bg-white/5 border-white/10 text-text-muted"
      }`}
    >
      <TimerIcon className="w-3.5 h-3.5" />
      {remaining}s
    </span>
  );
};
