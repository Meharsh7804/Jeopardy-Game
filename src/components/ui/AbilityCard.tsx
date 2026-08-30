import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Lock, Check, ChevronRight } from "lucide-react";
import type { RoomPlayer, RoomAbilityEffect } from "../../types/jeopardy";
import type { AbilityDef } from "../../abilities/types";
import { getAbilityForAvatar } from "../../abilities/config";
import { getAvatarByIdOrSeed } from "../../utils/avatarImages";

const ACCENT_RGB: Record<string, string> = {
  primary: "99,102,241",
  secondary: "139,92,246",
  warning: "245,158,11",
  danger: "244,63,94",
  success: "16,185,129",
  ink: "129,140,248",
};

const UNLOCK_TARGET = 2;

interface AbilityCardProps {
  player: RoomPlayer;
  /** Live effect instance for this player, if they have one active. */
  fx?: RoomAbilityEffect | undefined;
  /** Fired when the player taps to activate (ready state). */
  onActivate: () => void;
  /** Fired to open the settings when locked (hint). */
  onUnlockHint?: () => void;
  compact?: boolean;
}

/**
 * Stateful, animated ability card. Drives a progress ring around the avatar:
 * grey while locked → rotating conic glow once ready → live pulse while active
 * → dimmed checkmark once used. Replaces the plain header icon.
 */
