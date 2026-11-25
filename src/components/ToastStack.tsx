import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toastBus, type Toast, type ToastLevel } from "../utils/toast";
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";

const LEVEL_STYLES: Record<ToastLevel, { ring: string; icon: React.ReactNode; chip: string }> = {
  info: {
    ring: "border-primary-accent/50",
    icon: <Info className="w-5 h-5 text-primary-accent" />,
    chip: "bg-primary-accent/15",
  },
  success: {
    ring: "border-success-accent/50",
    icon: <CheckCircle2 className="w-5 h-5 text-success-accent" />,
    chip: "bg-success-accent/15",
  },
  warning: {
    ring: "border-warning-accent/50",
    icon: <AlertTriangle className="w-5 h-5 text-warning-accent" />,
    chip: "bg-warning-accent/15",
  },
  error: {
    ring: "border-danger-accent/50",
    icon: <XCircle className="w-5 h-5 text-danger-accent" />,
    chip: "bg-danger-accent/15",
  },
};

export const ToastStack: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const timers = new Map<string, number>();
    const unsub = toastBus.subscribe((t) => {
      setToasts((prev) => [...prev.slice(-4), t]);
      const timer = window.setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, t.duration ?? 4500);
      timers.set(t.id, timer);
    });
    return () => {
      unsub();
      timers.forEach((tm) => window.clearTimeout(tm));
    };
  }, []);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(22rem,calc(100vw-2rem))] pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const s = LEVEL_STYLES[t.level];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              className={`pointer-events-auto glass-panel-heavy rounded-2xl border ${s.ring} p-3 flex items-start gap-3 shadow-2xl`}
            >
              <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${s.chip}`}>
                {s.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-sm text-text-main leading-tight">{t.title}</p>
                {t.message && (
                  <p className="text-xs text-text-muted mt-0.5 leading-snug break-words">{t.message}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-main hover:bg-[#E5DEC9] transition"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default ToastStack;