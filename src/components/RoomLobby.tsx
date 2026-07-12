import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoom } from '../context/RoomContext';
import { useQuizLibrary } from '../context/QuizLibraryContext';
import type { Quiz } from '../types/jeopardy';
import { Play, LogIn, BookOpen, Plus, ChevronRight, Zap, Loader2 } from 'lucide-react';

interface RoomLobbyProps {
  onHostEntersRoom: () => void;
  onPlayerEntersRoom: () => void;
  onCreateQuiz: () => void;
  onEditQuiz: (quiz: Quiz) => void;
}

type LobbyTab = 'home' | 'host' | 'join';

export const RoomLobby: React.FC<RoomLobbyProps> = ({
  onHostEntersRoom,
  onPlayerEntersRoom,
  onCreateQuiz,
  onEditQuiz,
}) => {
  const { createRoom, joinRoom, loading, error } = useRoom();
  const { quizzes } = useQuizLibrary();

  const [tab, setTab] = useState<LobbyTab>('home');
  const [hostName, setHostName] = useState('');
  const [selectedQuizId, setSelectedQuizId] = useState<string>(quizzes[0]?.id ?? '');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [localError, setLocalError] = useState('');

  const selectedQuiz = quizzes.find((q) => q.id === selectedQuizId) ?? quizzes[0];

  const handleHost = async () => {
    setLocalError('');
    if (!hostName.trim()) { setLocalError('Please enter your host name.'); return; }
    if (!selectedQuiz) { setLocalError('Please select a quiz.'); return; }
    try {
      await createRoom(selectedQuiz, hostName.trim());
      onHostEntersRoom();
    } catch (e: any) {
      setLocalError(e.message ?? 'Failed to create room.');
    }
  };

  const handleJoin = async () => {
    setLocalError('');
    if (!playerName.trim()) { setLocalError('Please enter your name.'); return; }
    if (roomCode.trim().length !== 6) { setLocalError('Room code must be 6 characters.'); return; }
    try {
      await joinRoom(roomCode.trim(), playerName.trim());
      onPlayerEntersRoom();
    } catch (e: any) {
      setLocalError(e.message ?? 'Could not join room.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-[300px] h-[300px] bg-secondary-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-accent/10 border border-primary-accent/20 text-xs text-primary-accent font-semibold tracking-widest uppercase mb-2">
            <Zap className="w-3.5 h-3.5" />
            Live Multiplayer
          </div>
          <h1 className="text-5xl font-display font-extrabold text-text-main tracking-tight leading-none">
            Quiz<span className="bg-gradient-to-r from-primary-accent to-secondary-accent bg-clip-text text-transparent">Master</span>
          </h1>
          <p className="text-text-muted text-sm max-w-sm mx-auto">
            Host a live Jeopardy game — players join from any device, buzz in, and compete in real-time.
          </p>
        </div>

        {/* Tab card */}
        <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
          {/* Tab bar */}
          <div className="flex border-b border-white/5">
            {(['home', 'host', 'join'] as LobbyTab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setLocalError(''); }}
                className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-widest transition-all duration-200 ${
                  tab === t
                    ? 'bg-primary-accent/10 text-primary-accent border-b-2 border-primary-accent'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                {t === 'home' ? 'Home' : t === 'host' ? '🎤 Host' : '🎮 Join'}
              </button>
            ))}
          </div>

          <div className="p-6">
            <AnimatePresence mode="wait">
              {/* ── Home tab ────────────────────────────────────────────── */}
              {tab === 'home' && (
                <motion.div
                  key="home"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <button
                    onClick={() => setTab('host')}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary-accent/20 to-primary-accent/5 border border-primary-accent/30 hover:border-primary-accent/60 transition group"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className="p-2 rounded-lg bg-primary-accent/20 text-primary-accent">
                        <Play className="w-5 h-5 fill-current" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-text-main">Host a Game</p>
                        <p className="text-xs text-text-muted">Create a room, share code, control the board</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary-accent transition" />
                  </button>

                  <button
                    onClick={() => setTab('join')}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-secondary-accent/20 to-secondary-accent/5 border border-secondary-accent/30 hover:border-secondary-accent/60 transition group"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className="p-2 rounded-lg bg-secondary-accent/20 text-secondary-accent">
                        <LogIn className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-text-main">Join a Game</p>
                        <p className="text-xs text-text-muted">Enter room code, buzz in, win points</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-secondary-accent transition" />
                  </button>

                  <div className="pt-2 border-t border-white/5">
                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-3">Your Quiz Library</p>
                    <div className="flex gap-2">
                      <button
                        onClick={onCreateQuiz}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card-bg border border-white/5 text-xs font-semibold text-text-muted hover:text-text-main transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        New Quiz
                      </button>
                      {quizzes.slice(0, 2).map((q) => (
                        <button
                          key={q.id}
                          onClick={() => onEditQuiz(q)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card-bg border border-white/5 text-xs font-semibold text-text-muted hover:text-text-main transition truncate max-w-[140px]"
                        >
                          <BookOpen className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{q.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Host tab ────────────────────────────────────────────── */}
              {tab === 'host' && (
                <motion.div
                  key="host"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-5"
                >
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Your Host Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Alex (Host)"
                      value={hostName}
                      onChange={(e) => setHostName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleHost()}
                      className="w-full bg-primary-bg border border-white/10 rounded-xl px-4 py-3 text-sm text-text-main font-semibold outline-none focus:border-primary-accent placeholder-text-muted/30 transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Select Quiz Pack</label>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {quizzes.map((q) => (
                        <button
                          key={q.id}
                          onClick={() => setSelectedQuizId(q.id)}
                          className={`w-full text-left p-3 rounded-xl border transition ${
                            selectedQuizId === q.id
                              ? 'bg-primary-accent/10 border-primary-accent'
                              : 'bg-card-bg/30 border-white/5 hover:bg-card-bg/60'
                          }`}
                        >
                          <p className="font-bold text-sm text-text-main">{q.title}</p>
                          <p className="text-xs text-text-muted mt-0.5">{q.categories.length} categories</p>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={onCreateQuiz}
                      className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary-accent transition mt-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create a new quiz
                    </button>
                  </div>

                  {(localError || error) && (
                    <p className="text-xs text-danger-accent bg-danger-accent/10 border border-danger-accent/20 rounded-lg px-3 py-2">
                      {localError || error}
                    </p>
                  )}

                  <button
                    onClick={handleHost}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-primary-accent to-secondary-accent hover:brightness-110 text-text-main font-bold rounded-xl shadow-lg shadow-primary-accent/20 transition disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Create Room & Host
                  </button>
                </motion.div>
              )}

              {/* ── Join tab ────────────────────────────────────────────── */}
              {tab === 'join' && (
                <motion.div
                  key="join"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-5"
                >
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Your Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Mehar"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="w-full bg-primary-bg border border-white/10 rounded-xl px-4 py-3 text-sm text-text-main font-semibold outline-none focus:border-secondary-accent placeholder-text-muted/30 transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Room Code</label>
                    <input
                      type="text"
                      placeholder="e.g. A3BX9K"
                      maxLength={6}
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                      className="w-full bg-primary-bg border border-white/10 rounded-xl px-4 py-3 text-xl font-display font-extrabold text-center tracking-[0.3em] text-secondary-accent outline-none focus:border-secondary-accent placeholder-text-muted/30 uppercase transition"
                    />
                  </div>

                  {(localError || error) && (
                    <p className="text-xs text-danger-accent bg-danger-accent/10 border border-danger-accent/20 rounded-lg px-3 py-2">
                      {localError || error}
                    </p>
                  )}

                  <button
                    onClick={handleJoin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-secondary-accent to-primary-accent hover:brightness-110 text-text-main font-bold rounded-xl shadow-lg shadow-secondary-accent/20 transition disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    Join Room
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
