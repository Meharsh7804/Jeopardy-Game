import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { get, ref } from "firebase/database";
import { db } from "../firebase";
import { useRoom } from "../context/RoomContext";
import { useQuizLibrary } from "../context/QuizLibraryContext";
import type { Quiz, Question } from "../types/jeopardy";
import {
  Copy,
  Check,
  Play,
  Pause,
  Eye,
  X,
  LogOut,
  Scissors,
  Info,
  Zap,
  Settings as SettingsIcon,
  QrCode,
  Undo2,
  Redo2,
  ScrollText,
} from "lucide-react";
import { soundManager } from "../utils/sound";
import { PlayerAvatar } from "../utils/playerAvatar";
import { ResultsScreen } from "./ResultsScreen";
import { ReactionOverlay } from "./ReactionOverlay";
import { SettingsModal } from "./SettingsModal";
import { StartCountdown } from "./StartCountdown";
import { useSettings } from "../context/SettingsContext";
import { QrJoinModal } from "./QrJoinModal";
import { AchievementToast } from "./AchievementToast";
import { MediaViewer, isAudioQuestion } from "./ui/MediaViewer";
import { useScoreCelebrations } from "../delight/celebrate";
import { momentBus } from "../delight/moments";
import { useRoomCodeWordEgg } from "../delight/gameEggs";
import { useIdleNudge } from "../delight/watch";
import { useMatchMemory } from "../delight/memories";
import { lobbyVibe, LobbyCurrent } from "../delight/lobby";
import { rankBuzzes, isHidden } from "../abilities/engine";
import { getAbilityForAvatar } from "../abilities/config";

const SCAN_LINES = [
  "Scanning the horizon…",
  "A carrier pigeon is en route…",
  "Listening for footsteps…",
  "The map is almost ready…",
  "Charting the unknown…",
];

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

interface HostRoomProps {
  onLeave: () => void;
}

