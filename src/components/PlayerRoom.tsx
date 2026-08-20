import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoom } from "../context/RoomContext";
import { Zap, Crown, LogOut, Users, X, Info, Settings as SettingsIcon } from "lucide-react";
import { soundManager } from "../utils/sound";
import { db } from "../firebase";
import { ref, get, onValue } from "firebase/database";
import type { Quiz } from "../types/jeopardy";
import { PlayerAvatar } from "../utils/playerAvatar";
import { ResultsScreen } from "./ResultsScreen";
import { ReactionOverlay } from "./ReactionOverlay";
import { ScorePopup } from "./ScorePopup";
import { SettingsModal } from "./SettingsModal";
import { StartCountdown } from "./StartCountdown";
import { useSettings } from "../context/SettingsContext";
import { recordGameEnd, checkLiveAchievements, achievementProgress, achievementHint, ACHIEVEMENT_IDS, loadProfile } from "../utils/profile";
import type { AchievementId } from "../utils/profile";
import { achievementBus } from "../utils/achievementBus";
import { AchievementToast } from "./AchievementToast";
import { MediaViewer } from "./ui/MediaViewer";

const FUN_FACTS = [
  "Did you know? Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible.",
  "Did you know? A day on Venus is longer than a year on Venus. It takes Venus 243 Earth days to rotate once on its axis, but only 225 Earth days to orbit the Sun.",
  "Did you know? Bananas are berries, but strawberries aren't. In botanical terms, true berries are simple fruits stemming from one flower with one ovary.",
  "Trivia Time! The shortest commercial flight in the world lasts just 57 seconds, flying between two Scottish islands: Westray and Papa Westray.",
  "Brain Teaser: The Eiffel Tower can be 15 cm taller during the summer, due to thermal expansion meaning the iron heats up and expands.",
  "Did you know? Octopus have three hearts, nine brains, and blue blood.",
  "Fun Fact: There are more trees on Earth than stars in the Milky Way galaxy. (About 3 trillion trees vs. 100-400 billion stars!)",
  "Did you know? Wombat poop is cube-shaped! This stops it from rolling away and helps them mark their territory.",
  "Trivia: A group of flamingos is called a 'flamboyance'.",
  "Fun Fact: The unicorn is the national animal of Scotland."
];

const REACTION_EMOJIS = ["🔥", "🎉", "😂", "😱", "🤯", "🙏"];

const getGridStyle = (count: number): React.CSSProperties => ({
  gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
});

interface PlayerRoomProps {
  onLeave: () => void;
}

