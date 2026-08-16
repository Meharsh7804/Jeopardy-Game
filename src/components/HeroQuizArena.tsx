import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  animate,
} from "framer-motion";
import { useSettings, ANIM_MULT } from "../context/SettingsContext";
import { PlayerAvatar } from "../utils/playerAvatar";
import { Zap, Crown, Timer as TimerIcon, Flame, Target } from "lucide-react";

// ─── One master timeline for the whole arena ─────────────────────────────────
// A single "round" plays out over ~13s: idle → tile → buzz → player → settle
// → secondary → idle. Nothing runs its own independent loop.
type Phase = "idle" | "tile" | "buzz" | "player" | "settle" | "secondary";

const IDLE_1 = 3500; // calm start — let the user look at the UI
const TILE_D = 1100; // one tile quietly emphasizes
const BUZZ_D = 1700; // buzzer interaction
const PLAYER_D = 1600; // one player reacts, score updates
const SETTLE_D = 1500; // everything returns to normal
const SECONDARY_D = 1600; // one tiny secondary event
const IDLE_2 = 2000; // hold, then restart
const TOTAL =
  IDLE_1 + TILE_D + BUZZ_D + PLAYER_D + SETTLE_D + SECONDARY_D + IDLE_2; // 13000ms

// Progress-bar keyframes relative to the full cycle (drains only during the
// active part of the round, refills during the closing idle).
const BAR_TIMES = [
  0,
  IDLE_1 / TOTAL,
  (IDLE_1 + TILE_D + BUZZ_D + PLAYER_D + SETTLE_D) / TOTAL,
  (TOTAL - IDLE_2) / TOTAL,
  1,
];

const VALUES = [100, 200, 300, 500];
const DELTA = 500;
const PLAYERS = ["Player 1", "Player 2"];

interface ArenaPick {
  col: number;
  row: number;
  playerIdx: 0 | 1;
  focusPill: 0 | 1;
}

const randomPick = (prev?: ArenaPick): ArenaPick => {
  const p: ArenaPick = {
    col: Math.floor(Math.random() * 3),
    row: Math.floor(Math.random() * 4),
    playerIdx: Math.random() < 0.5 ? 0 : 1,
    focusPill: Math.random() < 0.5 ? 0 : 1,
  };
  // Avoid the exact same tile two rounds in a row.
  if (prev && prev.col === p.col && prev.row === p.row) {
    return { ...p, col: (p.col + 1) % 3 };
  }
  return p;
};

/** Smoothly counts toward `target` whenever it changes. */
function useAnimatedNumber(
  target: number,
  duration: number,
  reduce: boolean,
): number {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    if (reduce) {
      setVal(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    fromRef.current = target;
    const controls = animate(from, target, {
      duration: duration / 1000,
      ease: "easeOut",
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [target, duration, reduce]);
  return val;
}

// ─── Physical buzzer ─────────────────────────────────────────────────────────
// Enter/exit handled by the caller; the press, brighten and label swap are
// one-shot beats driven by the buzz-phase duration — no extra loops.
const Buzzer: React.FC<{ buzzDur: number }> = ({ buzzDur }) => {
  const [buzzed, setBuzzed] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setBuzzed(true), 0.55 * buzzDur * 1000);
    return () => clearTimeout(t);
  }, [buzzDur]);
  return (
    <div className="relative">
      {/* tiny pulse ring as the button fires */}
      <motion.span
        aria-hidden
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: [0, 0.55, 0], scale: [0.95, 1.35, 1.35] }}
        transition={{ duration: buzzDur, times: [0, 0.5, 0.75], ease: "easeOut" }}
        className="absolute inset-0 rounded-full bg-warning-accent/25"
      />
      <motion.button
        type="button"
        aria-label="Buzz"
        animate={{
          scale: [1, 0.94, 1, 1],
          filter: [
            "brightness(1)",
            "brightness(1.25)",
            "brightness(1)",
            "brightness(1)",
          ],
        }}
        transition={{
          duration: buzzDur,
          times: [0, 0.42, 0.6, 1],
          ease: "easeOut",
        }}
        className="relative flex items-center gap-2 px-6 py-2 rounded-full bg-gradient-to-r from-warning-accent to-amber-400 text-black font-black text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(245,158,11,0.5)]"
      >
        <span className="relative inline-flex items-center gap-2">
          <Zap className="w-4 h-4 fill-current" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={buzzed ? "buzzed" : "buzz"}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {buzzed ? "Buzzed" : "Buzz"}
            </motion.span>
          </AnimatePresence>
        </span>
      </motion.button>
    </div>
  );
};

