import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoom } from "../context/RoomContext";
import { Zap, Crown, LogOut, Users, X, Info, Settings as SettingsIcon, Sparkles, ShieldAlert, EyeOff, Eye, Lock } from "lucide-react";
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
import { recordGameEnd, checkLiveAchievements, achievementProgress, achievementHint, ACHIEVEMENT_IDS, loadProfile, grantAchievement } from "../utils/profile";
import type { AchievementId } from "../utils/profile";
import { achievementBus } from "../utils/achievementBus";
import { AchievementToast } from "./AchievementToast";
import { MediaViewer } from "./ui/MediaViewer";
import { useScoreCelebrations } from "../delight/celebrate";
import { momentBus } from "../delight/moments";
import { useRoomCodeWordEgg } from "../delight/gameEggs";
import { useRapidRepeat, useWrongStreakEncouragement, useIdleNudge } from "../delight/watch";
import { useMatchMemory } from "../delight/memories";
import { lobbyVibe, LobbyCurrent } from "../delight/lobby";
import { Check } from "lucide-react";
import { AbilityBadge } from "../abilities/AbilityBadge";
import { AbilityCard } from "./ui/AbilityCard";
import { ReactionGauge } from "./ui/ReactionGauge";
import { ActivationModal, type ActivationPayload } from "../abilities/ActivationModal";
import { getAbilityForAvatar } from "../abilities/config";
import { rankBuzzes, clueText, activeClueFor, activeCommunityClueFor, isHidden } from "../abilities/engine";
import type { RoomAbilityEffect } from "../types/jeopardy";
import { abilityNoticeBus } from "../abilities/internal";

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
  const { room, myId, myName, buzz, sendReaction, leaveRoom, activateAbility, setRiskChoice } = useRoom();
  const { t } = useSettings();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [categoryModalId, setCategoryModalId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const myPlayer = room?.players?.[myId];
  const hasBuzzed = !!room?.buzzes?.[myId];

  // ── Character ability state ────────────────────────────────────────────────
  const myAbility = getAbilityForAvatar(myPlayer?.abilityId);
  const abilityReady = !!myPlayer?.abilityUnlocked && !myPlayer?.abilityUsed;
  const abilityActive = !!room?.abilityEffects?.[myId];
  const myFx: RoomAbilityEffect | undefined = room?.abilityEffects?.[myId];
  const [showActivation, setShowActivation] = useState(false);

  // ── Settled buzz ranking ────────────────────────────────────────────────────
  // We never render a player's queue position from the live `room.buzzes` map
  // because each client's write arrives at a different instant, causing a
  // 1st-place-then-2nd-place flicker. Instead we commit the ranking only after
  // the buzz map has been stable (unchanged) for BUZZ_SETTLE_MS. During that
  // window the UI shows a neutral "calculating" state.
  const BUZZ_SETTLE_MS = 300;
  const [committedBuzzes, setCommittedBuzzes] = useState<[string, number][]>([]);
  const pendingSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBuzzSnapshotRef = useRef<string>("");

  useEffect(() => {
    const rawBuzzes = room?.buzzes ?? {};
    const snapshot = JSON.stringify(rawBuzzes);

    // Clear committed ranking when a new question opens (buzzes wiped)
    if (Object.keys(rawBuzzes).length === 0) {
      if (pendingSettleRef.current) clearTimeout(pendingSettleRef.current);
      lastBuzzSnapshotRef.current = "";
      setCommittedBuzzes([]);
      return;
    }

    // Same snapshot as last time — nothing changed, no need to restart the timer
    if (snapshot === lastBuzzSnapshotRef.current) return;
    lastBuzzSnapshotRef.current = snapshot;

    // A new buzz arrived. Reset the settle timer.
    if (pendingSettleRef.current) clearTimeout(pendingSettleRef.current);
    pendingSettleRef.current = setTimeout(() => {
      // Buzzes have been stable for BUZZ_SETTLE_MS — commit the final order.
      // A frontOfLine effect pushes the owner to #1 regardless of timestamps.
      const ranked = rankBuzzes(rawBuzzes, room?.abilityEffects).map((r) => [
        r.playerId as string,
        r.ts as number,
      ] as [string, number]);
      setCommittedBuzzes(ranked);
    }, BUZZ_SETTLE_MS);

    return () => {
      if (pendingSettleRef.current) clearTimeout(pendingSettleRef.current);
    };
  }, [room?.buzzes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset committed buzzes when the phase changes away from buzzing
  useEffect(() => {
    if (room?.phase !== "buzzing") {
      if (pendingSettleRef.current) clearTimeout(pendingSettleRef.current);
      lastBuzzSnapshotRef.current = "";
      setCommittedBuzzes([]);
    }
  }, [room?.phase]);

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
  // Queue position is derived ONLY from the committed (settled) order
  const myQueuePos = myBuzzTs > 0 && committedBuzzes.length > 0
    ? committedBuzzes.findIndex(([pId]) => pId === myId) + 1
    : 0;
  // Whether the server order is still being collected
  const buzzSettling = hasBuzzed && committedBuzzes.length === 0;

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
    if (room.phase === "answer") soundManager.playDiscover();
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
  // The page is a fixed-height scroll container; keep a handle so we can reset
  // its scroll position whenever the phase changes. Otherwise a player scrolled
  // down on the board would be left staring mid-screen when the next question
  // (or answer) opens.
  const mainScrollRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0 });
  }, [room?.phase]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const pressRepeat = useRapidRepeat({
    threshold: 5,
    windowMs: 3000,
    cooldownMs: 9000,
    onRepeat: (key) => {
      if (key.startsWith("react:")) {
        momentBus.emit({
          icon: "💬",
          title: "Feeling chatty?",
          subtitle: "The reactions panel is not a drum machine. (It is now.)",
          tone: "playful",
        });
      } else if (key === "buzz") {
        momentBus.emit({
          icon: "🥺",
          title: "Easy, tiger",
          subtitle: "One buzz is enough — the host heard you.",
          tone: "playful",
        });
      }
      // Button Masher: a hidden badge for genuinely enthusiastic tapping.
      if (grantAchievement("buttonMasher")) {
        soundManager.playEgg();
        achievementBus.emit("buttonMasher");
      }
    },
  });

  const handleBuzz = async () => {
    pressRepeat("buzz");
    if (hasBuzzed || room?.phase !== "buzzing") return;
    soundManager.playBuzzer();
    await buzz();
  };

  // ── Activate the once-per-game ability → cinematic + host applies ─────────
  const handleActivate = async (payload: ActivationPayload) => {
    if (!myAbility) return;
    try {
      await activateAbility({
        abilityId: myAbility.id,
        targetId: payload.targetId,
        option: payload.option,
      });
      setShowActivation(false);
      soundManager.playEgg();
      abilityNoticeBus.emit({
        tone: "ace",
        icon: "⚡",
        title: myAbility.abilityName,
        subtitle: "ability activated",
      });
    } catch {
      setShowActivation(false);
    }
  };

  // ── Risky buzzer (lee): armed with a switch between NORMAL / RISK ─────────
  const isRisky = myFx?.kind === "risky" && myFx.status !== "applied";
  const riskChoice = myFx?.option === "normal" ? ("normal" as const) : ("risk" as const);

  // ── Answer window (luffy): presentational countdown while buzzing ──────
  const [windowLeft, setWindowLeft] = useState<number | null>(null);
  const myAnswerWindow =
    room?.abilityEffects && room.activeQuestion
      ? Object.values(room.abilityEffects).find(
          (e) =>
            e.kind === "answerWindow" &&
            e.playerId === myId &&
            e.status === "applied" &&
            e.appliedToQuestionId === room.activeQuestion?.questionId,
        )
      : undefined;
  const windowMs = myAnswerWindow
    ? getAbilityForAvatar(myAnswerWindow.abilityId)?.params?.windowMs
    : undefined;
  useEffect(() => {
    if (!myAnswerWindow || !windowMs) {
      setWindowLeft(null);
      return;
    }
    const tick = () => setWindowLeft(Math.max(0, Math.ceil(windowMs / 1000)));
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [myAnswerWindow, windowMs]);

  // ── Owner-only clue card (clue kinds) ─────────────────────────────────────
  const myClue = room?.activeQuestion
    ? activeClueFor(room.abilityEffects, myId, room.activeQuestion.questionId)
    : undefined;

  // ── Live ability pressure on THIS player ──────────────────────────────────
  const activeQuestionId = room?.activeQuestion?.questionId;
  const silencedNow =
    !!room?.abilityEffects && activeQuestionId
      ? Object.values(room.abilityEffects).some(
          (e) =>
            e.kind === "silence" &&
            e.targetId === myId &&
            e.status === "applied" &&
            e.appliedToQuestionId === activeQuestionId,
        )
      : false;
  // Dark Jokes = Jail (samay): jailed players cannot buzz this question.
  const jailedNow = !!room?.jail?.includes(myId);
  // Owner-only buzzing window (`john`/`anime`/`raftaar`) — only live while the
  // windowMs has NOT elapsed since the question opened. Once it lapses, the
  // owner badge disappears and everyone can buzz again.
  const activeWindowFx = activeQuestionId
    ? Object.values(room?.abilityEffects || {}).find(
        (e) =>
          e.kind === "windowLock" &&
          e.status === "applied" &&
          e.appliedToQuestionId === activeQuestionId,
      )
    : undefined;
  const windowOwnerMs =
    activeWindowFx && getAbilityForAvatar(activeWindowFx.abilityId)?.params?.windowMs;
  const windowOpen =
    !!activeWindowFx &&
    !!windowOwnerMs &&
    openedAt > 0 &&
    Date.now() - openedAt < windowOwnerMs;
  const windowOwnerNow = windowOpen ? activeWindowFx?.playerId : undefined;
  const hiddenNow = isHidden(myId, room?.abilityEffects);

  // Hidden delight: right-clicking the buzzer is a quiet wink, not an action.
  const handleSecretBuzz = (e: React.MouseEvent) => {
    e.preventDefault();
    soundManager.playEgg();
    momentBus.emit({
      icon: "🤫",
      title: "Right-click buzz?",
      subtitle: "You found the hidden buzz. The game winks back.",
      tone: "playful",
    });
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
    pressRepeat(`react:${emoji}`);
    soundManager.playPop();
    sendReaction(emoji);
  };

  const handleLeave = () => {
    leaveRoom();
    onLeave();
  };

  // Central celebration engine: rewards clutch lead changes, comebacks and
  // hot streaks with sound + confetti + toasts on the player's own device.
  useScoreCelebrations(room?.players, myId);
  useRoomCodeWordEgg(room?.id);
  useMatchMemory(room, myId);

  // Watchful reactions to this player's own behavior.
  useWrongStreakEncouragement(room, myId);
  useIdleNudge({
    active: room?.phase === "lobby",
    messages: [
      "The host is plotting something…",
      "Still here? So are we.",
      "The map is lonely without a game.",
    ],
  });
  useIdleNudge({
    active: room?.phase === "buzzing" && !hasBuzzed,
    icon: "⚡",
    tone: "playful",
    messages: [
      "The board is live — tap to buzz!",
      "Don't let them beat you to it.",
      "Crickets? The question won't answer itself.",
    ],
  });

  // "Quantum Buzz": if the player locks in the first buzz absurdly fast
  // (sub-120ms after the question opened), they bent time a little.
  const quantumShown = useRef(false);
  useEffect(() => {
    if (room?.phase === "board" || room?.phase === "lobby") {
      quantumShown.current = false;
      return;
    }
    if (quantumShown.current) return;
    if (myReaction !== null && myQueuePos === 1 && myReaction <= 120) {
      quantumShown.current = true;
      soundManager.playEgg();
      momentBus.emit({
        icon: "⚡",
        title: "Quantum Buzz!",
        subtitle: "You buzzed before the question finished loading.",
        tone: "ink",
      });
      if (grantAchievement("buzzWhisperer")) achievementBus.emit("buzzWhisperer");
    }
  }, [room?.phase, myReaction, myQueuePos]);

  if (!room) return null;

  const players = Object.values(room.players)
    .filter((p) => !p.isHost)
    .sort((a, b) => b.score - a.score || (a.joinedAt ?? 0) - (b.joinedAt ?? 0));
  // Perry's cloaking: hidden players vanish from other clients' standings.
  const visiblePlayers = players.filter(
    (p) => p.id === myId || !isHidden(p.id, room.abilityEffects),
  );

  return (
    <div className="h-screen max-h-screen flex flex-col select-none bg-primary-bg relative overflow-hidden">
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
            <PlayerAvatar seed={myId} avatar={myPlayer?.avatar} name={myName} size={36} className="rounded-full" />
          </div>
          <div>
            <p className="font-display font-bold text-base text-white leading-tight">
              {myName}
              {hiddenNow && (
                <span className="ml-2 text-[9px] font-black text-text-muted uppercase tracking-widest align-middle inline-flex items-center gap-1">
                  <EyeOff className="w-3 h-3" /> invisible
                </span>
              )}
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
          {myAbility && room.phase !== "lobby" && (
            <button
              onClick={() => setShowActivation(true)}
              disabled={!abilityReady || abilityActive}
              title={
                abilityActive
                  ? `${myAbility.abilityName} — active`
                  : abilityReady
                    ? `Activate ${myAbility.abilityName}`
                    : `Unlock after 2 correct (${myPlayer?.correctCount ?? 0}/2)`
              }
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                abilityActive
                  ? "bg-success-accent/15 border-success-accent/40 text-success-accent animate-pulse"
                  : abilityReady
                    ? "bg-warning-accent/20 border-warning-accent/50 text-warning-accent hover:bg-warning-accent/30 hover:scale-105 shadow-[0_0_18px_rgba(245,158,11,0.3)]"
                    : "bg-black/30 border-white/10 text-text-muted/70"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">
                {abilityActive
                  ? myFx?.kind === "risky"
                    ? "ARMED"
                    : "ACTIVE"
                  : abilityReady
                    ? "USE NOW"
                    : `${myPlayer?.correctCount ?? 0}/2`}
              </span>
            </button>
          )}
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

      <main ref={mainScrollRef as any} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col items-center justify-start p-4 sm:p-8 gap-6 w-full relative z-10 mx-auto" style={{ maxWidth: 1600 }}>
        <AnimatePresence mode="wait">
          {/* LOBBY — waiting */}
          {room.phase === "lobby" && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
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
                 <LobbyCurrent className="max-w-md mx-auto" />
                 <p className="text-center text-sm text-text-muted italic mt-4">
                   {lobbyVibe(players.length, false)}
                 </p>
               </div>
               {myAbility && myPlayer && (
                 <div className="w-full max-w-lg mx-auto">
                   <AbilityCard
                     player={myPlayer}
                     fx={myFx}
                     onActivate={() => setShowActivation(true)}
                   />
                 </div>
               )}
              <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mt-8">
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
                      <PlayerAvatar seed={p.id} avatar={p.avatar} name={p.name} size={48} className="mx-auto mb-3 rounded-full ring-2 ring-white/10" />
                      <p className="text-sm font-bold text-white truncate px-1">
                        {p.name}
                      </p>
                       {p.id === myId && (
                         <p className="text-[10px] font-bold text-primary-accent uppercase tracking-widest mt-1 flex items-center justify-center gap-1">
                           <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> You
                         </p>
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="w-full grid gap-6 lg:grid-cols-[1fr_380px] items-start"
            >
              {/* Left column: host banner + categories board */}
              <div className="min-w-0 flex flex-col gap-6">
              <div className="glass-panel p-4 rounded-2xl text-center border-white/10 shadow-lg">
                <p className="text-sm font-medium text-white flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-warning-accent animate-pulse" />
                  {t('hostSelecting')}
                </p>
              </div>

              {myAbility && myPlayer && (
                <div className="w-full lg:hidden max-w-md mx-auto">
                  <AbilityCard
                    player={myPlayer}
                    fx={myFx}
                    onActivate={() => setShowActivation(true)}
                  />
                </div>
              )}

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
                        <motion.div
                          key={q.id}
                          className={`relative overflow-hidden glass-panel rounded-xl p-3 font-display font-black text-lg text-center flex items-center justify-center min-h-[4.5rem] transition-all ${
                            done
                              ? "opacity-50 border-2 border-success-accent/30 text-success-accent"
                              : "text-warning-accent shadow-md"
                          }`}
                        >
                          {!done && (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute inset-0 rounded-xl tile-glow"
                              style={{ animationDelay: `${(rowIdx % 4) * 0.4}s` }}
                            />
                          )}
                          {done ? (
                            <span className="relative z-10 flex flex-col items-center leading-none pointer-events-none">
                              <Check className="w-4 h-4" />
                              <span className="text-[8px] uppercase tracking-widest mt-1 opacity-80">mapped</span>
                            </span>
                          ) : (
                            <span className="relative z-10">${q.value}</span>
                          )}
                        </motion.div>
                      );
                    }),
                  )}
                </div>
                </div>
              )}
              </div>

              {/* Right column: ability card (desktop) + leaderboard */}
              <div className="min-w-0 flex flex-col gap-6">
              {myAbility && myPlayer && (
                <div className="w-full hidden lg:block">
                  <AbilityCard
                    player={myPlayer}
                    fx={myFx}
                    onActivate={() => setShowActivation(true)}
                  />
                </div>
              )}

              <div className="glass-panel-heavy p-6 rounded-3xl space-y-4 border border-white/10 shadow-xl">
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                  <Crown className="w-4 h-4 text-warning-accent" /> {t('standings')}
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {visiblePlayers.map((p, i) => (
                    <div
                      key={p.id}
                      className={`relative flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors ${
                        p.id === myId 
                          ? "bg-primary-accent/15 border-primary-accent/30 shadow-inner" 
                          : "bg-white/5 border-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {i === 0 && p.score > 0 ? (
                          <Crown className="w-4 h-4 text-warning-accent fill-warning-accent shrink-0" />
                        ) : (
                          <span className="text-[10px] font-bold text-text-muted w-4 text-center shrink-0">#{i + 1}</span>
                        )}
                        <PlayerAvatar seed={p.id} avatar={p.avatar} name={p.name} size={28} className="shrink-0 rounded-full" />
                        <span className={`font-bold text-sm break-words min-w-0 ${p.id === myId ? "text-primary-accent" : "text-white"}`}>
                          {p.name} {p.id === myId && `(${t('you')})`}
                          {isHidden(p.id, room.abilityEffects) && (
                            <span className="ml-1.5 text-[9px] font-black text-text-muted uppercase tracking-widest">👻</span>
                          )}
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
              </div>
            </motion.div>
          )}

          {/* BUZZING */}
          {room.phase === "buzzing" && room.activeQuestion && (
            <motion.div
              key="buzzing"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-full max-w-2xl mx-auto space-y-6"
            >
              <div className="glass-panel-heavy p-8 rounded-3xl text-center space-y-5 relative shadow-2xl border border-white/10">
                {/* Live reaction gauge — ticks the first-buzz bonus window, pins to your time once you buzz */}
                <div className="absolute top-4 right-4 z-20">
                  <ReactionGauge
                    openedAt={openedAt}
                    myReactionMs={myReaction}
                    live={!hasBuzzed && !silencedNow && !jailedNow}
                  />
                </div>
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
                    <MediaViewer url={room.activeQuestion.mediaUrl} type={room.activeQuestion.type as any} audioPlaying={room.activeQuestion.audioPlaying} className="max-h-56 w-full object-contain"
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
                  {windowOwnerNow === myId && (
                    <div className="px-4 py-2 rounded-xl bg-warning-accent/15 border border-warning-accent/40 text-warning-accent text-xs font-black uppercase tracking-widest flex items-center gap-2 animate-pulse">
                      <Zap className="w-4 h-4" /> Your window — only you can buzz
                    </div>
                  )}
                  {myAbility && abilityReady && abilityActive && myFx && (
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted">
                      <AbilityBadge player={myPlayer!} />
                      <span className="text-success-accent">armed & waiting</span>
                    </div>
                  )}
                  {/* Pulsing ring animations */}
                  {silencedNow || jailedNow ? (
                    <motion.div
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.6, repeat: Infinity }}
                      className="relative w-56 h-56 rounded-full font-display font-black text-2xl tracking-wider flex flex-col items-center justify-center gap-3 bg-black/50 border-2 border-danger-accent/30 text-text-muted cursor-not-allowed"
                    >
                      {jailedNow ? (
                        <>
                          <Lock className="w-12 h-12" />
                          <span className="text-sm">IN JAIL</span>
                          <span className="text-[9px] font-bold">dark joke — you can&apos;t buzz this question</span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-12 h-12" />
                          <span className="text-sm">SILENCED</span>
                          <span className="text-[9px] font-bold">you can&apos;t buzz this question</span>
                        </>
                      )}
                    </motion.div>
                  ) : (
                  <div className="relative">
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 w-56 h-56 rounded-full border-2 border-danger-accent/40"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0, 0.2] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                      className="absolute inset-0 w-56 h-56 rounded-full border border-danger-accent/20"
                    />
                    <motion.button
                      onClick={handleBuzz}
                      onContextMenu={handleSecretBuzz}
                      disabled={hasBuzzed}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.88 }}
                      className="relative w-56 h-56 rounded-full font-display font-black text-4xl tracking-wider flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-danger-accent via-rose-600 to-red-700 border-8 border-white/20 text-white cursor-pointer overflow-hidden group shadow-[0_0_50px_rgba(244,63,94,0.5)]"
                    >
                      {/* Animated shine sweep */}
                      <motion.div
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                      />
                      <Zap className="w-14 h-14 mb-1 relative z-10 drop-shadow-lg" />
                      <span className="relative z-10">{t('buzz')}</span>
                    </motion.button>
                  </div>
                  )}
                  <p className="text-sm font-bold text-text-muted uppercase tracking-widest animate-pulse">
                    {silencedNow || jailedNow ? "wait for the next question" : t('beFirstToBuzz')}
                  </p>
                </div>
              ) : (
                <div className="glass-panel p-6 rounded-3xl space-y-5 mt-4 shadow-xl relative overflow-hidden">
                  {/* Flash effect on buzz confirmation */}
                  <motion.div
                    initial={{ opacity: 0.6, x: "-100%" }}
                    animate={{ opacity: 0, x: "100%" }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-warning-accent/30 to-transparent pointer-events-none"
                  />
                  <div className="flex items-center justify-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/10 flex-col sm:flex-row relative z-10">
                     <div className="flex items-center gap-3">
                       <motion.div 
                         animate={{ scale: [1, 1.2, 1] }}
                         transition={{ duration: 1, repeat: Infinity }}
                         className="w-3 h-3 rounded-full bg-warning-accent" 
                       />
                       <p className="text-sm font-bold text-white uppercase tracking-widest">{t('youBuzzedIn')}</p>
                     </div>
                     <div className="flex items-center gap-2 sm:pl-4 sm:border-l sm:border-white/10">
                       {/* Reaction time badge — only shown once order is settled */}
{myReaction !== null && !buzzSettling && (
                          <span className={`flex items-center gap-1 text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                            myReaction <= 1000 && myQueuePos === 1
                              ? "bg-warning-accent/20 text-warning-accent border-warning-accent/40"
                              : "bg-white/5 text-text-muted border-white/10"
                          }`}>
                            <Zap className="w-3.5 h-3.5" /> {fmtReaction(myReaction)}
                          </span>
                        )}
                        {windowLeft !== null && (
                          <span className="flex items-center gap-1 text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border bg-secondary-accent/15 text-secondary-accent border-secondary-accent/40">
                            ⏳ {windowLeft}s
                          </span>
                        )}
                       {/* While the server order is still settling show a neutral indicator */}
                       {buzzSettling && (
                         <span className="text-xs font-bold text-text-muted uppercase tracking-widest animate-pulse">
                           …
                         </span>
                       )}
                       {!buzzSettling && myQueuePos > 1 && (
                         <span className="text-xs font-black text-primary-accent uppercase tracking-widest">
                           {t('youAreInQueue', { n: myQueuePos })}
                         </span>
                       )}
                       {!buzzSettling && myReaction !== null && myReaction <= 1000 && myQueuePos === 1 && (
                         <span className="text-xs font-black text-primary-accent uppercase tracking-widest hidden sm:inline">
                           {t('firstBonus', { n: Math.max(1, Math.round((room.activeQuestion?.value ?? 0) * 0.1)) })}
                         </span>
                       )}
                     </div>
</div>

                   {/* Risky buzzer (lee): remember to pick your stakes */}
                   {isRisky && (
                     <div className="relative z-10 p-4 rounded-2xl bg-black/40 border border-white/10">
                       <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2.5 flex items-center gap-1.5">
                         <Zap className="w-3 h-3 text-secondary-accent" />
                         {riskChoice === "risk"
                           ? "RISKY MODE — ×2 on correct, −2× on wrong"
                           : "PLAYING SAFE — ×1 either way"}
                       </p>
                       <div className="grid grid-cols-2 gap-2">
                         <button
                           onClick={() => setRiskChoice("normal")}
                           disabled={riskChoice === "normal"}
                           className={`py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                             riskChoice === "normal"
                               ? "bg-success-accent/20 border-success-accent/50 text-success-accent"
                               : "bg-white/5 border-white/10 text-text-muted hover:text-white hover:bg-white/10"
                           }`}
                         >
                           Normal ×1
                         </button>
                         <button
                           onClick={() => setRiskChoice("risk")}
                           disabled={riskChoice === "risk"}
                           className={`py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                             riskChoice === "risk"
                               ? "bg-danger-accent/20 border-danger-accent/50 text-danger-accent"
                               : "bg-white/5 border-white/10 text-text-muted hover:text-white hover:bg-white/10"
                           }`}
                         >
                           ☠️ Risk ×2
                         </button>
                       </div>
                     </div>
                   )}

                    {/* Owner-only clue card */}
                    {myClue && (
                      (() => {
                        const activeQ = quiz?.categories
                          .flatMap((c) => c.questions)
                          .find((q) => q.id === room?.activeQuestion?.questionId);
                        if (!activeQ) return null;
                        const clueType = getAbilityForAvatar(myClue.abilityId)?.params?.clueType;
                        return (
                          <div className="relative z-10 p-4 rounded-2xl bg-primary-accent/15 border border-primary-accent/40 overflow-hidden">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary-accent mb-1.5 flex items-center gap-1.5">
                              <Eye className="w-3 h-3" /> Owner-only clue
                            </p>
                            <p className="text-xl font-display font-bold text-white drop-shadow leading-snug">
                              {clueText(activeQ.answer, clueType)}
                            </p>
                          </div>
                        );
                      })()
                    )}

                    {/* Community clue (kr$na) — revealed to EVERYONE */}
                    {(() => {
                      const communityFx = room?.activeQuestion
                        ? activeCommunityClueFor(room.abilityEffects, room.activeQuestion.questionId)
                        : undefined;
                      if (!communityFx) return null;
                      const activeQ = quiz?.categories
                        .flatMap((c) => c.questions)
                        .find((q) => q.id === room?.activeQuestion?.questionId);
                      if (!activeQ) return null;
                      const clueType = getAbilityForAvatar(communityFx.abilityId)?.params?.clueType;
                      return (
                        <div className="relative z-10 p-4 rounded-2xl bg-warning-accent/15 border border-warning-accent/40 overflow-hidden">
                          <p className="text-[10px] font-black uppercase tracking-widest text-warning-accent mb-1.5 flex items-center gap-1.5">
                            <Eye className="w-3 h-3" /> Sales Round — everyone sees it
                          </p>
                          <p className="text-xl font-display font-bold text-white drop-shadow leading-snug">
                            {clueText(activeQ.answer, clueType)}
                          </p>
                        </div>
                      );
                    })()}

                   {/* Buzz queue — rendered only from the settled (authoritative) order.
                      While settling we show a pulsing placeholder so nothing flickers. */}
                  <AnimatePresence mode="wait">
                    {buzzSettling && (
                      <motion.div
                        key="settling"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center justify-center gap-2 py-3"
                      >
                        <span className="w-2 h-2 rounded-full bg-warning-accent/60 animate-pulse" />
                        <span className="text-xs font-bold text-text-muted uppercase tracking-widest animate-pulse">
                          {t('buzzQueue')}…
                        </span>
                      </motion.div>
                    )}
                    {!buzzSettling && committedBuzzes.length > 0 && (
                      <motion.div
                        key="committed"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="space-y-3"
                      >
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{t('buzzQueue')}</p>
                        <div className="grid grid-cols-1 gap-3">
                          {committedBuzzes.map(([pId, ts], idx) => {
                            const p = room.players[pId];
                            if (!p) return null;
                            const isMe = pId === myId;
                            const isFirst = idx === 0;
                            const react = reactionFor(ts as number);
                            return (
                              <motion.div
                                key={pId}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: idx * 0.04 }}
                                className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                                  isFirst
                                    ? "bg-warning-accent/15 border-warning-accent/30 shadow-inner"
                                    : "bg-white/5 border-white/5"
                                } ${isMe && !isFirst ? "ring-1 ring-primary-accent/50" : ""}`}
                              >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${isFirst ? "bg-warning-accent text-black" : "bg-white/10 text-text-muted"}`}>
                                  {idx + 1}
                                </div>
                                <PlayerAvatar seed={p.id} avatar={p.avatar} name={p.name} size={28} className="shrink-0 rounded-full" />
                                <div className="flex-1 min-w-0">
                                  <p className={`font-bold text-sm break-words ${isFirst ? "text-warning-accent" : "text-white"}`}>
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
                              </motion.div>
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
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
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
                    <MediaViewer url={room.activeQuestion.mediaUrl} type={room.activeQuestion.type as any} audioPlaying={room.activeQuestion.audioPlaying} className="max-h-56 w-full object-contain"
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
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-full max-w-2xl mx-auto space-y-6"
            >
              <div className="glass-panel-heavy p-8 rounded-3xl text-center space-y-6 shadow-2xl border border-white/10 relative">
                {room.activeQuestion.mediaUrl && (
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-lg mx-auto max-w-full max-h-56 bg-black">
                    <MediaViewer url={room.activeQuestion.mediaUrl} type={room.activeQuestion.type as any} audioPlaying={room.activeQuestion.audioPlaying} className="max-h-56 w-full object-contain"
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
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full"
            >
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={() => setCategoryModalId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
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

      {/* Character ability activation */}
      {myAbility && (
        <ActivationModal
          def={showActivation ? myAbility : null}
          meId={myId}
          players={players}
          onConfirm={handleActivate}
          onClose={() => setShowActivation(false)}
        />
      )}
    </div>
  );
};