export const HostRoom: React.FC<HostRoomProps> = ({ onLeave }) => {
  const {
    room,
    myId,
    startGame,
    openQuestion,
    setAudioPlaying,
    judgeAnswer,
    splitPoints,
    adjustScore,
    undoLastScoreChange,
    redoLastScoreChange,
    canRedo,
    pauseQuestion,
    resumeQuestion,
    revealAnswer,
    closeQuestion,
    endGame,
    resetGame,
    kickPlayer,
    leaveRoom,
  } = useRoom();
  const { quizzes } = useQuizLibrary();
  const { t } = useSettings();

  const [copied, setCopied] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [categoryModalId, setCategoryModalId] = useState<string | null>(null);
  const [splitSelected, setSplitSelected] = useState<string[]>([]);
  const [showSplit, setShowSplit] = useState(false);
  const [factIndex, setFactIndex] = useState(0);
  const [scanIndex, setScanIndex] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [showScoreAdjust, setShowScoreAdjust] = useState(false);
  const [adjustPlayerId, setAdjustPlayerId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("100");
  const [showSettings, setShowSettings] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const knownBuzzCount = useRef<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    const aq = room?.activeQuestion;
    if (aq?.paused) {
      setTimeLeft(typeof aq.pauseRemaining === "number" ? aq.pauseRemaining : null);
      return;
    }
    if (!aq?.timerDuration || !aq.openedAt || aq.openedAt <= 0) {
      setTimeLeft(null);
      return;
    }
    const duration = aq.timerDuration;
    const tick = () => {
      const elapsed = (Date.now() - (aq.openedAt as number)) / 1000;
      setTimeLeft(Math.max(0, duration - elapsed));
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [room?.activeQuestion?.openedAt, room?.activeQuestion?.timerDuration, room?.activeQuestion?.paused, room?.activeQuestion?.pauseRemaining]);

  useEffect(() => {
    if (room?.phase !== "lobby") return;
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % FUN_FACTS.length);
    }, 8000);
    const scan = setInterval(() => setScanIndex((prev) => (prev + 1) % SCAN_LINES.length), 2600);
    return () => {
      clearInterval(interval);
      clearInterval(scan);
    };
  }, [room?.phase]);

  const fetchedQuizKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!room?.quizId) {
      setQuiz(null);
      fetchedQuizKeyRef.current = null;
      return;
    }
    const quizId = room.quizId;
    const key = `${room.id}:${quizId}`;
    if (fetchedQuizKeyRef.current === key) return;

    // Instant paint from the library if it has this pack (the common case).
    // Never clear a quiz that already belongs to this room while we re-fetch.
    const cached = quizzes.find((q) => q.id === quizId) ?? null;
    setQuiz((prev) => (prev?.id === quizId ? prev : cached));

    // The room snapshot under `quizzes/{id}` is the source of truth: it is what
    // was saved when the room was created and what every player reads. It also
    // covers packs that are not in the shared library (e.g. the built-in
    // default quiz), which would otherwise leave the host board blank.
    let cancelled = false;
    get(ref(db, `quizzes/${quizId}`))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        fetchedQuizKeyRef.current = key;
        setQuiz(snap.val() as Quiz);
      })
      .catch(() => { /* fall back to the cached library entry */ });
    return () => {
      cancelled = true;
    };
  }, [room?.id, room?.quizId, quizzes]);

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
  }, [room?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // The host hears every new buzz land, so the "buzzed in" moment is audible.
  useEffect(() => {
    const count = Object.keys(room?.buzzes ?? {}).length;
    if (knownBuzzCount.current !== null && count > knownBuzzCount.current) {
      soundManager.playBuzzer();
    }
    knownBuzzCount.current = count;
  }, [room?.buzzes]);

  const handleJudge = useCallback(
    async (correct: boolean) => {
      if (correct) soundManager.playCorrect();
      else soundManager.playWrong();
      // High-value hauls get a one-off flourish (leader/streak celebrations are
      // handled centrally by useScoreCelebrations below).
      if (correct && (room?.activeQuestion?.value ?? 0) >= 400) {
        momentBus.emit({
          icon: "💎",
          title: "Big Haul!",
          subtitle: `+${room?.activeQuestion?.value} from the uncharted deep.`,
          tone: "playful",
        });
      }
      await judgeAnswer(correct);
    },
    [judgeAnswer, room?.activeQuestion],
  );

  // Number keys judge the current buzzer: 1 = Correct, 2 = Wrong. R reveals
  // the answer, C closes the question. Only active during buzzing with a
  // pending queue; ignored while typing.
  useEffect(() => {
    if (room?.phase !== "buzzing") return;
    if (showHistory || showScoreAdjust || showSettings || showQR || categoryModalId) return;
    const hasBuzzes = Object.keys(room.buzzes || {}).length > 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const tEl = e.target as HTMLElement | null;
      if (
        tEl &&
        (tEl.tagName === "INPUT" ||
          tEl.tagName === "TEXTAREA" ||
          tEl.tagName === "SELECT" ||
          tEl.isContentEditable)
      ) {
        return;
      }
      if (e.code === "Digit1" && hasBuzzes) {
        e.preventDefault();
        handleJudge(true);
      } else if (e.code === "Digit2" && hasBuzzes) {
        e.preventDefault();
        handleJudge(false);
      } else if (e.code === "KeyR" && room.activeQuestion && !room.activeQuestion.revealAnswer) {
        e.preventDefault();
        soundManager.playReveal();
        const aq = quiz?.categories
          .flatMap((c) => c.questions)
          .find((q) => q.id === room.activeQuestion!.questionId);
        revealAnswer(aq?.answer || "");
      } else if (e.code === "KeyC" && room.activeQuestion) {
        e.preventDefault();
        soundManager.playTimerTick();
        closeQuestion();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [room?.phase, room?.buzzes, room?.activeQuestion, quiz, handleJudge, revealAnswer, closeQuestion, showHistory, showScoreAdjust, showSettings, showQR, categoryModalId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Central celebration engine: watches scores/streaks and rewards clutch
  // lead changes, comebacks and hot streaks with sound + confetti + toasts.
  useScoreCelebrations(room?.players, myId);
  useRoomCodeWordEgg(room?.id);
  useMatchMemory(room, myId);

  // Watchful reactions aimed at the host's screen.
  useIdleNudge({
    active:
      room?.phase === "lobby" &&
      Object.values(room.players ?? {}).filter((p) => !p.isHost).length === 0,
    messages: [
      "Still recruiting explorers…",
      "A room this nice deserves company.",
      "Psst — share the code.",
    ],
  });
  useIdleNudge({
    active: room?.phase === "buzzing" && Object.keys(room.buzzes ?? {}).length === 0,
    icon: "🦗",
    tone: "warm",
    firstDelayMs: 6000,
    intervalMs: 12000,
    messages: [
      "Tough one? The board is waiting.",
      "Brave question. Nobody's bitten yet.",
    ],
  });

  if (!room) return null;

  const phase = room.phase;
  const players = Object.values(room.players).sort((a, b) => b.score - a.score || (a.joinedAt ?? 0) - (b.joinedAt ?? 0));
  const gamePlayers = players.filter((p) => !p.isHost);
  // Server-authoritative queue order + any frontOfLine jump.
  const rankedQueue = rankBuzzes(room.buzzes, room.abilityEffects);
  const sortedBuzzes = rankedQueue;

  // Reaction time helpers — both buzz timestamps and openedAt are resolved by
  // the Firebase server clock, so the difference is fair across devices.
  const openedAt =
    typeof room.activeQuestion?.openedAt === "number" ? room.activeQuestion.openedAt : 0;
  const reactionFor = (ts: number): number | null =>
    openedAt > 0 && ts > openedAt ? ts - openedAt : null;
  const fmtReaction = (ms: number | null) =>
    ms === null ? null : `${(ms / 1000).toFixed(2)}s`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenQuestion = async (q: Question, catName: string) => {
    soundManager.playWhoosh();
    await openQuestion(q, catName);
  };

  const categoryModalData = categoryModalId
    ? quiz?.categories.find((c) => c.id === categoryModalId) ?? null
    : null;

  const activeLocalQuestion = quiz?.categories
    .flatMap((c) => c.questions)
    .find((q) => q.id === room.activeQuestion?.questionId);

  const handleRevealAnswer = async () => {
    if (activeLocalQuestion) {
      await revealAnswer(activeLocalQuestion.answer || "");
    }
  };

  const handleSplit = async () => {
    if (splitSelected.length === 0) return;
    soundManager.playCorrect();
    await splitPoints(splitSelected);
    setSplitSelected([]);
    setShowSplit(false);
  };

  const handleKick = async (pid: string) => {
    if (!confirm("Kick this player from the room?")) return;
    await kickPlayer(pid);
  };

  const handleLeave = () => {
    leaveRoom();
    onLeave();
  };

  const scoreHistoryEntries = Object.values(room.scoreHistory || {}).sort(
    (a, b) => b.timestamp - a.timestamp,
  );

  const handleUndo = async () => {
    const last = scoreHistoryEntries[0];
    if (!last) return;
    const playerName = room.players[last.teamId || ""]?.name ?? "that player";
    if (!confirm(`Undo: "${last.description}"?\nThis will reset ${playerName}'s score back to ${last.previousScore}.`)) return;
    await undoLastScoreChange();
  };

  const handlePlayAgain = async () => {
    soundManager.playReveal();
    await resetGame();
  };

  const boardCategoryCount = Math.max(1, quiz?.categories.length ?? 0);
  const boardRowCount = Math.max(1, quiz?.categories[0]?.questions.length ?? 5);
  const isStandardBoard = boardCategoryCount === 6 && boardRowCount === 5;
  const playedCount = Object.values(room.completedQuestions || {}).filter(Boolean).length;

  const scoreDeck = (
    <div className="bg-[#111111] border-t-2 border-[#111111] px-4 sm:px-6 py-2.5 shrink-0">
      <div className="max-w-7xl mx-auto flex items-center gap-3 overflow-x-auto custom-scrollbar">
        <div className="shrink-0 font-mono text-[10px] font-bold text-[#FFD60A] uppercase tracking-wider leading-tight">Live Podiums<br />// Scores</div>
        <div className="shrink-0 bg-[#FFD60A] text-[#111111] border border-[#111111] px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-[0.06em]">{quiz?.categories.length ?? 0} CAT • {playedCount} PLAYED</div>
        {gamePlayers.map((p, i) => (
          <div key={p.id} className="bg-[#FFFFFF] border-2 border-[#111111] shadow-[2px_2px_0_#111111] px-3 py-1.5 flex items-center gap-2.5 shrink-0">
            <span className="font-mono text-[11px] font-black text-[#111111] w-5 shrink-0">#{i + 1}</span>
            <PlayerAvatar seed={p.id} avatar={p.avatar} name={p.name} size={28} className="!rounded-none w-7 h-7 border-2 border-[#111111] shrink-0" />
            <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-xs uppercase leading-none text-[#111111] truncate max-w-[130px]">{p.name}</div>
            <div className="bg-[#FFD60A] border border-[#111111] text-[#111111] px-2 py-0.5 font-['Archivo_Black'] text-xs leading-none">{p.score}</div>
          </div>
        ))}
        {gamePlayers.length === 0 && <div className="font-mono text-xs text-[#F4EFE6]/50 uppercase tracking-[0.08em]">No contestants on stage</div>}
      </div>
    </div>
  );

  const applyScoreAdjust = (sign: 1 | -1) => {
    const amount = Math.abs(parseInt(adjustAmount || "0", 10) || 0);
    const player = gamePlayers.find((p) => p.id === adjustPlayerId);
    if (!player || amount <= 0) return;
    const tag = sign > 0 ? `+${amount}` : `−${amount}`;
    adjustScore(player.id, sign * amount, `${player.name} — manual score override (${tag})`).catch(() => {});
    setShowScoreAdjust(false);
  };

  return (
    <div className="h-screen flex flex-col bg-[#F4EFE6] relative overflow-hidden text-[#111111] font-sans">
      <AchievementToast />

      {/* ── Unified Host Control Bar ───────────────────────────────────── */}
      {room.phase !== "ended" && (
      <header className="h-14 bg-[#FFFFFF] border-b-2 border-[#111111] px-4 sm:px-6 flex items-center justify-between gap-2.5 shrink-0 overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <div className="w-9 h-9 bg-[#FF3B1D] border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFD60A" stroke="#111111" strokeWidth="2" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 10-12h-7z" /></svg>
          </div>
          <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-sm sm:text-base uppercase leading-none text-[#111111] truncate max-w-[28vw]">{quiz?.title || "Loading..."}</div>
          <div className="bg-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0_#111111] px-2.5 py-1 flex items-center gap-1.5 font-mono text-xs font-bold shrink-0">
            <span className="tracking-[0.08em]">{room.id}</span>
            <button type="button" onClick={handleCopyCode} className="hover:text-[#FF3B1D] transition-colors" title="Copy room code">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}</button>
            <button type="button" onClick={() => setShowQR(true)} className="hover:text-[#FF3B1D] transition-colors" title="Show QR"><QrCode className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        <div className="hidden 2xl:flex items-center gap-2 bg-[#111111] text-[#FFD60A] px-3.5 py-1.5 font-mono text-xs font-bold shrink-0">
          <span className="w-2 h-2 bg-[#00C271] animate-pulse" />
          <span className="uppercase tracking-[0.06em]">{phase === "board" ? "Board Phase // Select a Clue" : phase === "lobby" ? "Green Room // Standby" : phase === "starting" ? "Countdown // Standby" : phase === "ended" ? "Show Complete // Results" : phase === "answer" ? "Answer Revealed // Debrief" : "Active Clue // Live"}</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button onClick={handleUndo} disabled={scoreHistoryEntries.length === 0} className="h-9 px-2.5 bg-[#F4EFE6] hover:bg-[#FFD60A] disabled:opacity-40 disabled:pointer-events-none border-2 border-[#111111] shadow-[2px_2px_0_#111111] font-mono text-xs font-bold flex items-center gap-1" title={t('undoLast')}><Undo2 className="w-4 h-4" /> UNDO</button>
          <button onClick={() => redoLastScoreChange()} disabled={!canRedo} className="h-9 px-2.5 bg-[#F4EFE6] hover:bg-[#FFD60A] disabled:opacity-40 disabled:pointer-events-none border-2 border-[#111111] shadow-[2px_2px_0_#111111] font-mono text-xs font-bold flex items-center gap-1" title="Redo last undone score change"><Redo2 className="w-4 h-4" /> REDO</button>
          <button onClick={() => setShowHistory(true)} className="h-9 px-2.5 bg-[#FFFFFF] hover:bg-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0_#111111] font-mono text-xs font-bold flex items-center gap-1.5" title={t('scoreHistory')}><ScrollText className="w-4 h-4" /> HISTORY</button>
          <button onClick={() => { setAdjustPlayerId(gamePlayers[0]?.id || ""); setShowScoreAdjust(true); }} className="h-9 px-3 bg-[#FFD60A] hover:bg-[#111111] text-[#111111] hover:text-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0_#111111] font-mono text-xs font-black flex items-center gap-1.5" title="Manual score adjust">± POINTS</button>
          {(room.phase === "board" || room.phase === "question" || room.phase === "buzzing" || room.phase === "judging" || room.phase === "answer") && (
            <button onClick={endGame} className="h-9 px-3 bg-[#FF3B1D] hover:bg-[#111111] text-[#FFFFFF] hover:text-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0_#111111] font-mono text-xs font-bold">END GAME</button>
          )}
          <button onClick={() => setShowSettings(true)} title={t('settingsTitle')} className="w-9 h-9 bg-[#FFFFFF] hover:bg-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center justify-center"><SettingsIcon className="w-4 h-4 text-[#111111]" /></button>
          <button onClick={handleLeave} title={t('leaveRoom')} className="w-9 h-9 bg-[#FFFFFF] hover:bg-[#FF3B1D] hover:text-white border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center justify-center text-[#111111]"><LogOut className="w-4 h-4" /></button>
        </div>
      </header>
      )}

      <main className={`flex-1 relative z-10 w-full ${room.phase === "board" || room.phase === "buzzing" || room.phase === "answer" ? "overflow-hidden flex flex-col min-h-0" : "overflow-y-auto"}`}>
        <AnimatePresence mode="wait">
          {/* LOBBY — Studio Green Room */}
          {room.phase === "lobby" && (
            <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="w-full min-h-full flex flex-col bg-[#F4EFE6]" style={{ backgroundImage: "linear-gradient(to right, #E5DEC9 1px, transparent 1px), linear-gradient(to bottom, #E5DEC9 1px, transparent 1px)", backgroundSize: "40px 40px" }}>
              <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  {/* LEFT: Podium Wall */}
                  <div className="lg:col-span-7 flex flex-col">
                    <section className="flex-1 flex flex-col bg-[#F4EFE6] border-2 border-[#111111] shadow-[6px_6px_0_#111111]">
                      <div className="bg-[#111111] px-4 py-3 flex items-center justify-between gap-3 shrink-0">
                        <span className="font-mono text-[0.75rem] font-bold tracking-[0.1em] uppercase text-white">Green Room // Contestant Podiums</span>
                        <span className="font-mono text-[0.75rem] font-bold tracking-[0.08em] uppercase text-[#FFD60A]">{gamePlayers.length} Joined</span>
                      </div>
                      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3.5 flex-1 content-start bg-[#F4EFE6]">
                        <AnimatePresence>
                          {gamePlayers.map((p, idx) => {
                            const pDef = getAbilityForAvatar(p.abilityId || p.avatar);
                            const connected = p.connected !== false;
                            return (
                              <motion.div layout key={p.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className={`flex flex-col justify-between overflow-hidden border-2 border-[#111111] shadow-[4px_4px_0_#111111] min-h-[155px] ${connected ? "bg-[#FFD60A]" : "bg-[#E5DEC9]"}`}>
                                <div className="bg-[#111111] text-[#FFFFFF] px-2.5 py-1.5 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-mono text-[10px] font-bold tracking-[0.08em] uppercase text-[#FFD60A] shrink-0">Podium {String(idx + 1).padStart(2, "0")}</span>
                                    {(p.streak ?? 0) >= 2 && <span className="px-1 py-0.5 bg-[#FF3B1D] text-white font-mono text-[9px] font-bold uppercase">🔥 {p.streak}</span>}
                                  </div>
                                  <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.06em] ${connected ? "text-[#00C271]" : "text-[#FF3B1D]"}`}>● {connected ? "Live" : "Off"}</span>
                                </div>
                                <div className="p-3 flex flex-col items-center text-center gap-2 flex-1 justify-center">
                                  <div className="relative w-14 h-14 border-2 border-[#111111] bg-[#FFFFFF] p-0.5 shadow-[2px_2px_0_#111111] shrink-0">
                                    <PlayerAvatar seed={p.id} avatar={p.avatar} name={p.name} size={52} className={`!rounded-none w-full h-full border border-[#111111]/20 ${!connected ? "opacity-40 grayscale" : ""}`} />
                                    <span className={`absolute -bottom-1 -right-1 w-3 h-3 border border-[#111111] ${connected ? "bg-[#00C271]" : "bg-[#FF3B1D]"}`} />
                                  </div>
                                  <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-base text-[#111111] uppercase tracking-tight leading-none truncate w-full">{p.name}</div>
                                  {pDef && <div className="bg-[#111111] text-[#FFFFFF] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider truncate max-w-full">{pDef.name} • {pDef.abilityName}</div>}
                                </div>
                                <div className="border-t-2 border-[#111111] flex items-stretch">
                                  <div className={`flex-1 py-1 text-center font-mono text-[10px] font-black tracking-widest uppercase ${connected ? "bg-[#00C271] text-[#111111]" : "bg-[#FF3B1D] text-white"}`}>{connected ? "✓ Locked In // Ready" : "● Disconnected"}</div>
                                  <button onClick={() => handleKick(p.id)} className="px-2.5 bg-[#111111] text-[#FF3B1D] hover:bg-[#FF3B1D] hover:text-white border-l-2 border-[#111111] font-mono text-[9px] font-black uppercase tracking-wider">Kick</button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                        {gamePlayers.length === 0 && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full flex flex-col items-center justify-center gap-3 py-12 px-6 border-2 border-dashed border-[#111111]/40 bg-[#FFFFFF]">
                            <div className="w-12 h-12 border-2 border-[#111111] bg-[#FFD60A] flex items-center justify-center"><Zap className="w-6 h-6 text-[#111111]" /></div>
                            <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#111111]/60">{SCAN_LINES[scanIndex]}</p>
                            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#111111]/40">{t('tellPlayersJoin')}</p>
                          </motion.div>
                        )}
                        {Array.from({ length: Math.max(0, 6 - gamePlayers.length) }).map((_, i) => {
                          const slot = gamePlayers.length + i + 1;
                          return (
                            <div key={`open-${i}`} className="bg-[#FFFFFF] border-2 border-dashed border-[#111111]/40 flex flex-col items-center justify-center p-4 min-h-[155px] gap-3">
                              <div className="font-mono font-bold text-[0.75rem] border border-[#111111]/30 bg-[#F4EFE6] px-2.5 py-1 text-[#111111]/60">{String(slot).padStart(2, "0")}</div>
                              <div className="font-mono text-[10px] font-bold tracking-[0.1em] uppercase text-[#111111]/40 text-center">Awaiting Player</div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-auto bg-[#111111] text-[#FFD60A] px-4 py-3 border-t-2 border-[#111111] flex items-center justify-between gap-3 font-mono text-xs font-bold tracking-[0.06em] uppercase">
                        <span className="flex items-center gap-2"><span className="w-2 h-2 bg-[#FFD60A] animate-pulse" /> On Standby — Launch When Ready</span>
                        <span className="text-[#F4EFE6]/70 shrink-0">Room: {room.id}</span>
                      </div>
                    </section>
                  </div>

                  {/* RIGHT: Teleprompter + Launch */}
                  <div className="lg:col-span-5 flex flex-col justify-between gap-3.5">
                    <section className="bg-[#FFFFFF] p-2 border-2 border-[#111111] shadow-[6px_6px_0_#111111] flex-1 flex flex-col">
                      <div className="bg-[#111111] text-white border-2 border-[#111111] p-3.5 flex-1 flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 font-mono text-[0.6875rem] font-bold tracking-[0.1em] uppercase text-[#00C271]">
                            <span className="w-2 h-2 bg-[#00C271] animate-pulse" /> Live Teleprompter // Studio Trivia
                          </div>
                          <button type="button" onClick={() => setFactIndex((v) => (v + 1) % FUN_FACTS.length)} className="px-2.5 py-1 border border-[#444444] font-mono text-[0.625rem] font-bold tracking-[0.08em] uppercase text-white/80 hover:border-[#FFD60A] hover:text-[#FFD60A] transition-colors">Next Fact ↻</button>
                        </div>
                        <div className="min-h-[84px] flex items-center">
                          <AnimatePresence mode="wait">
                            <motion.p key={factIndex} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="text-[0.9375rem] leading-relaxed text-[#F4EFE6]/90" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{FUN_FACTS[factIndex]}</motion.p>
                          </AnimatePresence>
                        </div>
                        <div className="mt-3 h-1.5 bg-[#333333] border border-[#444444] overflow-hidden"><div className="h-full bg-[#FFD60A]" style={{ width: "100%" }} /></div>
                      </div>
                    </section>

                    <section className="bg-[#FFFFFF] border-2 border-[#111111] shadow-[6px_6px_0_#111111] overflow-hidden">
                      <div className="bg-[#111111] text-[#FFFFFF] px-4 py-2 flex items-center justify-between font-mono text-xs font-bold tracking-[0.08em] uppercase"><span>Studio Status // Broadcast</span><span className="text-[#FFD60A]">{gamePlayers.filter((p) => p.connected !== false).length} / {gamePlayers.length} ready</span></div>
                      <div className="p-4 space-y-3">
                        <p className="text-sm font-bold text-[#111111]/70" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{lobbyVibe(gamePlayers.length, true)}</p>
                        <button onClick={startGame} disabled={gamePlayers.length === 0} className="w-full py-4 bg-[#FF3B1D] hover:bg-[#111111] text-[#FFFFFF] hover:text-[#FFD60A] disabled:opacity-40 disabled:pointer-events-none border-2 border-[#111111] shadow-[5px_5px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#111111] font-['Archivo_Black'] text-lg uppercase tracking-wide flex items-center justify-center gap-2.5 transition-[transform,box-shadow,background-color]">
                          <Play className="w-5 h-5 fill-current" /> Start Show & Launch Board →
                        </button>
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#111111]/45 text-center">At least one contestant must be locked in.</p>
                      </div>
                    </section>

                    <LobbyCurrent className="max-w-none" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* BOARD — Unified Host Categories Stage */}
          {room.phase === "board" && !quiz && (
            <motion.div key="board-sync" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 min-h-0 w-full flex items-center justify-center p-6 bg-[#F4EFE6]">
              <div className="bg-[#FFFFFF] border-[3px] border-[#111111] shadow-[8px_8px_0_#111111] px-8 py-7 max-w-md w-full text-center">
                <div className="w-12 h-12 mx-auto mb-4 bg-[#FFD60A] border-2 border-[#111111] shadow-[3px_3px_0_#111111] flex items-center justify-center animate-pulse">
                  <Zap className="w-6 h-6 text-[#111111]" />
                </div>
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#111111]/50 mb-1">Board Sync // Standby</p>
                <h2 style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-xl uppercase text-[#111111] leading-tight">Loading quiz pack…</h2>
                <p className="mt-2 text-xs font-bold text-[#111111]/55">Syncing the board for room {room.id}. If this persists, refresh the page or check your connection.</p>
              </div>
            </motion.div>
          )}

          {room.phase === "board" && quiz && (
            <motion.div key="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 min-h-0 w-full flex flex-col overflow-hidden bg-[#F4EFE6]" style={{ backgroundImage: "linear-gradient(to right, #E5DEC9 1px, transparent 1px), linear-gradient(to bottom, #E5DEC9 1px, transparent 1px)", backgroundSize: "40px 40px" }}>
              <div className="flex-1 min-h-0 flex flex-col max-w-7xl w-full mx-auto px-4 sm:px-6 py-3">
                <div
                  className="flex-1 min-h-0 grid grid-cols-6 grid-rows-[auto_repeat(5,minmax(0,1fr))] gap-2.5"
                  style={isStandardBoard ? undefined : {
                    gridTemplateColumns: `repeat(${boardCategoryCount}, minmax(0, 1fr))`,
                    gridTemplateRows: `auto repeat(${boardRowCount}, minmax(0, 1fr))`,
                  }}
                >
                  {quiz.categories.map((cat) => {
                    const isActive = room.activeQuestion?.categoryName === cat.name;
                    return (
                      <button key={cat.id} type="button" onClick={() => setCategoryModalId(cat.id)} className={`group relative bg-[#111111] ${isActive ? "text-[#FFD60A]" : "text-[#FFFFFF]"} border-2 border-[#111111] shadow-[3px_3px_0px_#111111] py-2.5 px-2 min-h-[54px] flex flex-col items-center justify-center text-center rounded-none hover:bg-[#FF3B1D] hover:text-white transition-colors`}>
                        <span className="text-xs sm:text-sm lg:text-[15px] font-['Archivo_Black'] uppercase tracking-wide leading-snug text-center line-clamp-2">{cat.name}</span>
                        {cat.description?.trim() && <Info className="absolute top-1 right-1 w-3 h-3 opacity-60 shrink-0" />}
                      </button>
                    );
                  })}

                  {Array.from({ length: boardRowCount }).map((_, rowIdx) =>
                    quiz.categories.map((cat) => {
                      const q = cat.questions[rowIdx];
                      if (!q) return <div key={`${cat.id}-${rowIdx}`} className="h-full w-full" />;
                      const done = !!room.completedQuestions?.[q.id];
                      return (
                        <button key={q.id} disabled={done} onClick={() => handleOpenQuestion(q, cat.name)} className={`h-full w-full flex items-center justify-center relative border-2 border-[#111111] transition-all ${done ? "bg-[#E6E0D4] text-[#111111]/30 shadow-none cursor-not-allowed" : "bg-[#FFFFFF] text-[#111111] shadow-[3px_3px_0_#111111] hover:bg-[#FFD60A] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"}`}>
                          {done ? (
                            <span className="flex flex-col items-center leading-none"><Check className="w-4 h-4" /><span className="font-mono text-[8px] uppercase tracking-widest mt-1">Played</span></span>
                          ) : (
                            <span className="text-xl sm:text-2xl font-['Archivo_Black']">${q.value}</span>
                          )}
                        </button>
                      );
                    }),
                  )}
                </div>
              </div>

              {scoreDeck}
            </motion.div>
          )}

          {/* ACTIVE CLUE — Host Control Stage */}
          {["buzzing", "answer"].includes(room.phase) && room.activeQuestion && (
            <motion.div key="question-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 min-h-0 w-full flex flex-col overflow-hidden bg-[#F4EFE6]" style={{ backgroundImage: "linear-gradient(to right, #E5DEC9 1px, transparent 1px), linear-gradient(to bottom, #E5DEC9 1px, transparent 1px)", backgroundSize: "40px 40px" }}>
              <div className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch overflow-y-auto lg:overflow-hidden">
                {/* LEFT: Clue Teleprompter & Show Controls */}
                <div className="lg:col-span-7 flex flex-col justify-between gap-4 min-h-0">
                  <div className="flex-1 bg-[#FFFFFF] border-2 border-[#111111] shadow-[6px_6px_0_#111111] flex flex-col justify-between overflow-hidden min-h-0">
                    <div className="bg-[#111111] text-[#FFFFFF] px-5 py-3 flex items-center justify-between gap-3 shrink-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="bg-[#F4EFE6] text-[#111111] px-3 py-1 font-bold text-xs uppercase truncate max-w-[40vw]">{room.activeQuestion.categoryName}</span>
                        <span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-2xl text-[#FFD60A] shrink-0">${room.activeQuestion.wager ?? room.activeQuestion.value}</span>
                        {room.activeQuestion.isDailyDouble && <span className="bg-[#FFD60A] text-[#111111] px-2 py-0.5 font-mono text-[10px] font-bold">DD</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {timeLeft !== null && <span className={`px-3 py-0.5 font-mono text-sm font-black ${room.activeQuestion?.paused ? "bg-[#F4EFE6] text-[#111111]" : timeLeft <= 4 ? "bg-[#FF3B1D] text-[#FFFFFF]" : "bg-[#FFD60A] text-[#111111]"}`}>{room.activeQuestion?.paused ? "PAUSED" : `⚡ ${timeLeft.toFixed(2)}s`}</span>}
                        <span className="font-mono text-xs font-bold text-[#00C271] uppercase hidden sm:inline">Active Clue // Live</span>
                      </div>
                    </div>
                    {(() => {
                      const mod = (room.activeQuestion as any)?.modifier;
                      if (!mod) return null;
                      return <div className="bg-[#FFD60A] border-b-2 border-[#111111] px-5 py-2 flex items-center justify-between font-mono text-xs font-black text-[#111111] shrink-0"><span>🚇 MODIFIER: {String(mod.name || mod).toUpperCase()}</span><span className="font-bold normal-case tracking-normal text-[#111111]/70">{mod.hint || mod.rule || ""}</span></div>;
                    })()}
                    <div className="flex-1 px-8 py-6 flex flex-col items-center justify-center text-center bg-[#FFFFFF] overflow-y-auto min-h-0">
                      {room.activeQuestion.mediaUrl && (
                        <div className="relative overflow-hidden border-2 border-[#111111] shadow-[4px_4px_0_#111111] mx-auto max-w-full max-h-52 bg-black mb-4 shrink-0">
                          <MediaViewer url={room.activeQuestion.mediaUrl} type={room.activeQuestion.type as any} audioPlaying={room.activeQuestion.audioPlaying} className="max-h-52 object-contain" />
                        </div>
                      )}
                      {isAudioQuestion(room.activeQuestion) && (
                        <div className="flex items-center justify-between gap-3 p-3 bg-[#F4EFE6] border-2 border-[#111111] mb-4 w-full max-w-lg shrink-0">
                          <div className="text-left"><p className="font-mono text-[10px] font-bold uppercase text-[#111111]">Host Audio Control</p><p className="text-[10px] text-[#111111]/60">Sync playback for all players</p></div>
                          <button onClick={() => setAudioPlaying(room.activeQuestion?.audioPlaying === false ? true : false)} className={`px-4 py-2 border-2 border-[#111111] font-mono text-xs font-bold uppercase ${room.activeQuestion?.audioPlaying === false ? "bg-[#00C271] text-[#111111]" : "bg-[#FFD60A] text-[#111111]"}`}>{room.activeQuestion?.audioPlaying === false ? "Play" : "Pause"}</button>
                        </div>
                      )}
                      <p className="text-3xl sm:text-4xl font-extrabold text-[#111111] leading-snug max-w-2xl whitespace-pre-wrap" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{room.activeQuestion.text}</p>
                      <ReactionOverlay reactions={room.reactions} />
                      {(() => {
                        const qId = room.activeQuestion!.questionId;
                        const fx = Object.values(room.abilityEffects || {}).filter((e) => e.appliedToQuestionId === qId || e.status === "pending");
                        if (fx.length === 0) return null;
                        return <div className="flex flex-wrap justify-center gap-1.5 mt-4">{fx.map((e) => { const def = getAbilityForAvatar(e.abilityId); return <span key={e.id} className="inline-flex items-center gap-1 px-2 py-1 bg-[#F4EFE6] border border-[#111111] font-mono text-[9px] font-bold uppercase"><span>{def?.emoji}</span>{def?.abilityName}</span>; })}</div>;
                      })()}
                    </div>
                    {(!room.activeQuestion.revealAnswer && activeLocalQuestion?.answer) && (
                      <div className="mx-5 mb-5 bg-[#F4EFE6] border-2 border-[#111111] border-l-[6px] border-l-[#FF3B1D] p-4 shrink-0">
                        <p className="font-mono text-[11px] font-black text-[#FF3B1D] uppercase tracking-[0.08em]">👁 Host Only // Correct Answer</p>
                        <p className="text-xl font-extrabold text-[#111111] mt-1 whitespace-pre-wrap">{activeLocalQuestion.answer}</p>
                      </div>
                    )}
                    {room.activeQuestion.revealAnswer && (
                      <div className="mx-5 mb-5 bg-[#FFFFFF] border-[3px] border-[#111111] shadow-[4px_4px_0_#111111] overflow-hidden shrink-0">
                        <div className="bg-[#111111] text-[#FFD60A] px-4 py-2 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-[0.06em]">
                          <span>● Official Answer Revealed</span>
                          <span>${room.activeQuestion.wager ?? room.activeQuestion.value}</span>
                        </div>
                        <div className="m-4 bg-[#00C271] border-2 border-[#111111] shadow-[3px_3px_0_#111111] p-5 text-center">
                          <div className="bg-[#111111] text-[#FFFFFF] px-3 py-0.5 font-mono text-[10px] font-bold tracking-widest inline-block mb-2 uppercase">Correct Answer</div>
                          <p className="text-3xl sm:text-4xl font-black leading-tight text-[#111111] whitespace-pre-wrap" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{room.activeQuestion.answer}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 shrink-0">
                    <button onClick={handleRevealAnswer} disabled={!!room.activeQuestion.revealAnswer} className={`py-3 border-2 border-[#111111] shadow-[3px_3px_0_#111111] font-mono text-xs font-bold flex items-center justify-center gap-2 uppercase transition-colors disabled:opacity-60 ${room.activeQuestion.revealAnswer ? "bg-[#FFD60A] text-[#111111]" : "bg-[#FFFFFF] hover:bg-[#FFD60A] text-[#111111]"}`}><Eye className="w-4 h-4" /> Reveal [R]</button>
                    <button onClick={() => room.activeQuestion?.paused ? resumeQuestion() : pauseQuestion()} className="py-3 bg-[#FFD60A] hover:bg-[#111111] hover:text-[#FFD60A] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0_#111111] font-mono text-xs font-bold flex items-center justify-center gap-2 uppercase transition-colors">{room.activeQuestion?.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />} {room.activeQuestion?.paused ? "Resume" : "Pause"}</button>
                    <button onClick={closeQuestion} className="py-3 bg-[#FFFFFF] hover:bg-[#FF3B1D] hover:text-white text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0_#111111] font-mono text-xs font-bold flex items-center justify-center gap-2 uppercase transition-colors"><X className="w-4 h-4" /> Close [C]</button>
                  </div>
                  {room.activeQuestion.revealAnswer && (
                    <button onClick={closeQuestion} className="w-full bg-[#111111] text-[#FFD60A] border-2 border-[#111111] shadow-[4px_4px_0_#111111] px-5 py-3 text-center font-mono text-xs font-bold tracking-wider uppercase hover:bg-[#1a1a1a] transition-colors shrink-0">▶ Back to Board [C]</button>
                  )}
                </div>

                {/* RIGHT: Buzz Queue & Adjudication */}
                <div className="lg:col-span-5 flex flex-col min-h-0">
                  <div className="flex-1 bg-[#FFFFFF] border-2 border-[#111111] shadow-[6px_6px_0_#111111] flex flex-col overflow-hidden min-h-0">
                    <div className="bg-[#111111] text-[#FFFFFF] px-4 py-2.5 flex items-center justify-between shrink-0">
                      <span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-sm text-[#FFD60A] uppercase flex items-center gap-2"><Zap className="w-4 h-4" /> Buzz Queue</span>
                      <button onClick={() => { setShowSplit(!showSplit); setSplitSelected([]); }} disabled={!!room.activeQuestion?.dailyDoublePlayerId} className="bg-[#F4EFE6] text-[#111111] hover:bg-[#FFD60A] px-2.5 py-1 font-mono text-[10px] font-bold border border-[#111111] uppercase disabled:opacity-40"><Scissors className="w-3 h-3 inline mr-1" />Split</button>
                    </div>
                    <div className="bg-[#F4EFE6] border-b-2 border-[#111111] px-4 py-2 flex flex-wrap items-center gap-2 font-mono text-[10px] font-bold uppercase shrink-0">
                      <span className="px-1.5 py-0.5 bg-white border border-[#111111]">[1] Correct</span>
                      <span className="px-1.5 py-0.5 bg-white border border-[#111111]">[2] Wrong</span>
                      <span className="px-1.5 py-0.5 bg-white border border-[#111111]">[R] Reveal</span>
                      <span className="px-1.5 py-0.5 bg-white border border-[#111111]">[C] Close</span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto min-h-0">
                      <AnimatePresence>
                        {showSplit && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="p-3 bg-[#F4EFE6] border-2 border-[#111111] space-y-2 shrink-0">
                            <p className="font-mono text-[10px] font-bold uppercase text-[#111111]/60">Split points among selected</p>
                            <div className="grid grid-cols-2 gap-2">
                              {gamePlayers.map((p) => (
                                <label key={p.id} className="flex items-center gap-2 p-2 bg-white border border-[#111111]/30 cursor-pointer"><input type="checkbox" checked={splitSelected.includes(p.id)} onChange={(e) => setSplitSelected((prev) => e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id))} className="accent-[#111111]" /><span className="text-xs font-bold truncate">{p.name}</span></label>
                              ))}
                            </div>
                            <button disabled={splitSelected.length === 0} onClick={handleSplit} className="w-full py-2 bg-[#FFD60A] border-2 border-[#111111] font-mono text-xs font-bold uppercase disabled:opacity-40">Award Split (+{splitSelected.length > 0 ? Math.round((room.activeQuestion?.value ?? 0) / splitSelected.length) : "?"} each)</button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex-1 flex flex-col gap-3 min-h-0">
                        <AnimatePresence mode="popLayout">
                          {sortedBuzzes.length > 0 ? sortedBuzzes.map(({ playerId: pId, ts, override }, idx) => {
                            const p = room.players[pId]; if (!p) return null;
                            const isFirst = idx === 0; const react = reactionFor(ts as number); const fast = react !== null && react <= 1000;
                            const avFx = room.abilityEffects?.[pId]; const isRisk = avFx?.kind === "risky" && avFx.option === "risk";
                            const hiddenNow = isHidden(pId, room.abilityEffects);
                            const pDef = getAbilityForAvatar(p.abilityId || p.avatar);
                            return isFirst ? (
                              <motion.div key={pId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="bg-[#FFD60A] border-2 border-[#111111] shadow-[4px_4px_0_#111111] p-3.5 space-y-3 shrink-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2"><span className="bg-[#111111] text-[#FFD60A] px-2 py-0.5 font-mono text-xs font-black">#1</span><span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]">On The Mic</span>{override && <span className="font-mono text-[9px] font-bold bg-[#111111] text-[#FFD60A] px-1.5 py-0.5">FRONT</span>}</div>
                                  {fmtReaction(react) && <span className="bg-[#FFFFFF] border border-[#111111] px-2 py-0.5 font-mono text-xs font-bold">⚡ {fmtReaction(react)}</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                  <PlayerAvatar seed={p.id} avatar={p.avatar} name={p.name} size={48} className="!rounded-none w-12 h-12 border-2 border-[#111111] bg-[#FFFFFF] shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-lg uppercase text-[#111111] leading-none truncate">{p.name}</div>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <span className="font-mono text-[10px] font-bold uppercase">Score: {p.score}</span>
                                      {pDef && <span className="bg-[#111111] text-[#FFFFFF] px-1.5 py-0.5 font-mono text-[10px] uppercase">{pDef.abilityName}</span>}
                                      {isRisk && <span className="bg-[#FF3B1D] text-white px-1.5 py-0.5 font-mono text-[10px] font-bold">☠️ RISK ×2</span>}
                                      {hiddenNow && <span className="font-mono text-[10px] font-bold">👻 HIDDEN</span>}
                                    </div>
                                  </div>
                                </div>
                                {fast && <p className="font-mono text-[10px] font-bold uppercase text-[#111111]">⚡ Fast buzz — +${Math.max(1, Math.round((room.activeQuestion?.value ?? 0) * 0.1))} bonus on correct</p>}
                                <div className="grid grid-cols-2 gap-2.5">
                                  <button onClick={() => handleJudge(true)} className="py-3 bg-[#00C271] hover:bg-[#00A862] text-[#111111] font-['Archivo_Black'] text-sm border-2 border-[#111111] shadow-[3px_3px_0_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none uppercase">✓ Correct [1]</button>
                                  <button onClick={() => handleJudge(false)} className="py-3 bg-[#FF3B1D] hover:bg-[#E02E12] text-[#FFFFFF] font-['Archivo_Black'] text-sm border-2 border-[#111111] shadow-[3px_3px_0_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none uppercase">✕ Wrong [2]</button>
                                </div>
                              </motion.div>
                            ) : (
                              <motion.div key={pId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#F4EFE6] border-2 border-[#111111] px-3 py-2 flex items-center justify-between gap-2 font-mono text-xs shrink-0">
                                <div className="flex items-center gap-2 min-w-0"><span className="font-black w-5">#{idx + 1}</span><PlayerAvatar seed={p.id} avatar={p.avatar} name={p.name} size={24} className="!rounded-none w-6 h-6 border border-[#111111] shrink-0" /><span className="font-bold uppercase truncate">{p.name}</span></div>
                                {fmtReaction(react) && <span className="font-bold shrink-0">⚡ {fmtReaction(react)}</span>}
                              </motion.div>
                            );
                          }) : (
                            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 border-2 border-dashed border-[#111111]/35 bg-[#F4EFE6] flex flex-col items-center justify-center p-6 text-center gap-2 min-h-[160px]">
                              <Zap className="w-8 h-8 text-[#111111]/35" />
                              <p className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-[#111111]/50">Waiting for Buzzes...</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="bg-[#111111] text-[#FFD60A] px-4 py-2 font-mono text-[11px] font-bold flex items-center gap-2 shrink-0 uppercase tracking-[0.04em]">
                      <span className="w-2 h-2 bg-[#00C271] animate-pulse shrink-0" />
                      <span className="truncate">{sortedBuzzes.length > 0 ? `${room.players[sortedBuzzes[0].playerId]?.name ?? "Contestant"} on the Mic — Grade Answer` : "Crickets... nobody's buzzing in."}</span>
                    </div>
                  </div>
                </div>
              </div>
              {scoreDeck}
            </motion.div>
          )}

          {/* ENDED PHASE — results */}
          {room.phase === "ended" && (
            <motion.div key="results" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }} className="w-full">
              <ResultsScreen
                players={gamePlayers}
                myId={myId}
                onPlayAgain={handlePlayAgain}
                onExit={handleLeave}
                exitLabel={t('returnToLobby')}
                quizTitle={quiz?.title}
                roomCode={room.id}
                onOpenHistory={() => setShowHistory(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Category description modal */}
      <AnimatePresence>
        {categoryModalData && (
          <motion.div key="cat-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111111]/70" onClick={() => setCategoryModalId(null)}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="max-w-lg w-full bg-[#FFFFFF] border-[3px] border-[#111111] shadow-[8px_8px_0_#111111] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-[#111111] text-[#FFD60A] px-5 py-3 flex items-center justify-between gap-3">
                <span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-sm uppercase tracking-wide">Category Dossier</span>
                <button onClick={() => setCategoryModalId(null)} aria-label="Close" className="bg-[#FF3B1D] text-white w-7 h-7 border border-white font-mono font-bold flex items-center justify-center">✕</button>
              </div>
              <div className="p-5 space-y-3">
                <div className="w-10 h-10 bg-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center justify-center"><Info className="w-5 h-5 text-[#111111]" /></div>
                <h3 style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-3xl uppercase leading-tight text-[#111111]">{categoryModalData.name}</h3>
                <div className="h-0.5 w-full bg-[#111111]" />
                <p className="text-base font-medium text-[#111111]/75 leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{categoryModalData.description?.trim() || "No detailed description provided for this category."}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score history / undo modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div key="history-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111111]/70" onClick={() => setShowHistory(false)}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="max-w-lg w-full max-h-[85vh] bg-[#FFFFFF] border-[3px] border-[#111111] shadow-[8px_8px_0_#111111] rounded-none overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="bg-[#111111] text-[#FFD60A] px-5 py-3 flex items-center justify-between gap-3 shrink-0">
                <span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-sm uppercase tracking-wide flex items-center gap-2"><ScrollText className="w-4 h-4" /> Game History // Score Log</span>
                <button onClick={() => setShowHistory(false)} aria-label="Close" className="bg-[#FF3B1D] text-white w-7 h-7 border border-white font-mono font-bold flex items-center justify-center">✕</button>
              </div>
              <div className="p-4 space-y-3 flex-1 min-h-0 flex flex-col">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#111111]/55">{t('everyScoreChange')}</p>
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                  {scoreHistoryEntries.length === 0 ? (
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.06em] text-[#111111]/45 text-center py-6">{t('noScoreChangesYet')}</p>
                  ) : (
                    scoreHistoryEntries.map((entry, i) => {
                      const positive = entry.changeAmount >= 0;
                      return (
                        <div key={entry.id} className="flex items-center justify-between gap-3 p-3 border-2 border-[#111111] bg-[#F4EFE6]">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              {i === 0 && <span className="shrink-0 bg-[#FFD60A] border border-[#111111] px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.06em]">Latest</span>}
                              <p className="text-sm font-bold text-[#111111] truncate">{entry.description}</p>
                            </div>
                            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-[#111111]/55 mt-0.5">{new Date(entry.timestamp).toLocaleTimeString()} · {entry.previousScore} → {entry.newScore}</p>
                          </div>
                          <span className={`shrink-0 px-2 py-1 border-2 border-[#111111] font-mono text-xs font-black ${positive ? "bg-[#00C271] text-[#111111]" : "bg-[#FF3B1D] text-[#FFFFFF]"}`}>{positive ? "+" : ""}{entry.changeAmount}</span>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 shrink-0">
                  <button onClick={handleUndo} disabled={scoreHistoryEntries.length === 0} className="py-2.5 bg-[#F4EFE6] hover:bg-[#FFD60A] disabled:opacity-40 disabled:pointer-events-none border-2 border-[#111111] shadow-[3px_3px_0_#111111] font-mono text-xs font-bold uppercase flex items-center justify-center gap-1.5"><Undo2 className="w-4 h-4" /> Undo Last</button>
                  <button onClick={() => redoLastScoreChange()} disabled={!canRedo} className="py-2.5 bg-[#F4EFE6] hover:bg-[#FFD60A] disabled:opacity-40 disabled:pointer-events-none border-2 border-[#111111] shadow-[3px_3px_0_#111111] font-mono text-xs font-bold uppercase flex items-center justify-center gap-1.5"><Redo2 className="w-4 h-4" /> Redo</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Score Override modal */}
      <AnimatePresence>
        {showScoreAdjust && (
          <motion.div key="score-adjust" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-[#111111]/70 flex items-center justify-center p-4" onClick={() => setShowScoreAdjust(false)}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="max-w-md w-full bg-[#FFFFFF] border-[3px] border-[#111111] shadow-[8px_8px_0_#111111] rounded-none overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-[#111111] text-[#FFD60A] px-5 py-3 flex items-center justify-between">
                <span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-sm uppercase tracking-wide">± Manual Score Override</span>
                <button onClick={() => setShowScoreAdjust(false)} aria-label="Close" className="bg-[#FF3B1D] text-[#FFFFFF] w-7 h-7 border border-[#FFFFFF] font-mono font-bold flex items-center justify-center">✕</button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#111111]/55 mb-2">Step 1 // Select Contestant</p>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-0.5">
                    {gamePlayers.map((p) => {
                      const selected = adjustPlayerId === p.id;
                      return (
                        <button key={p.id} onClick={() => setAdjustPlayerId(p.id)} className={`border-2 border-[#111111] p-2.5 flex items-center gap-2 text-left transition-all ${selected ? "bg-[#FFD60A] shadow-[3px_3px_0_#111111]" : "bg-[#F4EFE6] hover:bg-[#E5DEC9]"}`}>
                          <PlayerAvatar seed={p.id} avatar={p.avatar} name={p.name} size={28} className="!rounded-none w-7 h-7 border border-[#111111] shrink-0" />
                          <span className="min-w-0 flex-1"><span className="block font-bold text-xs uppercase truncate">{p.name}</span><span className="block font-mono text-[10px] font-bold text-[#111111]/60">{p.score} pts</span></span>
                        </button>
                      );
                    })}
                    {gamePlayers.length === 0 && <p className="col-span-2 font-mono text-xs text-[#111111]/50 uppercase">No contestants</p>}
                  </div>
                </div>

                <div>
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#111111]/55 mb-2">Step 2 // Point Amount</p>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[100, 200, 300, 500].map((v) => (
                      <button key={v} onClick={() => setAdjustAmount(String(v))} className={`font-mono font-bold border-2 border-[#111111] py-2 text-sm ${adjustAmount === String(v) ? "bg-[#FFD60A] shadow-[2px_2px_0_#111111]" : "bg-[#F4EFE6] hover:bg-[#FFD60A]"}`}>{v}</button>
                    ))}
                  </div>
                  <input type="number" min={1} value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} className="bg-[#F4EFE6] border-2 border-[#111111] px-3 py-2 font-['Archivo_Black'] text-lg w-full outline-none focus:bg-white" placeholder="Custom amount" />
                </div>

                <div>
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#111111]/55 mb-2">Step 3 // Apply Adjustment</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => applyScoreAdjust(-1)}
                      disabled={!adjustPlayerId || !(parseInt(adjustAmount || "0", 10) > 0)}
                      className="py-3 bg-[#FF3B1D] hover:bg-[#E02E12] disabled:opacity-40 disabled:pointer-events-none text-[#FFFFFF] font-['Archivo_Black'] text-xs sm:text-sm border-2 border-[#111111] shadow-[3px_3px_0_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none uppercase"
                    >− Subtract Points</button>
                    <button
                      onClick={() => applyScoreAdjust(1)}
                      disabled={!adjustPlayerId || !(parseInt(adjustAmount || "0", 10) > 0)}
                      className="py-3 bg-[#00C271] hover:bg-[#00A862] disabled:opacity-40 disabled:pointer-events-none text-[#111111] font-['Archivo_Black'] text-xs sm:text-sm border-2 border-[#111111] shadow-[3px_3px_0_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none uppercase"
                    >+ Add Points</button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {room.phase === "starting" && <StartCountdown startAt={room.startAt} />}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <QrJoinModal open={showQR} onClose={() => setShowQR(false)} roomId={room.id} />
    </div>
  );
};