export const HeroQuizArena: React.FC = () => {
  const { settings, t } = useSettings();
  const mult = ANIM_MULT[settings.animationSpeed];
  const reduce = !!useReducedMotion();

  const [phase, setPhase] = useState<Phase>("idle");
  const [cycle, setCycle] = useState(0);
  const [cycleSpeed, setCycleSpeed] = useState(1);
  const [pick, setPick] = useState<ArenaPick>(() => randomPick());
  const [scores, setScores] = useState([2400, 2250]);
  const [feed, setFeed] = useState<{
    text: string;
    Icon: React.ComponentType<{ className?: string }>;
  } | null>(null);
  const prevPhase = useRef<Phase>("idle");
  const prevLead = useRef(0);

  const cats = [t("categoryMovies"), t("categorySports"), t("categoryScience")];

  // ─── The master timeline ───────────────────────────────────────────────────
  // One setTimeout chain per round; each round is slightly re-randomized
  // (tile, reacting player, secondary pill) and subtly re-timed.
  useEffect(() => {
    if (reduce) return;
    let cancelled = false;
    const timers: number[] = [];
    const run = () => {
      const speed = mult * (0.94 + Math.random() * 0.12);
      setCycle((c) => c + 1);
      setCycleSpeed(speed);
      setPick((prev) => randomPick(prev));
      let acc = 0;
      const steps: [Phase, number][] = [
        ["idle", IDLE_1],
        ["tile", TILE_D],
        ["buzz", BUZZ_D],
        ["player", PLAYER_D],
        ["settle", SETTLE_D],
        ["secondary", SECONDARY_D],
        ["idle", IDLE_2],
      ];
      steps.forEach(([p, d]) => {
        timers.push(
          window.setTimeout(() => {
            if (!cancelled) setPhase(p);
          }, acc * speed),
        );
        acc += d;
      });
      timers.push(window.setTimeout(run, acc * speed));
    };
    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [mult, reduce]);

  // Score + leaderboard update exactly when the "player" phase starts.
  useEffect(() => {
    if (phase === "player" && prevPhase.current !== "player") {
      const next = scores.map((v, i) => (i === pick.playerIdx ? v + DELTA : v));
      setScores(next);
      const name = PLAYERS[pick.playerIdx];
      const newLead = next[0] >= next[1] ? 0 : 1;
      if (newLead !== prevLead.current) {
        prevLead.current = newLead;
        setFeed({ text: `${name} ${t("takesTheLead")}`, Icon: Crown });
      } else if (Math.random() < 0.5) {
        setFeed({ text: `${name} ${t("buzzedFirst")}`, Icon: Zap });
      } else {
        setFeed({ text: `+${DELTA} ${t("pointsLabel")}`, Icon: Target });
      }
    }
    prevPhase.current = phase;
  }, [phase, pick.playerIdx, scores, t]);

  const active = phase === "tile" || phase === "buzz" || phase === "player";
  const buzzVisible = phase === "buzz";
  const playerReacting = phase === "player";

  const focusOnline = phase === "secondary" && pick.focusPill === 0;
  const focusGames = phase === "secondary" && pick.focusPill === 1;

  // Every 3rd round plays out as a full "question state" instead of the board.
  const questionRound = !reduce && cycle > 0 && cycle % 3 === 2;
  const questionMode =
    questionRound && (phase === "buzz" || phase === "player");

  const crownOn = scores[0] >= scores[1] ? 0 : 1;
  const buzzDur = (BUZZ_D * cycleSpeed) / 1000;
  const streak = 2 + (cycle % 3);

  const p1 = useAnimatedNumber(scores[0], 900, reduce);
  const p2 = useAnimatedNumber(scores[1], 900, reduce);

  return (
    <div
      className="relative w-full max-w-[540px] mx-auto lg:mr-0 lg:ml-auto"
      style={{ perspective: "1400px" }}
    >
      {/* Physical board: subtle 3D tilt + slow ambient float */}
      <div className="[transform:rotateX(2.5deg)_rotateY(-1.5deg)]">
        <motion.div
          animate={reduce ? { y: 0 } : { y: [0, -4, 0] }}
          transition={{
            duration: 9 * mult,
            ease: "easeInOut",
            repeat: Infinity,
          }}
          className="relative will-change-transform"
        >
          {/* Restrained purple ambient glow — static, event pulses handled below */}
          <div className="absolute -inset-10 bg-gradient-to-br from-primary-accent/15 to-secondary-accent/10 blur-[110px] rounded-full pointer-events-none opacity-55" />

          {/* Live activity — players online */}
          <div className="relative z-10 flex justify-start -mb-3.5 md:-translate-x-6">
            <motion.div
              animate={
                reduce
                  ? { opacity: 1, y: 0, scale: 1 }
                  : {
                      opacity: focusOnline ? 1 : 0.72,
                      y: focusOnline ? -2 : 0,
                      scale: focusOnline ? 1.02 : 1,
                    }
              }
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-panel border border-white/10 text-[9px] font-black tracking-[0.22em] text-text-muted uppercase shadow-lg"
            >
              <motion.span
                animate={reduce ? { opacity: 1 } : { opacity: [0.5, 1, 0.5] }}
                transition={{
                  duration: 3.6 * mult,
                  ease: "easeInOut",
                  repeat: Infinity,
                }}
                className="w-1.5 h-1.5 rounded-full bg-success-accent shadow-[0_0_8px_rgba(16,185,129,0.9)]"
              />
              {t("playersOnlineCount", { n: 24 })}
            </motion.div>
          </div>

          <div
            className="relative w-full glass-panel-heavy rounded-3xl border border-white/10 overflow-hidden"
            style={{
              boxShadow:
                "0 30px 60px -20px rgba(0,0,0,0.7), 0 12px 40px -12px rgba(99,102,241,0.25)",
            }}
          >
            {/* Arena header */}
            <div className="flex items-center justify-between px-4 pt-5 pb-2.5">
              <div className="flex items-center gap-2">
                <motion.span
                  animate={
                    reduce ? { opacity: 1 } : { opacity: [0.55, 1, 0.55] }
                  }
                  transition={{
                    duration: 3.4 * mult,
                    ease: "easeInOut",
                    repeat: Infinity,
                  }}
                  className="w-2 h-2 rounded-full bg-rose-500"
                />
                <span className="text-[10px] font-black tracking-[0.25em] text-white uppercase">
                  {t("liveGame")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[9px] font-black tracking-widest text-text-muted uppercase">
                  {t("round")} 2/5
                  <span className="flex items-center gap-[3px]">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className={`w-[4px] h-[4px] rounded-full ${i < 2 ? "bg-warning-accent" : "bg-white/20"}`}
                      />
                    ))}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/40 border border-white/10 text-[11px] font-mono font-bold text-white tabular-nums">
                  <TimerIcon className="w-3 h-3 text-primary-accent" />
                  0:15
                </span>
              </div>
            </div>

            {/* Round timer — drains once per round, synchronized with the master timeline */}
            <div className="h-[3px] bg-black/40">
              <motion.div
                key={cycle}
                initial={{ scaleX: 1 }}
                animate={reduce ? { scaleX: 1 } : { scaleX: [1, 1, 0, 0, 1] }}
                transition={{
                  duration: (TOTAL * cycleSpeed) / 1000,
                  times: BAR_TIMES,
                  ease: "linear",
                }}
                className="h-full origin-left bg-gradient-to-r from-primary-accent to-secondary-accent"
              />
            </div>

            {/* Question strip slot — stays empty during idle */}
            <div className="px-4 py-2.5 min-h-[58px] flex items-center">
              <AnimatePresence mode="wait">
                {active && !questionMode ? (
                  <motion.div
                    key="q"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      y: -4,
                      transition: { duration: 0.6, ease: "easeIn" },
                    }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full flex items-center gap-3 min-w-0"
                  >
                    <span className="shrink-0 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1.5">
                      <span className="text-[9px] font-black tracking-widest text-white uppercase">
                        {cats[pick.col]}
                      </span>
                      <span className="text-[10px] font-black text-warning-accent">
                        ${VALUES[pick.row]}
                      </span>
                    </span>
                    <span className="text-[11px] text-text-muted font-medium truncate">
                      {t("demoQuestion")}
                    </span>
                  </motion.div>
                ) : (
                  <div key="empty" className="w-full" />
                )}
              </AnimatePresence>
            </div>

            {/* Board ↔ question-state swap (every 3rd round shows a full question) */}
            <AnimatePresence mode="wait" initial={false}>
              {questionMode ? (
                <motion.div
                  key="qpanel"
                  initial={{ opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{
                    opacity: 0,
                    scale: 0.985,
                    transition: { duration: 0.5, ease: "easeIn" },
                  }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="px-5 py-4 flex flex-col items-center justify-center text-center gap-3 min-h-[190px]"
                >
                  <span className="px-2.5 py-1 rounded-lg bg-primary-accent/15 border border-primary-accent/40 text-[9px] font-black tracking-[0.2em] text-primary-accent uppercase">
                    {cats[pick.col]}
                  </span>
                  <p className="font-display font-bold text-lg text-white leading-snug max-w-[85%]">
                    {t("demoQuestion")}
                  </p>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/40 border border-white/10 text-[11px] font-mono font-bold text-white tabular-nums">
                    <TimerIcon className="w-3 h-3 text-warning-accent" />
                    00:07
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="board"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{
                    opacity: 0,
                    transition: { duration: 0.5, ease: "easeIn" },
                  }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Quiz board */}
                  <div className="px-4 pb-3 grid grid-cols-3 gap-1.5">
                    {cats.map((c, col) => (
                      <div key={c} className="flex flex-col gap-1.5">
                        <div className="rounded-lg bg-white/5 border border-white/10 py-1.5 px-1 text-center text-[9px] font-black tracking-[0.18em] text-white uppercase leading-none flex items-center justify-center min-h-[28px]">
                          {c}
                        </div>
                        {VALUES.map((v, row) => {
                          const isPicked = col === pick.col && row === pick.row;
                          const dim = active && !isPicked;
                          return (
                            <motion.div
                              key={v}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                delay: 0.05 * row + 0.1 * col,
                                duration: 0.5,
                              }}
                              className={`rounded-lg border-2 text-center py-2 font-display font-black text-sm leading-none transition-all duration-[1000ms] ease-out ${
                                isPicked
                                  ? active
                                    ? "bg-gradient-to-br from-[#1e1b4b] to-[#312e81] border-warning-accent text-warning-accent -translate-y-0.5 scale-[1.03] shadow-[0_0_0_1px_rgba(99,102,241,0.45),0_0_18px_rgba(245,158,11,0.35)] z-10 relative"
                                    : "bg-gradient-to-br from-[#0c1838] to-[#12234f] border-[#1e3a8a] text-warning-accent/80"
                                  : `bg-gradient-to-br from-[#0c1838] to-[#12234f] border-[#1e3a8a] text-warning-accent ${
                                      dim ? "opacity-50" : "opacity-90"
                                    }`
                              }`}
                            >
                              {v}
                            </motion.div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Gameplay lighting — brief purple pulse around the arena at buzz */}
            <AnimatePresence>
              {buzzVisible && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.4, ease: "easeOut" }}
                  className="absolute inset-0 z-30 pointer-events-none rounded-3xl"
                  style={{
                    background:
                      "radial-gradient(ellipse at 50% 45%, rgba(99,102,241,0.22), transparent 65%)",
                    boxShadow: "inset 0 0 80px rgba(139,92,246,0.25)",
                  }}
                />
              )}
            </AnimatePresence>

            {/* Buzzer state — a physical button that presses down, then the player reacts */}
            <div className="flex items-center justify-center h-14">
              <AnimatePresence>
                {buzzVisible && (
                  <motion.div
                    key="buzzer"
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{
                      opacity: 0,
                      scale: 0.92,
                      transition: { duration: 0.3, ease: "easeIn" },
                    }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Buzzer buzzDur={buzzDur} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Players / mini leaderboard */}
            <div className="px-4 pb-4 grid grid-cols-2 gap-2.5">
              {[0, 1].map((i) => {
                const reacts = playerReacting && pick.playerIdx === i;
                const name = PLAYERS[i];
                const score = i === 0 ? p1 : p2;
                return (
                  <div
                    key={name}
                    className={`relative flex items-center gap-2.5 rounded-2xl border p-2.5 transition-all duration-700 ease-out ${
                      reacts
                        ? "-translate-y-0.5 bg-warning-accent/10 border-warning-accent/50 shadow-[0_0_18px_rgba(245,158,11,0.2),0_0_32px_rgba(139,92,246,0.18)]"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    {/* Crown follows the leader; pops when the lead changes */}
                    <AnimatePresence>
                      {crownOn === i && (
                        <motion.div
                          key="crown"
                          initial={
                            reduce
                              ? false
                              : { scale: 0.4, opacity: 0, rotate: -25 }
                          }
                          animate={{ scale: 1, opacity: 1, rotate: 0 }}
                          exit={{
                            scale: 0.4,
                            opacity: 0,
                            rotate: 15,
                            transition: { duration: 0.25, ease: "easeIn" },
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 320,
                            damping: 20,
                          }}
                          className="absolute -top-2 -left-1.5 z-10"
                        >
                          <Crown className="w-4 h-4 text-warning-accent drop-shadow" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <PlayerAvatar
                      seed={name.toLowerCase()}
                      name={name}
                      size={34}
                      className="rounded-full ring-2 ring-white/10 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black tracking-widest text-text-muted uppercase truncate">
                        {name}
                      </p>
                      <p className="font-display font-black text-lg text-white leading-none tabular-nums">
                        {score}
                      </p>
                      <p className="flex items-center gap-1 mt-0.5 text-[7px] font-black tracking-widest uppercase">
                        {i === 0 ? (
                          <>
                            <Flame className="w-2.5 h-2.5 text-warning-accent" />
                            {t("streakLabel", { n: streak })}
                          </>
                        ) : (
                          <>
                            <Zap className="w-2.5 h-2.5 text-primary-accent" />
                            {t("fastestBuzz")}
                          </>
                        )}
                      </p>
                    </div>
                    <AnimatePresence>
                      {reacts && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, transition: { duration: 0.4 } }}
                          transition={{
                            duration: 0.6,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-md bg-warning-accent/20 border border-warning-accent/40 text-warning-accent text-[9px] font-black"
                        >
                          <Zap className="w-2.5 h-2.5 fill-current" /> 0.42s
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {reacts && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: -10, scale: 1 }}
                          exit={{
                            opacity: 0,
                            y: -14,
                            transition: { duration: 0.5, ease: "easeIn" },
                          }}
                          transition={{
                            duration: 0.9,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="absolute -top-3 right-2 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-success-accent text-black font-black text-xs shadow-lg"
                        >
                          +{DELTA}
                          <span className="text-[8px] font-black tracking-wider">
                            {name}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Tiny reaction feed — one secondary notification per round */}
            <div className="px-4 pb-3 min-h-[20px]">
              <AnimatePresence mode="wait">
                {feed && (
                  <motion.p
                    key={feed.text}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      y: -4,
                      transition: { duration: 0.4, ease: "easeIn" },
                    }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center justify-center gap-1.5 text-[8px] font-black tracking-[0.2em] text-text-muted uppercase"
                  >
                    <feed.Icon className="w-3 h-3 text-warning-accent" />
                    {feed.text}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Live activity — games live */}
          <div className="relative z-10 flex justify-end -mt-2.5 md:translate-x-6">
            <motion.div
              animate={
                reduce
                  ? { opacity: 1, y: 0, scale: 1 }
                  : {
                      opacity: focusGames ? 1 : 0.72,
                      y: focusGames ? -2 : 0,
                      scale: focusGames ? 1.02 : 1,
                    }
              }
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-panel border border-white/10 text-[9px] font-black tracking-[0.22em] text-text-muted uppercase shadow-lg"
            >
              <Zap className="w-2.5 h-2.5 text-primary-accent" />
              {t("gamesLiveCount", { n: 12 })}
            </motion.div>
          </div>

          {/* Floating "player buzzed" card */}
          <AnimatePresence>
            {playerReacting && (
              <motion.div
                initial={{ opacity: 0, x: 12, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  x: 6,
                  scale: 0.95,
                  transition: { duration: 0.5, ease: "easeIn" },
                }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="absolute -top-3 -right-1 md:-right-8 z-20 hidden sm:block"
              >
                <div className="glass-panel-heavy rounded-2xl px-3.5 py-2.5 border border-white/15 flex items-center gap-2.5 shadow-xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning-accent" />
                  <div className="leading-none">
                    <p className="text-[8px] font-black tracking-[0.2em] text-text-muted uppercase">
                      {t("playerBuzzed")}
                    </p>
                    <p className="text-xs font-black text-warning-accent mt-1 tabular-nums">
                      0.42s
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};
