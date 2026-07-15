import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoom } from '../context/RoomContext';
import { useQuizLibrary } from '../context/QuizLibraryContext';
import type { Quiz } from '../types/jeopardy';
import { Play, LogIn, BookOpen, Plus, ChevronRight, Zap, Loader2, MonitorPlay, Users, HelpCircle, Lightbulb, Brain, Award, Sparkles } from 'lucide-react';

const FLOATING_ICONS = [
  { Icon: HelpCircle, top: '10%', left: '5%', size: 48, delay: 0 },
  { Icon: Lightbulb, top: '20%', right: '10%', size: 64, delay: 1.5 },
  { Icon: Brain, bottom: '15%', left: '15%', size: 56, delay: 3 },
  { Icon: Award, bottom: '25%', right: '5%', size: 72, delay: 4.5 },
  { Icon: Sparkles, top: '40%', left: '80%', size: 40, delay: 2 },
  { Icon: HelpCircle, bottom: '40%', left: '10%', size: 36, delay: 3.5 },
];

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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-12 overflow-hidden relative">
      {/* Abstract Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-accent/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-accent/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Floating Trivia Icons */}
      {FLOATING_ICONS.map((item, i) => (
        <motion.div
          key={i}
          initial={{ y: 0, opacity: 0 }}
          animate={{ 
            y: [-20, 20, -20], 
            rotate: [-10, 10, -10],
            opacity: [0.95, 0.85, 0.75]
          }}
          transition={{ 
            duration: 8 + (i % 4), 
            repeat: Infinity, 
            ease: "easeInOut",
            delay: item.delay
          }}
          className="absolute pointer-events-none text-white/10"
          style={{ top: item.top, left: item.left, right: item.right, bottom: item.bottom }}
        >
          <item.Icon size={item.size} />
        </motion.div>
      ))}

      <div className="w-full max-w-xl z-10 space-y-10">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-text-main font-semibold tracking-widest uppercase mb-4 shadow-lg backdrop-blur-md">
            <Zap className="w-4 h-4 text-warning-accent" />
            Live Multiplayer
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-white leading-[1.1]">
            Buzzing <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-accent to-secondary-accent">With Quizzing</span>
          </h1>
          <p className="text-text-muted text-base sm:text-lg max-w-md mx-auto leading-relaxed">
            Host an immersive live game, ask questions, buzz in fast, and dominate the leaderboard.
          </p>
        </motion.div>

        {/* Interactive Panel */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-panel rounded-3xl overflow-hidden shadow-2xl relative"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
          
          {/* Tab Navigation */}
          <div className="flex border-b border-white/10 bg-black/20 relative z-10">
            {(['home', 'host', 'join'] as LobbyTab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setLocalError(''); }}
                className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all duration-300 relative ${
                  tab === t
                    ? 'text-white'
                    : 'text-text-muted hover:text-white hover:bg-white/5'
                }`}
              >
                {tab === t && (
                  <motion.div
                    layoutId="active-tab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-accent"
                  />
                )}
                {t === 'home' ? 'Home' : t === 'host' ? 'Host' : 'Join'}
              </button>
            ))}
          </div>

          <div className="p-6 sm:p-8 relative z-10">
            <AnimatePresence mode="wait">
              {/* ── HOME TAB ───────────────────────────────────────────── */}
              {tab === 'home' && (
                <motion.div
                  key="home"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <button
                    onClick={() => setTab('host')}
                    className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-primary-accent/50 hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-primary-accent/20 to-primary-accent/5 text-primary-accent border border-primary-accent/20 group-hover:scale-110 transition-transform">
                        <MonitorPlay className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-base text-white">Host a Game</p>
                        <p className="text-sm text-text-muted">Create a room and control the board</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-primary-accent transition-colors group-hover:translate-x-1" />
                  </button>

                  <button
                    onClick={() => setTab('join')}
                    className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-secondary-accent/50 hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-secondary-accent/20 to-secondary-accent/5 text-secondary-accent border border-secondary-accent/20 group-hover:scale-110 transition-transform">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-base text-white">Join a Game</p>
                        <p className="text-sm text-text-muted">Enter a code, buzz in, win points</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-secondary-accent transition-colors group-hover:translate-x-1" />
                  </button>

                  <div className="pt-6 mt-4 border-t border-white/10">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Quiz Library</p>
                      <button
                        onClick={onCreateQuiz}
                        className="flex items-center gap-1.5 text-xs font-bold text-primary-accent hover:text-primary-hover transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        New Quiz
                      </button>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {quizzes.slice(0, 3).map((q) => (
                        <button
                          key={q.id}
                          onClick={() => onEditQuiz(q)}
                          className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <BookOpen className="w-4 h-4 text-text-muted group-hover:text-white shrink-0 transition" />
                            <span className="text-sm text-text-muted group-hover:text-white font-medium truncate">{q.title}</span>
                          </div>
                          <span className="text-[10px] text-text-muted/50 uppercase font-bold tracking-wider opacity-0 group-hover:opacity-100 transition">Edit</span>
                        </button>
                      ))}
                      {quizzes.length === 0 && (
                         <div className="text-center py-6 border border-dashed border-white/10 rounded-xl">
                           <p className="text-sm text-text-muted">No quizzes yet.</p>
                         </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── HOST TAB ───────────────────────────────────────────── */}
              {tab === 'host' && (
                <motion.div
                  key="host"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Host Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Alex (Host)"
                      value={hostName}
                      onChange={(e) => setHostName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleHost()}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white font-medium outline-none focus:border-primary-accent focus:ring-1 focus:ring-primary-accent transition-all placeholder:text-text-muted/40 shadow-inner"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Select Quiz Pack</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {quizzes.map((q) => (
                        <button
                          key={q.id}
                          onClick={() => setSelectedQuizId(q.id)}
                          className={`w-full text-left p-4 rounded-xl border transition-all ${
                            selectedQuizId === q.id
                              ? 'bg-primary-accent/20 border-primary-accent/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                              : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                          }`}
                        >
                          <p className={`font-bold text-sm ${selectedQuizId === q.id ? 'text-primary-accent' : 'text-white'}`}>{q.title}</p>
                          <p className="text-xs text-text-muted mt-1 truncate">{q.description}</p>
                        </button>
                      ))}
                      {quizzes.length === 0 && (
                         <div className="text-center py-6 border border-dashed border-white/10 rounded-xl">
                           <p className="text-sm text-text-muted mb-2">You need a quiz to host.</p>
                           <button onClick={onCreateQuiz} className="text-xs text-primary-accent hover:underline font-bold">Create one now</button>
                         </div>
                      )}
                    </div>
                  </div>

                  {(localError || error) && (
                    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-danger-accent bg-danger-accent/10 border border-danger-accent/20 rounded-lg px-4 py-3 font-medium">
                      {localError || error}
                    </motion.p>
                  )}

                  <button
                    onClick={handleHost}
                    disabled={loading || quizzes.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-4 premium-btn font-bold rounded-xl text-sm"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                    Create Room & Host
                  </button>
                </motion.div>
              )}

              {/* ── JOIN TAB ───────────────────────────────────────────── */}
              {tab === 'join' && (
                <motion.div
                  key="join"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Your Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Mehar"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white font-medium outline-none focus:border-secondary-accent focus:ring-1 focus:ring-secondary-accent transition-all placeholder:text-text-muted/40 shadow-inner"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Room Code</label>
                    <input
                      type="text"
                      placeholder="XXXXXX"
                      maxLength={6}
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-2xl font-display font-extrabold text-center tracking-[0.4em] text-white outline-none focus:border-secondary-accent focus:ring-1 focus:ring-secondary-accent transition-all placeholder:text-text-muted/20 shadow-inner uppercase"
                    />
                  </div>

                  {(localError || error) && (
                    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-danger-accent bg-danger-accent/10 border border-danger-accent/20 rounded-lg px-4 py-3 font-medium">
                      {localError || error}
                    </motion.p>
                  )}

                  <button
                    onClick={handleJoin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-white hover:bg-gray-100 text-black font-bold rounded-xl text-sm transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                    Join Room
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
