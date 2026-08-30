import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Target, Dices, X } from "lucide-react";
import type { RoomPlayer } from "../types/jeopardy";
import type { AbilityDef } from "./types";
import { getAvatarByIdOrSeed } from "../utils/avatarImages";
import { PlayerAvatar } from "../utils/playerAvatar";
import { resolveAutoTarget } from "./engine";

export interface ActivationPayload {
  targetId?: string;
  option?: string;
}

interface ActivationModalProps {
  def: AbilityDef | null;
  meId: string;
  players: RoomPlayer[]; // all non-host players
  onConfirm: (payload: ActivationPayload) => void;
  onClose: () => void;
}

const ACCENT_RING: Record<string, string> = {
  primary: "ring-primary-accent bg-primary-accent/20 border-primary-accent/40",
  secondary: "ring-secondary-accent bg-secondary-accent/20 border-secondary-accent/40",
  warning: "ring-warning-accent bg-warning-accent/20 border-warning-accent/40",
  danger: "ring-danger-accent bg-danger-accent/20 border-danger-accent/40",
  success: "ring-success-accent bg-success-accent/20 border-success-accent/40",
  ink: "ring-indigo-400 bg-indigo-400/20 border-indigo-400/40",
};

export const ActivationModal: React.FC<ActivationModalProps> = ({
  def,
  meId,
  players,
  onConfirm,
  onClose,
}) => {
  const [targetId, setTargetId] = useState<string | undefined>();
  const [rolling, setRolling] = useState(false);
  const [rolled, setRolled] = useState<string | undefined>();

  useEffect(() => {
    setTargetId(undefined);
    setRolled(undefined);
  }, [def?.id]);

  if (!def) return null;

  const candidates = players.filter((p) => p.id !== meId);
  const autoTarget = def.autoTarget
    ? resolveAutoTarget(
        Object.fromEntries(players.map((p) => [p.id, p])),
        meId,
        def.params?.targetMode,
      )
    : undefined;
  const autoPlayer = autoTarget ? players.find((p) => p.id === autoTarget) : undefined;
  const ring = ACCENT_RING[def.accent] ?? ACCENT_RING.primary;
  const needsRoll = def.params?.roll;

  const canConfirm = needsRoll ? !!rolled : def.needsTarget ? !!targetId : true;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({ targetId: def.autoTarget ? autoTarget : targetId, option: rolled });
  };

  const doRoll = () => {
    setRolling(true);
    setRolled(undefined);
    window.setTimeout(() => {
      const outcomes = ["×1.5", "×2", "×2.5"];
      const pick = outcomes[Math.floor(Math.random() * outcomes.length)];
      const map = { "×1.5": "150", "×2": "200", "×2.5": "250" } as const;
      setRolled(map[pick as keyof typeof map]);
      setRolling(false);
    }, 900);
  };

  const showTargets = def.needsTarget && !def.autoTarget;

  return (
    <AnimatePresence>
      <motion.div
        key="activation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 12 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="glass-panel-heavy rounded-[2rem] p-7 w-full max-w-md space-y-5 relative border border-white/15 shadow-[0_0_90px_rgba(0,0,0,0.7)]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 border border-white/10 text-text-muted hover:text-white hover:bg-white/20 transition-all"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-4 pr-10">
            <div className={`relative rounded-2xl p-2 ring-2 border ${ring}`}>
              {def.avatarId && (
                <img
                  src={getAvatarByIdOrSeed(def.avatarId)?.src}
                  alt={def.name}
                  className="w-16 h-16 rounded-xl object-cover"
                />
              )}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">{def.name}</p>
              <h3 className="text-2xl font-display font-black text-white leading-tight">{def.abilityName}</h3>
            </div>
          </div>

          <p className="text-sm text-text-muted leading-relaxed">{def.longDesc}</p>

          <div className="h-px w-full bg-gradient-to-r from-white/15 to-transparent" />

          {showTargets && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted flex items-center gap-1.5">
                <Target className="w-3 h-3" /> Choose a target
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                {candidates.map((p) => {
                  const isSel = targetId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setTargetId(p.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all text-left ${
                        isSel
                          ? "bg-primary-accent/20 border-primary-accent/60 ring-1 ring-primary-accent/60"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <PlayerAvatar seed={p.id} avatar={p.avatar} name={p.name} size={32} className="shrink-0 rounded-full" />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-white truncate">{p.name}</span>
                        <span className="block text-[10px] font-black text-text-muted">{p.score} pts</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {def.autoTarget && (
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-sm text-text-muted flex items-center gap-2">
              <Target className="w-4 h-4 text-primary-accent shrink-0" />
              Auto-targets:
              <span className="font-bold text-white">{autoPlayer?.name ?? "the leader"}</span>
            </div>
          )}

          {needsRoll && (
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-center">
              {rolling ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                  className="w-14 h-14 rounded-2xl mx-auto bg-white/10 flex items-center justify-center"
                >
                  <Dices className="w-7 h-7 text-warning-accent" />
                </motion.div>
              ) : rolled ? (
                <div className="space-y-1">
                  <p className="font-display font-black text-3xl text-warning-accent">
                    {rolled === "150" ? "×1.5" : rolled === "250" ? "×2.5" : "×2"}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Locked for your next correct</p>
                </div>
              ) : (
                <button
                  onClick={doRoll}
                  className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl bg-warning-accent/20 border border-warning-accent/40 text-warning-accent font-black uppercase tracking-widest text-xs hover:bg-warning-accent/30 transition-colors"
                >
                  <Dices className="w-4 h-4" /> Roll the dice
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="w-full py-3.5 rounded-2xl premium-btn font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 disabled:shadow-none"
          >
            <Zap className="w-4 h-4" />
            {needsRoll ? (rolled ? "Lock & Activate" : "Roll first") : def.needsTarget ? "Activate Against Target" : "Activate Ability"}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};