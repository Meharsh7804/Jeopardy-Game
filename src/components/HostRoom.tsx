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
  Zap,
  Trophy
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

// Extremely smooth spring configurations
const springConfig = { type: "spring", stiffness: 500, damping: 30, mass: 0.8 };
const fastSpring = { type: "spring", stiffness: 700, damping: 35, mass: 0.5 };

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
  const [categoryModalId, setCategoryModalId] = useState<string | null>(null);
  const [splitSelected, setSplitSelected] = useState<string[]>([]);
  const [showSplit, setShowSplit] = useState(false);
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    if (room?.phase !== "lobby") return;
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % FUN_FACTS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [room?.phase]);

  useEffect(() => {
    if (!room) return;
    const found = quizzes.find((q) => q.id === room.quizId) ?? null;
    setQuiz(found);
  }, [room?.quizId, quizzes]);

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
    <div className="min-h-screen flex flex-col bg-primary-bg relative overflow-hidden text-white font-sans">
      {/* Background Ambience */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary-accent/15 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-secondary-accent/10 blur-[180px] rounded-full pointer-events-none" />
      
      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <header className="glass-panel relative z-40 px-6 py-4 flex items-center justify-between border-b border-white/5 shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-accent to-secondary-accent flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.4)]">
            <span className="font-display font-black text-lg text-white">Q</span>
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-white leading-tight">Host Dashboard</h1>
            <p className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">{quiz?.title || "Loading..."}</p>
          </div>
        </div>

        {/* Room Code moved strictly to the Top Bar */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-4 px-6 py-2 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 hover:border-primary-accent/50 transition-all shadow-inner group"
          onClick={handleCopyCode}
          title="Click to copy room code"
        >
          <div className="flex flex-col items-end">
             <span className="text-[9px] text-text-muted font-bold uppercase tracking-widest leading-none mb-1 group-hover:text-primary-accent transition-colors">Room Code</span>
             <span className="font-display font-black text-2xl tracking-[0.25em] text-white leading-none">{room.id}</span>
          </div>
          {copied ? <Check className="w-5 h-5 text-success-accent" /> : <Copy className="w-5 h-5 text-text-muted group-hover:text-white transition-colors" />}
        </motion.div>

        <div className="flex items-center gap-3">
          {["board", "question", "buzzing", "judging", "answer"].includes(room.phase) && (
            <button
              onClick={endGame}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-danger-accent/10 border border-danger-accent/20 text-danger-accent text-sm font-bold hover:bg-danger-accent/20 transition-colors"
            >
              End Game
            </button>
          )}
          <button
            onClick={handleLeave}
            className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-text-muted hover:text-white hover:bg-white/10 transition-all"
            title="Leave room"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto relative z-10 w-full">
        <AnimatePresence mode="wait">
          {/* LOBBY PHASE */}
          {room.phase === "lobby" && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={springConfig}
              className="p-8 sm:p-12 w-full max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[80vh] gap-10"
            >
              <div className="text-center space-y-4">
                 <h2 className="text-5xl md:text-6xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                   Waiting for Players
                 </h2>
                 <p className="text-lg text-text-muted">Tell your players to join using the code in the top right.</p>
                 
                 <div className="mx-auto mt-4 max-w-lg h-20 flex items-center justify-center p-4 rounded-2xl glass-panel border border-white/10 relative overflow-hidden">
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

              {/* Players Centered in Lobby */}
              <div className="w-full">
                 <div className="flex flex-wrap justify-center gap-6">
                    <AnimatePresence>
                      {gamePlayers.length === 0 ? (
                        <motion.div 
                          initial={{ opacity: 0 }} 
                          animate={{ opacity: 1 }} 
                          className="flex flex-col items-center gap-4 py-12 px-20 border-2 border-dashed border-white/10 rounded-3xl bg-white/5"
                        >
                           <div className="w-12 h-12 rounded-full border-t-2 border-primary-accent animate-spin" />
                           <p className="text-text-muted font-bold tracking-widest uppercase text-sm">Listening for connections...</p>
                        </motion.div>
                      ) : (
                        gamePlayers.map((p, i) => (
                          <motion.div
                            layout
                            key={p.id}
                            initial={{ opacity: 0, scale: 0.5, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ ...springConfig, delay: Math.min(i * 0.05, 0.2) }}
                            className="flex flex-col items-center gap-3 p-6 rounded-3xl glass-panel border border-white/10 shadow-xl group hover:border-primary-accent/40 transition-colors min-w-[140px]"
                          >
                             <PlayerAvatar seed={p.id} name={p.name} size={80} className="rounded-full ring-4 ring-white/5 group-hover:ring-primary-accent/30 transition-all drop-shadow-xl" />
                             <span className="font-display font-bold text-lg text-white group-hover:text-primary-accent transition-colors">{p.name}</span>
                             <button
                               onClick={() => handleKick(p.id)}
                               className="opacity-0 group-hover:opacity-100 mt-2 px-3 py-1 rounded-lg bg-danger-accent/10 text-danger-accent text-xs font-bold hover:bg-danger-accent/20 transition-all"
                             >
                               Kick
                             </button>
                          </motion.div>
                        ))
                      )}
                    </AnimatePresence>
                 </div>
              </div>
              
              <motion.div 
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: 0.2 }}
              >
                <button
                  onClick={startGame}
                  disabled={gamePlayers.length === 0}
                  className="px-10 py-5 rounded-2xl premium-btn font-display font-black text-xl text-white shadow-[0_0_40px_rgba(99,102,241,0.4)] disabled:opacity-50 disabled:shadow-none hover:scale-105 active:scale-95 transition-all flex items-center gap-3 group"
                >
                  <Play className="w-6 h-6 fill-current group-hover:translate-x-1 transition-transform" />
                  START GAME
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* BOARD PHASE */}
          {room.phase === "board" && quiz && (
            <motion.div
              key="board"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={springConfig}
              className="p-4 md:p-6 max-w-7xl mx-auto w-full flex flex-col xl:flex-row gap-6 items-start"
            >
              <div className="flex-1 w-full space-y-4">
                <div className="flex items-center justify-between bg-black/30 p-3 rounded-2xl border border-white/5 backdrop-blur-md shadow-lg">
                  <h2 className="font-display font-black text-2xl text-white tracking-tight">{quiz.title}</h2>
                  <span className="text-xs font-bold text-primary-accent px-3 py-1 bg-primary-accent/10 rounded-xl border border-primary-accent/20 uppercase tracking-widest">
                    Board Phase
                  </span>
                </div>

                <div className={`grid gap-2 ${getGridColsClass(quiz.categories.length)}`}>
                  {/* Category headers */}
                  {quiz.categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryModalId(cat.id)}
                      className="glass-panel p-2 rounded-xl text-center font-display font-black text-[11px] text-white uppercase tracking-wider min-h-[3.5rem] flex flex-col items-center justify-center gap-1 transition hover:bg-white/10 hover:scale-105 group shadow-md border border-white/10"
                    >
                      <span className="group-hover:text-primary-accent transition-colors drop-shadow-md leading-tight">{cat.name}</span>
                      {cat.description?.trim() && <Info className="w-3 h-3 text-text-muted shrink-0 group-hover:text-primary-accent transition-colors" />}
                    </button>
                  ))}

                  {/* Question Tiles */}
                  {Array.from({ length: quiz.categories[0]?.questions.length ?? 5 }).map((_, rowIdx) =>
                    quiz.categories.map((cat) => {
                      const q = cat.questions[rowIdx];
                      if (!q) return <div key={`${cat.id}-${rowIdx}`} />;
                      const done = !!room.completedQuestions?.[q.id];
                      return (
                        <motion.button
                          layoutId={`q-${q.id}`}
                          key={q.id}
                          disabled={done}
                          onClick={() => handleOpenQuestion(q, cat.name)}
                          whileHover={!done ? { scale: 1.05, y: -3 } : {}}
                          whileTap={!done ? { scale: 0.95 } : {}}
                          className={`rounded-xl p-3 font-display font-black text-xl text-center flex items-center justify-center min-h-[4.5rem] transition-all shadow-md ${
                            done
                              ? "glass-panel opacity-20 cursor-not-allowed grayscale"
                              : "bg-gradient-to-br from-[#0c1838] to-[#12234f] border-2 border-[#1e3a8a] text-warning-accent hover:border-warning-accent hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] cursor-pointer drop-shadow-lg"
                          }`}
                        >
                          {done ? "" : `$${q.value}`}
                        </motion.button>
                      );
                    }),
                  )}
                </div>
              </div>

              {/* Sidebar Leaderboard for Board Phase */}
              <div className="w-full xl:w-80 shrink-0 glass-panel-heavy rounded-3xl border border-white/10 shadow-2xl overflow-hidden sticky top-6">
                <div className="p-5 border-b border-white/5 bg-black/20">
                   <p className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                     <Crown className="w-4 h-4 text-warning-accent" /> Leaderboard
                   </p>
                </div>
                <div className="p-3 max-h-[70vh] overflow-y-auto custom-scrollbar space-y-2">
                  <AnimatePresence>
                    {gamePlayers.map((p, i) => (
                      <motion.div
                        key={p.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={fastSpring}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {i === 0 && p.score > 0 ? (
                            <Crown className="w-4 h-4 text-warning-accent fill-warning-accent shrink-0" />
                          ) : (
                            <span className="text-[10px] text-text-muted font-bold w-4 text-center shrink-0">#{i + 1}</span>
                          )}
                          <PlayerAvatar seed={p.id} name={p.name} size={32} className="shrink-0 rounded-full" />
                          <span className="font-bold text-sm text-white truncate">{p.name}</span>
                        </div>
                        <span className="font-display font-black text-base text-white">{p.score}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {/* QUESTION / BUZZING / ANSWER PHASE */}
          {["buzzing", "answer"].includes(room.phase) && room.activeQuestion && (
            <motion.div
              key="question-screen"
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={springConfig}
              className="p-6 md:p-8 max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-8 items-start"
            >
              {/* Question Card */}
              <div className="flex-1 w-full space-y-6">
                <motion.div layoutId={`q-${room.activeQuestion.questionId}`} className="glass-panel-heavy p-10 md:p-14 rounded-[2.5rem] text-center space-y-8 relative shadow-2xl border border-white/10">
                  <div className="flex items-center justify-center gap-4">
                    <span className="px-5 py-2 rounded-full bg-black/40 border border-white/10 text-xs font-bold text-text-muted uppercase tracking-widest shadow-inner">
                      {room.activeQuestion.categoryName}
                    </span>
                    <span className="font-display font-black text-warning-accent text-3xl drop-shadow-md">
                      ${room.activeQuestion.value}
                    </span>
                  </div>

                  {room.activeQuestion.mediaUrl && room.activeQuestion.type !== "text" && (
                    <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] mx-auto w-fit max-h-72 bg-black">
                       <img
                         src={room.activeQuestion.mediaUrl}
                         alt="Question media"
                         className="max-h-72 object-contain"
                       />
                    </div>
                  )}

                  <p className="text-3xl md:text-5xl font-display font-black text-white leading-tight whitespace-pre-wrap px-4 drop-shadow-lg">
                    {room.activeQuestion.text}
                  </p>
                  
                  {/* Host-only Answer visibility (before reveal) */}
                  {!room.activeQuestion.revealAnswer && activeLocalQuestion?.answer && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-10 p-5 rounded-2xl border border-primary-accent/30 bg-primary-accent/10 text-left relative overflow-hidden"
                    >
                       <div className="absolute top-0 left-0 w-1.5 h-full bg-primary-accent" />
                       <p className="text-[10px] font-bold text-primary-accent uppercase tracking-widest mb-2 pl-3 flex items-center gap-2">
                         <Eye className="w-3 h-3" /> Host Only: Correct Answer
                       </p>
                       <p className="text-xl font-bold text-white whitespace-pre-wrap pl-3">{activeLocalQuestion.answer}</p>
                    </motion.div>
                  )}

                  {/* Revealed Answer for Everyone */}
                  {room.activeQuestion.revealAnswer && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={fastSpring}
                      className="mt-10 p-8 rounded-3xl bg-success-accent/15 border border-success-accent/30 shadow-[0_0_40px_rgba(16,185,129,0.2)] text-left relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-2 h-full bg-success-accent" />
                      <p className="text-xs font-bold text-success-accent uppercase tracking-widest mb-3 pl-4 flex items-center gap-2">
                        <Check className="w-4 h-4" /> Revealed Answer
                      </p>
                      <p className="text-3xl font-display font-black text-white whitespace-pre-wrap pl-4 drop-shadow-md">
                        {room.activeQuestion.answer}
                      </p>
                    </motion.div>
                  )}
                </motion.div>

                {/* Host Action Buttons below question */}
                <div className="flex flex-col sm:flex-row gap-4">
                  {!room.activeQuestion.revealAnswer && (
                    <button
                      onClick={handleRevealAnswer}
                      className="flex-1 flex items-center justify-center gap-3 px-6 py-5 rounded-2xl bg-white/10 border border-white/10 text-white font-bold hover:bg-white/20 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 text-lg"
                    >
                      <Eye className="w-5 h-5" />
                      Reveal Answer
                    </button>
                  )}
                  <button
                    onClick={closeQuestion}
                    className="flex-1 flex items-center justify-center gap-3 px-6 py-5 rounded-2xl bg-white/5 border border-white/10 text-text-muted hover:text-white hover:bg-white/10 font-bold transition-all shadow-inner hover:-translate-y-1 text-lg"
                  >
                    <ChevronRight className="w-5 h-5" />
                    Close Question
                  </button>
                </div>
              </div>

              {/* Right Sidebar: Buzzers & Actions */}
              <div className="w-full lg:w-96 shrink-0 space-y-6">
                <div className="glass-panel-heavy p-6 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-warning-accent to-amber-500" />
                   
                   <div className="flex items-center justify-between mb-6">
                     <p className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Zap className="w-4 h-4 text-warning-accent" /> Buzz Queue
                     </p>
                     <button
                       onClick={() => { setShowSplit(!showSplit); setSplitSelected([]); }}
                       className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-white transition font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5"
                     >
                       <Scissors className="w-3.5 h-3.5" /> Split
                     </button>
                   </div>

                   <AnimatePresence>
                      {showSplit && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mb-6 p-4 rounded-2xl bg-black/30 border border-white/10 space-y-3"
                        >
                          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Select players to split points:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {gamePlayers.map((p) => (
                              <label key={p.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-white/5 transition border border-transparent hover:border-white/5">
                                <input
                                  type="checkbox"
                                  checked={splitSelected.includes(p.id)}
                                  onChange={(e) =>
                                    setSplitSelected((prev) =>
                                      e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                                    )
                                  }
                                  className="w-4 h-4 accent-primary-accent rounded border-white/20 bg-black/50"
                                />
                                <span className="text-sm font-bold text-white truncate">{p.name}</span>
                              </label>
                            ))}
                          </div>
                          <button
                            disabled={splitSelected.length === 0}
                            onClick={handleSplit}
                            className="w-full py-3 rounded-xl premium-btn font-bold text-sm shadow-md disabled:opacity-50 mt-2"
                          >
                            Award Split (+{splitSelected.length > 0 ? Math.round((room.activeQuestion.value ?? 0) / splitSelected.length) : "?"} each)
                          </button>
                        </motion.div>
                      )}
                   </AnimatePresence>

                   <div className="space-y-3 min-h-[200px]">
                     <AnimatePresence mode="popLayout">
                       {sortedBuzzes.length > 0 ? (
                         sortedBuzzes.map(([pId], idx) => {
                           const p = room.players[pId];
                           if (!p) return null;
                           const isFirst = idx === 0;
                           return (
                             <motion.div
                               layout
                               initial={{ opacity: 0, x: 20, scale: 0.9 }}
                               animate={{ opacity: 1, x: 0, scale: 1 }}
                               exit={{ opacity: 0, scale: 0.8 }}
                               transition={fastSpring}
                               key={pId}
                               className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all ${
                                 isFirst 
                                   ? "bg-gradient-to-br from-warning-accent/20 to-warning-accent/5 border-warning-accent/50 shadow-[0_0_25px_rgba(245,158,11,0.2)] scale-[1.02] z-10 relative" 
                                   : "bg-white/5 border-white/5 opacity-70 scale-95"
                               }`}
                             >
                               <div className="flex items-center gap-3">
                                 <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${isFirst ? "bg-warning-accent text-black" : "bg-black/50 text-text-muted border border-white/10"}`}>
                                   {idx + 1}
                                 </div>
                                 <PlayerAvatar seed={p.id} name={p.name} size={40} className="shrink-0 rounded-full ring-2 ring-white/10" />
                                 <div className="flex-1 min-w-0">
                                   <p className={`font-display font-black text-lg truncate leading-tight ${isFirst ? "text-warning-accent" : "text-white"}`}>
                                     {p.name}
                                   </p>
                                   <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-0.5">Score: {p.score}</p>
                                 </div>
                               </div>
                               
                               {isFirst && (
                                 <motion.div 
                                   initial={{ opacity: 0, height: 0 }} 
                                   animate={{ opacity: 1, height: "auto" }} 
                                   className="flex gap-2 pt-2 border-t border-warning-accent/20"
                                 >
                                   <button
                                     onClick={() => handleJudge(true)}
                                     className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-success-accent text-white hover:bg-emerald-400 transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 active:translate-y-0"
                                   >
                                     <Check className="w-5 h-5 font-bold" /> <span className="font-bold text-sm">Correct</span>
                                   </button>
                                   <button
                                     onClick={() => handleJudge(false)}
                                     className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-danger-accent text-white hover:bg-rose-400 transition-all shadow-[0_4px_15px_rgba(244,63,94,0.3)] hover:-translate-y-0.5 active:translate-y-0"
                                   >
                                     <X className="w-5 h-5 font-bold" /> <span className="font-bold text-sm">Wrong</span>
                                   </button>
                                 </motion.div>
                               )}
                             </motion.div>
                           );
                         })
                       ) : (
                         <motion.div 
                           initial={{ opacity: 0 }} 
                           animate={{ opacity: 1 }} 
                           className="text-center py-12 border border-white/10 border-dashed rounded-2xl bg-black/20"
                         >
                           <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                              <Zap className="w-6 h-6 text-text-muted animate-pulse" />
                           </div>
                           <p className="text-sm font-bold text-text-muted uppercase tracking-widest">Waiting for buzzes...</p>
                         </motion.div>
                       )}
                     </AnimatePresence>
                   </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ENDED PHASE */}
          {room.phase === "ended" && (
            <motion.div
              key="ended"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={springConfig}
              className="flex flex-col items-center justify-center min-h-[75vh] gap-10 text-center p-8 w-full"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-warning-accent/30 blur-[100px] rounded-full" />
                <Trophy className="w-28 h-28 text-warning-accent drop-shadow-[0_0_40px_rgba(245,158,11,0.6)] relative z-10" />
              </div>
              <h2 className="text-6xl md:text-7xl font-display font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50">
                Game Over!
              </h2>
              
              <div className="w-full max-w-2xl space-y-4 mt-6">
                {gamePlayers.map((p, i) => (
                  <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...springConfig, delay: i * 0.1 }}
                    key={p.id}
                    className={`flex items-center justify-between px-8 py-6 rounded-3xl border ${
                      i === 0 
                        ? "bg-gradient-to-r from-warning-accent/20 to-warning-accent/5 border-warning-accent/40 shadow-[0_0_30px_rgba(245,158,11,0.2)] scale-105 z-10 relative" 
                        : "bg-white/5 border-white/5 hover:bg-white/10 transition-colors"
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      {i === 0 && <Crown className="w-6 h-6 text-warning-accent fill-warning-accent drop-shadow-md" />}
                      {i !== 0 && <span className="font-black text-text-muted w-6 text-center text-xl">#{i+1}</span>}
                      <PlayerAvatar seed={p.id} name={p.name} size={48} className="shrink-0 rounded-full ring-2 ring-white/10" />
                      <span className={`font-display font-black text-2xl truncate ${i === 0 ? "text-warning-accent" : "text-white"}`}>{p.name}</span>
                    </div>
                    <span className="font-display font-black text-4xl text-white drop-shadow-md">{p.score}</span>
                  </motion.div>
                ))}
              </div>
              
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                onClick={handleLeave}
                className="mt-8 px-10 py-5 rounded-2xl bg-white text-black font-display font-black text-xl hover:bg-gray-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95"
              >
                Return to Lobby
              </motion.button>
            </motion.div>
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
            onClick={() => setCategoryModalId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={fastSpring}
              className="glass-panel-heavy rounded-[2.5rem] p-10 max-w-lg w-full space-y-6 relative border border-white/20 shadow-[0_0_80px_rgba(0,0,0,0.6)]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setCategoryModalId(null)}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/10 border border-white/10 text-text-muted hover:text-white hover:bg-white/20 transition-all hover:scale-110 active:scale-90"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 rounded-2xl bg-primary-accent/20 flex items-center justify-center border border-primary-accent/30 shadow-inner">
                 <Info className="w-6 h-6 text-primary-accent" />
              </div>
              <h3 className="text-4xl font-display font-black text-white leading-tight pr-8">{categoryModalData.name}</h3>
              <div className="h-px w-full bg-gradient-to-r from-white/20 to-transparent my-6" />
              <p className="text-lg text-text-muted leading-relaxed whitespace-pre-wrap font-medium">
                {categoryModalData.description?.trim() || "No detailed description provided for this category."}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