export const AbilityCard: React.FC<AbilityCardProps> = ({
  player,
  fx,
  onActivate,
  compact,
}) => {
  const def: AbilityDef | undefined = getAbilityForAvatar(player.abilityId);
  const [charging, setCharging] = useState(false);

  const used = !!player.abilityUsed;
  const ready = !!player.abilityUnlocked && !used;
  const active = !!fx && fx.status !== undefined; // any live effect instance
  const counts = player.correctCount ?? 0;
  const progress = Math.min(1, counts / UNLOCK_TARGET);

  if (!def) return null;

  const avatar = getAvatarByIdOrSeed(def.avatarId);
  const rgb = ACCENT_RGB[def.accent] ?? ACCENT_RGB.primary;
  const pct = ready ? 100 : Math.round(progress * 100);

  const handleTap = () => {
    if (!ready) return;
    setCharging(true);
    window.setTimeout(() => {
      setCharging(false);
      onActivate();
    }, 350);
  };

  // Rotating colored conic while ready or active; static grey progress arc
  // while locked so the fill visually grows toward the unlock threshold.
  const ringStyle: React.CSSProperties = ready || active
    ? {
        background: `conic-gradient(from 0deg, rgba(${rgb},1), rgba(${rgb},0.25), rgba(${rgb},1))`,
      }
    : {
        background: `conic-gradient(rgba(148,163,184,0.9) ${pct * 3.6}deg, rgba(229,231,235,0.15) 0deg)`,
      };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className={`relative rounded-[1.6rem] border overflow-hidden select-none ${
        compact ? "p-3" : "p-4 sm:p-5"
      } ${
        ready
          ? "border-warning-accent/40 bg-gradient-to-br from-warning-accent/10 via-secondary-accent/5 to-black/30"
          : active
            ? "border-success-accent/40 bg-gradient-to-br from-success-accent/10 via-black/25 to-black/30"
            : used
              ? "border-white/10 bg-black/25"
              : "border-white/10 bg-black/30 grayscale-[35%]"
      }`}
    >
      {/* Soft ambient glow, only present while ready or active */}
      <AnimatePresence>
        {(ready || active) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute -inset-8 -z-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 50% 40%, rgba(${rgb},0.28), transparent 65%)`,
            }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 flex items-center gap-3 sm:gap-4">
        {/* Progress ring + avatar */}
        <div className="relative shrink-0">
          {/* Rotating colored arc (ready/active) or static grey progress (locked) */}
          <motion.div
            className="absolute -inset-1.5 rounded-full"
            style={ringStyle}
            animate={ready || active ? { rotate: 360 } : { rotate: 0 }}
            transition={
              ready || active
                ? { duration: 6, repeat: Infinity, ease: "linear" }
                : { duration: 0 }
            }
          />
          {/* Inner disc so the arc reads as a ring */}
          <div
            className={`absolute -inset-1.5 rounded-full bg-[#0a0e17] ${
              compact ? "scale-[0.82]" : "scale-[0.85]"
            }`}
          />
          <div className="relative">
            <motion.img
              src={avatar?.src}
              alt={def.name}
              animate={
                ready
                  ? { scale: [1, 1.05, 1] }
                  : active
                    ? { scale: [1, 1.03, 1] }
                    : { scale: 1 }
              }
              transition={
                ready
                  ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                  : active
                    ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0 }
              }
              className={`rounded-full object-cover ring-2 ${
                ready
                  ? "ring-warning-accent/70 shadow-[0_0_20px_rgba(245,158,11,0.45)]"
                  : active
                    ? "ring-success-accent/70 shadow-[0_0_20px_rgba(16,185,129,0.45)]"
                    : used
                      ? "ring-white/10 grayscale"
                      : "ring-white/15"
              } ${compact ? "w-12 h-12" : "w-14 h-14 sm:w-16 sm:h-16"}`}
              style={{ objectPosition: avatar?.position }}
            />
            {/* Charging flash when tapped */}
            <AnimatePresence>
              {charging && (
                <motion.div
                  initial={{ opacity: 0.9, scale: 0.6 }}
                  animate={{ opacity: 0, scale: 1.8 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full bg-warning-accent/70 pointer-events-none"
                />
              )}
            </AnimatePresence>
          </div>
          {/* Ready badge — tiny sparkle chip on the ring */}
          {ready && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.1 }}
              className="absolute -right-1 -top-1 w-5 h-5 rounded-full bg-warning-accent text-black flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.8)]"
            >
              <Zap className="w-3 h-3 fill-current" />
            </motion.div>
          )}
        </div>

        {/* Copy */}
        <div className="min-w-0 flex-1">
          <p
            className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] ${
              ready
                ? "text-warning-accent"
                : active
                  ? "text-success-accent"
                  : used
                    ? "text-text-muted"
                    : "text-text-muted/70"
            }`}
          >
            {def.emoji} {def.abilityName}
          </p>
          <p className="text-sm sm:text-base font-display font-black text-white truncate">
            {def.name}
          </p>

          {/* State line */}
          <div className="mt-1 flex items-center gap-1.5 min-h-[16px]">
            <AnimatePresence mode="wait">
              {used ? (
                <motion.span
                  key="used"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-text-muted uppercase tracking-widest"
                >
                  <Check className="w-3 h-3 text-success-accent" /> Used this game
                </motion.span>
              ) : active ? (
                <motion.span
                  key="active"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="inline-flex items-center gap-1 text-[10px] font-black text-success-accent uppercase tracking-widest animate-pulse"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-success-accent animate-pulse" />
                  {fx?.kind === "risky" ? "Activated — pick your risk" : "Ability live now"}
                </motion.span>
              ) : ready ? (
                <motion.span
                  key="ready"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="inline-flex items-center gap-1 text-[10px] font-black text-warning-accent uppercase tracking-widest"
                >
                  <Zap className="w-3 h-3" /> Tap to activate
                </motion.span>
              ) : (
                <motion.span
                  key="locked"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="inline-flex items-center gap-1 text-[10px] font-black text-text-muted uppercase tracking-widest"
                >
                  <Lock className="w-3 h-3" /> Unlock after 2 correct
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Progress bar while locked (growable toward 2 correct) */}
          {!ready && !used && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-warning-accent to-secondary-accent"
                  initial={false}
                  animate={{ width: `${Math.round(progress * 100)}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
              <span className="text-[10px] font-black text-text-muted tabular-nums">
                {counts}/{UNLOCK_TARGET}
              </span>
            </div>
          )}
        </div>

        {/* Right chevron / cta affordance */}
        <button
          onClick={handleTap}
          disabled={!ready}
          aria-label={ready ? `Activate ${def.abilityName}` : "Ability locked"}
          className={`shrink-0 rounded-xl border p-2 transition-all ${
            ready
              ? "bg-warning-accent/20 border-warning-accent/50 text-warning-accent hover:bg-warning-accent/30 hover:scale-110 shadow-[0_0_14px_rgba(245,158,11,0.35)]"
              : "bg-white/5 border-white/10 text-text-muted/40"
          }`}
        >
          {ready ? <Zap className="w-4 h-4 animate-pulse" /> : <Lock className="w-4 h-4" />}
        </button>
      </div>

      {/* Tagline footer (non-compact) */}
      {!compact && (
        <p className={`relative z-10 mt-3 text-[11px] leading-relaxed italic ${ready ? "text-warning-accent/70" : "text-text-muted/70"}`}>
          {def.tagline}
        </p>
      )}

      {/* Unlock hint arrow (locked) */}
      {!ready && !used && (
        <div className="relative z-10 mt-2 flex items-center gap-1 text-[10px] font-bold text-text-muted/60 uppercase tracking-widest">
          <ChevronRight className="w-3 h-3" /> Answer 2 correct to charge this ability
        </div>
      )}
    </motion.div>
  );
};
