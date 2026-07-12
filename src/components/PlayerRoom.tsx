import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoom } from '../context/RoomContext';
import { Zap, Trophy, Crown, LogOut, Users } from 'lucide-react';
import { soundManager } from '../utils/sound';
import { db } from '../firebase';
import { ref, get } from 'firebase/database';
import type { Quiz } from '../types/jeopardy';
import { PlayerAvatar } from '../utils/playerAvatar';

const getGridColsClass = (count: number) => {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-3';
  if (count === 4) return 'grid-cols-4';
  if (count === 5) return 'grid-cols-5';
  return 'grid-cols-6';
};

interface PlayerRoomProps {
  onLeave: () => void;
}

export const PlayerRoom: React.FC<PlayerRoomProps> = ({ onLeave }) => {
  const { room, myId, myName, buzz, leaveRoom } = useRoom();
  const [quiz, setQuiz] = useState<Quiz | null>(null);

  const myPlayer = room?.players?.[myId];
  const hasBuzzed = !!room?.buzzes?.[myId];
  const sortedBuzzes = Object.entries(room?.buzzes || {}).sort((a, b) => a[1] - b[1]);

  useEffect(() => {
    if (!room?.quizId) return;
    const fetchQuiz = async () => {
      const snap = await get(ref(db, `quizzes/${room.quizId}`));
      if (snap.exists()) setQuiz(snap.val());
    };
    fetchQuiz();
  }, [room?.quizId]);

  const handleBuzz = async () => {
    if (hasBuzzed || room?.phase !== 'buzzing') return;
    soundManager.playBuzzer();
    await buzz();
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
    <div className="min-h-screen flex flex-col select-none">
      {/* Top bar */}
      <header className="glass-panel sticky top-0 z-40 px-5 py-3 flex items-center justify-between rounded-b-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary-accent/15 border border-primary-accent/20 flex items-center justify-center">
            <span className="font-display font-extrabold text-sm text-text-main">Q</span>
          </div>
          <div>
            <p className="font-bold text-sm text-text-main leading-none">{myName}</p>
            <p className="text-[10px] text-text-muted">Room: <span className="font-bold text-primary-accent tracking-widest">{room.id}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-card-bg border border-white/5 font-display font-extrabold text-base text-text-main">
            {myPlayer?.score ?? 0} <span className="text-xs font-sans font-normal text-text-muted">pts</span>
          </div>
          <button onClick={handleLeave} title="Leave room" aria-label="Leave room" className="p-2 rounded-xl bg-card-bg border border-white/5 text-text-muted hover:text-text-main transition">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start px-4 py-6 gap-6 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">

          {/* LOBBY — waiting */}
          {room.phase === 'lobby' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-5 py-12 text-center w-full"
            >
              <div className="w-16 h-16 rounded-2xl bg-card-bg border border-white/5 flex items-center justify-center">
                <Users className="w-8 h-8 text-primary-accent" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-main">Waiting for host…</h2>
                <p className="text-sm text-text-muted mt-2">You're in. Players will appear here as the room fills up.</p>
              </div>
              <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                <AnimatePresence>
                  {players.map((p, index) => (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.18) }}
                      className={`rounded-2xl border p-3 text-left ${p.id === myId ? 'bg-primary-accent/8 border-primary-accent/25' : 'bg-card-bg/50 border-white/5'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <PlayerAvatar seed={p.id} name={p.name} size={40} className="shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-main truncate">{p.name} {p.id === myId && <span className="text-[10px] text-primary-accent">(you)</span>}</p>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted mt-1">Waiting</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* BOARD — show read-only board while host picks a question */}
          {room.phase === 'board' && (
            <motion.div
              key="board"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full space-y-6"
            >
              <div className="glass-panel p-4 rounded-2xl text-center">
                <p className="text-sm text-text-muted">Host is selecting a question…</p>
              </div>
              
              {/* Render the read-only board if we fetched the quiz */}
              {quiz && (
                <div className={`grid gap-2 ${getGridColsClass(quiz.categories.length)}`}>
                  {quiz.categories.map((cat) => (
                    <div key={cat.id} className="glass-panel p-2 rounded-xl text-center font-bold text-[10px] text-text-main uppercase tracking-wide min-h-10 flex items-center justify-center">
                      {cat.name}
                    </div>
                  ))}
                  {Array.from({ length: (quiz.categories[0]?.questions.length ?? 5) }).map((_, rowIdx) =>
                    quiz.categories.map((cat) => {
                      const q = cat.questions[rowIdx];
                      if (!q) return <div key={`${cat.id}-${rowIdx}`} />;
                      const done = !!room.completedQuestions?.[q.id];
                      return (
                        <div key={q.id} className={`glass-panel rounded-xl p-2 font-bold text-sm text-center flex items-center justify-center min-h-11 ${done ? 'opacity-20' : 'text-[#FACC15]'}`}>
                          {done ? '' : `$${q.value}`}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              <div className="glass-panel p-4 rounded-2xl space-y-3">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Scores</p>
                {players.map((p, i) => (
                  <div key={p.id} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${p.id === myId ? 'bg-primary-accent/10 border-primary-accent/30' : 'bg-card-bg/30 border-white/5'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {i === 0 && p.score > 0 ? <Crown className="w-3.5 h-3.5 text-[#FACC15] fill-[#FACC15]" /> : <span className="text-[10px] text-text-muted w-3.5 text-center">#{i + 1}</span>}
                      <PlayerAvatar seed={p.id} name={p.name} size={24} className="shrink-0" />
                      <span className="font-semibold text-sm text-text-main truncate">{p.name} {p.id === myId && <span className="text-primary-accent text-[10px]">(you)</span>}</span>
                    </div>
                    <span className="font-display font-extrabold text-text-main">{p.score}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* BUZZING — big buzz button + list of buzzes */}
          {room.phase === 'buzzing' && room.activeQuestion && (
            <motion.div
              key="buzzing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-lg mx-auto space-y-4"
            >
              <div className="glass-panel p-6 rounded-2xl text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{room.activeQuestion.categoryName}</span>
                  <span className="font-display font-extrabold text-[#FACC15]">${room.activeQuestion.value}</span>
                </div>
                {room.activeQuestion.mediaUrl && room.activeQuestion.type !== 'text' && (
                  <img src={room.activeQuestion.mediaUrl} alt="" className="max-h-36 mx-auto rounded-xl object-contain" />
                )}
                <p className="text-lg font-display font-semibold text-text-main leading-relaxed">{room.activeQuestion.text}</p>
              </div>

              {!hasBuzzed ? (
                /* Buzz button */
                <div className="flex flex-col items-center gap-3">
                  <motion.button
                    onClick={handleBuzz}
                    disabled={hasBuzzed}
                    whileTap={{ scale: hasBuzzed ? 1 : 0.93 }}
                    className={`w-48 h-48 rounded-full font-display font-extrabold text-2xl shadow-2xl transition-all duration-150 flex flex-col items-center justify-center gap-2 ${
                      hasBuzzed
                        ? 'bg-text-muted/20 border-2 border-white/10 text-text-muted cursor-not-allowed'
                        : 'bg-linear-to-br from-danger-accent to-[#B91C1C] border-4 border-danger-accent/50 text-white hover:brightness-110 cursor-pointer shadow-danger-accent/30 active:scale-95'
                    }`}
                  >
                    <Zap className={`w-10 h-10 ${hasBuzzed ? '' : 'fill-white/30'}`} />
                    {hasBuzzed ? 'Buzzed!' : 'BUZZ!'}
                  </motion.button>
                  <p className="text-xs text-text-muted">Tap to buzz in first!</p>
                </div>
              ) : (
                /* Buzzed List */
                <div className="glass-panel p-5 rounded-2xl space-y-4">
                  <AnimatePresence>
                    {sortedBuzzes.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="space-y-2"
                      >
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Buzz Order</p>
                        {sortedBuzzes.map(([pId], idx) => {
                          const p = room.players[pId];
                          if (!p) return null;
                          return (
                            <div key={pId} className={`flex items-center gap-3 p-3 rounded-xl border ${idx === 0 ? 'bg-[#FACC15]/10 border-[#FACC15]/40' : 'bg-card-bg border-white/5'}`}>
                              <div className="w-6 text-center font-bold text-text-muted text-xs">#{idx + 1}</div>
                              <PlayerAvatar seed={p.id} name={p.name} size={28} className="shrink-0" />
                              <div className="flex-1">
                                <p className="font-bold text-sm text-text-main">
                                  {idx === 0 ? <span className="text-[#FACC15]">{p.name}</span> : p.name} {pId === myId && <span className="text-[10px] ml-1">(you)</span>}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <p className="text-center text-xs text-text-muted mt-2">Waiting for host to judge...</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ANSWER revealed */}
          {room.phase === 'answer' && room.activeQuestion && (
            <motion.div
              key="answer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-4"
            >
              <div className="glass-panel p-6 rounded-2xl text-center space-y-3">
                <p className="text-base font-display font-semibold text-text-muted">{room.activeQuestion.text}</p>
                <div className="p-4 rounded-xl bg-success-accent/10 border border-success-accent/30">
                  <p className="text-[10px] font-bold text-success-accent uppercase tracking-widest mb-1">Answer</p>
                  <p className="text-xl font-display font-extrabold text-success-accent">{room.activeQuestion.answer}</p>
                </div>
              </div>
              <div className="glass-panel p-4 rounded-xl text-center">
                <p className="text-sm text-text-muted">Waiting for host to continue…</p>
              </div>
            </motion.div>
          )}

          {/* ENDED */}
          {room.phase === 'ended' && (
            <motion.div
              key="ended"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center gap-6 py-8 text-center w-full"
            >
              <Trophy className="w-16 h-16 text-[#FACC15] fill-[#FACC15]/20" />
              <h2 className="text-2xl font-display font-extrabold text-text-main">Game Over!</h2>
              <div className="space-y-2 w-full max-w-xs">
                {players.map((p, i) => (
                  <div key={p.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${i === 0 ? 'bg-[#FACC15]/10 border-[#FACC15]/30' : 'bg-card-bg/30 border-white/5'} ${p.id === myId ? 'ring-1 ring-primary-accent' : ''}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {i === 0 && <Crown className="w-4 h-4 text-[#FACC15] fill-[#FACC15]" />}
                      <PlayerAvatar seed={p.id} name={p.name} size={24} className="shrink-0" />
                      <span className="font-bold text-sm text-text-main truncate">{p.name} {p.id === myId && '(you)'}</span>
                    </div>
                    <span className="font-display font-extrabold text-text-main">{p.score}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleLeave} className="px-6 py-3 rounded-xl bg-primary-accent hover:brightness-110 text-white font-bold text-sm transition">
                Back to Lobby
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
};