export const PlayerRoom: React.FC<PlayerRoomProps> = ({ onLeave }) => {
  const { room, myId, myName, buzz, sendReaction, leaveRoom } = useRoom();
  const { t } = useSettings();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [categoryModalId, setCategoryModalId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const myPlayer = room?.players?.[myId];
  const hasBuzzed = !!room?.buzzes?.[myId];
  const sortedBuzzes = Object.entries(room?.buzzes || {}).sort((a, b) => a[1] - b[1]);

  // Reaction time: buzz timestamps and openedAt are both server-resolved, so
  // the diff is fair across devices regardless of clock skew.
  const openedAt =
    typeof room?.activeQuestion?.openedAt === "number" ? room.activeQuestion.openedAt : 0;
  const reactionFor = (ts: number): number | null =>
    openedAt > 0 && ts > openedAt ? ts - openedAt : null;
  const fmtReaction = (ms: number | null) =>
    ms === null ? null : `${(ms / 1000).toFixed(2)}s`;
  const myBuzzTs =
    typeof room?.buzzes?.[myId] === "number" ? (room.buzzes[myId] as number) : 0;
  const myReaction = myBuzzTs > 0 ? reactionFor(myBuzzTs) : null;
  const myQueuePos = myBuzzTs > 0 ? sortedBuzzes.findIndex(([pId]) => pId === myId) + 1 : 0;

  const [factIndex, setFactIndex] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  // Theme music on game start ("Let's Buzz!" board landing) and victory
  // fanfare when the game ends. Phase-transition guarded so remounts and
  // reconnects never replay them.
  const prevPhaseRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!room) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = room.phase;
    if (prev === undefined || prev === room.phase) return;
    if (room.phase === "board") soundManager.playIntro();
    if (room.phase === "ended") soundManager.playWinner();
  }, [room?.phase]);

  // ── Achievements ────────────────────────────────────────────────────────────
  // Baseline snapshot of the profile before this game starts (used to diff
  // what unlocked during/at the end of this game), plus the set of ids that
  // unlocked this game, and the awards/hints shown on the results screen.
  const gameStartAchievementsRef = useRef<Record<string, number> | null>(null);
  const gameUnlocksRef = useRef<Set<string>>(new Set());
  const awardsHandledRef = useRef(false);
  const [myAwards, setMyAwards] = useState<AchievementId[]>([]);
  const [myHints, setMyHints] = useState<{ key: string; params?: Record<string, string | number> }[]>([]);
  const [allUnlocked, setAllUnlocked] = useState(false);

  const seenAnyPhaseRef = useRef(false);
  useEffect(() => {
    if (room?.phase === "starting") {
      // Fresh game — baseline from the stored profile.
      gameStartAchievementsRef.current = loadProfile().achievements;
      gameUnlocksRef.current = new Set();
      awardsHandledRef.current = false;
      setMyAwards([]);
      setMyHints([]);
      setAllUnlocked(false);
    } else if (!seenAnyPhaseRef.current && room) {
      // Joined mid-game — nothing before this point counts as "this game".
      seenAnyPhaseRef.current = true;
      if (gameStartAchievementsRef.current === null) {
        gameStartAchievementsRef.current = loadProfile().achievements;
      }
    }
  }, [room?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live unlocks: streak goals and buzz-time goals pop the moment they're hit.
  useEffect(() => {
    const me = room?.players?.[myId];
    if (!me || room?.phase === "ended") return;
    const fastestMs = myBuzzTs > 0 && openedAt > 0 ? myBuzzTs - openedAt : undefined;
    const newly = checkLiveAchievements({
      bestStreak: me.bestStreak ?? 0,
      fastestBuzzMs: fastestMs,
    });
    for (const id of newly) {
      gameUnlocksRef.current.add(id);
      achievementBus.emit(id);
    }
  }, [room?.players?.[myId], myBuzzTs, openedAt, room?.phase, myId]);

  // Record this finished game in the player's local profile (once per game),
  // toast anything unlocked by the final tally, and stage the awards panel.
  useEffect(() => {
    if (room?.phase !== "ended" || !myId) return;
    const profile = recordGameEnd(room, myId);
    const before = gameStartAchievementsRef.current ?? {};
    const newlyAtEnd = ACHIEVEMENT_IDS.filter(
      (id) => profile.achievements[id] && !before[id],
    );
    for (const id of newlyAtEnd) {
      if (gameUnlocksRef.current.has(id)) continue;
      gameUnlocksRef.current.add(id);
      achievementBus.emit(id);
    }

    if (!awardsHandledRef.current) {
      awardsHandledRef.current = true;
      setMyAwards(ACHIEVEMENT_IDS.filter((id) => gameUnlocksRef.current.has(id)));
      // Encouragement: hints for the locked achievements closest to unlocking.
      const progress = achievementProgress(profile);
      const lockedAll = ACHIEVEMENT_IDS.filter((id) => !profile.achievements[id]);
      const locked = lockedAll
        .sort((a, b) => progress[b] - progress[a])
        .slice(0, 3);
      setAllUnlocked(lockedAll.length === 0);
      setMyHints(
        locked.map((id) => {
          const h = achievementHint(id, profile);
          return { key: h.key, params: h.params };
        }),
      );
    }
  }, [room, myId]);

  // Players hear the verdict (correct/wrong) when their score changes. Past
  // entries are seeded on mount so reconnects never replay old verdicts.
  const heardScoreEntries = useRef<Set<string> | null>(null);
  useEffect(() => {
    const entries = Object.values(room?.scoreHistory ?? {});
    if (heardScoreEntries.current === null) {
      heardScoreEntries.current = new Set(entries.map((e) => e.id));
      return;
    }
    for (const e of entries) {
      if (e.teamId !== myId || heardScoreEntries.current.has(e.id)) continue;
      heardScoreEntries.current.add(e.id);
      if (e.changeAmount > 0) soundManager.playCorrect();
      else soundManager.playWrong();
    }
  }, [room?.scoreHistory, myId]);

  // Track this client's live socket connectivity so a dropped connection is
  // visible instead of silently looking like an idle screen.
  useEffect(() => {
    const infoRef = ref(db, ".info/connected");
    const unsub = onValue(infoRef, (snap) => setIsOffline(snap.val() !== true));
    return () => unsub();
  }, []);

  // If we land back on the "buzzing" phase already holding a buzz (e.g. after
  // a refresh mid-question), briefly reassure the player their spot in the
  // queue was preserved rather than silently lost.
  useEffect(() => {
    if (room?.phase === "buzzing" && hasBuzzed) {
      setShowRestored(true);
      const t = setTimeout(() => setShowRestored(false), 4000);
      return () => clearTimeout(t);
    }
  }, [room?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (room?.phase !== "lobby") return;
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % FUN_FACTS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [room?.phase]);

  useEffect(() => {
    if (!room?.quizId) return;
    const fetchQuiz = async () => {
      const snap = await get(ref(db, `quizzes/${room.quizId}`));
      if (snap.exists()) setQuiz(snap.val());
    };
    fetchQuiz();
  }, [room?.quizId]);

  const categoryModalData = categoryModalId
    ? quiz?.categories.find((c) => c.id === categoryModalId) ?? null
    : null;

  const handleBuzz = async () => {
    if (hasBuzzed || room?.phase !== "buzzing") return;
    soundManager.playBuzzer();
    await buzz();
  };

  // Space bar = buzz in (game-show style). Guarded against typing in inputs
  // and key auto-repeat; preventDefault stops the page from scrolling.
  useEffect(() => {
    if (room?.phase !== "buzzing" || hasBuzzed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      handleBuzz();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [room?.phase, hasBuzzed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReact = (emoji: string) => {
    soundManager.playPop();
    sendReaction(emoji);
  };

  const handleLeave = () => {
    leaveRoom();
    onLeave();
  };

  if (!room) return null;

  const players = Object.values(room.players)
    .filter((p) => !p.isHost)
    .sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen flex flex-col select-none bg-primary-bg relative overflow-hidden">
      {/* Achievement unlocked popups */}
      <AchievementToast />
      {/* Background glow effects */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary-accent/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-accent/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Connection status banners */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="fixed top-0 inset-x-0 z-50 bg-danger-accent text-white text-center text-xs font-bold uppercase tracking-widest py-2"
          >
            {t('reconnect')}
          </motion.div>
        )}
        {!isOffline && showRestored && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="fixed top-0 inset-x-0 z-50 bg-green-600 text-white text-center text-xs font-bold uppercase tracking-widest py-2"
          >
            {t('buzzPreserved')}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <header className="glass-panel sticky top-0 z-40 px-5 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-accent to-secondary-accent flex items-center justify-center shadow-lg ring-2 ring-white/10">
            <PlayerAvatar seed={myId} name={myName} size={36} className="rounded-full" />
          </div>
          <div>
            <p className="font-display font-bold text-base text-white leading-tight">
              {myName}
            </p>
            <p className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mt-0.5">
              {t('room')}: <span className="font-bold text-primary-accent">{room.id}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 shadow-inner flex items-center gap-2">
            <span className="font-display font-black text-xl text-white">{myPlayer?.score ?? 0}</span>
            <span className="text-xs font-bold text-text-muted uppercase tracking-widest">{t('pts')}</span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            title={t('settingsTitle')}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-text-muted hover:text-white hover:bg-white/10 transition-all shadow-inner"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
          <button
            onClick={handleLeave}
            title={t('leaveRoom')}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-text-muted hover:text-white hover:bg-white/10 transition-all shadow-inner"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-4 sm:p-8 gap-6 max-w-4xl mx-auto w-full relative z-10">
        <AnimatePresence mode="wait">
          {/* LOBBY — waiting */}
          {room.phase === "lobby" && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 25,
                mass: 0.8,
              }}
              className="flex flex-col items-center justify-center gap-6 py-12 text-center w-full"
            >
              <div className="relative">
                 <div className="absolute inset-0 bg-secondary-accent/20 blur-2xl rounded-full" />
                 <div className="w-20 h-20 rounded-3xl glass-panel-heavy border border-white/10 flex items-center justify-center relative z-10 shadow-xl">
                   <Users className="w-10 h-10 text-secondary-accent" />
                 </div>
              </div>
              <div>
                <h2 className="text-3xl font-display font-bold text-white mb-2">{t('waitingForHost')}</h2>
                <p className="text-base text-text-muted">
                  {t('hangTight')}
                </p>
                
                <div className="mt-8 mb-4 max-w-md w-full h-24 flex items-center justify-center p-5 rounded-2xl glass-panel border border-white/10 relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-primary-accent" />
                   <AnimatePresence mode="wait">
                     <motion.p
                       key={factIndex}
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, y: -10 }}
                       transition={{ duration: 0.3 }}
                       className="text-sm text-text-main font-medium italic"
                     >
                       "{FUN_FACTS[factIndex]}"
                     </motion.p>
                   </AnimatePresence>
                </div>
              </div>
              <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-8">
                <AnimatePresence>
                  {players.map((p, index) => (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
                      className={`rounded-2xl border p-4 text-center transition-colors ${
                        p.id === myId 
                          ? "bg-primary-accent/15 border-primary-accent/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]" 
                          : "glass-panel"
                      }`}
                    >
                      <PlayerAvatar seed={p.id} name={p.name} size={48} className="mx-auto mb-3 rounded-full ring-2 ring-white/10" />
                      <p className="text-sm font-bold text-white truncate px-1">
                        {p.name}
                      </p>
                      {p.id === myId && (
                        <p className="text-[10px] font-bold text-primary-accent uppercase tracking-widest mt-1">You</p>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* BOARD — read-only view */}
          {room.phase === "board" && (
            <motion.div
              key="board"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 25,
                mass: 0.8,
              }}
              className="w-full space-y-8"
            >
              <div className="glass-panel p-4 rounded-2xl text-center border-white/10 shadow-lg">
                <p className="text-sm font-medium text-white flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-warning-accent animate-pulse" />
                  {t('hostSelecting')}
                </p>
              </div>

              {quiz && (
                <div className="w-full overflow-x-auto pb-1">
                <div
                  className="grid gap-2"
                  style={{
                    ...getGridStyle(quiz.categories.length),
                    minWidth: quiz.categories.length > 6 ? `${quiz.categories.length * 100}px` : undefined,
                  }}
                >
                  {quiz.categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryModalId(cat.id)}
                      className="glass-panel p-3 rounded-xl text-center font-bold text-[10px] sm:text-xs text-white uppercase tracking-wider min-h-[4rem] flex flex-col items-center justify-center gap-1 transition hover:bg-white/10 group shadow-md"
                    >
                      <span className="group-hover:text-primary-accent transition-colors">{cat.name}</span>
                      {cat.description?.trim() && <Info className="w-3 h-3 text-text-muted shrink-0 group-hover:text-primary-accent" />}
                    </button>
                  ))}
                  {Array.from({ length: quiz.categories[0]?.questions.length ?? 5 }).map((_, rowIdx) =>
                    quiz.categories.map((cat) => {
                      const q = cat.questions[rowIdx];
                      if (!q) return <div key={`${cat.id}-${rowIdx}`} />;
                      const done = !!room.completedQuestions?.[q.id];
                      return (
                        <div
                          key={q.id}
                          className={`glass-panel rounded-xl p-3 font-display font-black text-lg text-center flex items-center justify-center min-h-[4.5rem] transition-all ${
                            done ? "opacity-10 grayscale" : "text-warning-accent shadow-md"
                          }`}
                        >
                          {done ? "" : `$${q.value}`}
                        </div>
                      );
                    }),
                  )}
                </div>
                </div>
              )}

              <div className="glass-panel-heavy p-6 rounded-3xl space-y-4 border border-white/10 shadow-xl">
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                  <Crown className="w-4 h-4 text-warning-accent" /> {t('standings')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {players.map((p, i) => (
                    <div
                      key={p.id}
                      className={`relative flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors ${
                        p.id === myId 
                          ? "bg-primary-accent/15 border-primary-accent/30 shadow-inner" 
                          : "bg-white/5 border-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {i === 0 && p.score > 0 ? (
                          <Crown className="w-4 h-4 text-warning-accent fill-warning-accent" />
                        ) : (
                          <span className="text-[10px] font-bold text-text-muted w-4 text-center">#{i + 1}</span>
                        )}
                        <PlayerAvatar seed={p.id} name={p.name} size={28} className="shrink-0 rounded-full" />
                        <span className={`font-bold text-sm truncate ${p.id === myId ? "text-primary-accent" : "text-white"}`}>
                          {p.name} {p.id === myId && `(${t('you')})`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(p.streak ?? 0) >= 2 && (
                          <span className="text-[10px] font-black text-warning-accent uppercase tracking-widest" title={`${p.streak} ${t('inARow')}`}>
                            🔥 {p.streak}
                          </span>
                        )}
                        <span className="font-display font-black text-lg text-white">{p.score}</span>
                      </div>
                      <ScorePopup entries={room.scoreHistory} playerId={p.id} />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* BUZZING */}
          {room.phase === "buzzing" && room.activeQuestion && (
            <motion.div
              key="buzzing"
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 25,
                mass: 0.8,
              }}
              className="w-full max-w-2xl mx-auto space-y-6"
            >
              <div className="glass-panel-heavy p-8 rounded-3xl text-center space-y-5 relative shadow-2xl border border-white/10">
                <div className="flex items-center justify-center gap-3">
                  <span className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-text-muted uppercase tracking-widest">
                    {room.activeQuestion.categoryName}
                  </span>
                  <span className="font-display font-black text-warning-accent text-xl">
                    ${room.activeQuestion.value}
                  </span>
                </div>
                {room.activeQuestion.mediaUrl && (
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-lg mx-auto max-w-full max-h-56 bg-black">
                    <MediaViewer url={room.activeQuestion.mediaUrl} type={room.activeQuestion.type as any} className="max-h-56 w-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                )}
                <p className="text-lg sm:text-2xl font-display font-semibold text-white leading-relaxed whitespace-pre-wrap">
                  {room.activeQuestion.text}
                </p>
                <ReactionOverlay reactions={room.reactions} />
              </div>

              {!hasBuzzed ? (
                <div className="flex flex-col items-center gap-6 mt-8">
                  <motion.button
                    onClick={handleBuzz}
                    disabled={hasBuzzed}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    className="w-56 h-56 rounded-full font-display font-black text-4xl tracking-wider transition-all duration-150 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-danger-accent to-rose-700 border-8 border-white/10 text-white shadow-[0_0_50px_rgba(244,63,94,0.5)] cursor-pointer relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Zap className="w-14 h-14 mb-1" />
                    {t('buzz')}
                  </motion.button>
                  <p className="text-sm font-bold text-text-muted uppercase tracking-widest animate-pulse">
                    {t('beFirstToBuzz')}
                  </p>
                </div>
              ) : (
                <div className="glass-panel p-6 rounded-3xl space-y-5 mt-4 shadow-xl">
                  <div className="flex items-center justify-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/10 flex-col sm:flex-row">
                     <div className="flex items-center gap-3">
                       <div className="w-3 h-3 rounded-full bg-warning-accent animate-pulse" />
                       <p className="text-sm font-bold text-white uppercase tracking-widest">{t('youBuzzedIn')}</p>
                     </div>
                     <div className="flex items-center gap-2 sm:pl-4 sm:border-l sm:border-white/10">
                       {myReaction !== null && (
                         <span className={`flex items-center gap-1 text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                           myReaction <= 1000 && myQueuePos === 1
                             ? "bg-warning-accent/20 text-warning-accent border-warning-accent/40"
                             : "bg-white/5 text-text-muted border-white/10"
                         }`}>
                           <Zap className="w-3.5 h-3.5" /> {fmtReaction(myReaction)}
                         </span>
                       )}
{myQueuePos > 1 && (
                          <span className="text-xs font-black text-primary-accent uppercase tracking-widest">
                            {t('youAreInQueue', { n: myQueuePos })}
                          </span>
                        )}
                        {myReaction !== null && myReaction <= 1000 && myQueuePos === 1 && (
                          <span className="text-xs font-black text-primary-accent uppercase tracking-widest hidden sm:inline">
                            {t('firstBonus', { n: Math.max(1, Math.round((room.activeQuestion?.value ?? 0) * 0.1)) })}
                          </span>
                        )}
                     </div>
                  </div>
                  
                  <AnimatePresence>
                    {sortedBuzzes.length > 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{t('buzzQueue')}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {sortedBuzzes.map(([pId, ts], idx) => {
                            const p = room.players[pId];
                            if (!p) return null;
                            const isMe = pId === myId;
                            const isFirst = idx === 0;
                            const react = reactionFor(ts as number);
                            return (
                              <div
                                key={pId}
                                className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                                  isFirst 
                                    ? "bg-warning-accent/15 border-warning-accent/30 shadow-inner" 
                                    : "bg-white/5 border-white/5"
                                } ${isMe && !isFirst ? "ring-1 ring-primary-accent/50" : ""}`}
                              >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${isFirst ? "bg-warning-accent text-black" : "bg-white/10 text-text-muted"}`}>
                                  {idx + 1}
                                </div>
                                <PlayerAvatar seed={p.id} name={p.name} size={28} className="shrink-0 rounded-full" />
                                <div className="flex-1 min-w-0">
                                  <p className={`font-bold text-sm truncate ${isFirst ? "text-warning-accent" : "text-white"}`}>
                                    {p.name} {isMe && <span className="text-[10px] ml-1 text-primary-accent">({t('you')})</span>}
                                  </p>
                                  {(p.streak ?? 0) >= 2 && (
                                    <p className="text-[10px] font-black text-warning-accent leading-tight mt-0.5">
                                      🔥 {p.streak} {t('inARow')}
                                    </p>
                                  )}
                                </div>
                                {fmtReaction(react) && (
                                  <span
                                    className={`shrink-0 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                                      react !== null && react <= 1000
                                        ? "bg-warning-accent/20 text-warning-accent border-warning-accent/40"
                                        : "bg-white/5 text-text-muted border-white/10"
                                    }`}
                                  >
                                    <Zap className="w-3 h-3" /> {fmtReaction(react)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <p className="text-center text-xs font-medium text-text-muted">{t('waitingForHostJudge')}</p>
                </div>
              )}

              {/* Emoji reactions */}
              <div className="flex flex-col items-center gap-2 mt-2">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                  {t('react')}
                </p>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {REACTION_EMOJIS.map((emoji) => (
                    <motion.button
                      key={emoji}
                      onClick={() => handleReact(emoji)}
                      whileHover={{ scale: 1.2, y: -2 }}
                      whileTap={{ scale: 0.85 }}
                      className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 hover:bg-white/15 hover:border-white/25 text-xl flex items-center justify-center transition-colors shadow-inner"
                      aria-label={`Send ${emoji}`}
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* JUDGING – host is evaluating the buzzer's answer */}
          {room.phase === "judging" && room.activeQuestion && (
            <motion.div
              key="judging"
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 25,
                mass: 0.8,
              }}
              className="w-full max-w-2xl mx-auto space-y-6"
            >
              <div className="glass-panel-heavy p-8 rounded-3xl text-center space-y-5 relative shadow-2xl border border-white/10">
                <div className="flex items-center justify-center gap-3">
                  <span className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-text-muted uppercase tracking-widest">
                    {room.activeQuestion.categoryName}
                  </span>
                  <span className="font-display font-black text-warning-accent text-xl">
                    ${room.activeQuestion.value}
                  </span>
                </div>
                {room.activeQuestion.mediaUrl && (
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-lg mx-auto max-w-full max-h-56 bg-black">
                    <MediaViewer url={room.activeQuestion.mediaUrl} type={room.activeQuestion.type as any} className="max-h-56 w-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                )}
                <p className="text-lg sm:text-2xl font-display font-semibold text-white leading-relaxed whitespace-pre-wrap">
                  {room.activeQuestion.text}
                </p>
              </div>
              <div className="glass-panel p-6 rounded-3xl space-y-3 mt-4 shadow-xl border border-white/10 text-center">
                <div className="flex items-center justify-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="w-3 h-3 rounded-full bg-warning-accent animate-pulse" />
                  <p className="text-sm font-bold text-white uppercase tracking-widest">{t('hostIsJudging')}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ANSWER revealed */}
          {room.phase === "answer" && room.activeQuestion && (
            <motion.div
              key="answer"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 25,
                mass: 0.8,
              }}
              className="w-full max-w-2xl mx-auto space-y-6"
            >
              <div className="glass-panel-heavy p-8 rounded-3xl text-center space-y-6 shadow-2xl border border-white/10 relative">
                {room.activeQuestion.mediaUrl && (
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-lg mx-auto max-w-full max-h-56 bg-black">
                    <MediaViewer url={room.activeQuestion.mediaUrl} type={room.activeQuestion.type as any} className="max-h-56 w-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                )}
                <p className="text-base font-display font-medium text-text-muted/80 whitespace-pre-wrap">
                  {room.activeQuestion.text}
                </p>
                <div className="p-8 rounded-2xl bg-success-accent/10 border border-success-accent/30 relative overflow-hidden shadow-lg">
                  <div className="absolute top-0 left-0 w-full h-1 bg-success-accent" />
                  <p className="text-xs font-bold text-success-accent uppercase tracking-widest mb-3">{t('correctAnswer')}</p>
                  <p className="text-4xl font-display font-black text-white whitespace-pre-wrap">
                    {room.activeQuestion.answer}
                  </p>
                </div>
                <ReactionOverlay reactions={room.reactions} />
              </div>
              <div className="glass-panel p-4 rounded-2xl text-center border border-white/5">
                <p className="text-sm font-medium text-text-muted flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white/20 animate-pulse" />
                  {t('waitingForHostContinue')}
                </p>
              </div>
            </motion.div>
          )}

          {/* ENDED — game-show results with podium, stats & confetti */}
          {room.phase === "ended" && (
            <ResultsScreen
              players={players}
              myId={myId}
              onExit={handleLeave}
              exitLabel={t('exitGame')}
              waitingNote={t('waitingForRematch')}
              myAwards={myAwards}
              myHints={myHints}
              allUnlocked={allUnlocked}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Category description modal */}
      <AnimatePresence>
        {categoryModalData && (
          <motion.div
            key="cat-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={() => setCategoryModalId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="glass-panel-heavy rounded-3xl p-8 max-w-md w-full space-y-4 relative border border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setCategoryModalId(null)}
                className="absolute top-5 right-5 p-2 rounded-full bg-white/10 border border-white/10 text-text-muted hover:text-white hover:bg-white/20 transition-all"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-10 h-10 rounded-full bg-secondary-accent/20 flex items-center justify-center border border-secondary-accent/30 mb-2">
                 <Info className="w-5 h-5 text-secondary-accent" />
              </div>
              <h3 className="text-3xl font-display font-black text-white leading-tight pr-8">{categoryModalData.name}</h3>
              <div className="h-px w-full bg-gradient-to-r from-white/20 to-transparent my-4" />
              <p className="text-base text-text-muted leading-relaxed whitespace-pre-wrap font-medium">
                {categoryModalData.description?.trim() || "No detailed description provided for this category."}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start-game countdown */}
      {room.phase === "starting" && <StartCountdown startAt={room.startAt} />}

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};
