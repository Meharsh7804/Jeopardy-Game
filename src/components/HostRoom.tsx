import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoom } from "../context/RoomContext";
import { useQuizLibrary } from "../context/QuizLibraryContext";
import type { Quiz, Question } from "../types/jeopardy";
import {
  Users,
  Copy,
  Check,
  Play,
  Crown,
  Eye,
  X,
  ChevronRight,
  LogOut,
  Scissors,
  UserX,
  Info,
} from "lucide-react";
import { soundManager } from "../utils/sound";
import { PlayerAvatar } from "../utils/playerAvatar";

const getGridColsClass = (count: number) => {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  if (count === 3) return "grid-cols-3";
  if (count === 4) return "grid-cols-4";
  if (count === 5) return "grid-cols-5";
  return "grid-cols-6";
};

interface HostRoomProps {
  onLeave: () => void;
}

export const HostRoom: React.FC<HostRoomProps> = ({ onLeave }) => {
  const {
    room,
    startGame,
    openQuestion,
    judgeAnswer,
    splitPoints,
    revealAnswer,
    closeQuestion,
    endGame,
    kickPlayer,
    leaveRoom,
  } = useRoom();
  const { quizzes } = useQuizLibrary();

  const [copied, setCopied] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  // Fix #5: category description modal
  const [categoryModalId, setCategoryModalId] = useState<string | null>(null);
  // Fix #6: split points — track selected players
  const [splitSelected, setSplitSelected] = useState<string[]>([]);
  const [showSplit, setShowSplit] = useState(false);

  useEffect(() => {
    if (!room) return;
    const found = quizzes.find((q) => q.id === room.quizId) ?? null;
    setQuiz(found);
  }, [room?.quizId, quizzes]);

  useEffect(() => {
    if (!quiz?.categories.length) return;
    setSelectedCategoryId((current) =>
      current && quiz.categories.some((cat) => cat.id === current)
        ? current
        : quiz.categories[0].id,
    );
  }, [quiz]);

  if (!room) return null;

  const players = Object.values(room.players).sort((a, b) => b.score - a.score);
  const gamePlayers = players.filter((p) => !p.isHost);
  const sortedBuzzes = Object.entries(room.buzzes || {}).sort((a, b) => a[1] - b[1]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenQuestion = async (q: Question, catName: string) => {
    soundManager.playReveal();
    await openQuestion(q, catName);
  };

  const selectedCategory = quiz?.categories.find((cat) => cat.id === selectedCategoryId) ?? null;
  const categoryModalData = categoryModalId
    ? quiz?.categories.find((c) => c.id === categoryModalId) ?? null
    : null;

  const handleJudge = async (correct: boolean) => {
    if (correct) soundManager.playCorrect();
    else soundManager.playWrong();
    await judgeAnswer(correct);
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <header className="glass-panel sticky top-0 z-40 px-6 py-3 flex items-center justify-between gap-4 rounded-b-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary-accent/15 border border-primary-accent/20 flex items-center justify-center">
            <span className="font-display font-extrabold text-sm text-text-main">Q</span>
          </div>
          <div>
            <h1 className="font-bold text-base text-text-main leading-none">Buzzing With Quizzing</h1>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Host View</p>
          </div>
        </div>

        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card-bg border border-white/10 cursor-pointer hover:border-primary-accent/30 transition"
          onClick={handleCopyCode}
          title="Click to copy room code"
        >
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Room</span>
          <span className="font-display font-extrabold text-lg tracking-[0.25em] text-primary-accent">{room.id}</span>
          {copied ? <Check className="w-3.5 h-3.5 text-success-accent" /> : <Copy className="w-3.5 h-3.5 text-text-muted" />}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-text-muted bg-card-bg px-2.5 py-1.5 rounded-lg border border-white/5">
            <Users className="w-3.5 h-3.5" />
            {players.length} connected
          </div>
          {room.phase === "lobby" && (
            <button
              onClick={startGame}
              disabled={gamePlayers.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-success-accent text-white font-bold text-xs hover:brightness-110 transition disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start Game
            </button>
          )}
          {["board", "question", "buzzing", "judging", "answer"].includes(room.phase) && (
            <button
              onClick={endGame}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card-bg border border-white/5 text-danger-accent text-xs font-semibold hover:bg-danger-accent/10 transition"
            >
              End Game
            </button>
          )}
          <button
            onClick={handleLeave}
            className="p-2 rounded-xl bg-card-bg border border-white/5 text-text-muted hover:text-text-main transition"
            title="Leave room"
            aria-label="Leave room"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* ── Left: Players / Leaderboard ──────────────────────────────── */}
        <aside className="w-56 shrink-0 border-r border-white/5 flex flex-col gap-0 overflow-y-auto">
          <div className="p-4 border-b border-white/5">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Leaderboard</p>
            <div className="space-y-2">
              {gamePlayers.map((p, i) => (
                <motion.div
                  key={p.id}
                  layout
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className={`flex items-center justify-between p-2.5 rounded-xl border ${
                    sortedBuzzes[0]?.[0] === p.id
                      ? "bg-[#FACC15]/10 border-[#FACC15]/40"
                      : "bg-card-bg/30 border-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {i === 0 && p.score > 0 ? (
                      <Crown className="w-3.5 h-3.5 text-[#FACC15] fill-[#FACC15] shrink-0" />
                    ) : (
                      <span className="text-[10px] text-text-muted font-bold w-3.5 text-center shrink-0">#{i + 1}</span>
                    )}
                    <PlayerAvatar seed={p.id} name={p.name} size={24} className="shrink-0" />
                    <span className="font-semibold text-xs text-text-main truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-display font-extrabold text-sm text-text-main">{p.score}</span>
                    {/* Fix #6: Kick button */}
                    <button
                      onClick={() => handleKick(p.id)}
                      title="Kick player"
                      className="p-0.5 rounded text-text-muted hover:text-danger-accent transition opacity-40 hover:opacity-100"
                    >
                      <UserX className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              ))}
              {gamePlayers.length === 0 && (
                <p className="text-xs text-text-muted italic text-center py-2">No players yet</p>
              )}
            </div>
          </div>

          {room.phase === "lobby" && (
            <div className="p-4 space-y-2">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Share with players</p>
              <p className="text-xs text-text-muted leading-relaxed">Tell players to visit this site and enter code:</p>
              <div
                onClick={handleCopyCode}
                className="text-center py-3 rounded-xl bg-primary-accent/10 border border-primary-accent/20 cursor-pointer hover:bg-primary-accent/20 transition"
              >
                <span className="font-display font-extrabold text-2xl tracking-[0.3em] text-primary-accent">{room.id}</span>
              </div>
              <p className="text-[10px] text-text-muted text-center">Click to copy</p>
            </div>
          )}
        </aside>

        {/* ── Main area ─────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {/* LOBBY */}
            {room.phase === "lobby" && (
              <motion.div
                key="lobby"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center"
              >
                <div className="p-5 rounded-2xl bg-card-bg/40 border border-white/5 inline-flex">
                  <Users className="w-10 h-10 text-primary-accent" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-main">Waiting for Players</h2>
                  <p className="text-text-muted text-sm mt-2">
                    Share room code{" "}
                    <span className="font-display font-bold text-primary-accent tracking-widest">{room.id}</span>{" "}
                    with your players.
                    <br />
                    Press <strong className="text-text-main">Start Game</strong>{" "}
                    when everyone has joined.
                  </p>
                </div>
                <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {gamePlayers.map((p, index) => (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.18) }}
                      className="rounded-2xl border border-white/5 bg-card-bg/50 p-3 text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <PlayerAvatar seed={p.id} name={p.name} size={40} className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-text-main truncate">{p.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted mt-1">Waiting</p>
                        </div>
                        <span className="text-[10px] font-bold text-text-muted">#{index + 1}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* BOARD */}
            {room.phase === "board" && quiz && (
              <motion.div
                key="board"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-extrabold text-xl text-text-main">{quiz.title}</h2>
                  <span className="text-xs text-text-muted">Click a cell to open a question</span>
                </div>

                <div className={`grid gap-2 ${getGridColsClass(quiz.categories.length)}`}>
                  {/* Category headers — Fix #5: clicking opens modal */}
                  {quiz.categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryModalId(cat.id)}
                      className="glass-panel p-3 rounded-xl text-center font-bold text-xs text-text-main uppercase tracking-wide min-h-15 flex items-center justify-center gap-1 transition hover:bg-primary-accent/10"
                    >
                      {cat.name}
                      {cat.description?.trim() && <Info className="w-3 h-3 text-text-muted shrink-0" />}
                    </button>
                  ))}

                  {Array.from({ length: quiz.categories[0]?.questions.length ?? 5 }).map((_, rowIdx) =>
                    quiz.categories.map((cat) => {
                      const q = cat.questions[rowIdx];
                      if (!q) return <div key={`${cat.id}-${rowIdx}`} />;
                      const done = !!room.completedQuestions?.[q.id];
                      return (
                        <button
                          key={q.id}
                          disabled={done}
                          onClick={() => handleOpenQuestion(q, cat.name)}
                          className={`glass-panel rounded-xl p-4 font-bold text-xl text-center transition-all duration-200 min-h-17.5 flex items-center justify-center ${
                            done
                              ? "opacity-20 cursor-not-allowed"
                              : "text-[#FACC15] hover:bg-primary-accent/20 hover:scale-[1.03] cursor-pointer shadow hover:shadow-primary-accent/20"
                          }`}
                        >
                          {done ? "" : `$${q.value}`}
                        </button>
                      );
                    }),
                  )}
                </div>
              </motion.div>
            )}

            {/* QUESTION / BUZZING / ANSWER */}
            {["buzzing", "answer"].includes(room.phase) && room.activeQuestion && (
              <motion.div
                key="question"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-2xl mx-auto space-y-6"
              >
                {/* Question card */}
                <div className="glass-panel p-8 rounded-2xl text-center space-y-5 relative">
                  <div className="flex items-center justify-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-card-bg border border-white/10 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                      {room.activeQuestion.categoryName}
                    </span>
                    <span className="font-display font-extrabold text-[#FACC15] text-lg">
                      ${room.activeQuestion.value}
                    </span>
                  </div>

                  {room.activeQuestion.mediaUrl && room.activeQuestion.type !== "text" && (
                    <img
                      src={room.activeQuestion.mediaUrl}
                      alt="Question media"
                      className="max-h-48 mx-auto rounded-xl object-contain"
                    />
                  )}

                  {/* Fix #4: preserve line breaks with whitespace-pre-wrap */}
                  <p className="text-xl sm:text-2xl font-display font-semibold text-text-main leading-relaxed whitespace-pre-wrap">
                    {room.activeQuestion.text}
                  </p>

                  {room.activeQuestion.revealAnswer && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 rounded-xl bg-success-accent/10 border border-success-accent/30"
                    >
                      <p className="text-[10px] font-bold text-success-accent uppercase tracking-widest mb-1">Answer</p>
                      {/* Fix #4: preserve line breaks in answer too */}
                      <p className="text-lg font-display font-extrabold text-success-accent whitespace-pre-wrap">
                        {room.activeQuestion.answer}
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Buzz status + controls */}
                <div className="glass-panel p-5 rounded-2xl space-y-4">
                  <AnimatePresence>
                    {sortedBuzzes.length > 0 ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Buzz Order</p>
                          {/* Fix #6: Split points toggle */}
                          <button
                            onClick={() => { setShowSplit(!showSplit); setSplitSelected([]); }}
                            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-primary-accent transition font-bold uppercase tracking-widest"
                          >
                            <Scissors className="w-3 h-3" />
                            Split Points
                          </button>
                        </div>

                        {/* Fix #6: Split points player selector */}
                        {showSplit && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 rounded-xl bg-card-bg border border-white/10 space-y-2"
                          >
                            <p className="text-[10px] text-text-muted">Select players to split ${room.activeQuestion.value} between:</p>
                            <div className="space-y-1">
                              {gamePlayers.map((p) => (
                                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={splitSelected.includes(p.id)}
                                    onChange={(e) =>
                                      setSplitSelected((prev) =>
                                        e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                                      )
                                    }
                                    className="accent-primary-accent"
                                  />
                                  <span className="text-xs text-text-main">{p.name}</span>
                                  <span className="text-xs text-text-muted">({p.score} pts)</span>
                                </label>
                              ))}
                            </div>
                            <button
                              disabled={splitSelected.length === 0}
                              onClick={handleSplit}
                              className="w-full py-2 rounded-lg bg-primary-accent text-white font-bold text-xs hover:brightness-110 transition disabled:opacity-40"
                            >
                              Award Split (+{splitSelected.length > 0 ? Math.round((room.activeQuestion.value ?? 0) / splitSelected.length) : "?"} each)
                            </button>
                          </motion.div>
                        )}

                        {sortedBuzzes.map(([pId], idx) => {
                          const p = room.players[pId];
                          if (!p) return null;
                          return (
                            <div
                              key={pId}
                              className={`flex items-center gap-3 p-3 rounded-xl border ${idx === 0 ? "bg-[#FACC15]/10 border-[#FACC15]/40" : "bg-card-bg border-white/5"}`}
                            >
                              <div className="w-6 text-center font-bold text-text-muted text-xs">#{idx + 1}</div>
                              <PlayerAvatar seed={p.id} name={p.name} size={28} className="shrink-0" />
                              <div className="flex-1">
                                <p className="font-bold text-sm text-text-main">
                                  {idx === 0 ? <span className="text-[#FACC15]">{p.name}</span> : p.name}
                                </p>
                                <p className="text-xs text-text-muted">Score: {p.score} pts</p>
                              </div>
                              {idx === 0 && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleJudge(true)}
                                    className="p-2 rounded-lg bg-success-accent hover:brightness-110 text-white transition flex items-center justify-center"
                                    title="Correct"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleJudge(false)}
                                    className="p-2 rounded-lg bg-danger-accent hover:brightness-110 text-white transition flex items-center justify-center"
                                    title="Wrong"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </motion.div>
                    ) : (
                      <div className="text-center p-4 border border-white/10 border-dashed rounded-xl">
                        <p className="text-sm text-text-muted animate-pulse">Waiting for players to buzz in...</p>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Host action buttons */}
                  <div className="flex flex-wrap gap-3">
                    {!room.activeQuestion.revealAnswer && (
                      <button
                        onClick={revealAnswer}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl bg-card-bg border border-white/10 text-text-muted hover:text-text-main text-sm font-semibold transition"
                      >
                        <Eye className="w-4 h-4" />
                        Reveal Answer
                      </button>
                    )}
                    <button
                      onClick={closeQuestion}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-card-bg border border-white/10 text-text-muted hover:text-text-main text-sm font-semibold transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                      Next Question
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ENDED */}
            {room.phase === "ended" && (
              <motion.div
                key="ended"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center"
              >
                <h2 className="text-3xl font-display font-extrabold text-text-main">Game Over!</h2>
                <div className="space-y-2 w-full max-w-sm">
                  {gamePlayers.map((p, i) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                        i === 0 ? "bg-[#FACC15]/10 border-[#FACC15]/30" : "bg-card-bg/30 border-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <PlayerAvatar seed={p.id} name={p.name} size={24} className="shrink-0" />
                        <span className="font-bold text-sm text-text-main truncate">{p.name}</span>
                      </div>
                      <span className="font-display font-extrabold text-text-main">{p.score}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleLeave}
                  className="px-6 py-3 rounded-xl bg-primary-accent hover:brightness-110 text-white font-bold text-sm transition"
                >
                  Back to Lobby
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Fix #5: Category description modal */}
      <AnimatePresence>
        {categoryModalData && (
          <motion.div
            key="cat-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setCategoryModalId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="glass-panel rounded-2xl p-6 max-w-md w-full space-y-3 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setCategoryModalId(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-card-bg border border-white/10 text-text-muted hover:text-text-main transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <p className="text-[10px] font-bold text-primary-accent uppercase tracking-widest">Category</p>
              <h3 className="text-xl font-display font-extrabold text-text-main pr-8">{categoryModalData.name}</h3>
              <p className="text-sm text-text-muted leading-relaxed whitespace-pre-wrap">
                {categoryModalData.description?.trim() || "No description added for this category."}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
