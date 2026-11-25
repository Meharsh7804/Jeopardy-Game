import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Share2,
  Copy,
  Download,
  LogOut,
  ScrollText,
  Settings as SettingsIcon,
} from "lucide-react";
import type { RoomPlayer } from "../types/jeopardy";
import { getAvatarByIdOrSeed } from "../utils/avatarImages";
import { useSettings } from "../context/SettingsContext";
import { ConfettiBurst } from "./ConfettiBurst";
import {
  achievementKey,
  achievementProgress,
  ACHIEVEMENT_IDS,
  isSecretAchievement,
  loadProfile,
} from "../utils/profile";
import type { AchievementId } from "../utils/profile";
import { momentBus } from "../delight/moments";
import { confettiBus } from "../delight/celebrate";
import { emitCloseWin } from "../delight/watch";
import { getMatchMemory } from "../delight/memories";
import { grantAchievement } from "../utils/profile";
import { achievementBus } from "../utils/achievementBus";
import { soundManager } from "../utils/sound";

const fmtReaction = (ms?: number | null) =>
  ms === undefined || ms === null ? "—" : `${(ms / 1000).toFixed(2)}s`;

const accuracyOf = (p: RoomPlayer) => {
  const answered = (p.correctCount ?? 0) + (p.wrongCount ?? 0);
  return answered === 0 ? null : Math.round(((p.correctCount ?? 0) / answered) * 100);
};

// ─── Win celebration levels ──────────────────────────────────────────────────
// The same victory is told differently depending on HOW it happened. This
// picks a celebration tier from the final standings + the match's memory, so
// a dominant blowout, a one-point squeaker and a huge comeback each feel
// distinct — sound, confetti and on-screen response included.

type WinTier = "normal" | "dominant" | "comeback" | "onePoint" | "clutch" | "hugeStreak";

interface WinCelebration {
  tier: WinTier;
  headline: string;
  sub: string;
  confetti: number;
  sound: () => void;
  legendary: boolean;
}

const computeWinCelebration = (
  players: { id: string; name: string; score: number; bestStreak?: number }[],
  myId: string | undefined,
  memory: ReturnType<typeof getMatchMemory>,
): WinCelebration => {
  const top = players[0];
  const second = players[1];
  const margin = top && second ? (top.score ?? 0) - (second.score ?? 0) : 0;
  const won = !!top && (top.score ?? 0) > 0;
  const iWon = won && top.id === myId;

  const legendary =
    memory.biggestComeback >= 400 ||
    (memory.fastestAnswer != null && memory.fastestAnswer <= 900) ||
    (top?.bestStreak ?? 0) >= 6 ||
    memory.buzzerBattle >= 4;

  let tier: WinTier = "normal";
  if (iWon) {
    if (margin === 100) tier = "onePoint";
    else if (margin <= 5) tier = "clutch";
    else if (memory.biggestComeback >= 400) tier = "comeback";
    else if ((top.bestStreak ?? 0) >= 5) tier = "hugeStreak";
    else if (margin >= 800 || (second && top.score >= 2 * second.score)) tier = "dominant";
  }

  const copy: Record<WinTier, { headline: string; sub: string; confetti: number; sound: () => void }> = {
    dominant: { headline: "TOTAL DOMINATION", sub: "You didn't win the game — you redrew the map.", confetti: 280, sound: () => soundManager.playWinner() },
    comeback: { headline: "THE GREAT COMEBACK", sub: "From the depths to the throne.", confetti: 240, sound: () => soundManager.playComeback() },
    onePoint: { headline: "BY A SINGLE POINT", sub: "Destiny, settled by one.", confetti: 220, sound: () => soundManager.playClutch() },
    clutch: { headline: "CLUTCH VICTORY", sub: "You took it in the final breath.", confetti: 200, sound: () => soundManager.playClutch() },
    hugeStreak: { headline: "STREAK LEGEND", sub: "Untouchable, all game long.", confetti: 200, sound: () => soundManager.playStreak() },
    normal: { headline: "VICTORY", sub: "You charted the unknown and claimed it.", confetti: 170, sound: () => soundManager.playWinner() },
  };
  const c = copy[tier];
  return { tier, headline: c.headline, sub: c.sub, confetti: c.confetti, sound: c.sound, legendary };
};

