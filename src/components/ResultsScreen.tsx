import React from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Crown,
  Check,
  X,
  Zap,
  Target,
  RotateCcw,
  LogOut,
} from "lucide-react";
import type { RoomPlayer } from "../types/jeopardy";
import { PlayerAvatar } from "../utils/playerAvatar";
import { useSettings } from "../context/SettingsContext";
import { ConfettiBurst } from "./ConfettiBurst";

const fmtReaction = (ms?: number | null) =>
  ms === undefined || ms === null ? "—" : `${(ms / 1000).toFixed(2)}s`;

const accuracyOf = (p: RoomPlayer) => {
  const answered = (p.correctCount ?? 0) + (p.wrongCount ?? 0);
  return answered === 0 ? null : Math.round(((p.correctCount ?? 0) / answered) * 100);
};

interface ResultsScreenProps {
  players: RoomPlayer[]; // already sorted by score descending
  myId?: string;
  onPlayAgain?: () => void;
  onExit: () => void;
  exitLabel?: string;
  waitingNote?: string; // shown to non-hosts while they wait for a rematch
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  players,
  myId,
  onPlayAgain,
  onExit,
  exitLabel = "Exit",
  waitingNote,
}) => {
  const { t } = useSettings();
  const podiumOrder = [players[1], players[0], players[2]].filter(Boolean) as RoomPlayer[];
  const rest = players.slice(3);

  const podiumStyle: Record<
    number,
    { ring: string; badge: string; height: string; label: string; name: string }
  > = {
    1: {
      ring: "border-warning-accent/50 bg-gradient-to-b from-warning-accent/25 to-warning-accent/5 shadow-[0_0_40px_rgba(245,158,11,0.25)]",
      badge: "bg-warning-accent text-black",
      height: "h-56",
      label: t("champion"),
      name: "text-warning-accent",
    },
    2: {
      ring: "border-slate-300/40 bg-gradient-to-b from-slate-300/20 to-slate-300/5",
      badge: "bg-slate-300 text-slate-900",
      height: "h-40",
      label: t("champion2nd"),
      name: "text-slate-200",
    },
    3: {
      ring: "border-orange-700/40 bg-gradient-to-b from-orange-700/20 to-orange-700/5",
      badge: "bg-orange-700 text-white",
      height: "h-32",
      label: t("champion3rd"),
      name: "text-orange-200",
    },
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] gap-10 text-center p-6 w-full relative">
      <ConfettiBurst />

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.8 }}
        className="relative"
      >
        <div className="absolute inset-0 bg-warning-accent/30 blur-[100px] rounded-full" />
        <Trophy className="w-28 h-28 text-warning-accent drop-shadow-[0_0_40px_rgba(245,158,11,0.6)] relative z-10" />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-5xl md:text-6xl font-display font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50"
      >
        {t("gameOver")}
      </motion.h2>

      {players.length > 0 && (
        <div className="w-full max-w-2xl">
          <div className="grid grid-cols-3 gap-3 sm:gap-5 items-end">
            {podiumOrder.map((p, idx) => {
              const rank = podiumOrder.length === 3 ? [2, 1, 3][idx] : idx + 1;
              const style = podiumStyle[rank] ?? podiumStyle[1];
              const isMe = p.id === myId;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 25,
                    mass: 0.8,
                    delay: 0.15 * idx,
                  }}
                  className={`${style.height} ${style.ring} rounded-t-3xl border border-b-0 p-3 sm:p-4 flex flex-col items-center justify-end gap-2 relative overflow-hidden`}
                >
                  {rank === 1 && (
                    <motion.div
                      initial={{ y: -30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 20 }}
                      className="absolute -top-7"
                    >
                      <Crown className="w-10 h-10 text-warning-accent fill-warning-accent drop-shadow-lg" />
                    </motion.div>
                  )}
                  <div className="relative">
                    <PlayerAvatar
                      seed={p.id}
                      name={p.name}
                      size={rank === 1 ? 72 : 52}
                      className={`rounded-full ring-2 ${rank === 1 ? "ring-warning-accent/60" : "ring-white/10"}`}
                    />
                    {isMe && (
                      <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-primary-accent text-white text-[9px] font-black uppercase">
                        {t("you")}
                      </span>
                    )}
                  </div>
                  <p className={`font-display font-black text-base sm:text-xl truncate w-full leading-tight ${style.name}`}>
                    {p.name}
                  </p>
                  <p className="font-display font-black text-2xl sm:text-3xl text-white drop-shadow">
                    {p.score}
                  </p>
                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest ${style.badge}`}>
                    {style.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="w-full max-w-2xl space-y-2"
        >
          {rest.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-5 py-3 rounded-2xl border ${
                p.id === myId ? "bg-primary-accent/15 border-primary-accent/30" : "bg-white/5 border-white/5"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-black text-text-muted w-6 text-center">#{i + 4}</span>
                <PlayerAvatar seed={p.id} name={p.name} size={28} className="shrink-0 rounded-full" />
                <span className={`font-bold text-sm truncate ${p.id === myId ? "text-primary-accent" : "text-white"}`}>
                  {p.name} {p.id === myId && `(${t("you")})`}
                </span>
              </div>
              <span className="font-display font-black text-xl text-white">{p.score}</span>
            </div>
          ))}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-2xl glass-panel-heavy p-6 rounded-3xl border border-white/10 shadow-xl space-y-3"
      >
        <p className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center justify-center gap-2">
          <Zap className="w-4 h-4 text-warning-accent" /> {t("playerStats")}
        </p>
        <div className="space-y-2">
          {players.map((p) => {
            const acc = accuracyOf(p);
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border ${
                  p.id === myId ? "bg-primary-accent/15 border-primary-accent/30" : "bg-white/5 border-white/5"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PlayerAvatar seed={p.id} name={p.name} size={24} className="shrink-0 rounded-full" />
                  <span className={`font-bold text-sm truncate ${p.id === myId ? "text-primary-accent" : "text-white"}`}>
                    {p.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-success-accent">
                    <Check className="w-3.5 h-3.5" /> {p.correctCount ?? 0}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-danger-accent">
                    <X className="w-3.5 h-3.5" /> {p.wrongCount ?? 0}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-primary-accent">
                    <Target className="w-3.5 h-3.5" /> {acc === null ? "—" : `${acc}%`}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-warning-accent">
                    <Zap className="w-3.5 h-3.5" /> {fmtReaction(p.fastestBuzz)}
                  </span>
                  <span
                    className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-orange-400"
                    title={t("statBestStreak")}
                  >
                    🔥 {(p.bestStreak ?? 0) > 1 ? p.bestStreak : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        {onPlayAgain && (
          <button
            onClick={onPlayAgain}
            className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl premium-btn font-display font-black text-lg text-white shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:scale-105 active:scale-95 transition-all"
          >
            <RotateCcw className="w-5 h-5" /> {t("playAgain")}
          </button>
        )}
        {!onPlayAgain && waitingNote && (
          <div className="glass-panel px-6 py-4 rounded-2xl border border-white/10 text-sm font-bold text-text-muted flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-warning-accent animate-pulse" />
            {waitingNote}
          </div>
        )}
        <button
          onClick={onExit}
          className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold text-base transition-all shadow-lg"
        >
          <LogOut className="w-5 h-5" /> {exitLabel}
        </button>
      </motion.div>
    </div>
  );
};