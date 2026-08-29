import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoom } from "../context/RoomContext";
import { useQuizLibrary } from "../context/QuizLibraryContext";
import { useSettings } from "../context/SettingsContext";
import type { Quiz } from "../types/jeopardy";
import {
  Lock,
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
  Timer,
  ArrowLeft,
  Check,
  User,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PlayerAvatar } from "../utils/playerAvatar";
import { avatarImages } from "../utils/avatarImages";
import { Logo } from "./ui/Logo";
import { SettingsModal } from "./SettingsModal";
import { HeroQuizArena } from "./HeroQuizArena";
import { ACHIEVEMENT_ICONS } from "../utils/achievements";
import {
  loadProfile,
  saveProfileName,
  saveProfileAvatar,
  xpOf,
  levelInfo,
  ACHIEVEMENT_IDS,
  isSecretAchievement,
  achievementKey,
  achievementHint,
} from "../utils/profile";
import { momentBus } from "../delight/moments";
import { soundManager } from "../utils/sound";
import { useLongHover } from "../delight/secrets";

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

  // Hidden delight: hover the logo long enough and it murmurs a secret back.
  const logoRef = React.useRef<HTMLDivElement>(null);
  useLongHover(logoRef, 2500, () => {
    soundManager.playEgg();
    momentBus.emit({
      icon: "🔮",
      title: "The logo hums",
      subtitle: "Some totems remember every game played beneath them.",
      tone: "ink",
    });
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [achFilter, setAchFilter] = useState<"all" | "unlocked" | "locked">("all");

  const [hostName, setHostName] = useState("");
  const [selectedQuizId, setSelectedQuizId] = useState<string>(quizzes[0]?.id ?? "");
  const [playerName, setPlayerName] = useState(() => loadProfile().name || "");
  const [roomCode, setRoomCode] = useState("");
  const [localError, setLocalError] = useState("");
  const [quizSearch, setQuizSearch] = useState("");
  const profile = loadProfile();
  const [selectedAvatar, setSelectedAvatar] = useState(() => profile.avatar || avatarImages[0]?.id || "");

  const xp = xpOf(profile);
  const level = levelInfo(xp);
  const unlockedCount = ACHIEVEMENT_IDS.filter((id) => profile.achievements[id]).length;
  const lockedCount = ACHIEVEMENT_IDS.length - unlockedCount;

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
      if (selectedAvatar) saveProfileAvatar(selectedAvatar);
      await createRoom(selectedQuiz, hostName.trim(), selectedAvatar);
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
      if (selectedAvatar) saveProfileAvatar(selectedAvatar);
      await joinRoom(roomCode.trim(), playerName.trim(), selectedAvatar);
      onPlayerEntersRoom();
    } catch (e: any) {
      setLocalError(e.message ?? t("errorJoinFailed"));
    }
  };

  const fmtFastest = (ms: number | null) =>
    ms === null ? "—" : `${(ms / 1000).toFixed(2)}s`;

  const inputBase =
    "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white font-medium outline-none focus:ring-1 transition-all placeholder:text-text-muted/40 shadow-inner";

  const modalPanel =
    "glass-panel-heavy rounded-[2rem] p-8 w-full space-y-6 relative border border-white/20 shadow-[0_0_80px_rgba(0,0,0,0.6)] max-h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar";
  const closeBtn =
    "absolute top-5 right-5 p-2 rounded-full bg-white/10 border border-white/10 text-text-muted hover:text-white hover:bg-white/20 transition-all";

  const howToSteps = [
    { Icon: MonitorPlay, title: t("htpStep1Title"), desc: t("htpStep1Desc") },
    { Icon: LayoutGrid, title: t("htpStep2Title"), desc: t("htpStep2Desc") },
    { Icon: Zap, title: t("htpStep3Title"), desc: t("htpStep3Desc") },
  ];

  // ── 1. CREATE GAME -> FULL-SCREEN HOST SETUP PAGE ────────────────────────
  if (createOpen) {
    const totalQuestions = selectedQuiz
      ? selectedQuiz.categories.reduce(
          (acc, cat) => acc + (cat.questions?.length || 0),
          0
        )
      : 0;
    const estMinutes = Math.max(5, Math.ceil((totalQuestions * 35) / 60));

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.3 }}
        className="h-screen max-h-screen flex flex-col relative bg-primary-bg text-white font-sans overflow-hidden"
      >
        {/* Background ambient glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-accent/15 blur-[160px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/15 blur-[160px] rounded-full pointer-events-none" />

        {/* ── Top Header ───────────────────────────────────────────── */}
        <header className="relative z-40 w-full max-w-7xl mx-auto px-5 sm:px-10 pt-4 pb-3 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-4">
            <Logo size={34} withWordmark />
            <div className="h-4 w-px bg-white/20 hidden sm:block" />
            <span className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-primary-accent/20 border border-primary-accent/30 text-xs font-bold text-primary-accent uppercase tracking-widest">
              <MonitorPlay className="w-3.5 h-3.5" />
              {t("createGame") || "Host Setup"}
            </span>
          </div>

          <button
            onClick={() => setCreateOpen(false)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-text-muted hover:text-white transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("Back To Lobby") || "Back to Lobby"}
          </button>
        </header>

        {/* ── Main Single-Screen Content (No Scroll) ───────────────── */}
        <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-5 sm:px-10 py-4 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center overflow-hidden">
          {/* Left Column: Host Details & Avatar Picker */}
          <div className="lg:col-span-6 h-full flex flex-col justify-between gap-4 overflow-hidden">
            <div className="glass-panel-heavy rounded-3xl p-5 sm:p-6 border border-white/15 shadow-2xl flex-1 flex flex-col justify-between min-h-0 overflow-hidden">
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 rounded-2xl bg-primary-accent/20 flex items-center justify-center border border-primary-accent/30">
                  <User className="w-4 h-4 text-primary-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-black text-white">Host Identity</h2>
                  <p className="text-xs text-text-muted">Enter host display name & select your character</p>
                </div>
              </div>

              {/* Host Name Input */}
              <div className="space-y-1.5 shrink-0 my-3">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">
                  {t("hostName")}
                </label>
                <input
                  type="text"
                  placeholder={t("hostNamePh")}
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleHost()}
                  className={`${inputBase} py-2.5 focus:border-primary-accent focus:ring-1 focus:ring-primary-accent`}
                />
              </div>

              {/* Avatar Selection */}
              <div className="flex-1 flex flex-col min-h-0 space-y-2">
                <div className="flex items-center justify-between ml-1 shrink-0">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    Host Avatar
                  </label>
                  <span className="text-[11px] text-text-muted font-medium">
                    {avatarImages.length} Avatars Available
                  </span>
                </div>

                <div className="flex-1 min-h-0 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 p-3 rounded-2xl bg-black/40 border border-white/10 overflow-y-auto custom-scrollbar">
                  {avatarImages.map((av) => {
                    const isSelected = selectedAvatar === av.id;
                    return (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => setSelectedAvatar(av.id)}
                        className={`relative rounded-2xl p-1 transition-all flex items-center justify-center aspect-square ${
                          isSelected
                            ? "ring-3 ring-primary-accent scale-105 bg-primary-accent/25 shadow-lg shadow-primary-accent/20"
                            : "hover:scale-105 opacity-75 hover:opacity-100 bg-white/5 border border-white/5 hover:border-white/20"
                        }`}
                        title={av.id}
                      >
                        <img
                          src={av.src}
                          alt={av.id}
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover shadow-md"
                        />
                        {isSelected && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary-accent text-white flex items-center justify-center text-[10px] font-black shadow-lg ring-2 ring-black">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Quiz Selection, Preview & Launch CTA */}
          <div className="lg:col-span-6 h-full flex flex-col justify-between gap-4 overflow-hidden">
            <div className="glass-panel-heavy rounded-3xl p-5 sm:p-6 border border-white/15 shadow-2xl flex-1 flex flex-col justify-between min-h-0 overflow-hidden space-y-3">
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-primary-accent/20 flex items-center justify-center border border-primary-accent/30">
                    <LayoutGrid className="w-4 h-4 text-primary-accent" />
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-black text-white">{t("selectQuizPack")}</h2>
                    <p className="text-xs text-text-muted">Choose a quiz set for this game</p>
                  </div>
                </div>

                <button
                  onClick={onCreateQuiz}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-accent/20 border border-primary-accent/30 text-xs font-bold text-primary-accent hover:bg-primary-accent/30 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("newQuiz")}
                </button>
              </div>

              {quizzes.length > 3 && (
                <div className="relative shrink-0">
                  <input
                    type="text"
                    placeholder={t("searchQuizzes") || "Search quizzes..."}
                    value={quizSearch}
                    onChange={(e) => setQuizSearch(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-primary-accent/50 transition-all placeholder:text-text-muted/40"
                  />
                  {quizSearch && (
                    <button
                      onClick={() => setQuizSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Quiz Pack List */}
              <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {!isSynced ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.03] animate-pulse"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-white/10 rounded w-2/3" />
                          <div className="h-3 bg-white/5 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {filteredQuizzes.map((q) => {
                      const isSelected = selectedQuizId === q.id;
                      const qCount = q.categories.reduce(
                        (acc, cat) => acc + (cat.questions?.length || 0),
                        0
                      );
                      return (
                        <div
                          key={q.id}
                          onClick={() => setSelectedQuizId(q.id)}
                          className={`group flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                            isSelected
                              ? "bg-primary-accent/20 border-primary-accent/50 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                              : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/15"
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                                  isSelected
                                    ? "border-primary-accent bg-primary-accent text-white"
                                    : "border-white/30"
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5" />}
                              </span>
                              <p
                                className={`font-bold text-sm truncate ${
                                  isSelected ? "text-primary-accent" : "text-white"
                                }`}
                              >
                                {q.title}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 mt-1 pl-5 text-[10px] font-bold text-text-muted">
                              <span>{q.categories.length} Categories</span>
                              <span>•</span>
                              <span>{qCount} Questions</span>
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditQuiz(q);
                            }}
                            title={t("edit")}
                            className="shrink-0 p-1.5 rounded-xl bg-white/5 border border-white/10 text-text-muted hover:text-white hover:bg-white/15 transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Selected Quiz Preview Box */}
              {selectedQuiz && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-primary-accent/10 to-indigo-900/20 border border-primary-accent/30 space-y-1.5 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-primary-accent uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Quiz Preview
                    </span>
                    <span className="text-xs font-bold text-text-muted">
                      Est. {estMinutes} mins
                    </span>
                  </div>

                  <h3 className="text-sm font-display font-black text-white truncate">{selectedQuiz.title}</h3>

                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {selectedQuiz.categories.slice(0, 5).map((c) => (
                      <span
                        key={c.id}
                        className="px-2 py-0.5 rounded-md bg-black/40 border border-white/10 text-[9px] font-bold text-white/90 truncate max-w-[120px]"
                      >
                        {c.name}
                      </span>
                    ))}
                    {selectedQuiz.categories.length > 5 && (
                      <span className="px-2 py-0.5 rounded-md bg-black/40 border border-white/10 text-[9px] font-bold text-text-muted">
                        +{selectedQuiz.categories.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Launch CTA */}
              <div className="space-y-2 shrink-0 pt-1">
                {(localError || error) && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-danger-accent bg-danger-accent/10 border border-danger-accent/20 rounded-xl px-3.5 py-2 font-medium"
                  >
                    {localError || error}
                  </motion.p>
                )}

                <button
                  onClick={handleHost}
                  disabled={loading || quizzes.length === 0}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary-accent to-indigo-600 hover:from-primary-hover hover:to-indigo-500 font-display font-black text-base text-white shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:shadow-[0_0_40px_rgba(99,102,241,0.6)] transition-all flex items-center justify-center gap-3 active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5 fill-current" />
                  )}
                  {t("createRoomAndHost") || "Launch Game Room"}
                </button>
              </div>
            </div>
          </div>
        </main>
      </motion.div>
    );
  }

  // ── 2. JOIN GAME -> FULL-SCREEN PLAYER ENTRY PAGE ────────────────────────
  if (joinOpen) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.3 }}
        className="min-h-screen flex flex-col relative bg-primary-bg text-white font-sans overflow-x-hidden"
      >
        {/* Ambient background lighting */}
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary-accent/15 blur-[160px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[45%] h-[45%] bg-pink-600/15 blur-[160px] rounded-full pointer-events-none" />

        {/* ── Top Header ───────────────────────────────────────────── */}
        <header className="relative z-40 w-full max-w-7xl mx-auto px-5 sm:px-10 pt-6 pb-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-4">
            <Logo size={36} withWordmark />
            <div className="h-5 w-px bg-white/20 hidden sm:block" />
            <span className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-accent/20 border border-secondary-accent/30 text-xs font-bold text-secondary-accent uppercase tracking-widest">
              <LogIn className="w-4 h-4" />
              {t("joinGame") || "Player Entry"}
            </span>
          </div>

          <button
            onClick={() => setJoinOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-text-muted hover:text-white transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("Back To Lobby") || "Back to Lobby"}
          </button>
        </header>

        {/* ── Centered Content Container ────────────────────────────── */}
        <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-5 py-8 sm:py-12 space-y-8 flex flex-col justify-center">
          <div className="text-center space-y-2">
            <h1 className="text-4xl sm:text-5xl font-display font-black text-white tracking-tight">
              Join Live Game
            </h1>
            <p className="text-sm text-text-muted">
              Choose your nickname, select your character avatar, and enter the room code.
            </p>
          </div>

          {/* Card 1: Nickname & Avatar Selection */}
          <div className="glass-panel-heavy rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">
                {t("yourName")}
              </label>
              <input
                type="text"
                placeholder={t("yourNamePh")}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className={`${inputBase} focus:border-secondary-accent focus:ring-1 focus:ring-secondary-accent text-base`}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                  Choose Avatar
                </label>
                <span className="text-[11px] text-secondary-accent font-bold">
                  Selected Character
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 p-4 rounded-2xl bg-black/40 border border-white/10 max-h-72 overflow-y-auto custom-scrollbar">
                {avatarImages.map((av) => {
                  const isSelected = selectedAvatar === av.id;
                  return (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setSelectedAvatar(av.id)}
                      className={`relative rounded-2xl p-1.5 transition-all flex flex-col items-center justify-center ${
                        isSelected
                          ? "ring-4 ring-secondary-accent scale-105 bg-secondary-accent/25 shadow-lg shadow-secondary-accent/20"
                          : "hover:scale-105 opacity-75 hover:opacity-100 bg-white/5 border border-white/5 hover:border-white/20"
                      }`}
                      title={av.id}
                    >
                      <img
                        src={av.src}
                        alt={av.id}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-md"
                      />
                      {isSelected && (
                        <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-secondary-accent text-white flex items-center justify-center text-xs font-black shadow-lg ring-2 ring-black">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2: Room Code Input */}
          <div className="glass-panel-heavy rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl space-y-3">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1 block text-center sm:text-left">
              {t("roomCode")}
            </label>
            <input
              type="text"
              placeholder="XXXXXX"
              maxLength={6}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              className="w-full bg-black/50 border border-white/15 rounded-2xl px-4 py-4 text-3xl sm:text-4xl font-display font-extrabold text-center tracking-[0.5em] text-secondary-accent outline-none focus:border-secondary-accent focus:ring-2 focus:ring-secondary-accent transition-all placeholder:text-text-muted/20 shadow-inner uppercase"
            />
          </div>

          {/* Stats Preview Card (if profile has history) */}
          {profile.gamesPlayed > 0 && (
            <div className="p-5 rounded-3xl bg-white/5 border border-white/10 space-y-3">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-warning-accent" /> {t("myStats")}
              </p>
              <div className="flex items-center gap-4">
                <PlayerAvatar
                  seed={myId}
                  avatar={selectedAvatar || profile.avatar}
                  name={profile.name || playerName || "You"}
                  size={48}
                  className="shrink-0 rounded-full ring-2 ring-white/10 shadow-lg"
                />
                <div className="grid grid-cols-3 gap-x-4 gap-y-2 flex-1">
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
                    <p className="font-display font-black text-lg text-primary-accent leading-none flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5" /> {fmtFastest(profile.fastestBuzz)}
                    </p>
                    <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1">
                      {t("statFastest")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Join Room CTA & Error */}
          <div className="space-y-3">
            {(localError || error) && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-danger-accent bg-danger-accent/10 border border-danger-accent/20 rounded-xl px-4 py-3 font-medium text-center"
              >
                {localError || error}
              </motion.p>
            )}

            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full py-4.5 rounded-2xl bg-gradient-to-r from-secondary-accent to-pink-600 hover:from-pink-500 hover:to-secondary-accent font-display font-black text-base sm:text-lg text-white shadow-[0_0_30px_rgba(236,72,153,0.4)] hover:shadow-[0_0_40px_rgba(236,72,153,0.6)] transition-all flex items-center justify-center gap-3 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <LogIn className="w-6 h-6" />
              )}
              {t("joinRoomBtn") || "Join Room"}
            </button>
          </div>
        </main>
      </motion.div>
    );
  }

  // ── 3. HOME LOBBY HERO VIEW ──────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-primary-bg text-white font-sans">
      {/* Ambient background */}
      <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] bg-primary-accent/15 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] bg-secondary-accent/12 blur-[140px] rounded-full pointer-events-none" />

      {/* ── Minimal navigation ─────────────────────────────────────────── */}
      <header className="relative z-40 w-full max-w-7xl mx-auto px-5 sm:px-10 pt-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div ref={logoRef} className="inline-flex">
            <Logo size={40} withWordmark />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Level & Achievements Bar Widget */}
          <button
            onClick={() => setShowAchievementsModal(true)}
            className="group flex items-center gap-3 px-3.5 py-1.5 rounded-2xl glass-panel-heavy border border-white/15 hover:border-primary-accent/50 hover:bg-white/10 transition-all shadow-xl"
            title="Click to view all achievements & career level"
          >
            <div className="relative">
              <PlayerAvatar
                seed={myId}
                avatar={selectedAvatar || profile.avatar}
                name={profile.name || playerName || "Player"}
                size={34}
                className="rounded-full ring-2 ring-primary-accent/60 group-hover:scale-105 transition-transform"
              />
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-primary-accent text-white text-[9px] font-black border border-black/60 shadow">
                Lvl {level.level}
              </span>
            </div>

            <div className="hidden sm:flex flex-col items-start min-w-[110px]">
              <div className="flex items-center justify-between w-full text-[10px] font-bold">
                <span className="text-white group-hover:text-primary-accent transition-colors">
                  Level {level.level}
                </span>
                <span className="text-text-muted">{level.into}/{level.need} XP</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-black/50 overflow-hidden border border-white/10 mt-1">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary-accent via-indigo-400 to-secondary-accent transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, (level.into / level.need) * 100))}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-black text-amber-300">
              <Trophy className="w-3.5 h-3.5 fill-current text-amber-400" />
              <span>{unlockedCount}/{ACHIEVEMENT_IDS.length}</span>
            </div>
          </button>

          <button
            onClick={() => setHowToOpen(true)}
            className="px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-text-muted hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all hidden md:block"
          >
            {t("howToPlay")}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 rounded-xl glass-panel border border-white/10 text-text-muted hover:text-white hover:bg-white/10 transition-all shadow-lg"
            aria-label={t("settingsTitle")}
            title={t("settingsTitle")}
          >
            <SettingsIcon className="w-4 h-4" />
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
            className="mt-6 text-base sm:text-lg text-text-muted max-w-lg font-medium leading-relaxed"
          >
            {t("heroSubtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto"
          >
            <button
              onClick={() => {
                setLocalError("");
                setCreateOpen(true);
              }}
              className="premium-btn py-4 px-8 font-bold text-base flex items-center justify-center gap-3 rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.35)]"
            >
              <Play className="w-5 h-5 fill-current" />
              {t("hostAGame")}
            </button>

            <button
              onClick={() => {
                setLocalError("");
                setJoinOpen(true);
              }}
              className="px-8 py-4 rounded-2xl glass-panel-heavy border border-white/20 font-bold text-base text-white hover:bg-white/10 transition-all flex items-center justify-center gap-3 shadow-lg"
            >
              <LogIn className="w-5 h-5 text-secondary-accent" />
              {t("joinGame")}
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 pt-6 border-t border-white/10 flex items-center justify-center lg:justify-start gap-6 text-xs text-text-muted font-semibold tracking-wide"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success-accent animate-pulse" />
              {quizzes.length} {t("quizPacksReady")}
            </span>
            <span>•</span>
            <span>{t("noAppRequired")}</span>
          </motion.div>
        </motion.div>

        {/* Right: Live Interactive Hero Arena */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full flex justify-center lg:justify-end"
        >
          <HeroQuizArena />
        </motion.div>
      </main>

      {/* ── Upgraded Modern Footer ───────────────────────────────────────── */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-10 py-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-text-muted">
        <div className="flex items-center gap-3">
          <Logo size={24} />
          <span className="font-bold text-white">QuizMaster Jeopardy</span>
          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-semibold text-text-muted">
            v2.4 Live Edition
          </span>
          <span className="text-white/20">•</span>
          <p>© {new Date().getFullYear()} All rights reserved.</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-bold">
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Realtime Multiplayer Sync
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/80">
            <ShieldCheck className="w-3.5 h-3.5 text-primary-accent" />
            Server Anti-Flicker
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/80">
            <Zap className="w-3.5 h-3.5 text-warning-accent" />
            Instant Buzz Engine
          </span>
        </div>
      </footer>

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

      {/* ── Achievements & Level Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {showAchievementsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
            onClick={() => setShowAchievementsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl glass-panel-heavy border border-white/15 shadow-2xl overflow-hidden bg-primary-bg/95"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <PlayerAvatar
                      seed={myId}
                      avatar={selectedAvatar || profile.avatar}
                      name={profile.name || playerName || "Player"}
                      size={52}
                      className="rounded-2xl ring-2 ring-primary-accent shadow-lg"
                    />
                    <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-primary-accent text-white text-xs font-black border border-black shadow">
                      Lvl {level.level}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-black text-white flex items-center gap-2">
                      {profile.name || playerName || "Player"}'s Achievements
                    </h2>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                      <span className="text-amber-300 font-bold flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5 fill-current text-amber-400" />
                        {unlockedCount} of {ACHIEVEMENT_IDS.length} Unlocked
                      </span>
                      <span>•</span>
                      <span className="text-primary-accent font-bold">
                        {level.into} / {level.need} XP
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowAchievementsModal(false)}
                  className={closeBtn}
                  aria-label={t("close")}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Career Stats Overview */}
              <div className="px-6 py-4 bg-white/[0.02] border-b border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[10px] uppercase font-bold text-text-muted">Games Played</p>
                  <p className="text-lg font-black text-white mt-0.5">{profile.gamesPlayed}</p>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[10px] uppercase font-bold text-text-muted">Games Won</p>
                  <p className="text-lg font-black text-emerald-400 mt-0.5">{profile.gamesWon}</p>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[10px] uppercase font-bold text-text-muted">Best Streak</p>
                  <p className="text-lg font-black text-amber-400 mt-0.5">×{profile.bestStreak}</p>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-[10px] uppercase font-bold text-text-muted">Fastest Buzz</p>
                  <p className="text-lg font-black text-indigo-400 mt-0.5">
                    {profile.fastestBuzz ? `${(profile.fastestBuzz / 1000).toFixed(2)}s` : "—"}
                  </p>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="px-6 pt-4 pb-2 flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10">
                  <button
                    onClick={() => setAchFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      achFilter === "all"
                        ? "bg-primary-accent text-white shadow"
                        : "text-text-muted hover:text-white"
                    }`}
                  >
                    All ({ACHIEVEMENT_IDS.length})
                  </button>
                  <button
                    onClick={() => setAchFilter("unlocked")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      achFilter === "unlocked"
                        ? "bg-emerald-500 text-white shadow"
                        : "text-text-muted hover:text-white"
                    }`}
                  >
                    Unlocked ({unlockedCount})
                  </button>
                  <button
                    onClick={() => setAchFilter("locked")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      achFilter === "locked"
                        ? "bg-amber-500/80 text-white shadow"
                        : "text-text-muted hover:text-white"
                    }`}
                  >
                    Locked ({lockedCount})
                  </button>
                </div>
                <span className="text-xs text-text-muted font-medium hidden sm:inline">
                  Click any badge to view milestone requirements
                </span>
              </div>

              {/* Achievements Grid */}
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ACHIEVEMENT_IDS.filter((id) => {
                  const unlocked = !!profile.achievements[id];
                  if (achFilter === "unlocked") return unlocked;
                  if (achFilter === "locked") return !unlocked;
                  return true;
                }).map((id) => {
                  const unlocked = !!profile.achievements[id];
                  const Icon = ACHIEVEMENT_ICONS[id] || Trophy;
                  const secret = isSecretAchievement(id) && !unlocked;
                  const titleKey = achievementKey(id);
                  const descKey = `${titleKey}Desc`;
                  const hint = achievementHint(id, profile);

                  return (
                    <div
                      key={id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                        unlocked
                          ? "bg-gradient-to-br from-amber-500/10 via-primary-accent/5 to-white/5 border-amber-500/30 shadow-lg shadow-amber-500/5 hover:border-amber-500/50"
                          : "bg-white/[0.02] border-white/10 opacity-75 hover:opacity-100 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center border shadow-inner ${
                            unlocked
                              ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black border-amber-300 shadow-amber-500/20"
                              : secret
                              ? "bg-white/5 text-white/40 border-white/10"
                              : "bg-white/5 text-white/50 border-white/10"
                          }`}
                        >
                          {secret ? <Lock className="w-5 h-5" /> : <Icon className="w-5.5 h-5.5" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="font-bold text-sm text-white truncate">
                              {secret ? "??? Secret Badge" : t(titleKey)}
                            </h4>
                            {unlocked && (
                              <span className="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Unlocked
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted mt-1 leading-snug">
                            {secret
                              ? "Earned through curious discovery & playful actions in game."
                              : t(descKey)}
                          </p>
                        </div>
                      </div>

                      {!unlocked && !secret && hint && (
                        <div className="mt-3 pt-2.5 border-t border-white/5 text-[11px] text-amber-300/80 font-medium flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 shrink-0 text-amber-400" />
                          <span className="truncate">{t(hint.key, hint.params)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};