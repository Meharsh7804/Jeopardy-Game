import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useRoom } from "../context/RoomContext";
import { useQuizLibrary } from "../context/QuizLibraryContext";
import { useSettings } from "../context/SettingsContext";
import type { Quiz } from "../types/jeopardy";
import {
  Play,
  LogIn,
  Loader2,
  Plus,
  Pencil,
  X,
  MonitorPlay,
  LayoutGrid,
  Zap,
  Settings as SettingsIcon,
  Trophy,
  Flame,
  Timer,
  Target,
  Coins,
  Tag,
  ChevronDown,
  Award,
  CalendarCheck,
  History,
  Shield,
  Sparkles,
} from "lucide-react";
import { PlayerAvatar } from "../utils/playerAvatar";
import { Logo } from "./ui/Logo";
import { SettingsModal } from "./SettingsModal";
import { HeroQuizArena } from "./HeroQuizArena";
import { ACHIEVEMENT_ICONS } from "../utils/achievements";
import {
  loadProfile,
  saveProfileName,
  loadMatchHistory,
  loadSeasons,
  seasonKeyOf,
  xpOf,
  levelInfo,
  ACHIEVEMENT_IDS,
  nextAchievementGoal,
  achievementHint,
} from "../utils/profile";

interface RoomLobbyProps {
  onHostEntersRoom: () => void;
  onPlayerEntersRoom: () => void;
  onCreateQuiz: () => void;
  onEditQuiz: (quiz: Quiz) => void;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({
  onHostEntersRoom,
  onPlayerEntersRoom,
  onCreateQuiz,
  onEditQuiz,
}) => {
  const { createRoom, joinRoom, loading, error, myId } = useRoom();
  const { quizzes, isSynced } = useQuizLibrary();
  const { t } = useSettings();
  const reduce = !!useReducedMotion();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [hostName, setHostName] = useState("");
  const [selectedQuizId, setSelectedQuizId] = useState<string>(quizzes[0]?.id ?? "");
  const [playerName, setPlayerName] = useState(() => loadProfile().name || "");
  const [roomCode, setRoomCode] = useState("");
  const [localError, setLocalError] = useState("");
  const [quizSearch, setQuizSearch] = useState("");
  const profile = loadProfile();

  const matches = loadMatchHistory();
  const seasons = loadSeasons();
  const season = seasons[seasonKeyOf()] ?? { points: 0, games: 0, wins: 0 };
  const xp = xpOf(profile);
  const level = levelInfo(xp);
  const unlockedCount = ACHIEVEMENT_IDS.filter((id) => profile.achievements[id]).length;

  const totalAnswered = profile.totalCorrect + profile.totalWrong;
  const accuracy =
    totalAnswered > 0 ? Math.round((profile.totalCorrect / totalAnswered) * 100) : null;

  const selectedQuiz = quizzes.find((q) => q.id === selectedQuizId) ?? quizzes[0];

  const filteredQuizzes = quizSearch.trim()
    ? quizzes.filter(
        (q) =>
          q.title.toLowerCase().includes(quizSearch.toLowerCase()) ||
          q.description?.toLowerCase().includes(quizSearch.toLowerCase()),
      )
    : quizzes;

  // QR join: prefill the room code when arriving via /?join=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get("join") || "").toUpperCase().trim();
    if (code) {
      setRoomCode(code);
      setJoinOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Sync selected quiz when the library updates (e.g. after Firebase resolves)
  useEffect(() => {
    if (quizzes.length > 0 && !quizzes.find((q) => q.id === selectedQuizId)) {
      setSelectedQuizId(quizzes[0].id);
    }
  }, [quizzes, selectedQuizId]);

  const handleHost = async () => {
    setLocalError("");
    if (!hostName.trim()) {
      setLocalError(t("errorEnterHostName"));
      return;
    }
    if (!selectedQuiz) {
      setLocalError(t("errorSelectQuiz"));
      return;
    }
    try {
      await createRoom(selectedQuiz, hostName.trim());
      onHostEntersRoom();
    } catch (e: any) {
      setLocalError(e.message ?? t("errorCreateFailed"));
    }
  };

  const handleJoin = async () => {
    setLocalError("");
    if (!playerName.trim()) {
      setLocalError(t("errorEnterName"));
      return;
    }
    if (roomCode.trim().length !== 6) {
      setLocalError(t("errorCodeLength"));
      return;
    }
    try {
      saveProfileName(playerName.trim());
      await joinRoom(roomCode.trim(), playerName.trim());
      onPlayerEntersRoom();
    } catch (e: any) {
      setLocalError(e.message ?? t("errorJoinFailed"));
    }
  };

  const fmtFastest = (ms: number | null) =>
    ms === null ? "—" : `${(ms / 1000).toFixed(2)}s`;

  const modalPanel =
    "glass-panel-heavy rounded-[2rem] p-8 w-full space-y-6 relative border border-white/20 shadow-[0_0_80px_rgba(0,0,0,0.6)] max-h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar";
  const closeBtn =
    "absolute top-5 right-5 p-2 rounded-full bg-white/10 border border-white/10 text-text-muted hover:text-white hover:bg-white/20 transition-all";
  const inputBase =
    "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white font-medium outline-none focus:ring-1 transition-all placeholder:text-text-muted/40 shadow-inner";

  const howToSteps = [
    { Icon: MonitorPlay, title: t("htpStep1Title"), desc: t("htpStep1Desc") },
    { Icon: LayoutGrid, title: t("htpStep2Title"), desc: t("htpStep2Desc") },
    { Icon: Zap, title: t("htpStep3Title"), desc: t("htpStep3Desc") },
  ];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-primary-bg text-white font-sans">
      {/* Ambient background */}
      <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] bg-primary-accent/15 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] bg-secondary-accent/12 blur-[140px] rounded-full pointer-events-none" />

