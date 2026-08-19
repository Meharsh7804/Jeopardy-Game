import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award } from "lucide-react";
import { achievementBus } from "../utils/achievementBus";
import { ACHIEVEMENT_ICONS } from "../utils/achievements";
import { achievementKey } from "../utils/profile";
import type { AchievementId } from "../utils/profile";
import { useSettings } from "../context/SettingsContext";
import { soundManager } from "../utils/sound";

interface Toast {
  key: string;
  id: AchievementId;
}

const TOAST_DURATION = 4200;

/**
 * In-game achievement popup layer. Rendered once per device; listens on the
 * achievement bus and slides in a golden "Achievement Unlocked!" card whenever
 * anything (live streak/buzz checks, game-end evaluation) grants a new one.
 */
export const AchievementToast: React.FC = () => {
  const { t } = useSettings();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const timers = new Map<string, number>();
    const unsub = achievementBus.subscribe((id) => {
      const key = `${id}-${Date.now()}`;
      setToasts((prev) => [...prev.slice(-2), { key, id }]);
      soundManager.playCorrect();
      const timer = window.setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.key !== key));
      }, TOAST_DURATION);
      timers.set(key, timer);
    });
    return () => {
      unsub();
      timers.forEach((tm) => window.clearTimeout(tm));
    };
  }, []);

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[90] flex flex-col items-center gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = ACHIEVEMENT_ICONS[toast.id];
          const nameKey = achievementKey(toast.id);
          return (
            <motion.div
              key={toast.key}
              initial={{ opacity: 0, y: -60, scale: 0.6 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 380, damping: 20 }}
              className="relative flex items-center gap-4 pl-4 pr-8 py-4 rounded-2xl glass-panel-heavy border-2 border-warning-accent/60 bg-black/80 shadow-[0_0_50px_rgba(245,158,11,0.5)] backdrop-blur-xl overflow-hidden"
            >
              {/* golden sweep */}
              <motion.span
                initial={{ left: "-40%" }}
                animate={{ left: "120%" }}
                transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
                className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-warning-accent/20 to-transparent skew-x-[-20deg]"
              />
              <span className="relative">
                <span className="absolute inset-0 bg-warning-accent/50 blur-xl rounded-full animate-pulse-glow" />
                <span className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-warning-accent to-amber-600 flex items-center justify-center text-black shadow-[0_0_25px_rgba(245,158,11,0.6)]">
                  <Icon className="w-7 h-7" />
                </span>
              </span>
              <span className="relative text-left">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-warning-accent">
                  <Award className="w-3.5 h-3.5" /> {t("achievementUnlocked")}
                </span>
                <span className="block font-display font-black text-xl text-white leading-tight mt-0.5">
                  {t(nameKey)}
                </span>
                <span className="block text-xs text-text-muted leading-tight mt-0.5">
                  {t(`${nameKey}Desc`)}
                </span>
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
