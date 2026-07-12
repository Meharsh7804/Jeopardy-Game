import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoom } from '../context/RoomContext';
import { Zap, Trophy, Crown, LogOut, Users } from 'lucide-react';
import { soundManager } from '../utils/sound';

interface PlayerRoomProps {
  onLeave: () => void;
}

export const PlayerRoom: React.FC<PlayerRoomProps> = ({ onLeave }) => {
  const { room, myId, myName, buzz, leaveRoom } = useRoom();
  const [buzzed, setBuzzed] = useState(false);

  const myPlayer = room?.players?.[myId];
  const buzzedPlayer = room?.buzz ? room.players[room.buzz.playerId] : null;
  const iMyBuzz = room?.buzz?.playerId === myId;

  // Reset buzzed state when a new question opens
  useEffect(() => {
    if (room?.phase === 'question' || room?.phase === 'board') {
      setBuzzed(false);
    }
  }, [room?.phase, room?.activeQuestion?.questionId]);

  const handleBuzz = async () => {
    if (buzzed || room?.phase !== 'buzzing') return;
    setBuzzed(true);
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
      <header className="glass-panel sticky top-0 z-40 px-5 py-3 flex items-center justify-between rounded-b-2xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-accent to-secondary-accent flex items-center justify-center">
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
          <button onClick={handleLeave} className="p-2 rounded-xl bg-card-bg border border-white/5 text-text-muted hover:text-text-main transition">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start px-4 py-6 gap-6 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">

          {/* LOBBY — waiting */}
          {room.phase === 'lobby' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-4 py-16 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-card-bg/60 border border-white/10 flex items-center justify-center">
                <Users className="w-8 h-8 text-primary-accent" />
              </div>
              <h2 className="text-xl font-display font-extrabold text-text-main">Waiting for host…</h2>
              <p className="text-sm text-text-muted">You're in! The host will start the game shortly.</p>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {players.map((p) => (
                  <span key={p.id} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${p.id === myId ? 'bg-primary-accent/20 border-primary-accent text-primary-accent' : 'bg-card-bg border-white/10 text-text-muted'}`}>
                    {p.name} {p.id === myId && '(you)'}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* BOARD — show read-only scoreboard while host picks a question */}
          {room.phase === 'board' && (
            <motion.div
              key="board"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full space-y-4"
            >
              <div className="glass-panel p-4 rounded-2xl text-center">
                <p className="text-sm text-text-muted">Host is selecting a question…</p>
              </div>
              <div className="glass-panel p-4 rounded-2xl space-y-3">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Scores</p>
                {players.map((p, i) => (
                  <div key={p.id} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${p.id === myId ? 'bg-primary-accent/10 border-primary-accent/30' : 'bg-card-bg/30 border-white/5'}`}>
                    <div className="flex items-center gap-2">
                      {i === 0 && p.score > 0 ? <Crown className="w-3.5 h-3.5 text-[#FACC15] fill-[#FACC15]" /> : <span className="text-[10px] text-text-muted w-3.5 text-center">#{i + 1}</span>}
                      <span className="font-semibold text-sm text-text-main">{p.name} {p.id === myId && <span className="text-primary-accent text-[10px]">(you)</span>}</span>
                    </div>
                    <span className="font-display font-extrabold text-text-main">{p.score}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* QUESTION — show the clue, no buzzing yet */}
          {room.phase === 'question' && room.activeQuestion && (
            <motion.div
              key="question"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-4"
            >
              <div className="glass-panel p-6 rounded-2xl text-center space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{room.activeQuestion.categoryName}</span>
                  <span className="font-display font-extrabold text-[#FACC15]">${room.activeQuestion.value}</span>
                </div>
                {room.activeQuestion.mediaUrl && room.activeQuestion.type !== 'text' && (
                  <img src={room.activeQuestion.mediaUrl} alt="" className="max-h-40 mx-auto rounded-xl object-contain" />
                )}
                <p className="text-lg font-display font-semibold text-text-main leading-relaxed">{room.activeQuestion.text}</p>
              </div>
              <div className="glass-panel p-4 rounded-2xl text-center">
                <p className="text-sm text-text-muted animate-pulse">Waiting for host to open buzzers…</p>
              </div>
            </motion.div>
          )}

          {/* BUZZING — big buzz button! */}
          {room.phase === 'buzzing' && room.activeQuestion && (
            <motion.div
              key="buzzing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-4"
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

              {/* Buzz button */}
              <div className="flex flex-col items-center gap-3">
                <motion.button
                  onClick={handleBuzz}
                  disabled={buzzed}
                  whileTap={{ scale: buzzed ? 1 : 0.93 }}
                  className={`w-48 h-48 rounded-full font-display font-extrabold text-2xl shadow-2xl transition-all duration-150 flex flex-col items-center justify-center gap-2 ${
                    buzzed
                      ? 'bg-text-muted/20 border-2 border-white/10 text-text-muted cursor-not-allowed'
                      : 'bg-gradient-to-br from-danger-accent to-[#B91C1C] border-4 border-danger-accent/50 text-white hover:brightness-110 cursor-pointer shadow-danger-accent/30 active:scale-95'
                  }`}
                >
                  <Zap className={`w-10 h-10 ${buzzed ? '' : 'fill-white/30'}`} />
                  {buzzed ? 'Buzzed!' : 'BUZZ!'}
                </motion.button>
                <p className="text-xs text-text-muted">{buzzed ? 'You buzzed! Waiting for host…' : 'Tap to buzz in first!'}</p>
              </div>
            </motion.div>
          )}

          {/* JUDGING — someone buzzed */}
          {room.phase === 'judging' && room.activeQuestion && (
            <motion.div
              key="judging"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-4"
            >
              <div className="glass-panel p-6 rounded-2xl text-center space-y-3">
                <p className="text-lg font-display font-semibold text-text-main">{room.activeQuestion.text}</p>
              </div>

              {iMyBuzz ? (
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="glass-panel p-6 rounded-2xl text-center space-y-2 border-[#FACC15]/40 bg-[#FACC15]/5"
                >
                  <Zap className="w-8 h-8 text-[#FACC15] fill-[#FACC15] mx-auto" />
                  <p className="font-display font-extrabold text-lg text-[#FACC15]">You buzzed first!</p>
                  <p className="text-sm text-text-muted">Host is judging your answer…</p>
                </motion.div>
              ) : (
                <div className="glass-panel p-5 rounded-2xl text-center">
                  <p className="text-sm text-text-muted">
                    <span className="font-bold text-text-main">{buzzedPlayer?.name ?? 'Someone'}</span> buzzed first.
                    <br />Waiting for host to judge…
                  </p>
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
                    <div className="flex items-center gap-2">
                      {i === 0 && <Crown className="w-4 h-4 text-[#FACC15] fill-[#FACC15]" />}
                      <span className="font-bold text-sm text-text-main">{p.name} {p.id === myId && '(you)'}</span>
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
