import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getAbilityForAvatar } from "./config";
import { abilityOverlayBus, type AbilityOverlayEvent } from "./internal";
import { playAbilityAudio } from "./audio";
import { getAvatarByIdOrSeed } from "../utils/avatarImages";

const ACCENT_GLOW: Record<string, string> = {
  spotlight: "244,63,94",
  shake: "245,158,11",
  impact: "99,102,241",
  flash: "236,72,153",
  burst: "16,185,129",
  zoom: "94,234,212",
  freeze: "165,180,252",
  glitch: "244,63,94",
  chaos: "168,85,247",
};

// Shared keyframe language — each ability runs one so no two fire the same way.
const INTERNAL: Record<string, { anim: any }> = {
  spotlight: { anim: { opacity: [0, 1, 1], scale: [0.7, 1.1, 1] } },
  shake: { anim: { x: [0, -18, 14, -10, 6, 0], rotate: [0, -4, 4, -2, 0, 0] } },
  impact: { anim: { scale: [0.3, 1.15, 1], y: [80, -14, 0] } },
  flash: { anim: { opacity: [0, 1, 1], scale: [1.4, 1, 1] } },
  burst: { anim: { scale: [0.4, 1.15, 1], y: [24, -10, 0] } },
  zoom: { anim: { scale: [0.5, 1.2, 1] } },
  freeze: { anim: { opacity: [0, 1, 1], scale: [0.7, 1.25, 1] } },
  glitch: { anim: { x: [0, -6, 7, -4, 0], skewX: [0, 4, -4, 0, 0] } },
  chaos: { anim: { scale: [0.4, 1.3, 0.95, 1], rotate: [0, -9, 9, 0], y: [0, -22, 0] } },
};

interface ActiveItem extends AbilityOverlayEvent {
  avatarSrc?: string;
  name: string;
}

const TTL = 2000;

/** Full-screen cinematic flash when ANY player's ability fires. */
export const AbilityOverlay: React.FC = () => {
  const [items, setItems] = useState<ActiveItem[]>([]);

  useEffect(() => {
    const unsub = abilityOverlayBus.subscribe((e) => {
      const def = getAbilityForAvatar(e.abilityId);
      if (!def) return;
      playAbilityAudio(e.abilityId);
      const avatar = getAvatarByIdOrSeed(e.abilityId);
      setItems((prev) => [...prev, { ...e, avatarSrc: avatar?.src, name: def.name }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== e.id));
      }, TTL);
    });
    return unsub;
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[90] pointer-events-none overflow-hidden">
      <AnimatePresence>
        {items.map((it) => {
          const def = getAbilityForAvatar(it.abilityId);
          const anim = def?.animation ?? "spotlight";
          const rgb = ACCENT_GLOW[anim] ?? ACCENT_GLOW.spotlight;
          const animCfg = INTERNAL[anim] ?? INTERNAL.spotlight;
          return (
            <div
              key={it.id}
              className="absolute inset-0 flex items-center justify-center"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse at center, transparent 20%, rgba(${rgb},0.5) 140%)`,
                }}
              />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  ...(animCfg?.anim ?? INTERNAL.spotlight.anim),
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex flex-col items-center justify-center text-center"
              >
                {it.avatarSrc && (
                  <motion.img
                    src={it.avatarSrc}
                    alt={it.name}
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                    className="w-32 h-32 rounded-full object-cover ring-4 ring-white/30 shadow-[0_0_70px_rgba(0,0,0,0.8)]"
                  />
                )}
                <motion.div
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.12, type: "spring", stiffness: 300, damping: 24 }}
                  className="mt-4 flex flex-col items-center gap-1"
                >
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-white/70">
                    {it.name} activates
                  </span>
                  <span className="font-display font-black text-3xl text-white text-center drop-shadow-lg px-4">
                    {def?.abilityName}
                  </span>
                </motion.div>
              </motion.div>
            </div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body,
  );
};