      {/* ── Minimal navigation ─────────────────────────────────────────── */}
      <header className="relative z-40 w-full max-w-7xl mx-auto px-5 sm:px-10 pt-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={40} withWordmark />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setHowToOpen(true)}
            className="px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-text-muted hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
          >
            {t("howToPlay")}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-3 rounded-xl glass-panel border border-white/10 text-text-muted hover:text-white hover:bg-white/10 transition-all shadow-lg"
            aria-label={t("settingsTitle")}
            title={t("settingsTitle")}
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-5 sm:px-10 py-8 lg:py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-10 items-center">
        {/* Left: headline + CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center lg:items-start text-center lg:text-left"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-text-main font-semibold tracking-widest uppercase shadow-lg backdrop-blur-md">
            <Zap className="w-4 h-4 text-warning-accent" />
            {t("liveMultiplayer")}
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 font-display font-black tracking-tight leading-[0.95] text-5xl sm:text-7xl xl:text-[5.25rem] text-white"
          >
            THINK FAST.
            <span className="block mt-1 text-transparent bg-clip-text bg-gradient-to-r from-primary-accent to-secondary-accent">
              BUZZ FASTER.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 text-text-muted text-base sm:text-lg leading-relaxed max-w-md"
          >
            {t("heroTagline")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 w-full sm:w-auto"
          >
            <button
              onClick={() => {
                setLocalError("");
                setCreateOpen(true);
              }}
              className="group flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl premium-btn font-display font-black text-base uppercase tracking-wide hover:[filter:brightness(1.08)]"
            >
              <Play className="w-5 h-5 fill-current transition-transform duration-300 group-hover:translate-x-0.5" />
              {t("createGame")}
            </button>
            <button
              onClick={() => {
                setLocalError("");
                setJoinOpen(true);
              }}
              className="group flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-white text-[#0b1020] hover:bg-gray-100 font-display font-black text-base uppercase tracking-wide shadow-[0_0_25px_rgba(255,255,255,0.15)] hover:shadow-[0_0_35px_rgba(255,255,255,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
            >
              <LogIn className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-0.5" />
              {t("joinGame")}
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-8 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-primary-accent/80 to-secondary-accent/80"
          >
            <span className="w-8 h-px bg-gradient-to-r from-primary-accent/60 to-transparent" />
            Buzzing With Quizzing
          </motion.p>
        </motion.div>

        {/* Right: interactive quiz arena */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="w-full lg:justify-self-end"
        >
          <HeroQuizArena />
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.9 }}
          className="col-span-1 lg:col-span-2 flex flex-col items-center gap-2 mt-12 lg:mt-16"
        >
          <span className="text-[9px] font-black tracking-[0.3em] text-text-muted uppercase">
            {t("scrollToExplore")}
          </span>
          <motion.span
            animate={reduce ? { y: 0 } : { y: [0, 4, 0] }}
            transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity }}
          >
            <ChevronDown className="w-4 h-4 text-primary-accent" />
          </motion.span>
        </motion.div>

        {/* ── Profile & career: level, achievements, season, match history ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="col-span-1 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 lg:mt-10"
        >
          {/* Level + XP + achievements */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-5">
            <div className="flex items-center gap-4">
              <PlayerAvatar
                seed={myId}
                name={profile.name || playerName || "You"}
                size={52}
                className="shrink-0 rounded-full ring-2 ring-primary-accent/40"
              />
              <div className="flex-1 min-w-0">
                <p className="font-display font-black text-lg text-white truncate">
                  {profile.name || playerName || "You"}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-primary-accent mt-0.5">
                  {t("levelLabel")} {level.level} · {xp.toLocaleString()} {t("xpLabel")}
                </p>
                <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary-accent to-secondary-accent transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.round((level.into / level.need) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                <span className="flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-warning-accent" /> {t("achievementsTitle")}
                </span>
                {!!profile.achievements.collector && (
                  <span className="flex items-center gap-1 text-[9px] font-black text-warning-accent bg-warning-accent/10 border border-warning-accent/30 rounded-full px-2 py-0.5">
                    <Shield className="w-3 h-3" /> {t("badgeChip")}
                  </span>
                )}
                <span className="ml-auto text-text-muted/80">
                  {t("achievementsCount", { unlocked: unlockedCount, total: ACHIEVEMENT_IDS.length })}
                </span>
              </p>
              <div className="grid grid-cols-9 gap-2 mt-3">
                {ACHIEVEMENT_IDS.map((id) => {
                  const Icon = ACHIEVEMENT_ICONS[id];
                  const unlocked = !!profile.achievements[id];
                  return (
                    <div
                      key={id}
                      title={`${t(`ach${id[0].toUpperCase()}${id.slice(1)}`)} — ${t(`ach${id[0].toUpperCase()}${id.slice(1)}Desc`)}`}
                      className={`flex items-center justify-center p-2.5 rounded-xl border transition-all ${
                        unlocked
                          ? "bg-warning-accent/10 border-warning-accent/30 text-warning-accent"
                          : "bg-white/[0.03] border-white/5 text-text-muted/40"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                  );
                })}
              </div>
              {(() => {
                const goal = nextAchievementGoal(profile);
                if (!goal) return null;
                const hint = achievementHint(goal, profile);
                return (
                  <p className="text-[11px] font-medium text-text-muted/80 mt-2.5 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-secondary-accent shrink-0" />
                    <span className="shrink-0">{t("nextGoal")}:</span>
                    <span className="truncate">{t(hint.key, hint.params)}</span>
                  </p>
                );
              })()}
            </div>
          </div>

          {/* Season standings + match history */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-5">
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                <CalendarCheck className="w-3.5 h-3.5 text-secondary-accent" /> {t("seasonTitle")}
              </p>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <p className="font-display font-black text-lg text-white leading-none">
                    {season.points.toLocaleString()}
                  </p>
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1">
                    {t("statTotalPoints")}
                  </p>
                </div>
                <div>
                  <p className="font-display font-black text-lg text-white leading-none">
                    {season.games}
                  </p>
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1">
                    {t("statGames")}
                  </p>
                </div>
                <div>
                  <p className="font-display font-black text-lg text-warning-accent leading-none">
                    {season.wins}
                  </p>
                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1">
                    {t("statWins")}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-primary-accent" /> {t("matchHistoryTitle")}
              </p>
              <div className="mt-2">
                {matches.length === 0 ? (
                  <p className="text-xs text-text-muted py-4 text-center">{t("emptyHistory")}</p>
                ) : (
                  matches.slice(0, 5).map((m) => (
                    <div
                      key={`${m.date}-${m.rank}`}
                      className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0"
                    >
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-display font-black text-xs border shrink-0 ${
                          m.won
                            ? "bg-warning-accent/15 border-warning-accent/30 text-warning-accent"
                            : "bg-white/5 border-white/10 text-text-muted"
                        }`}
                      >
                        #{m.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {new Date(m.date).toLocaleDateString()}
                          <span className="text-text-muted font-semibold">
                            {" "}
                            · {m.totalPlayers} {t("statGames")}
                          </span>
                        </p>
                        <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-0.5">
                          {m.correct} ✓ · {m.wrong} ✗
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display font-black text-sm text-white leading-none">
                          {m.myScore.toLocaleString()}
                        </p>
                        <p
                          className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${
                            m.won ? "text-warning-accent" : "text-text-muted"
                          }`}
                        >
                          {m.won ? t("matchWon") : t("matchLost")}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.section>
      </main>

      {/* ── Create Game modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {createOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
            onClick={() => setCreateOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`${modalPanel} max-w-lg`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setCreateOpen(false)}
                className={closeBtn}
                aria-label={t("close")}
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-3xl font-display font-black text-white leading-tight pr-8 flex items-center gap-3">
                <span className="w-11 h-11 rounded-2xl bg-primary-accent/20 flex items-center justify-center border border-primary-accent/30 shadow-inner">
                  <MonitorPlay className="w-5 h-5 text-primary-accent" />
                </span>
                {t("createGame")}
              </h3>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">
                  {t("hostName")}
                </label>
                <input
                  type="text"
                  placeholder={t("hostNamePh")}
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleHost()}
                  className={`${inputBase} focus:border-primary-accent focus:ring-primary-accent`}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    {t("selectQuizPack")}
                  </label>
                  <button
                    onClick={onCreateQuiz}
                    className="flex items-center gap-1.5 text-xs font-bold text-primary-accent hover:text-primary-hover transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t("newQuiz")}
                  </button>
                </div>
                {quizzes.length > 3 && (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t("searchQuizzes") || "Search quizzes..."}
                      value={quizSearch}
                      onChange={(e) => setQuizSearch(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary-accent/50 transition-all placeholder:text-text-muted/40"
                    />
                    {quizSearch && (
                      <button
                        onClick={() => setQuizSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-text-muted hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
                <div className="space-y-1 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                  {!isSynced ? (
                    <div className="space-y-1">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-white/5 bg-white/[0.03] animate-pulse">
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-white/10 rounded w-2/3" />
                            <div className="h-2 bg-white/5 rounded w-1/2" />
                          </div>
                          <div className="w-6 h-6 rounded bg-white/5" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {filteredQuizzes.map((q) => (
                        <div
                          key={q.id}
                          className={`group flex items-center gap-2 p-2.5 rounded-lg border transition-all ${
                            selectedQuizId === q.id
                              ? "bg-primary-accent/20 border-primary-accent/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                              : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                          }`}
                        >
                          <button
                            onClick={() => setSelectedQuizId(q.id)}
                            className="flex-1 text-left min-w-0"
                          >
                            <p
                              className={`font-bold text-xs truncate ${
                                selectedQuizId === q.id ? "text-primary-accent" : "text-white"
                              }`}
                            >
                              {q.title}
                            </p>
                            <p className="text-[10px] text-text-muted mt-0.5 truncate">{q.description}</p>
                          </button>
                          <button
                            onClick={() => onEditQuiz(q)}
                            title={t("edit")}
                            className="shrink-0 p-1.5 rounded-md bg-white/5 border border-white/10 text-text-muted hover:text-white hover:bg-white/10 transition-all"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {filteredQuizzes.length === 0 && quizzes.length > 0 && (
                        <div className="text-center py-4 border border-dashed border-white/10 rounded-lg">
                          <p className="text-xs text-text-muted">{t("noResults") || "No matching quizzes"}</p>
                        </div>
                      )}
                      {quizzes.length === 0 && (
                        <div className="text-center py-4 border border-dashed border-white/10 rounded-lg">
                          <p className="text-xs text-text-muted mb-1">{t("needQuizToHost")}</p>
                          <button
                            onClick={onCreateQuiz}
                            className="text-[10px] text-primary-accent hover:underline font-bold"
                          >
                            {t("createOneNow")}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {(localError || error) && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-danger-accent bg-danger-accent/10 border border-danger-accent/20 rounded-lg px-4 py-3 font-medium"
                >
                  {localError || error}
                </motion.p>
              )}

              <button
                onClick={handleHost}
                disabled={loading || quizzes.length === 0}
                className="w-full flex items-center justify-center gap-2 py-4 premium-btn font-bold rounded-xl text-sm"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                {t("createRoomAndHost")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Join Game modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {joinOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
            onClick={() => setJoinOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`${modalPanel} max-w-md`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setJoinOpen(false)}
                className={closeBtn}
                aria-label={t("close")}
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-3xl font-display font-black text-white leading-tight pr-8 flex items-center gap-3">
                <span className="w-11 h-11 rounded-2xl bg-secondary-accent/20 flex items-center justify-center border border-secondary-accent/30 shadow-inner">
                  <LogIn className="w-5 h-5 text-secondary-accent" />
                </span>
                {t("joinGame")}
              </h3>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">
                  {t("yourName")}
                </label>
                <input
                  type="text"
                  placeholder={t("yourNamePh")}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className={`${inputBase} focus:border-secondary-accent focus:ring-secondary-accent`}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">
                  {t("roomCode")}
                </label>
                <input
                  type="text"
                  placeholder="XXXXXX"
                  maxLength={6}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-2xl font-display font-extrabold text-center tracking-[0.4em] text-white outline-none focus:border-secondary-accent focus:ring-1 focus:ring-secondary-accent transition-all placeholder:text-text-muted/20 shadow-inner uppercase"
                />
              </div>

              {profile.gamesPlayed > 0 && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2 mb-3">
                    <Trophy className="w-3.5 h-3.5 text-warning-accent" /> {t("myStats")}
                  </p>
                  <div className="flex items-start gap-4">
                    <PlayerAvatar
                      seed={myId}
                      name={profile.name || playerName || "You"}
                      size={44}
                      className="shrink-0 rounded-full ring-2 ring-white/10"
                    />
                    <div className="grid grid-cols-3 gap-x-4 gap-y-3 flex-1">
                      <div>
                        <p className="font-display font-black text-lg text-white leading-none">
                          {profile.gamesPlayed}
                        </p>
                        <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1">
                          {t("statGames")}
                        </p>
                      </div>
                      <div>
                        <p className="font-display font-black text-lg text-warning-accent leading-none">
                          {profile.gamesWon}
                        </p>
                        <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1">
                          {t("statWins")}
                        </p>
                      </div>
                      <div>
                        <p className="font-display font-black text-lg text-orange-400 leading-none flex items-center gap-1">
                          <Flame className="w-4 h-4" /> {Math.max(profile.bestStreak, 0)}
                        </p>
                        <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1">
                          {t("statBestStreak")}
                        </p>
                      </div>
                      <div>
                        <p className="font-display font-black text-lg text-primary-accent leading-none flex items-center gap-1">
                          <Timer className="w-4 h-4" /> {fmtFastest(profile.fastestBuzz)}
                        </p>
                        <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1">
                          {t("statFastest")}
                        </p>
                      </div>
                      <div>
                        <p className="font-display font-black text-lg text-success-accent leading-none flex items-center gap-1">
                          <Target className="w-4 h-4" /> {accuracy === null ? "—" : `${accuracy}%`}
                        </p>
                        <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1">
                          {t("statAccuracy")}
                        </p>
                      </div>
                      <div>
                        <p className="font-display font-black text-lg text-secondary-accent leading-none flex items-center gap-1">
                          <Coins className="w-4 h-4" /> {profile.totalPoints.toLocaleString()}
                        </p>
                        <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1">
                          {t("statTotalPoints")}
                        </p>
                      </div>
                    </div>
                  </div>
                  {profile.favoriteCategory && (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary-accent/10 border border-secondary-accent/20">
                      <Tag className="w-3.5 h-3.5 text-secondary-accent shrink-0" />
                      <p className="text-[11px] font-bold text-white truncate">
                        {t("statBestCategory")}:{" "}
                        <span className="text-secondary-accent">{profile.favoriteCategory}</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {(localError || error) && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-danger-accent bg-danger-accent/10 border border-danger-accent/20 rounded-lg px-4 py-3 font-medium"
                >
                  {localError || error}
                </motion.p>
              )}

              <button
                onClick={handleJoin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-4 bg-white hover:bg-gray-100 text-black font-bold rounded-xl text-sm transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                {t("joinRoomBtn")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── How to Play modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {howToOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
            onClick={() => setHowToOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`${modalPanel} max-w-md`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setHowToOpen(false)}
                className={closeBtn}
                aria-label={t("close")}
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-3xl font-display font-black text-white leading-tight pr-8 flex items-center gap-3">
                <span className="w-11 h-11 rounded-2xl bg-primary-accent/20 flex items-center justify-center border border-primary-accent/30 shadow-inner">
                  <Zap className="w-5 h-5 text-primary-accent" />
                </span>
                {t("howToPlay")}
              </h3>

              <p className="text-sm text-text-muted -mt-2">{t("howToPlayIntro")}</p>

              <div className="space-y-3">
                {howToSteps.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary-accent/20 to-secondary-accent/20 border border-white/10 flex items-center justify-center">
                      <step.Icon className="w-5 h-5 text-primary-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-white">
                        <span className="text-text-muted font-black mr-2">{i + 1}.</span>
                        {step.title}
                      </p>
                      <p className="text-xs text-text-muted mt-1 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};