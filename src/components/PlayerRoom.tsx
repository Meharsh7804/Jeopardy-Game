import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoom } from "../context/RoomContext";
import { Zap, LogOut, X, Info, Settings as SettingsIcon, Sparkles, EyeOff, Eye, Check, QrCode } from "lucide-react";
import { soundManager } from "../utils/sound";
import { db } from "../firebase";
import { ref, get, onValue } from "firebase/database";
import type { Quiz } from "../types/jeopardy";
import { PlayerAvatar } from "../utils/playerAvatar";
import { ResultsScreen } from "./ResultsScreen";
import { ReactionOverlay } from "./ReactionOverlay";

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
/* lobby helpers removed - using Green Room design */
import { QrJoinModal } from "./QrJoinModal";

import { ReactionGauge } from "./ui/ReactionGauge";
import { ActivationModal, type ActivationPayload } from "../abilities/ActivationModal";
import { getAbilityForAvatar } from "../abilities/config";
import { getAvatarByIdOrSeed } from "../utils/avatarImages";
import { rankBuzzes, clueText, activeClueFor, activeCommunityClueFor, isHidden } from "../abilities/engine";
import type { RoomAbilityEffect } from "../types/jeopardy";
import { abilityNoticeBus } from "../abilities/internal";

const LOBBY_TRIVIA_FALLBACK = [
  "Honey never spoils — archaeologists have found edible honey in ancient Egyptian tombs over 3,000 years old.",
  "A day on Venus is longer than a year on Venus.",
  "Bananas are berries, but strawberries are not.",
  "Octopuses have three hearts, nine brains, and blue blood.",
  "Wombat poop is cube-shaped, which helps it stay in place.",
  "A group of flamingos is called a flamboyance.",
];

const REACTION_EMOJIS = ["🔥", "🎉", "😂", "😱", "🤯", "🙏"];

interface PlayerRoomProps {
  onLeave: () => void;
}

