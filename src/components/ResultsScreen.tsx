import React, { useEffect, useState } from "react";
import { motion, useReducedMotion, animate } from "framer-motion";
import {
  Trophy,
  Crown,
  Check,
  X,
  Zap,
  Target,
  RotateCcw,
  LogOut,
  Flame,
  Medal,
  Sparkles,
  Award,
  PartyPopper,
} from "lucide-react";
import type { RoomPlayer } from "../types/jeopardy";
import { PlayerAvatar } from "../utils/playerAvatar";
import { useSettings } from "../context/SettingsContext";
import { ConfettiBurst } from "./ConfettiBurst";
import { ACHIEVEMENT_ICONS } from "../utils/achievements";
import { achievementKey } from "../utils/profile";
import type { AchievementId } from "../utils/profile";

const fmtReaction = (ms?: number | null) =>
  ms === undefined || ms === null ? "—" : `${(ms / 1000).toFixed(2)}s`;

const accuracyOf = (p: RoomPlayer) => {
  const answered = (p.correctCount ?? 0) + (p.wrongCount ?? 0);
  return answered === 0 ? null : Math.round(((p.correctCount ?? 0) / answered) * 100);
};

/** Counts up to `value` once, after `delay` ms. */
const ScoreCount: React.FC<{ value: number; delay?: number }> = ({ value, delay = 0 }) => {
  const reduce = !!useReducedMotion();
  const [val, setVal] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setVal(value);
      return;
    }
    const t = window.setTimeout(() => {
      const controls = animate(0, value, {
        duration: 1.3,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (v) => setVal(Math.round(v)),
      });
      return () => controls.stop();
    }, delay);
    return () => window.clearTimeout(t);
  }, [value, delay, reduce]);
  return <>{val.toLocaleString()}</>;
};

interface ResultsScreenProps {
  players: RoomPlayer[]; // already sorted by score descending
  myId?: string;
  onPlayAgain?: () => void;
  onExit: () => void;
  exitLabel?: string;
  waitingNote?: string; // shown to non-hosts while they wait for a rematch
  /** Achievements the current player unlocked during/at the end of this game. */
  myAwards?: AchievementId[];
  /** Encouragement messages for locked achievements ("next time buzz under 3s…"). */
  myHints?: { key: string; params?: Record<string, string | number> }[];
  /** True when every achievement is already unlocked — shown as a celebratory note. */
  allUnlocked?: boolean;
}

