import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoom } from '../context/RoomContext';
import { useQuizLibrary } from '../context/QuizLibraryContext';
import type { Quiz, Question } from '../types/jeopardy';
import {
  Users, Copy, Check, Play, Trophy, Crown,
  Zap, Eye, X, ChevronRight, LogOut,
} from 'lucide-react';
import { soundManager } from '../utils/sound';

interface HostRoomProps {
  onLeave: () => void;
}

export const HostRoom: React.FC<HostRoomProps> = ({ onLeave }) => {
  const { room, startGame, openQuestion, enableBuzzing, judgeAnswer, revealAnswer, closeQuestion, endGame, leaveRoom } = useRoom();
  const { quizzes } = useQuizLibrary();

  const [copied, setCopied] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);

  // Find quiz from library by room.quizId
  useEffect(() => {
    if (!room) return;
    const found = quizzes.find((q) => q.id === room.quizId) ?? null;
    setQuiz(found);
  }, [room?.quizId, quizzes]);

  if (!room) return null;

  const players = Object.values(room.players).sort((a, b) => b.score - a.score);
  const gamePlayers = players.filter((p) => !p.isHost);
  const buzzedPlayer = room.buzz ? room.players[room.buzz.playerId] : null;

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

  const handleJudge = async (correct: boolean) => {
    if (correct) soundManager.playCorrect();
    else soundManager.playWrong();
    await judgeAnswer(correct);
  };

  const handleLeave = () => {
    leaveRoom();
    onLeave();
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="glass-panel sticky top-0 z-40 px-6 py-3 flex items-center justify-between gap-4 rounded-b-2xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-accent to-secondary-accent flex items-center justify-center">
            <span className="font-display font-extrabold text-sm text-text-main">Q</span>
          </div>
          <div>
            <h1 className="font-display font-extrabold text-base text-text-main leading-none">Buzzing With Quizzing</h1>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Host View</p>
          </div>
        </div>

        {/* Room code pill */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card-bg border border-white/10 cursor-pointer hover:border-primary-accent/40 transition"
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
          {room.phase === 'lobby' && (
            <button
              onClick={startGame}
              disabled={gamePlayers.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-success-accent text-white font-bold text-xs hover:brightness-110 transition disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start Game
            </button>
          )}
          {['board', 'question', 'buzzing', 'judging', 'answer'].includes(room.phase) && (
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
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* ── Left: Players / Leaderboard ─────────────────────────────────── */}
        <aside className="w-56 shrink-0 border-r border-white/5 flex flex-col gap-0 overflow-y-auto">
          <div className="p-4 border-b border-white/5">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Leaderboard</p>
            <div className="space-y-2">
              {gamePlayers.map((p, i) => (
                <motion.div
                  key={p.id}
                  layout
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className={`flex items-center justify-between p-2.5 rounded-xl border ${
                    buzzedPlayer?.id === p.id
                      ? 'bg-[#FACC15]/10 border-[#FACC15]/40'
                      : 'bg-card-bg/30 border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {i === 0 && p.score > 0 ? (
                      <Crown className="w-3.5 h-3.5 text-[#FACC15] fill-[#FACC15] shrink-0" />
                    ) : (
                      <span className="text-[10px] text-text-muted font-bold w-3.5 text-center shrink-0">#{i + 1}</span>
                    )}
                    <span className="font-semibold text-xs text-text-main truncate">{p.name}</span>
                  </div>
                  <span className="font-display font-extrabold text-sm text-text-main shrink-0">{p.score}</span>
                </motion.div>
              ))}
              {gamePlayers.length === 0 && (
                <p className="text-xs text-text-muted italic text-center py-2">No players yet</p>
              )}
            </div>
          </div>

          {/* Share instructions */}
          {room.phase === 'lobby' && (
            <div className="p-4 space-y-2">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Share with players</p>
              <p className="text-xs text-text-muted leading-relaxed">
                Tell players to visit this site and enter code:
              </p>
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

        {/* ── Main area ───────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {/* LOBBY */}
            {room.phase === 'lobby' && (
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
                  <h2 className="text-2xl font-display font-extrabold text-text-main">Waiting for Players</h2>
                  <p className="text-text-muted text-sm mt-2">
                    Share room code <span className="font-display font-bold text-primary-accent tracking-widest">{room.id}</span> with your players.
                    <br />
                    Press <strong className="text-text-main">Start Game</strong> when everyone has joined.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {gamePlayers.map((p) => (
                    <div key={p.id} className="px-3 py-1.5 rounded-full bg-card-bg border border-white/10 text-xs font-semibold text-text-main">
                      {p.name}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* BOARD */}
            {room.phase === 'board' && quiz && (
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

                {/* Board grid */}
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${quiz.categories.length}, minmax(0, 1fr))` }}
                >
                  {/* Category headers */}
                  {quiz.categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="glass-panel p-3 rounded-xl text-center font-display font-extrabold text-xs text-text-main uppercase tracking-wide min-h-[60px] flex items-center justify-center"
                    >
                      {cat.name}
                    </div>
                  ))}

                  {/* Question cells — render row by row */}
                  {Array.from({ length: (quiz.categories[0]?.questions.length ?? 5) }).map((_, rowIdx) =>
                    quiz.categories.map((cat) => {
                      const q = cat.questions[rowIdx];
                      if (!q) return <div key={`${cat.id}-${rowIdx}`} />;
                      const done = !!room.completedQuestions?.[q.id];
                      return (
                        <button
                          key={q.id}
                          disabled={done}
                          onClick={() => handleOpenQuestion(q, cat.name)}
                          className={`glass-panel rounded-xl p-4 font-display font-extrabold text-xl text-center transition-all duration-200 min-h-[70px] flex items-center justify-center ${
                            done
                              ? 'opacity-20 cursor-not-allowed'
                              : 'text-[#FACC15] hover:bg-primary-accent/20 hover:scale-[1.03] cursor-pointer shadow hover:shadow-primary-accent/20'
                          }`}
                        >
                          {done ? '' : `$${q.value}`}
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* QUESTION / BUZZING / JUDGING / ANSWER */}
            {['question', 'buzzing', 'judging', 'answer'].includes(room.phase) && room.activeQuestion && (
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
                    <span className="font-display font-extrabold text-[#FACC15] text-lg">${room.activeQuestion.value}</span>
                  </div>

                  {room.activeQuestion.mediaUrl && room.activeQuestion.type !== 'text' && (
                    <img
                      src={room.activeQuestion.mediaUrl}
                      alt="Question media"
                      className="max-h-48 mx-auto rounded-xl object-contain"
                    />
                  )}

                  <p className="text-xl sm:text-2xl font-display font-semibold text-text-main leading-relaxed">
                    {room.activeQuestion.text}
                  </p>

                  {room.activeQuestion.revealAnswer && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 rounded-xl bg-success-accent/10 border border-success-accent/30"
                    >
                      <p className="text-[10px] font-bold text-success-accent uppercase tracking-widest mb-1">Answer</p>
                      <p className="text-lg font-display font-extrabold text-success-accent">{room.activeQuestion.answer}</p>
                    </motion.div>
                  )}
                </div>

                {/* Buzz status + controls */}
                <div className="glass-panel p-5 rounded-2xl space-y-4">
                  {/* Buzz indicator */}
                  <AnimatePresence>
                    {buzzedPlayer && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex items-center gap-3 p-4 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/40"
                      >
                        <Zap className="w-5 h-5 text-[#FACC15] fill-[#FACC15]" />
                        <div>
                          <p className="font-bold text-sm text-text-main">
                            <span className="text-[#FACC15]">{buzzedPlayer.name}</span> buzzed first!
                          </p>
                          <p className="text-xs text-text-muted">Current score: {buzzedPlayer.score} pts</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Host action buttons */}
                  <div className="flex flex-wrap gap-3">
                    {/* Enable buzzing */}
                    {room.phase === 'question' && (
                      <button
                        onClick={enableBuzzing}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-accent hover:brightness-110 text-white font-bold text-sm transition"
                      >
                        <Zap className="w-4 h-4" />
                        Open Buzzers
                      </button>
                    )}

                    {/* Judge buttons — shown when someone buzzed */}
                    {room.phase === 'judging' && buzzedPlayer && (
                      <>
                        <button
                          onClick={() => handleJudge(true)}
                          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-success-accent hover:brightness-110 text-white font-bold text-sm transition"
                        >
                          <Check className="w-4 h-4" />
                          Correct (+${room.activeQuestion.value})
                        </button>
                        <button
                          onClick={() => handleJudge(false)}
                          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-danger-accent hover:brightness-110 text-white font-bold text-sm transition"
                        >
                          <X className="w-4 h-4" />
                          Wrong (-${room.activeQuestion.value})
                        </button>
                      </>
                    )}

                    {/* Reveal answer */}
                    {!room.activeQuestion.revealAnswer && (
                      <button
                        onClick={revealAnswer}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl bg-card-bg border border-white/10 text-text-muted hover:text-text-main text-sm font-semibold transition"
                      >
                        <Eye className="w-4 h-4" />
                        Reveal Answer
                      </button>
                    )}

                    {/* Close / skip question */}
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
            {room.phase === 'ended' && (
              <motion.div
                key="ended"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center"
              >
                <Trophy className="w-16 h-16 text-[#FACC15] fill-[#FACC15]/20" />
                <h2 className="text-3xl font-display font-extrabold text-text-main">Game Over!</h2>
                <div className="space-y-2 w-full max-w-sm">
                  {gamePlayers.map((p, i) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                        i === 0 ? 'bg-[#FACC15]/10 border-[#FACC15]/30' : 'bg-card-bg/30 border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {i === 0 && <Crown className="w-4 h-4 text-[#FACC15] fill-[#FACC15]" />}
                        <span className="font-bold text-sm text-text-main">{p.name}</span>
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
    </div>
  );
};