interface ResultsScreenProps {
  players: RoomPlayer[]; // already sorted by score descending
  myId?: string;
  onPlayAgain?: () => void;
  onExit: () => void;
  exitLabel?: string;
  waitingNote?: string;
  /** Achievements the current player unlocked during/at the end of this game. */
  myAwards?: AchievementId[];
  /** Encouragement messages for locked achievements ("next time buzz under 3s…"). */
  myHints?: { key: string; params?: Record<string, string | number> }[];
  /** True when every achievement is already unlocked — shown as a celebratory note. */
  allUnlocked?: boolean;
  /** Room code shown in the finale broadcast header. */
  roomCode?: string;
  /** Quiz pack title shown in the finale broadcast header. */
  quizTitle?: string;
  /** Opens the host's score-history overlay from the finale broadcast header. */
  onOpenHistory?: () => void;
}

interface FunAward {
  label: string;
  value: string;
  playerName: string;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  players,
  myId,
  onPlayAgain,
  onExit,
  exitLabel = "Exit",
  myAwards = [],
  myHints = [],
  allUnlocked = false,
  roomCode = "YY3WCJ",
  quizTitle = "QUIZ 30 (HINDI)",
  onOpenHistory,
}) => {
  const { t } = useSettings();
  const standings = useMemo(() => {
    const seenPlayerIds = new Set<string>();
    return players.filter((player) => {
      if (seenPlayerIds.has(player.id)) return false;
      seenPlayerIds.add(player.id);
      return true;
    });
  }, [players]);
  const winner = standings[0];
  const isTie = !!winner && standings.length > 1 && (winner.score ?? 0) > 0 && winner.score === standings[1].score;
  const winnerAvatar = winner ? getAvatarByIdOrSeed(winner.avatar, winner.id) : undefined;
  const [failedAvatarId, setFailedAvatarId] = useState<string | null>(null);

  const [celebrationTier, setCelebrationTier] = useState<WinTier>("normal");
  const [isLegendary, setIsLegendary] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const handleShare = async () => {
    const lines = ["🏆 Buzzing With Quizzing - Results", ...standings.map((p, i) => `${i + 1}. ${p.name} - $${p.score}`)];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {}
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {}
  };

  const handleDownloadCard = () => {
    const w = 1200, h = 630;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const g = ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0,"#020617"); g.addColorStop(1,"#1e1b4b");
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = "#8b5cf6"; ctx.font = "bold 28px sans-serif"; ctx.fillText("BUZZING WITH QUIZZING", 60, 70);
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 56px sans-serif"; ctx.fillText(isTie ? "It's a Tie!" : "Final Results", 60, 140);
    ctx.fillStyle = "#94a3b8"; ctx.font = "24px sans-serif"; ctx.fillText(new Date().toLocaleDateString(), 60, 180);
    const top = standings.slice(0,5);
    top.forEach((p,i) => {
      const y = 250 + i*72;
      ctx.fillStyle = i===0 ? "rgba(251,191,36,0.18)" : "rgba(255,255,255,0.06)";
      ctx.fillRect(60,y-42,1080,58);
      ctx.fillStyle = i===0 ? "#fbbf24" : "#e2e8f0";
      ctx.font = "bold 30px sans-serif";
      ctx.fillText(`${i+1}. ${p.name}`, 90, y);
      ctx.textAlign = "right";
      ctx.fillText(`$${p.score}`, 1110, y);
      ctx.textAlign = "left";
    });
    const a = document.createElement("a");
    a.download = "buzzing-results.png";
    a.href = c.toDataURL("image/png");
    a.click();
  };

  // ── Fun awards: fastest buzzer, most correct, longest streak ───────────────
  const funAwards: FunAward[] = [];
  if (standings.length > 0) {
    const fastest = standings.filter((p) => p.fastestBuzz != null);
    if (fastest.length > 0) {
      const best = fastest.reduce((a, b) => ((b.fastestBuzz as number) < (a.fastestBuzz as number) ? b : a));
      funAwards.push({
        label: t("awardFastest"),
        value: fmtReaction(best.fastestBuzz),
        playerName: best.name,
      });
    }
    const mostCorrect = standings.reduce((a, b) => ((b.correctCount ?? 0) > (a.correctCount ?? 0) ? b : a));
    if ((mostCorrect.correctCount ?? 0) > 0) {
      funAwards.push({
        label: t("awardMostCorrect"),
        value: `${mostCorrect.correctCount}`,
        playerName: mostCorrect.name,
      });
    }
    const streak = standings.reduce((a, b) => ((b.bestStreak ?? 0) > (a.bestStreak ?? 0) ? b : a));
    if ((streak.bestStreak ?? 0) > 1) {
      funAwards.push({
        label: t("awardStreak"),
        value: `${streak.bestStreak}×`,
        playerName: streak.name,
      });
    }
  }

  // A tailored, tier-aware celebration when the results land (once per mount).
  const resultEmitted = useRef(false);
  useEffect(() => {
    if (resultEmitted.current) return;
    resultEmitted.current = true;
    const memory = getMatchMemory();
    const top = standings[0];
    const second = standings[1];
    const margin = top && second ? (top.score ?? 0) - (second.score ?? 0) : 0;
    if (standings.length >= 2) memory.closestFinish = margin;

    const wc = computeWinCelebration(standings, myId, memory);
    const me = standings.find((p) => p.id === myId);
    const tie = !!winner && standings.length > 1 && (winner.score ?? 0) > 0 && winner.score === standings[1].score;
    const iWonNow = !tie && me && me.id === winner?.id && (winner.score ?? 0) > 0;

    if (iWonNow) {
      setCelebrationTier(wc.tier);
      setIsLegendary(wc.legendary);
      const tierIcon: Record<WinTier, string> = {
        dominant: "👑",
        comeback: "🔙",
        onePoint: "📸",
        clutch: "🏁",
        hugeStreak: "🔥",
        normal: "🏆",
      };
      momentBus.emit({ icon: tierIcon[wc.tier], title: wc.headline, subtitle: wc.sub, tone: "celebrate" });
      wc.sound();
      confettiBus.burst({ count: wc.confetti, duration: 3200 });
      // Win-type badges. Secret ones reveal themselves only on unlock.
      if (margin === 100 && grantAchievement("onePointWonder")) achievementBus.emit("onePointWonder");
      if (margin <= 5 && grantAchievement("clutchMaster")) achievementBus.emit("clutchMaster");
      if (memory.biggestComeback >= 400 && grantAchievement("comebackKid")) achievementBus.emit("comebackKid");
    } else if (me) {
      const acc = accuracyOf(me);
      momentBus.emit({
        icon: "🧭",
        title: "Brave Explorer",
        subtitle:
          acc != null && acc < 40
            ? "Rough seas — but every explorer gets lost."
            : "The map is bigger than a single voyage.",
        tone: "playful",
      });
    } else {
      momentBus.emit({
        icon: "🗺️",
        title: "Expedition Complete",
        subtitle: "Another unknown charted by your crew.",
        tone: "ink",
      });
    }

    // A legendary match gets its own banner even if you didn't take it.
    if (wc.legendary) {
      setIsLegendary(true);
      if (!iWonNow) {
        momentBus.emit({
          icon: "🌟",
          title: "LEGENDARY MATCH",
          subtitle: "Nobody will describe this one normally.",
          tone: "celebrate",
        });
        confettiBus.burst({ count: 200, duration: 2800 });
      }
    }
    // A one-point squeaker or photo finish gets its own special gasp.
    emitCloseWin(standings, myId);
  }, [standings, myId, winner]);

  const rootGlow = isLegendary
    ? "win-legendary"
    : celebrationTier === "dominant"
      ? "win-dominant"
      : "";

  const matchMemory = getMatchMemory();
  const fastestBuzzMs = standings.reduce<RoomPlayer | undefined>(
    (best, player) => !best || (player.fastestBuzz ?? Infinity) < (best.fastestBuzz ?? Infinity) ? player : best,
    undefined,
  );
  const fastestBuzzText = fmtReaction(matchMemory.fastestAnswer ?? fastestBuzzMs?.fastestBuzz);
  const badgeProgress = useMemo(() => {
    const profile = loadProfile();
    const progress = achievementProgress(profile);
    return ACHIEVEMENT_IDS
      .filter((id) => !isSecretAchievement(id) || Boolean(profile.achievements[id]) || myAwards.includes(id))
      .map((id) => {
        const unlocked = Boolean(profile.achievements[id]) || myAwards.includes(id);
        const key = achievementKey(id);
        return {
          key: id,
          title: t(key).toUpperCase(),
          description: t(`${key}Desc`),
          unlocked,
          progress: unlocked ? 1 : Math.max(0, Math.min(1, progress[id])),
        };
      });
  }, [myAwards, t]);
  const nextBadgeProgress = badgeProgress.reduce(
    (best, badge) => badge.unlocked ? best : Math.max(best, badge.progress),
    0,
  );
  const badgePlaques = [
    ...funAwards.map((award) => ({
      key: `award-${award.label}`,
      title: award.label === t("awardFastest")
        ? "SPEED DEMON"
        : award.label === t("awardMostCorrect")
          ? "MOST CORRECT"
          : "LONGEST STREAK",
      description: `${award.playerName} • ${award.value}`,
      unlocked: true,
      progress: 1,
    })),
    ...(allUnlocked
      ? [{
          key: "all-unlocked",
          title: "COLLECTION COMPLETE",
          description: t("allUnlocked"),
          unlocked: true,
          progress: 1,
        }]
      : myHints[0]
        ? [{
            key: "next-challenge",
            title: "NEXT CHALLENGE",
            description: t(myHints[0].key, myHints[0].params),
            unlocked: false,
            progress: nextBadgeProgress,
          }]
        : []),
    ...badgeProgress,
  ];

  return (
    <div className={`h-screen flex flex-col overflow-hidden w-full relative ${rootGlow}`}>
      <ConfettiBurst />

      {/* Legendary-match golden flash (brief, then settles) */}
      {isLegendary && (
        <motion.div
          initial={{ opacity: 0.55 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          className="pointer-events-none fixed inset-0 z-[44] bg-[radial-gradient(circle_at_50%_40%,rgba(251,191,36,0.28),transparent_60%)]"
          aria-hidden
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
          1. UNIFIED TOP FINALE HEADER — "FINAL BROADCAST // OFFICIAL MATCH RESULTS"
          ═══════════════════════════════════════════════════════════════ */}
      <header className="h-14 bg-[#FFFFFF] border-b-2 border-[#111111] px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="w-10 h-10 bg-[#FF3B1D] border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center justify-center shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFD60A" stroke="#111111" strokeWidth="2" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 10-12h-7z" /></svg>
            </div>
            <div className="flex items-center gap-2.5 min-w-0">
              <span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="font-['Archivo_Black'] text-base sm:text-lg uppercase leading-none text-[#111111] truncate">{quizTitle}</span>
              <span className="inline-flex items-center px-2 py-0.5 border-2 border-[#111111] bg-[#FFD60A] shadow-[2px_2px_0_#111111] font-mono text-xs sm:text-sm font-bold tracking-[0.14em] text-[#111111] shrink-0">
                {roomCode}
              </span>
            </div>
        </div>

        <div className="flex-1 flex items-center justify-center bg-[#111111] border-2 border-[#111111] px-3 py-2 min-w-0">
          <span className="w-2 h-2 bg-[#FF3B1D] rounded-full animate-pulse shrink-0" />
          <span className="font-mono text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-[#FFD60A] truncate">FINAL BROADCAST // OFFICIAL MATCH RESULTS</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
              type="button"
              onClick={onOpenHistory}
              className="h-9 px-2.5 bg-[#FFFFFF] hover:bg-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0_#111111] font-mono text-xs font-bold flex items-center gap-1.5"
              title={t("scoreHistory")}
            >
              <ScrollText className="w-4 h-4 text-[#111111]" /> HISTORY
          </button>
          <button
              type="button"
              title={t("settingsTitle")}
              className="w-9 h-9 bg-[#FFFFFF] hover:bg-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center justify-center"
            >
              <SettingsIcon className="w-4 h-4 text-[#111111]" />
          </button>
          <button
              type="button"
              onClick={onExit}
              title={exitLabel}
              className="w-9 h-9 bg-[#FFFFFF] hover:bg-[#FF3B1D] hover:text-white border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center justify-center text-[#111111]"
            >
              <LogOut className="w-4 h-4 text-[#111111]" />
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════
          2. THE BROAD SHEET — FRONT-PAGE EDITORIAL SPREAD
          ═══════════════════════════════════════════════════════════════ */}
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-4 sm:px-6 py-3 flex flex-col">
        <div className="flex-1 min-h-0 bg-[#F4EFE6] border-[3px] border-[#111111] shadow-[8px_8px_0px_#111111] flex flex-col overflow-hidden rounded-none">
          <section className="relative min-h-[220px] sm:min-h-[250px] bg-[#FFFFFF] border-b-2 border-[#111111] grid grid-cols-1 lg:grid-cols-12 overflow-hidden shrink-0">
            <div className="lg:col-span-7 relative z-20 p-5 sm:p-6 flex flex-col justify-center">
              <h1
                style={{ fontFamily: "'Archivo Black', sans-serif" }}
                className="font-['Archivo_Black'] text-4xl sm:text-5xl xl:text-[54px] leading-[0.95] tracking-tight text-[#111111] uppercase"
              >
                THE BUZZING CHRONICLE
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="bg-[#111111] text-[#FFD60A] px-3 py-1 self-start font-mono text-[11px] font-bold tracking-wider uppercase">
                  FINALE EDITION! // OFFICIAL MATCH SIGN-OFF
                </div>
                <span
                  style={{ fontFamily: "'Archivo Black', sans-serif" }}
                  className="bg-[#FFD60A] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] px-3 py-0.5 font-['Archivo_Black'] text-xs sm:text-sm tracking-widest uppercase inline-flex items-center gap-1.5"
                >
                  <svg className="w-7 h-5" viewBox="0 0 58 44" fill="#FFD60A" stroke="#111111" strokeWidth="2.5" strokeLinejoin="miter" aria-hidden="true">
                    <path d="M6 38 8 14 19 25 29 5 39 25 50 14 52 38Z" />
                    <path d="M8 38H50V42H8Z" />
                    <path d="m17 16 3 4 3-4Z" fill="#FF3B1D" strokeWidth="1.5" />
                    <path d="m27 10 3 4 3-4Z" fill="#00C271" strokeWidth="1.5" />
                    <path d="m37 16 3 4 3-4Z" fill="#FF3B1D" strokeWidth="1.5" />
                  </svg>
                  CHAMPION
                </span>
              </div>
              <p
                style={{ fontFamily: "'Archivo Black', sans-serif" }}
                className="font-['Archivo_Black'] text-2xl sm:text-3xl mt-3 text-[#111111] uppercase leading-tight"
              >
                {winner ? `${winner.name} CLAIMS ULTIMATE TRIVIA CROWN!` : "THE ULTIMATE TRIVIA CROWN AWAITS!"}
              </p>
            </div>

            <div className="lg:col-span-5 relative h-full min-h-[210px] overflow-hidden">
              {winnerAvatar && failedAvatarId !== winner?.id ? (
                <img
                  src={winnerAvatar.src}
                  alt={`${winner?.name ?? "Champion"} avatar`}
                  onError={() => winner && setFailedAvatarId(winner.id)}
                  style={{ objectPosition: winnerAvatar.position }}
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-[#F4EFE6] font-['Archivo_Black'] text-8xl uppercase text-[#111111]">
                  {winner?.name.trim().charAt(0) || "?"}
                </div>
              )}
              <div className="absolute inset-y-0 left-0 w-28 sm:w-36 bg-gradient-to-r from-[#FFFFFF] via-[#FFFFFF]/80 to-transparent z-10 pointer-events-none" />

              <div className="absolute bottom-3 right-3 z-20 bg-[#111111] text-[#FFD60A] border-2 border-[#FFFFFF] px-3 py-1 font-mono text-xs font-black shadow-[3px_3px_0px_#111111]">
                {winner ? `${winner.score} PTS • ⚡ ${fastestBuzzText || "—"}` : "NO SCORE • ⚡ —"}
              </div>
            </div>
          </section>

          <section className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 bg-[#F4EFE6] border-b-2 border-[#111111] overflow-hidden">
            <div className="lg:col-span-6 border-b-2 lg:border-b-0 lg:border-r-2 border-[#111111] flex flex-col min-h-0">
              <div className="bg-[#111111] text-[#FFFFFF] px-4 py-2 flex items-center justify-between font-mono text-[11px] font-bold uppercase shrink-0">
                <span className="text-[#FFD60A]">🏆 FINAL LEADERBOARD STANDINGS</span>
                <span>{standings.length} CONTESTANTS</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto divide-y-2 divide-[#111111]">
                {standings.map((player, index) => {
                  const avatar = getAvatarByIdOrSeed(player.avatar, player.id);
                  const rowClass = index === 0
                    ? "bg-[#FFD60A]/25"
                    : index === 1
                      ? "bg-[#FFFFFF]"
                      : index === 2
                        ? "bg-[#FFFFFF]/80"
                        : "bg-[#F4EFE6]";
                  const rankClass = index === 0
                    ? "bg-[#FFD60A]"
                    : index === 1
                      ? "bg-[#E6E0D4]"
                      : index === 2
                        ? "bg-[#F4EFE6]"
                        : "bg-[#FFFFFF]";
                  return (
                    <div key={player.id} className={`px-4 py-2 flex items-center justify-between gap-2 ${rowClass}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-7 h-7 flex items-center justify-center font-mono text-xs font-black border-2 border-[#111111] shrink-0 ${rankClass}`}>
                          #{index + 1}
                        </span>
                        {avatar ? (
                          <img
                            src={avatar.src}
                            alt={`${player.name} avatar`}
                            style={{ objectPosition: avatar.position }}
                            className="w-7 h-7 border border-[#111111] shrink-0 object-cover"
                          />
                        ) : (
                          <span className="w-7 h-7 border border-[#111111] shrink-0 bg-[#FFFFFF] flex items-center justify-center font-['Archivo_Black'] text-xs">
                            {player.name.trim().charAt(0) || "?"}
                          </span>
                        )}
                        <span className="font-['Archivo_Black'] text-xs sm:text-sm text-[#111111] truncate uppercase">{player.name}</span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 font-mono text-[11px] font-bold">
                        <span className="text-[#00C271]">✓{player.correctCount ?? 0}</span>
                        <span className="text-[#FF3B1D]">✕{player.wrongCount ?? 0}</span>
                        <span className="hidden sm:inline bg-[#FFFFFF] border border-[#111111] px-1.5 py-0.5">{accuracyOf(player) ?? 0}%</span>
                        <span className="bg-[#111111] text-[#FFD60A] px-2.5 py-1 font-['Archivo_Black'] text-xs">{player.score} PTS</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-6 flex flex-col min-h-0">
              <div className="bg-[#111111] text-[#FFFFFF] px-4 py-2 flex items-center justify-between font-mono text-[11px] font-bold uppercase shrink-0">
                <span className="text-[#00C271]">📊 MATCH ANALYSIS &amp; BADGES UNLOCKED</span>
                <span className="text-[#FFD60A]">EDITOR'S PICKS</span>
              </div>
              <div className="p-3.5 flex-1 min-h-0 overflow-y-auto flex flex-col justify-between gap-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#FFFFFF] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] p-2 min-w-0">
                    <div className="font-mono text-[9px] sm:text-[10px] font-black uppercase text-[#111111]/75">⚡ FASTEST BUZZ</div>
                    <div className="font-['Archivo_Black'] text-sm sm:text-base text-[#111111] truncate">{fastestBuzzText}</div>
                  </div>
                  <div className="bg-[#FFFFFF] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] p-2 min-w-0">
                    <div className="font-mono text-[9px] sm:text-[10px] font-black uppercase text-[#111111]/75">🎯 TOUGHEST TILE</div>
                    <div className="font-['Archivo_Black'] text-sm sm:text-base text-[#111111] truncate">
                      {matchMemory.hardestQuestion > 0 ? `${matchMemory.hardestQuestion} PTS` : "—"}
                    </div>
                  </div>
                  <div className="bg-[#FFFFFF] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] p-2 min-w-0">
                    <div className="font-mono text-[9px] sm:text-[10px] font-black uppercase text-[#111111]/75">🔄 BIGGEST SWING</div>
                    <div className="font-['Archivo_Black'] text-sm sm:text-base text-[#111111] truncate">
                      {matchMemory.biggestSwing > 0 ? `${matchMemory.biggestSwing} PTS` : "0 PTS"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {badgePlaques.map((badge) => (
                    <div key={badge.key} className="bg-[#FFFFFF] border-2 border-[#111111] p-2.5 flex flex-col justify-between gap-1.5 rounded-none">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-['Archivo_Black'] text-xs text-[#111111] uppercase leading-tight">{badge.title}</span>
                        <span className={`shrink-0 px-1.5 py-0.5 font-mono text-[9px] font-black border border-[#111111] text-[#111111] ${badge.unlocked ? "bg-[#00C271]" : "bg-[#FFD60A]"}`}>
                          {badge.unlocked ? "UNLOCKED" : "IN PROGRESS"}
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-[#111111]/75 leading-snug">{badge.description}</p>
                      <div
                        role="progressbar"
                        aria-label={`${badge.title} progress`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(badge.progress * 100)}
                        className="w-full h-2 bg-[#E6E0D4] border border-[#111111] overflow-hidden"
                      >
                        <div className="h-full bg-[#00C271]" style={{ width: `${badge.progress * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <footer className="bg-[#111111] px-4 sm:px-5 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
            {onPlayAgain ? (
              <button
                type="button"
                onClick={onPlayAgain}
                className="w-full sm:flex-1 py-2.5 bg-[#FF3B1D] hover:bg-[#FFD60A] text-[#FFFFFF] hover:text-[#111111] font-['Archivo_Black'] text-xs sm:text-sm tracking-wider border-2 border-[#FFFFFF] shadow-[3px_3px_0px_#FFD60A] uppercase rounded-none"
              >
                ↻ PLAY AGAIN (NEW MATCH)
              </button>
            ) : (
              <div className="w-full sm:flex-1 py-2.5 px-4 bg-[#FFD60A] text-[#111111] border-2 border-[#FFFFFF] font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 rounded-none">
                ⏳ WAITING FOR HOST TO START A REMATCH...
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 w-full sm:w-auto shrink-0">
              <button type="button" onClick={handleShare} className="px-3 py-2.5 bg-[#FFFFFF] hover:bg-[#FFD60A] text-[#111111] font-mono text-[11px] font-bold border-2 border-[#FFFFFF] rounded-none flex items-center justify-center gap-1">
                <Share2 className="w-3.5 h-3.5 shrink-0" /> {copiedShare ? "COPIED!" : "SHARE"}
              </button>
              <button type="button" onClick={handleCopyLink} className="px-3 py-2.5 bg-[#FFFFFF] hover:bg-[#FFD60A] text-[#111111] font-mono text-[11px] font-bold border-2 border-[#FFFFFF] rounded-none flex items-center justify-center gap-1">
                <Copy className="w-3.5 h-3.5 shrink-0" /> COPY LINK
              </button>
              <button type="button" onClick={handleDownloadCard} className="px-3 py-2.5 bg-[#00C271] hover:bg-[#FFD60A] text-[#111111] font-mono text-[11px] font-bold border-2 border-[#FFFFFF] rounded-none flex items-center justify-center gap-1">
                <Download className="w-3.5 h-3.5 shrink-0" /> CARD
              </button>
              <button type="button" onClick={onExit} className="px-3 py-2.5 bg-[#FFFFFF] hover:bg-[#FFD60A] text-[#111111] font-mono text-[11px] font-bold border-2 border-[#FFFFFF] rounded-none flex items-center justify-center gap-1">
                <LogOut className="w-3.5 h-3.5 shrink-0" /> LOBBY
              </button>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
};