interface FunAward {
  Icon: typeof Trophy;
  label: string;
  value: string;
  playerName: string;
  accent: string;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  players,
  myId,
  onPlayAgain,
  onExit,
  exitLabel = "Exit",
  waitingNote,
  myAwards = [],
  myHints = [],
  allUnlocked = false,
}) => {
  const { t } = useSettings();
  const winner = players[0];
  const iWon = !!winner && winner.id === myId && (winner.score ?? 0) > 0;
  const hasWinner = !!winner && (winner.score ?? 0) > 0;

  const podiumOrder = [players[1], players[0], players[2]].filter(Boolean) as RoomPlayer[];
  const rest = players.slice(3);

  // ── Fun awards: fastest buzzer, most correct, longest streak ───────────────
  const funAwards: FunAward[] = [];
  if (players.length > 0) {
    const fastest = players.filter((p) => p.fastestBuzz != null);
    if (fastest.length > 1) {
      const best = fastest.reduce((a, b) => ((b.fastestBuzz as number) < (a.fastestBuzz as number) ? b : a));
      funAwards.push({
        Icon: Zap,
        label: t("awardFastest"),
        value: fmtReaction(best.fastestBuzz),
        playerName: best.name,
        accent: "text-primary-accent",
      });
    }
    const mostCorrect = players.reduce((a, b) => ((b.correctCount ?? 0) > (a.correctCount ?? 0) ? b : a));
    if ((mostCorrect.correctCount ?? 0) > 0) {
      funAwards.push({
        Icon: Target,
        label: t("awardMostCorrect"),
        value: `${mostCorrect.correctCount}`,
        playerName: mostCorrect.name,
        accent: "text-success-accent",
      });
    }
    const streak = players.reduce((a, b) => ((b.bestStreak ?? 0) > (a.bestStreak ?? 0) ? b : a));
    if ((streak.bestStreak ?? 0) > 1) {
      funAwards.push({
        Icon: Flame,
        label: t("awardStreak"),
        value: `${streak.bestStreak}×`,
        playerName: streak.name,
        accent: "text-orange-400",
      });
    }
  }

  const showAwards = funAwards.length > 0 || myAwards.length > 0 || myHints.length > 0 || allUnlocked;
  const showHints = myHints.length > 0 || allUnlocked;

  const podiumStyle: Record<
    number,
    { ring: string; badge: string; height: string; label: string; name: string }
  > = {
    1: {
      ring: "border-warning-accent/60 bg-gradient-to-b from-warning-accent/25 to-warning-accent/5 shadow-[0_0_60px_rgba(245,158,11,0.35)]",
      badge: "bg-gradient-to-r from-warning-accent to-amber-500 text-black",
      height: "h-64",
      label: t("champion"),
      name: "text-warning-accent",
    },
    2: {
      ring: "border-slate-300/40 bg-gradient-to-b from-slate-300/20 to-slate-300/5",
      badge: "bg-slate-300 text-slate-900",
      height: "h-44",
      label: t("champion2nd"),
      name: "text-slate-200",
    },
    3: {
      ring: "border-orange-700/40 bg-gradient-to-b from-orange-700/20 to-orange-700/5",
      badge: "bg-orange-700 text-white",
      height: "h-36",
      label: t("champion3rd"),
      name: "text-orange-200",
    },
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] gap-8 text-center p-6 w-full relative">
      <ConfettiBurst />

      {/* ── Headline — dynamic for winner vs. everyone else ────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 20, mass: 0.8 }}
        className="relative flex flex-col items-center gap-1"
      >
        <div className="relative">
          <div
            className={`absolute inset-0 rounded-full blur-[80px] ${
              iWon ? "bg-warning-accent/60" : "bg-primary-accent/40"
            }`}
          />
          <motion.div
            animate={iWon ? { y: [0, -6, 0], rotate: [0, -4, 4, 0] } : {}}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            className="relative z-10"
          >
            {iWon ? (
              <Crown className="w-24 h-24 text-warning-accent fill-warning-accent drop-shadow-[0_0_40px_rgba(245,158,11,0.8)]" />
            ) : (
              <Trophy className="w-24 h-24 text-warning-accent drop-shadow-[0_0_40px_rgba(245,158,11,0.6)]" />
            )}
          </motion.div>
        </div>

        {iWon && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="px-4 py-1.5 rounded-full bg-warning-accent/15 border border-warning-accent/40 text-warning-accent text-[10px] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2"
          >
            <PartyPopper className="w-3.5 h-3.5" /> {t("champion")}
          </motion.div>
        )}

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-5xl md:text-7xl font-display font-black tracking-tight leading-none mt-2 ${
            iWon
              ? "text-transparent bg-clip-text bg-gradient-to-b from-amber-300 via-warning-accent to-amber-600 drop-shadow-[0_0_30px_rgba(245,158,11,0.4)]"
              : "text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50"
          }`}
        >
          {iWon ? t("youWin") : t("gameOver")}
        </motion.h2>

        {hasWinner && !iWon && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-2 text-base text-text-muted font-semibold flex items-center gap-2"
          >
            <Trophy className="w-4 h-4 text-warning-accent" />
            {t("winnerIs", { name: winner.name })}
          </motion.p>
        )}
      </motion.div>

      {/* ── Champion spotlight ─────────────────────────────────────────────── */}
      {hasWinner && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-md glass-panel-heavy rounded-3xl border border-warning-accent/30 bg-gradient-to-br from-warning-accent/10 to-transparent p-5 flex items-center gap-5 shadow-[0_0_40px_rgba(245,158,11,0.15)]"
        >
          <div className="relative shrink-0">
            <PlayerAvatar
              seed={winner.id}
              name={winner.name}
              size={64}
              className="rounded-full ring-2 ring-warning-accent/60 shadow-[0_0_25px_rgba(245,158,11,0.4)]"
            />
            {iWon && (
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-warning-accent text-black text-[9px] font-black uppercase">
                {t("you")}
              </span>
            )}
          </div>
          <div className="min-w-0 text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-warning-accent">
              {t("finalScore")}
            </p>
            <p className="font-display font-black text-3xl text-white leading-tight truncate">
              <ScoreCount value={winner.score ?? 0} delay={500} />
            </p>
            <p className="text-sm font-bold text-white truncate mt-0.5">{winner.name}</p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-1.5 shrink-0">
            <span className="flex items-center gap-1.5 text-xs font-bold text-success-accent">
              <Check className="w-3.5 h-3.5" /> {winner.correctCount ?? 0}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-danger-accent">
              <X className="w-3.5 h-3.5" /> {winner.wrongCount ?? 0}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-primary-accent">
              <Target className="w-3.5 h-3.5" />{" "}
              {accuracyOf(winner) === null ? "—" : `${accuracyOf(winner)}%`}
            </span>
          </div>
        </motion.div>
      )}

      {/* ── Podium ─────────────────────────────────────────────────────────── */}
      {players.length > 0 && (
        <div className="w-full max-w-2xl">
          {players.length >= 2 ? (
            /* Avatars sit ABOVE the podium block so they're never clipped */
            <div className="flex flex-col gap-0">
              {/* Avatar row — floats above the colored podium columns.
                  Each column is padded-bottom by the difference between the
                  tallest podium (1st = h-64 / 256px) and its own podium height
                  so avatars visually sit right on top of their column. */}
              <div className="grid grid-cols-3 gap-3 sm:gap-5 items-end mb-0">
                {podiumOrder.map((p, idx) => {
                  const rank = podiumOrder.length === 3 ? [2, 1, 3][idx] : idx + 1;
                  const style = podiumStyle[rank] ?? podiumStyle[1];
                  const isMe = p.id === myId;
                  // Unique celebration poses per rank via CSS rotate/translate
                  const poseClass =
                    rank === 1
                      ? "animate-bounce" // champion bounces
                      : rank === 2
                      ? "[transform:rotate(-6deg)]" // 2nd tilts left
                      : "[transform:rotate(6deg)]";  // 3rd tilts right
                  // Push avatar down so it sits on top of its podium column.
                  // 1st place (h-64 = 16rem) needs no padding; 2nd (h-44 = 11rem)
                  // needs 5rem; 3rd (h-36 = 9rem) needs 7rem.
                  const podiumPad: Record<number, string> = { 1: "pb-0", 2: "pb-5", 3: "pb-7" };

                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: -30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 22,
                        mass: 0.8,
                        delay: 0.45 + 0.18 * idx,
                      }}
                      className={`flex flex-col items-center gap-1.5 ${podiumPad[rank] ?? "pb-0"}`}
                    >
                      {rank === 1 && (
                        <motion.div
                          initial={{ y: -20, opacity: 0, rotate: -20 }}
                          animate={{ y: 0, opacity: 1, rotate: 0 }}
                          transition={{ delay: 0.9, type: "spring", stiffness: 300, damping: 18 }}
                        >
                          <Crown className="w-9 h-9 text-warning-accent fill-warning-accent drop-shadow-lg mb-1" />
                        </motion.div>
                      )}
                      {rank !== 1 && <div className="h-10" />}
                      <div className={`relative ${poseClass}`}>
                        <PlayerAvatar
                          seed={p.id}
                          name={p.name}
                          size={rank === 1 ? 80 : 60}
                          className={`rounded-full ring-2 ${
                            rank === 1
                              ? "ring-warning-accent/70 shadow-[0_0_30px_rgba(245,158,11,0.45)]"
                              : rank === 2
                              ? "ring-slate-300/50"
                              : "ring-orange-700/50"
                          }`}
                        />
                        {isMe && (
                          <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-primary-accent text-white text-[9px] font-black uppercase">
                            {t("you")}
                          </span>
                        )}
                      </div>
                      <p className={`font-display font-black text-xs sm:text-sm truncate w-full text-center leading-tight px-1 ${style.name}`}>
                        {p.name}
                      </p>
                    </motion.div>
                  );
                })}
              </div>

              {/* Podium columns — no overflow-hidden so avatars above are safe */}
              <div className="grid grid-cols-3 gap-3 sm:gap-5 items-end">
                {podiumOrder.map((p, idx) => {
                  const rank = podiumOrder.length === 3 ? [2, 1, 3][idx] : idx + 1;
                  const style = podiumStyle[rank] ?? podiumStyle[1];
                  return (
                    <motion.div
                      key={`podium-${p.id}`}
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 25,
                        mass: 0.8,
                        delay: 0.55 + 0.18 * idx,
                      }}
                      className={`${style.height} ${style.ring} rounded-t-3xl border border-b-0 flex flex-col items-center justify-center gap-2 px-2`}
                    >
                      <p className="font-display font-black text-2xl sm:text-4xl text-white drop-shadow">
                        <ScoreCount value={p.score ?? 0} delay={700 + idx * 200} />
                      </p>
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest ${style.badge}`}>
                        {style.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="w-full max-w-md mx-auto"
            >
              <div className="glass-panel-heavy rounded-3xl border border-warning-accent/40 p-8 flex flex-col items-center gap-4 shadow-[0_0_50px_rgba(245,158,11,0.25)]">
                <div className="relative">
                  <div className="absolute inset-0 bg-warning-accent/40 blur-2xl rounded-full" />
                  <PlayerAvatar
                    seed={players[0].id}
                    name={players[0].name}
                    size={96}
                    className="relative z-10 rounded-full ring-4 ring-warning-accent/60 shadow-[0_0_40px_rgba(245,158,11,0.5)]"
                  />
                </div>
                <p className="font-display font-black text-3xl text-white truncate max-w-full">
                  {players[0].name}
                </p>
                <p className="font-display font-black text-5xl text-warning-accent">
                  <ScoreCount value={players[0].score ?? 0} delay={600} />
                </p>
                <span className="px-3 py-1 rounded-lg bg-gradient-to-r from-warning-accent to-amber-500 text-black text-[10px] font-black tracking-widest">
                  {t("champion")}
                </span>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {rest.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
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

      {/* ── Player stats ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
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

      {/* ── Awards & achievements ──────────────────────────────────────────── */}
      {showAwards && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="w-full max-w-2xl glass-panel-heavy p-6 rounded-3xl border border-white/10 shadow-xl space-y-5"
        >
          <p className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center justify-center gap-2">
            <Medal className="w-4 h-4 text-warning-accent" /> {t("awardsTitle")}
            <span className="text-text-muted/60 font-semibold normal-case">— {t("awardsSub")}</span>
          </p>

          {funAwards.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {funAwards.map((a) => (
                <div
                  key={a.label}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/5"
                >
                  <span className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <a.Icon className={`w-4 h-4 ${a.accent}`} />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-text-muted">
                      {a.label}
                    </span>
                    <span className="block font-display font-black text-sm text-white truncate">
                      {a.playerName}
                    </span>
                    <span className="block text-[11px] font-bold text-text-muted">{a.value}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {myAwards.length > 0 && (
            <div className="space-y-2">
              {myAwards.map((id) => {
                const Icon = ACHIEVEMENT_ICONS[id];
                const nameKey = achievementKey(id);
                return (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.1 + 0.12 * myAwards.indexOf(id) }}
                    className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border ${
                      id === "collector"
                        ? "bg-warning-accent/15 border-warning-accent/50 shadow-[0_0_25px_rgba(245,158,11,0.15)]"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <span className="p-2.5 rounded-xl bg-gradient-to-br from-warning-accent to-amber-600 text-black shadow-lg">
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block font-display font-black text-sm text-white leading-tight">
                        {t(nameKey)}
                      </span>
                      <span className="block text-[11px] text-text-muted leading-tight">
                        {t(`${nameKey}Desc`)}
                      </span>
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-warning-accent shrink-0">
                      <Sparkles className="w-3 h-3" /> {t("achievementUnlocked")}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ── Keep-going hints — always visible for players ─────────────── */}
          {showHints && (
            <div className="pt-1 border-t border-white/10">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-secondary-accent" /> {t("keepGoing")}
              </p>
              <div className="space-y-2">
                {myHints.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-secondary-accent/10 border border-secondary-accent/20 text-left"
                  >
                    <span className="shrink-0 w-6 h-6 rounded-full bg-secondary-accent/20 border border-secondary-accent/40 flex items-center justify-center mt-0.5">
                      <Sparkles className="w-3 h-3 text-secondary-accent" />
                    </span>
                    <p className="text-sm font-semibold text-white leading-relaxed">
                      {t(h.key, h.params)}
                    </p>
                  </div>
                ))}
                {myHints.length === 0 && allUnlocked && (
                  <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-warning-accent/10 border border-warning-accent/20 text-left">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-warning-accent/20 border border-warning-accent/40 flex items-center justify-center mt-0.5">
                      <Award className="w-3 h-3 text-warning-accent" />
                    </span>
                    <p className="text-sm font-semibold text-warning-accent leading-relaxed">
                      {t("allUnlocked")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Actions ────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
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