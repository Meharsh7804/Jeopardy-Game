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
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = ACHIEVEMENT_ICONS[toast.id];
          const nameKey = achievementKey(toast.id);
          return (
            <motion.div
              key={toast.key}
              initial={{ opacity: 0, y: -40, scale: 0.7 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="flex items-center gap-3.5 pl-3.5 pr-7 py-3.5 rounded-2xl glass-panel-heavy border border-warning-accent/40 bg-black/70 shadow-[0_0_40px_rgba(245,158,11,0.35)] backdrop-blur-xl"
            >
              <span className="relative">
                <span className="absolute inset-0 bg-warning-accent/40 blur-lg rounded-full" />
                <span className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-warning-accent to-amber-600 flex items-center justify-center text-black shadow-lg">
                  <Icon className="w-6 h-6" />
                </span>
              </span>
              <span className="text-left">
                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-warning-accent">
                  <Award className="w-3 h-3" /> {t("achievementUnlocked")}
                </span>
                <span className="block font-display font-black text-lg text-white leading-tight">
                  {t(nameKey)}
                </span>
                <span className="block text-[11px] text-text-muted leading-tight mt-0.5">
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