export const PlayerRoom: React.FC<PlayerRoomProps> = ({ onLeave }) => {
  const { room, myId, myName, buzz, sendReaction, leaveRoom, activateAbility, setRiskChoice } = useRoom();
  const { t } = useSettings();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [categoryModalId, setCategoryModalId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const myPlayer = room?.players?.[myId];
  const hasBuzzed = !!room?.buzzes?.[myId];
  const isSpectator = !!myPlayer?.isSpectator;

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

  const [lobbyFact, setLobbyFact] = useState(LOBBY_TRIVIA_FALLBACK[0]);
  const [lobbyFactKey, setLobbyFactKey] = useState(0);
  const [factProgress, setFactProgress] = useState(0);
  const [buzzerBestMs, setBuzzerBestMs] = useState<number | null>(null);
  const [buzzerStatus, setBuzzerStatus] = useState("READY FOR SOUNDCHECK");
  const [buzzerFlash, setBuzzerFlash] = useState(false);
  const buzzerArmRef = useRef<number | null>(null);
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

  const fetchLobbyFact = useCallback(async () => {
    const fallback = () => LOBBY_TRIVIA_FALLBACK[Math.floor(Math.random() * LOBBY_TRIVIA_FALLBACK.length)];
    try {
      const res = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json() as { text?: string };
        const text = String(data?.text || "").replace(/\s+/g, " ").trim();
        if (text) { setLobbyFact(text); setLobbyFactKey((k) => k + 1); setFactProgress(0); return; }
      }
      throw new Error("bad");
    } catch {
      try {
        const res = await fetch("https://opentdb.com/api.php?amount=1&type=multiple", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json() as { results?: Array<{ question?: string; correct_answer?: string }> };
          const r = data?.results?.[0];
          const q = String(r?.question || "").replace(/&quot;|&#039;|&amp;|&ldquo;|&rdquo;/g, "'").replace(/<[^>]+>/g, "").trim();
          const a = String(r?.correct_answer || "").replace(/&quot;|&#039;|&amp;|&ldquo;|&rdquo;/g, "'").replace(/<[^>]+>/g, "").trim();
          if (q && a) { setLobbyFact(`Did you know? ${q} Answer: ${a}.`); setLobbyFactKey((k) => k + 1); setFactProgress(0); return; }
        }
      } catch {}
      setLobbyFact(fallback()); setLobbyFactKey((k) => k + 1); setFactProgress(0);
    }
  }, []);

  useEffect(() => {
    if (room?.phase !== "lobby") return;
    fetchLobbyFact();
    const advance = window.setInterval(fetchLobbyFact, 18000);
    const tick = window.setInterval(() => setFactProgress((p) => Math.min(100, p + (100 / (18000 / 200)))), 200);
    return () => { window.clearInterval(advance); window.clearInterval(tick); };
  }, [room?.phase, fetchLobbyFact]);

  const playSoundcheckBeep = useCallback(() => {
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square"; osc.frequency.value = 880;
      gain.gain.value = 0.03;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.08);
      osc.onended = () => { ctx.close().catch(() => {}); };
    } catch {}
  }, []);

  const triggerBuzzerSoundcheck = useCallback(() => {
    const now = performance.now();
    const arm = buzzerArmRef.current;
    const ms = arm ? Math.max(1, Math.round(now - arm)) : Math.round(120 + Math.random() * 180);
    buzzerArmRef.current = now;
    setBuzzerBestMs((prev) => (prev === null || ms < prev ? ms : prev));
    setBuzzerStatus("REFLEXES LOCKED IN!");
    setBuzzerFlash(true);
    playSoundcheckBeep();
    window.setTimeout(() => setBuzzerFlash(false), 180);
    window.setTimeout(() => setBuzzerStatus("READY FOR SOUNDCHECK"), 1400);
  }, [playSoundcheckBeep]);

  useEffect(() => {
    if (room?.phase !== "lobby") return;
    buzzerArmRef.current = performance.now();
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      e.preventDefault();
      triggerBuzzerSoundcheck();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [room?.phase, triggerBuzzerSoundcheck]);

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

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room?.id || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
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
    .filter((p) => !p.isHost && !p.isSpectator)
    .sort((a, b) => b.score - a.score || (a.joinedAt ?? 0) - (b.joinedAt ?? 0));
  // Perry's cloaking: hidden players vanish from other clients' standings.
  const visiblePlayers = players.filter(
    (p) => p.id === myId || !isHidden(p.id, room.abilityEffects),
  );

  return (
    <div className="h-screen max-h-screen flex flex-col select-none bg-transparent relative overflow-hidden">
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
            className="fixed top-0 inset-x-0 z-50 bg-green-600 text-[#111111] text-center text-xs font-bold uppercase tracking-widest py-2"
          >
            {t('buzzPreserved')}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      {room.phase !== "lobby" && room.phase !== "board" && room.phase !== "buzzing" && room.phase !== "answer" && room.phase !== "ended" && (
      <header className="glass-panel sticky top-0 z-40 px-5 py-4 flex items-center justify-between border-b border-[#111111]/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-accent to-secondary-accent flex items-center justify-center shadow-lg ring-2 ring-white/10">
            <PlayerAvatar seed={myId} avatar={myPlayer?.avatar} name={myName} size={36} className="rounded-full" />
          </div>
          <div>
            <p className="font-display font-bold text-base text-[#111111] leading-tight">
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
          <div className="px-4 py-2 rounded-xl bg-[#F4EFE6] border border-[#111111]/15 shadow-inner flex items-center gap-2">
            <span className="font-display font-black text-xl text-[#111111]">{myPlayer?.score ?? 0}</span>
            <span className="text-xs font-bold text-text-muted uppercase tracking-widest">{t('pts')}</span>
          </div>
          {myAbility && (
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
                    : "bg-[#F4EFE6] border-[#111111]/15 text-text-muted/70"
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
            className="p-2.5 rounded-xl bg-[#F4EFE6] border border-[#111111]/15 text-text-muted hover:text-[#111111] hover:bg-[#E5DEC9] transition-all shadow-inner"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
          <button
            onClick={handleLeave}
            title={t('leaveRoom')}
            className="p-2.5 rounded-xl bg-[#F4EFE6] border border-[#111111]/15 text-text-muted hover:text-[#111111] hover:bg-[#E5DEC9] transition-all shadow-inner"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>
      )}

      <main
        ref={mainScrollRef as any}
        className={`flex-1 min-h-0 w-full relative z-10 mx-auto ${
          room.phase === "board" || room.phase === "buzzing" || room.phase === "answer"
            ? "overflow-hidden flex flex-col p-0 max-w-none"
            : "overflow-y-auto custom-scrollbar flex flex-col items-center justify-start p-4 sm:p-8 gap-6"
        }`}
        style={room.phase === "board" || room.phase === "buzzing" || room.phase === "answer" ? undefined : { maxWidth: 1600 }}
      >
        <AnimatePresence mode="wait">
          {/* LOBBY — waiting */}
          {room.phase === "lobby" && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="w-full min-h-full flex flex-col bg-[#F4EFE6] -m-4 sm:-m-8"
            >
              {/* 1. TOP BROADCAST BAR */}
              <header className="shrink-0 border-b-2 border-[#111111] bg-[#FFFFFF]">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-[#FF3B1D] border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center justify-center shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFD60A" stroke="#111111" strokeWidth="2" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 10-12h-7z" /></svg>
                    </div>
                    <div className="min-w-0">
                      <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-[1rem] sm:text-[1.1rem] uppercase tracking-[-0.02em] leading-none text-[#111111] truncate">Buzzing With Quizzing</div>
                      <div className="mt-1 inline-flex items-center px-2 py-0.5 border border-[#111111] bg-[#F4EFE6] font-mono text-[0.625rem] font-bold tracking-[0.08em] uppercase text-[#111111]/70 truncate max-w-full">Pack: {quiz?.title || "Loading..."}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 self-start lg:self-auto">
                    <div className="flex items-stretch border-2 border-[#111111] bg-[#FFD60A] shadow-[3px_3px_0_#111111]">
                      <div className="px-3 py-2 border-r-2 border-[#111111] bg-[#FFFFFF]/35">
                        <div className="font-mono text-[0.5625rem] font-bold tracking-[0.12em] uppercase text-[#111111]/60 leading-none">Room Code</div>
                        <div className="font-mono text-[1.25rem] sm:text-[1.5rem] font-bold tracking-[0.14em] text-[#111111] leading-none mt-1">{room.id}</div>
                      </div>
                      <button type="button" onClick={handleCopyCode} className="px-3 font-mono text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-[#111111] hover:bg-[#111111] hover:text-[#FFD60A] transition-colors border-r-2 border-[#111111]">
                        {copied ? "COPIED!" : "COPY"}
                      </button>
                      <button type="button" onClick={() => setShowQR(true)} className="px-3 font-mono text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-[#111111] hover:bg-[#111111] hover:text-[#FFD60A] transition-colors inline-flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5" /> QR
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end lg:self-auto">
                    <button type="button" onClick={() => setShowSettings(true)} className="p-2.5 bg-[#FFFFFF] border-2 border-[#111111] shadow-[2px_2px_0_#111111] text-[#111111] hover:bg-[#F4EFE6] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all" title={t('settingsTitle')}>
                      <SettingsIcon className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={handleLeave} className="inline-flex items-center gap-2 px-3 py-2.5 bg-[#FFFFFF] border-2 border-[#111111] shadow-[2px_2px_0_#111111] font-mono text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-[#111111] hover:bg-[#FF3B1D] hover:text-white active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all">
                      <LogOut className="w-4 h-4" /> Leave
                    </button>
                  </div>
                </div>
              </header>

              <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  {/* LEFT: Contestant Podium Wall */}
                  <div className="lg:col-span-7 flex flex-col">
                  <section className="flex-1 flex flex-col bg-[#F4EFE6] border-2 border-[#111111] shadow-[6px_6px_0_#111111]">
                    <div className="bg-[#111111] px-4 py-3 flex items-center justify-between gap-3 shrink-0">
                      <span className="font-mono text-[0.75rem] font-bold tracking-[0.1em] uppercase text-white">Stage Floor // Contestant Podiums</span>
                      <span className="font-mono text-[0.75rem] font-bold tracking-[0.08em] uppercase text-[#FFD60A]">{players.length} Joined</span>
                    </div>
                    <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3.5 flex-1 content-start bg-[#F4EFE6]">
                      <AnimatePresence>
                        {players.map((p, idx) => {
                          const isMe = p.id === myId;
                          const pDef = getAbilityForAvatar(p.abilityId || p.avatar);
                          const connected = p.connected !== false;
                          return (
                            <motion.div
                              layout
                              key={p.id}
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              className={`flex flex-col justify-between overflow-hidden border-2 border-[#111111] shadow-[4px_4px_0_#111111] min-h-[155px] ${connected ? "bg-[#FFD60A]" : "bg-[#E5DEC9]"}`}
                            >
                              <div className="bg-[#111111] text-[#FFFFFF] px-2.5 py-1.5 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-mono text-[10px] font-bold tracking-[0.08em] uppercase text-[#FFD60A] shrink-0">Podium {String(idx + 1).padStart(2, "0")}</span>
                                  {isMe && <span className="px-1 py-0.5 bg-[#00C271] text-[#111111] font-mono text-[9px] font-bold uppercase tracking-[0.04em]">You</span>}
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
                              <div className={`border-t-2 border-[#111111] py-1 text-center font-mono text-[10px] font-black tracking-widest uppercase ${connected ? "bg-[#00C271] text-[#111111]" : "bg-[#FF3B1D] text-white"}`}>
                                {connected ? "✓ Locked In // Ready" : "● Disconnected"}
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                      {Array.from({ length: Math.max(0, 6 - players.length) }).map((_, i) => {
                        const slot = players.length + i + 1;
                        return (
                          <div key={`open-${i}`} className="bg-[#FFFFFF] border-2 border-dashed border-[#111111]/40 flex flex-col items-center justify-center p-4 min-h-[155px] gap-3">
                            <div className="font-mono font-bold text-[0.75rem] border border-[#111111]/30 bg-[#F4EFE6] px-2.5 py-1 text-[#111111]/60">{String(slot).padStart(2, "0")}</div>
                            <div className="font-mono text-[10px] font-bold tracking-[0.1em] uppercase text-[#111111]/40 text-center">Awaiting Player</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-auto bg-[#111111] text-[#FFD60A] px-4 py-3 border-t-2 border-[#111111] flex items-center justify-between gap-3 font-mono text-xs font-bold tracking-[0.06em] uppercase">
                      <span className="flex items-center gap-2"><span className="w-2 h-2 bg-[#FFD60A] animate-pulse" /> On Standby — Host Will Launch Board Soon</span>
                      <span className="text-[#F4EFE6]/70 shrink-0">Room: {room.id}</span>
                    </div>
                  </section>
                  </div>

                  {/* RIGHT: Teleprompter + Buzzer Soundcheck */}
                  <div className="lg:col-span-5 flex flex-col justify-between gap-3.5">
                    <section className="bg-[#FFFFFF] p-2 border-2 border-[#111111] shadow-[6px_6px_0_#111111] flex-1 flex flex-col">
                      <div className="bg-[#111111] text-white border-2 border-[#111111] p-3.5 flex-1 flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 font-mono text-[0.6875rem] font-bold tracking-[0.1em] uppercase text-[#00C271]">
                            <span className="w-2 h-2 bg-[#00C271] animate-pulse" />
                            Live Teleprompter // Studio Trivia
                          </div>
                          <button type="button" onClick={fetchLobbyFact} className="px-2.5 py-1 border border-[#444444] font-mono text-[0.625rem] font-bold tracking-[0.08em] uppercase text-white/80 hover:border-[#FFD60A] hover:text-[#FFD60A] transition-colors">Next Fact ↻</button>
                        </div>
                        <div className="min-h-[84px] flex items-center">
                          <AnimatePresence mode="wait">
                            <motion.p key={lobbyFactKey} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="text-[0.9375rem] leading-relaxed text-[#F4EFE6]/90" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                              {lobbyFact}
                            </motion.p>
                          </AnimatePresence>
                        </div>
                        <div className="mt-3 h-1.5 bg-[#333333] border border-[#444444] overflow-hidden">
                          <div className="h-full bg-[#FFD60A] transition-[width] duration-200 ease-linear" style={{ width: `${factProgress}%` }} />
                        </div>
                      </div>
                    </section>

                    <section className={`bg-[#FFFFFF] border-2 border-[#111111] shadow-[6px_6px_0_#111111] p-3.5 transition-colors ${buzzerFlash ? "bg-[#FFD60A]/20" : ""}`}>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="font-mono text-[0.6875rem] font-bold tracking-[0.1em] uppercase text-[#111111]/55">Pre-Show // Buzzer Soundcheck</span>
                        <span className="font-mono text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-[#111111]">Best: {buzzerBestMs !== null ? `${buzzerBestMs} ms` : "--- ms"}</span>
                      </div>
                      <button type="button" onClick={triggerBuzzerSoundcheck} className="w-full py-3 bg-[#F4EFE6] hover:bg-[#FFD60A] active:translate-x-[2px] active:translate-y-[2px] border-2 border-[#111111] shadow-[3px_3px_0_#111111] active:shadow-none font-black uppercase tracking-[0.02em] text-[#111111] transition-[transform,box-shadow,background-color]" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
                        ⚡ Test Buzzer (Space)
                      </button>
                      <div className="mt-2 font-mono text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-[#00C271]">{buzzerStatus}</div>
                    </section>

                    {myAbility && myPlayer && (() => {
                      const correct = Math.min(2, Math.max(0, myPlayer.correctCount ?? 0));
                      const pct = (correct / 2) * 100;
                      const canActivate = !!abilityReady && !abilityActive;
                      const avatar = getAvatarByIdOrSeed(myPlayer.avatar || myPlayer.abilityId);
                      return (
                        <section
                          className={`bg-[#FFFFFF] border-2 border-[#111111] shadow-[6px_6px_0_#111111] rounded-none overflow-hidden ${canActivate ? "cursor-pointer hover:bg-[#F4EFE6]" : ""}`}
                          onClick={canActivate ? () => setShowActivation(true) : undefined}
                          role={canActivate ? "button" : undefined}
                          tabIndex={canActivate ? 0 : undefined}
                          onKeyDown={canActivate ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowActivation(true); } } : undefined}
                        >
                          <div className="bg-[#111111] text-[#FFFFFF] px-4 py-2 flex items-center justify-between font-mono text-xs font-bold tracking-[0.08em] uppercase">
                            <span>Equipped Power-Up // Loadout</span>
                            <span className="text-[#FFD60A]">{correct} / 2 Correct</span>
                          </div>
                          <div className="p-3.5 flex items-center gap-3.5">
                            <div className="w-14 h-14 border-2 border-[#111111] bg-[#FFD60A] p-0.5 shrink-0 rounded-none overflow-hidden">
                              {avatar?.src ? <img src={avatar.src} alt={myAbility.name} className="w-full h-full object-cover border border-[#111111]/20" style={{ objectPosition: avatar.position }} /> : <div className="w-full h-full bg-[#F4EFE6]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="bg-[#FF3B1D] text-[#FFFFFF] font-mono text-[10px] font-bold px-2 py-0.5 inline-block uppercase tracking-[0.04em]">{myAbility.emoji} {myAbility.abilityName}</div>
                              <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-base uppercase text-[#111111] leading-tight mt-1 truncate">{myAbility.name}</div>
                              <div className="mt-2 h-2.5 bg-[#F4EFE6] border border-[#111111] overflow-hidden">
                                <div className="h-full bg-[#00C271]" style={{ width: `${abilityActive ? 100 : pct}%` }} />
                              </div>
                              <div className="mt-1 font-mono text-[10px] font-bold tracking-[0.06em] uppercase text-[#111111]/55">
                                {abilityActive ? "Ability Active" : canActivate ? "Ready — Tap to Activate" : "Unlock After 2 Correct Answers"}
                              </div>
                            </div>
                          </div>
                        </section>
                      );
                    })()}
                  </div>
                </div>

               
              </div>
            </motion.div>
          )}

          {/* BOARD — unified full-width studio stage */}
          {room.phase === "board" && (
            <motion.div
              key="board"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex-1 min-h-0 w-full flex flex-col overflow-hidden bg-[#F4EFE6]"
              style={{ backgroundImage: "linear-gradient(to right, #E5DEC9 1px, transparent 1px), linear-gradient(to bottom, #E5DEC9 1px, transparent 1px)", backgroundSize: "40px 40px" }}
            >
              {/* 1. Unified Top Broadcast & Standings Bar */}
              <header className="h-14 bg-[#FFFFFF] border-b-2 border-[#111111] px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 border-2 border-[#111111] bg-[#FFD60A] p-0.5 shrink-0 rounded-none overflow-hidden">
                    <PlayerAvatar seed={myId} avatar={myPlayer?.avatar} name={myName} size={32} className="!rounded-none w-full h-full" />
                  </div>
                  <div className="min-w-0">
                    <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-sm uppercase leading-none text-[#111111] truncate">{myName}</div>
                    <div className="mt-1 inline-flex bg-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0_#111111] px-2.5 py-0.5 font-['Archivo_Black'] text-[10px] leading-none text-[#111111]">{myPlayer?.score ?? 0} PTS</div>
                  </div>
                </div>

                <div className="bg-[#111111] text-[#FFD60A] px-3.5 py-1.5 font-mono text-[11px] sm:text-xs font-bold flex items-center gap-2 shrink-0 max-w-[42%]">
                  <span className="w-2 h-2 bg-[#FF3B1D] animate-pulse shrink-0" />
                  <span className="uppercase tracking-[0.04em] truncate">{t('hostSelecting')}</span>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <div className="hidden md:flex items-center gap-1.5 overflow-x-auto max-w-[22rem] custom-scrollbar">
                    {visiblePlayers.map((p, i) => (
                      <div key={p.id} className={`border-2 border-[#111111] px-2.5 py-1 font-mono text-[10px] font-bold uppercase whitespace-nowrap ${p.id === myId ? "bg-[#FFD60A] text-[#111111]" : "bg-[#F4EFE6] text-[#111111]"}`}>
                        #{i + 1} {p.name} • {p.score}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setShowSettings(true)} title={t('settingsTitle')} className="w-9 h-9 bg-[#FFFFFF] hover:bg-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center justify-center rounded-none shrink-0">
                    <SettingsIcon className="w-4 h-4 text-[#111111]" />
                  </button>
                  <button type="button" onClick={handleLeave} title={t('leaveRoom')} className="w-9 h-9 bg-[#FFFFFF] hover:bg-[#FF3B1D] hover:text-white border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center justify-center rounded-none shrink-0 text-[#111111]">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </header>

              {/* 2. Full-Width Neo-Brutalist Jeopardy Board */}
              <div className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-4 sm:px-6 py-2.5 flex flex-col">
                {quiz ? (
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {(() => {
                      const rowCount = quiz.categories[0]?.questions.length ?? 5;
                      return (
                    <div
                      className="grid gap-2 h-full min-h-0"
                      style={{
                        gridTemplateColumns: `repeat(${quiz.categories.length}, minmax(0, 1fr))`,
                        gridTemplateRows: `auto repeat(${rowCount}, minmax(0, 1fr))`,
                        minWidth: quiz.categories.length > 6 ? `${quiz.categories.length * 140}px` : undefined,
                      }}
                    >
                      {quiz.categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoryModalId(cat.id)}
                          className="bg-[#111111] border-2 border-[#111111] shadow-[3px_3px_0_#111111] py-2 px-2 flex flex-col items-center justify-center text-center min-h-[52px] rounded-none hover:bg-[#1a1a1a] transition-colors"
                        >
                          <span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-[#FFFFFF] text-xs sm:text-sm lg:text-[15px] uppercase tracking-wide leading-snug">{cat.name}</span>
                          {cat.description?.trim() && <span className="mt-0.5 text-[#FFD60A] text-xs leading-none">ⓘ</span>}
                        </button>
                      ))}
                      {Array.from({ length: rowCount }).map((_, rowIdx) =>
                        quiz.categories.map((cat) => {
                          const q = cat.questions[rowIdx];
                          if (!q) return <div key={`${cat.id}-${rowIdx}`} className="border-2 border-[#111111]/15 bg-[#E6E0D4]/50" />;
                          const done = !!room.completedQuestions?.[q.id];
                          return (
                            <div
                              key={q.id}
                              className={`relative overflow-hidden rounded-none border-2 flex items-center justify-center p-1 min-h-0 font-['Archivo_Black'] text-lg sm:text-xl transition-all ${
                                done
                                  ? "bg-[#E6E0D4] border-[#111111]/25 text-[#111111]/20 shadow-none"
                                  : "bg-[#FFFFFF] border-[#111111] text-[#111111] shadow-[3px_3px_0_#111111]"
                              }`}
                            >
                              {done ? <Check className="w-5 h-5 opacity-30" /> : <span>${q.value}</span>}
                            </div>
                          );
                        }),
                      )}
                    </div>
                    );
                  })()}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center font-mono text-sm font-bold uppercase tracking-[0.08em] text-[#111111]/50">Loading Board...</div>
                )}
              </div>

              {/* 3. Single Horizontal Power-Up Console Strip */}
              <div className="bg-[#111111] text-[#FFFFFF] border-t-2 border-[#111111] px-4 sm:px-6 py-2.5 shrink-0">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 border-2 border-[#FFD60A] bg-[#1C1C1C] shrink-0 rounded-none overflow-hidden">
                      {(() => {
                        const av = getAvatarByIdOrSeed(myPlayer?.avatar || myPlayer?.abilityId);
                        return av?.src ? <img src={av.src} alt={myAbility?.name || "Power-up"} className="w-full h-full object-cover" style={{ objectPosition: av.position }} /> : null;
                      })()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {myAbility && <span className="bg-[#FF3B1D] text-[#FFFFFF] font-mono text-[10px] font-bold px-2 py-0.5 uppercase tracking-[0.04em]">{myAbility.abilityName}</span>}
                        <span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-sm text-[#FFD60A] uppercase leading-none">{myAbility?.name || "No Power-Up"}</span>
                      </div>
                      <div className="text-xs text-[#CCCCCC] truncate mt-0.5">{myAbility?.tagline || "Select a character to gain an ability."}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {(() => {
                      const correct = Math.min(2, Math.max(0, myPlayer?.correctCount ?? 0));
                      const canActivate = !!abilityReady && !abilityActive;
                      return (
                        <>
                          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.06em]">
                            <span className="text-[#F4EFE6]/70">Charge {correct}/2</span>
                            <div className="flex items-center gap-1">
                              {[0, 1].map((i) => (
                                <span key={i} className={`w-5 h-3 border border-[#555555] ${i < correct || abilityActive ? "bg-[#00C271]" : "bg-[#2A2A2A]"}`} />
                              ))}
                            </div>
                          </div>
                          {abilityActive ? (
                            <span className="border border-[#00C271] text-[#00C271] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.06em]">Active</span>
                          ) : canActivate ? (
                            <button type="button" onClick={() => setShowActivation(true)} className="bg-[#00C271] hover:bg-[#FFD60A] text-[#111111] font-['Archivo_Black'] text-xs px-4 py-2 border-2 border-[#FFFFFF] shadow-[3px_3px_0_#FFD60A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none uppercase tracking-[0.03em] transition-[transform,box-shadow,background-color]">
                              ⚡ Activate Power-Up
                            </button>
                          ) : (
                            <span className="border border-[#444444] text-[#888888] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.06em]">Locked</span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* BUZZING — TV Studio Live Clue Monitor */}
          {room.phase === "buzzing" && room.activeQuestion && (() => {
            const aq = room.activeQuestion;
            const buzzDisabled = isSpectator || (!!aq.dailyDoublePlayerId && aq.dailyDoublePlayerId !== myId) || silencedNow || jailedNow;
            const buzzLabel = isSpectator ? "Spectating" : (aq.dailyDoublePlayerId && aq.dailyDoublePlayerId !== myId) ? "Daily Double" : jailedNow ? "In Jail" : silencedNow ? "Silenced" : "";
            const statusLine = buzzSettling ? "● SIGNALS LOCKING — HOST IS ADJUDICATING..." : hasBuzzed ? `● ${myName.toUpperCase()} BUZZED IN — WAITING FOR HOST` : buzzDisabled ? `● ${buzzLabel.toUpperCase()} — BUZZER LOCKED` : "⚡ THE BOARD IS LIVE — TAP OR PRESS [SPACE] TO BUZZ!";
            return (
            <motion.div key="buzzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 min-h-0 w-full flex flex-col overflow-hidden bg-[#F4EFE6]" style={{ backgroundImage: "linear-gradient(to right, #E5DEC9 1px, transparent 1px), linear-gradient(to bottom, #E5DEC9 1px, transparent 1px)", backgroundSize: "40px 40px" }}>
              {/* Top Telemetry Bar */}
              <header className="h-14 bg-[#FFFFFF] border-b-2 border-[#111111] px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 border-2 border-[#111111] bg-[#FFD60A] p-0.5 shrink-0 overflow-hidden"><PlayerAvatar seed={myId} avatar={myPlayer?.avatar} name={myName} size={32} className="!rounded-none w-full h-full" /></div>
                  <div className="min-w-0">
                    <div style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-sm uppercase leading-none text-[#111111] truncate">{myName}</div>
                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#111111]/55">Room {room.id}</div>
                  </div>
                  <div className="ml-1 bg-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0_#111111] px-2.5 py-0.5 font-['Archivo_Black'] text-[10px] text-[#111111]">{myPlayer?.score ?? 0} PTS</div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setShowSettings(true)} title={t('settingsTitle')} className="w-9 h-9 bg-[#FFFFFF] hover:bg-[#FFD60A] border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center justify-center"><SettingsIcon className="w-4 h-4 text-[#111111]" /></button>
                  <button type="button" onClick={handleLeave} title={t('leaveRoom')} className="w-9 h-9 bg-[#FFFFFF] hover:bg-[#FF3B1D] hover:text-white border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center justify-center text-[#111111]"><LogOut className="w-4 h-4" /></button>
                </div>
              </header>

              {/* Center Stage */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col items-center gap-4">
                <div className="max-w-3xl w-full mx-auto bg-[#FFFFFF] border-[3px] border-[#111111] shadow-[8px_8px_0_#111111] overflow-hidden shrink-0">
                  <div className="bg-[#111111] text-[#FFFFFF] px-5 py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="bg-[#F4EFE6] text-[#111111] px-2.5 py-0.5 font-bold text-xs uppercase tracking-[0.04em] truncate max-w-[50vw]">{aq.categoryName}</span>
                      <span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-lg text-[#FFD60A] shrink-0">${aq.wager ?? aq.value}</span>
                      {aq.isDailyDouble && <span className="bg-[#FFD60A] text-[#111111] px-2 py-0.5 font-mono text-[10px] font-bold uppercase">DD</span>}
                    </div>
                    {timeLeft !== null && (
                      <span className={`px-3 py-0.5 font-mono text-sm font-black shrink-0 ${aq.paused ? "bg-[#F4EFE6] text-[#111111]" : timeLeft < 4 ? "bg-[#FF3B1D] text-[#FFFFFF]" : "bg-[#FFD60A] text-[#111111]"}`}>
                        {aq.paused ? "PAUSED" : `⚡ ${timeLeft.toFixed(2)}s`}
                      </span>
                    )}
                  </div>
                  <div className="p-6 sm:p-8 text-center bg-[#FFFFFF] relative">
                    <div className="absolute top-3 right-3 z-20"><ReactionGauge openedAt={openedAt} myReactionMs={myReaction} live={!hasBuzzed && !silencedNow && !jailedNow} /></div>
                    {aq.mediaUrl && (
                      <div className="relative overflow-hidden border-2 border-[#111111] shadow-[4px_4px_0_#111111] mx-auto max-w-full max-h-56 bg-black mb-5">
                        <MediaViewer url={aq.mediaUrl} type={aq.type as any} audioPlaying={aq.audioPlaying} className="max-h-56 w-full object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      </div>
                    )}
                    <p className="text-2xl sm:text-3xl font-extrabold text-[#111111] leading-snug whitespace-pre-wrap" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{aq.text}</p>
                    <ReactionOverlay reactions={room.reactions} />
                  </div>
                </div>

                {/* Buzzer / State */}
                <div className="my-auto flex flex-col items-center gap-3 py-2">
                  {windowOwnerNow === myId && !hasBuzzed && !buzzDisabled && <div className="px-3 py-1.5 bg-[#FFD60A] border-2 border-[#111111] font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[#111111]">⚡ Your window — only you can buzz</div>}
                  {isSpectator ? (
                    <div className="w-56 h-32 sm:w-64 sm:h-36 border-[3px] border-[#111111] shadow-[4px_4px_0_#111111] bg-[#E6E0D4] text-[#111111]/60 flex flex-col items-center justify-center gap-1.5"><Eye className="w-8 h-8" /><span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-2xl uppercase">Spectating</span></div>
                  ) : aq.dailyDoublePlayerId && aq.dailyDoublePlayerId !== myId ? (
                    <div className="w-56 h-32 sm:w-64 sm:h-36 border-[3px] border-[#111111] shadow-[4px_4px_0_#111111] bg-[#FFD60A] text-[#111111] flex flex-col items-center justify-center gap-1 px-4 text-center"><span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-xl uppercase">Daily Double</span><span className="font-mono text-[10px] font-bold uppercase">{room.players[aq.dailyDoublePlayerId]?.name} is answering</span></div>
                  ) : silencedNow || jailedNow ? (
                    <div className="w-56 h-32 sm:w-64 sm:h-36 border-[3px] border-[#111111] shadow-[3px_3px_0_#111111] bg-[#E6E0D4] text-[#111111]/50 cursor-not-allowed flex flex-col items-center justify-center gap-1.5"><span className="text-2xl">🔒</span><span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-xl sm:text-2xl uppercase">{jailedNow ? "In Jail" : "Silenced"}</span></div>
                  ) : !hasBuzzed ? (
                    <motion.button onClick={handleBuzz} onContextMenu={handleSecretBuzz} whileTap={{ x: 4, y: 4 }} className="w-56 h-32 sm:w-64 sm:h-36 border-[3px] border-[#111111] shadow-[8px_8px_0_#111111] active:shadow-[2px_2px_0_#111111] transition-all flex flex-col items-center justify-center gap-1.5 select-none bg-[#FF3B1D] hover:bg-[#E02E12] text-[#FFFFFF] cursor-pointer">
                      <Zap className="w-8 h-8 fill-current" />
                      <span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="text-3xl sm:text-4xl tracking-wider leading-none">BUZZ!</span>
                      <span className="bg-[#111111] text-[#FFD60A] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">[Spacebar / Tap]</span>
                    </motion.button>
                  ) : (
                    <div className="w-72 sm:w-80 py-5 bg-[#FFD60A] text-[#111111] border-[3px] border-[#111111] shadow-[6px_6px_0_#111111] flex flex-col items-center justify-center gap-1.5">
                      <span style={{ fontFamily: "'Archivo Black', sans-serif" }} className="whitespace-nowrap text-3xl sm:text-4xl tracking-wider uppercase leading-none">⚡ Buzzed!</span>
                      <span className="bg-[#111111] text-[#FFD60A] px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-widest uppercase">{buzzSettling ? "Locking In..." : myQueuePos === 1 ? "Speak Your Answer Now" : `Queue #${myQueuePos}`}</span>
                      {myReaction !== null && !buzzSettling && <span className="font-mono text-xs font-black">⚡ {fmtReaction(myReaction)}</span>}
                    </div>
                  )}

                  {/* Risky buzzer */}
                  {isRisky && hasBuzzed && (
                    <div className="w-full max-w-sm bg-[#FFFFFF] border-2 border-[#111111] p-3 shadow-[3px_3px_0_#111111]">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#111111] mb-2">{riskChoice === "risk" ? "RISKY MODE — ×2 / −2×" : "PLAYING SAFE — ×1"}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setRiskChoice("normal")} disabled={riskChoice === "normal"} className={`py-2 border-2 border-[#111111] font-mono text-[10px] font-bold uppercase ${riskChoice === "normal" ? "bg-[#00C271] text-[#111111]" : "bg-[#F4EFE6] text-[#111111]"}`}>Normal ×1</button>
                        <button onClick={() => setRiskChoice("risk")} disabled={riskChoice === "risk"} className={`py-2 border-2 border-[#111111] font-mono text-[10px] font-bold uppercase ${riskChoice === "risk" ? "bg-[#FF3B1D] text-white" : "bg-[#F4EFE6] text-[#111111]"}`}>☠️ Risk ×2</button>
                      </div>
                    </div>
                  )}

                  {/* Clues */}
                  {myClue && (() => {
                    const activeQ = quiz?.categories.flatMap((c) => c.questions).find((q) => q.id === aq.questionId);
                    if (!activeQ) return null;
                    const clueType = getAbilityForAvatar(myClue.abilityId)?.params?.clueType;
                    return <div className="w-full max-w-3xl bg-[#F4EFE6] border-2 border-[#111111] p-3"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#111111]/60 mb-1">Owner-only clue</p><p className="text-lg font-bold text-[#111111]">{clueText(activeQ.answer, clueType)}</p></div>;
                  })()}
                  {(() => {
                    const communityFx = activeCommunityClueFor(room.abilityEffects, aq.questionId);
                    if (!communityFx) return null;
                    const activeQ = quiz?.categories.flatMap((c) => c.questions).find((q) => q.id === aq.questionId);
                    if (!activeQ) return null;
                    const clueType = getAbilityForAvatar(communityFx.abilityId)?.params?.clueType;
                    return <div className="w-full max-w-3xl bg-[#FFD60A]/20 border-2 border-[#111111] p-3"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#111111]/60 mb-1">Sales Round — everyone sees it</p><p className="text-lg font-bold text-[#111111]">{clueText(activeQ.answer, clueType)}</p></div>;
                  })()}

                  {/* Buzz queue */}
                  <div className="w-full max-w-3xl">
                    <AnimatePresence mode="wait">
                      {buzzSettling ? (
                        <motion.div key="settling" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-2 border-dashed border-[#111111]/35 bg-[#FFFFFF] px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.08em] text-[#111111]/60 text-center">Signals locking…</motion.div>
                      ) : committedBuzzes.length > 0 ? (
                        <motion.div key="q" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                          {committedBuzzes.map(([pId, ts], idx) => {
                            const p = room.players[pId]; if (!p) return null;
                            const isMe = pId === myId; const react = reactionFor(ts as number);
                            return (
                              <div key={pId} className={`flex items-center gap-3 px-3 py-2 border-2 border-[#111111] ${idx === 0 ? "bg-[#FFD60A] shadow-[2px_2px_0_#111111]" : "bg-[#FFFFFF]"} ${isMe ? "ring-2 ring-[#FF3B1D] ring-inset" : ""}`}>
                                <span className="font-mono text-xs font-black w-5">#{idx + 1}</span>
                                <PlayerAvatar seed={p.id} avatar={p.avatar} name={p.name} size={28} className="!rounded-none w-7 h-7 border border-[#111111] shrink-0" />
                                <span className="font-bold text-sm uppercase truncate flex-1">{p.name}{isMe ? " (YOU)" : ""}</span>
                                {fmtReaction(react) && <span className="font-mono text-[10px] font-bold bg-[#111111] text-[#FFD60A] px-2 py-0.5">⚡ {fmtReaction(react)}</span>}
                              </div>
                            );
                          })}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>

                  {/* Emoji reactions */}
                  <div className="flex items-center gap-2 flex-wrap justify-center pt-1">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button key={emoji} onClick={() => handleReact(emoji)} className="w-10 h-10 bg-[#FFFFFF] border-2 border-[#111111] hover:bg-[#FFD60A] text-lg flex items-center justify-center shadow-[2px_2px_0_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none" aria-label={`Send ${emoji}`}>{emoji}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Console Strip */}
              <div className="bg-[#111111] text-[#FFD60A] border-t-2 border-[#111111] px-4 py-2.5 flex items-center justify-between gap-3 font-mono text-xs font-bold uppercase tracking-[0.06em] shrink-0">
                <span className="truncate">{statusLine}</span>
                {windowLeft !== null && hasBuzzed && <span className="text-[#FFFFFF] shrink-0">⏳ {windowLeft}s</span>}
              </div>
            </motion.div>
            );
          })()}

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
              <div className="glass-panel-heavy p-8 rounded-3xl text-center space-y-5 relative shadow-2xl border border-[#111111]/15">
                <div className="flex items-center justify-center gap-3">
                  <span className="px-4 py-1.5 rounded-full bg-[#F4EFE6] border border-[#111111]/15 text-xs font-bold text-text-muted uppercase tracking-widest">
                    {room.activeQuestion.categoryName}
                  </span>
                  {room.activeQuestion.isDailyDouble && <span className="px-3 py-1 rounded-full bg-warning-accent/20 border border-warning-accent/50 text-warning-accent text-[10px] font-black uppercase tracking-widest">Daily Double</span>}
                  <span className="font-display font-black text-warning-accent text-xl">
                    ${room.activeQuestion.wager ?? room.activeQuestion.value}
                  </span>
                  {timeLeft !== null && (
                    <span className={`px-3 py-1 rounded-full text-xs font-black border ${timeLeft <= 5 ? "bg-danger-accent/20 border-danger-accent/50 text-danger-accent animate-pulse" : "bg-[#E5DEC9] border-[#111111]/20 text-text-main"}`}>
                      ⏱ {Math.ceil(timeLeft)}s
                    </span>
                  )}
                </div>
                {room.activeQuestion.mediaUrl && (
                  <div className="relative rounded-2xl overflow-hidden border border-[#111111]/15 shadow-lg mx-auto max-w-full max-h-56 bg-black">
                    <MediaViewer url={room.activeQuestion.mediaUrl} type={room.activeQuestion.type as any} audioPlaying={room.activeQuestion.audioPlaying} className="max-h-56 w-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                )}
                <p className="text-lg sm:text-2xl font-display font-semibold text-[#111111] leading-relaxed whitespace-pre-wrap">
                  {room.activeQuestion.text}
                </p>
              </div>
              <div className="glass-panel p-6 rounded-3xl space-y-3 mt-4 shadow-xl border border-[#111111]/15 text-center">
                <div className="flex items-center justify-center gap-3 bg-[#F4EFE6] p-4 rounded-2xl border border-[#111111]/15">
                  <div className="w-3 h-3 rounded-full bg-warning-accent animate-pulse" />
                  <p className="text-sm font-bold text-[#111111] uppercase tracking-widest">{t('hostIsJudging')}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ANSWER revealed */}
          {room.phase === "answer" && room.activeQuestion && (
            <motion.div key="answer" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.18, ease: "easeOut" }} className="flex-1 min-h-0 w-full overflow-y-auto px-4 sm:px-6 py-6 flex flex-col items-center justify-center">
              <div className="max-w-2xl w-full mx-auto bg-[#FFFFFF] border-[3px] border-[#111111] shadow-[8px_8px_0_#111111] overflow-hidden rounded-none">
                <div className="bg-[#111111] text-[#FFD60A] px-5 py-2.5 flex items-center justify-between font-mono text-xs font-bold uppercase tracking-[0.06em]">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 bg-[#00C271]" /> Official Answer Revealed</span>
                  <span>{room.activeQuestion.categoryName} • ${room.activeQuestion.wager ?? room.activeQuestion.value}</span>
                </div>
                <div className="px-6 py-4 bg-[#F4EFE6] border-b-2 border-[#111111] text-center text-sm sm:text-base font-bold text-[#111111]/80 whitespace-pre-wrap">{room.activeQuestion.text}</div>
                <div className="m-5 bg-[#00C271] border-2 border-[#111111] shadow-[4px_4px_0_#111111] p-6 text-center">
                  <div className="bg-[#111111] text-[#FFFFFF] px-3 py-0.5 font-mono text-[10px] font-bold tracking-widest inline-block mb-2 uppercase">Correct Answer</div>
                  <p className="text-3xl sm:text-4xl font-black leading-tight text-[#111111] whitespace-pre-wrap" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{room.activeQuestion.answer}</p>
                </div>
              </div>
              <div className="max-w-2xl w-full mx-auto mt-4 bg-[#111111] text-[#FFD60A] border-2 border-[#111111] shadow-[4px_4px_0_#111111] px-5 py-3 text-center font-mono text-xs font-bold tracking-wider uppercase rounded-none">
                ⏳ Waiting for Host to Return to Board...
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
                quizTitle={quiz?.title}
                roomCode={room.id}
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#FFFFFF]/45 "
            onClick={() => setCategoryModalId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="glass-panel-heavy rounded-3xl p-8 max-w-md w-full space-y-4 relative border border-[#111111]/20 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setCategoryModalId(null)}
                className="absolute top-5 right-5 p-2 rounded-full bg-[#E5DEC9] border border-[#111111]/15 text-text-muted hover:text-[#111111] hover:bg-[#E5DEC9] transition-all"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-10 h-10 rounded-full bg-secondary-accent/20 flex items-center justify-center border border-secondary-accent/30 mb-2">
                 <Info className="w-5 h-5 text-secondary-accent" />
              </div>
              <h3 className="text-3xl font-display font-black text-[#111111] leading-tight pr-8">{categoryModalData.name}</h3>
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
      <QrJoinModal open={showQR} onClose={() => setShowQR(false)} roomId={room.id} />

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
