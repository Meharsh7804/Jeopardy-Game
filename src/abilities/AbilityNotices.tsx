import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { abilityNoticeBus, type AbilityNotice } from "./internal";

const TONE_STYLES: Record<AbilityNotice["tone"], string> = {
  warn: "border-warning-accent/50 bg-warning-accent/10 text-warning-accent",
  info: "border-primary-accent/50 bg-primary-accent/10 text-primary-accent",
  lock: "border-danger-accent/50 bg-danger-accent/10 text-danger-accent",
  ace: "border-success-accent/50 bg-success-accent/10 text-success-accent",
};

/** Short-lived single-purpose toasts (lock outs, bounce-backs, rolls…). */
export const AbilityNotices: React.FC = () => {
  const [notices, setNotices] = useState<AbilityNotice[]>([]);

  useEffect(() => {
    const unsub = abilityNoticeBus.subscribe((n) => {
      setNotices((prev) => [...prev.slice(-2), n]);
      window.setTimeout(() => {
        setNotices((prev) => prev.filter((x) => x.id !== n.id));
      }, 2600);
    });
    return unsub;
  }, []);

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[96] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {notices.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 backdrop-blur-xl bg-black/70 font-black uppercase tracking-wider text-xs ${TONE_STYLES[n.tone]} shadow-xl`}
          >
            {n.icon && <span className="text-base leading-none">{n.icon}</span>}
            <span>{n.title}</span>
            {n.subtitle && <span className="font-bold normal-case tracking-normal text-text-muted">{n.subtitle}</span>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};