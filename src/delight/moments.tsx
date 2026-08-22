import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

export type MomentTone = "forest" | "warm" | "ink" | "celebrate" | "playful";

export interface Moment {
  id: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  tone: MomentTone;
}

type Listener = (m: Moment) => void;
const listeners = new Set<Listener>();

/** Fire-and-forget in-game "moment" toast (achievements, clutch, comebacks). */
export const momentBus = {
  emit(m: Omit<Moment, "id">): string {
    const full: Moment = { ...m, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
    listeners.forEach((l) => l(full));
    return full.id;
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

const TONE_CLASSES: Record<MomentTone, { ring: string; glow: string; chip: string }> = {
  forest: { ring: "border-success-accent/60", glow: "shadow-[0_0_40px_rgba(16,185,129,0.45)]", chip: "bg-success-accent/20 text-success-accent" },
  warm: { ring: "border-warning-accent/60", glow: "shadow-[0_0_40px_rgba(245,158,11,0.45)]", chip: "bg-warning-accent/20 text-warning-accent" },
  ink: { ring: "border-ink-accent/60", glow: "shadow-[0_0_40px_rgba(99,102,241,0.45)]", chip: "bg-ink-accent/20 text-ink-accent" },
  celebrate: { ring: "border-rose-400/60", glow: "shadow-[0_0_50px_rgba(244,114,182,0.5)]", chip: "bg-rose-400/20 text-rose-300" },
  playful: { ring: "border-teal-300/60", glow: "shadow-[0_0_40px_rgba(94,234,212,0.45)]", chip: "bg-teal-300/20 text-teal-200" },
};

/** Bottom-center stack of playful, self-dismissing moment toasts. */
export const MomentToast: React.FC = () => {
  const [moments, setMoments] = useState<Moment[]>([]);

  useEffect(() => {
    const timers = new Map<string, number>();
    const unsub = momentBus.subscribe((m) => {
      setMoments((prev) => [...prev.slice(-2), m]);
      const timer = window.setTimeout(() => {
        setMoments((prev) => prev.filter((x) => x.id !== m.id));
      }, 3800);
      timers.set(m.id, timer);
    });
    return () => {
      unsub();
      timers.forEach((tm) => window.clearTimeout(tm));
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[95] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {moments.map((m) => {
          const tc = TONE_CLASSES[m.tone];
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 40, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className={`relative flex items-center gap-3 pl-4 pr-6 py-3 rounded-2xl glass-panel-heavy border-2 ${tc.ring} ${tc.glow} bg-black/75 backdrop-blur-xl overflow-hidden`}
            >
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${tc.chip} text-2xl`}>
                {m.icon}
              </span>
              <span className="text-left">
                <span className="block font-display font-black text-lg leading-tight text-white">{m.title}</span>
                {m.subtitle && <span className="block text-xs text-text-muted leading-tight">{m.subtitle}</span>}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
