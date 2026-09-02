/**
 * RoomContext — Firebase Realtime Database multiplayer room management.
 *
 * Flow:
 *  Host:   createRoom() → picks quiz → starts game → opens questions → grades buzzes
 *  Player: joinRoom(code, name) → sees board & buzzes in → host grades
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { db } from "../firebase";
import { COUNTDOWN_MS } from "../components/StartCountdown";
import {
  ref,
  set,
  get,
  update,
  onValue,
  remove,
  onDisconnect,
  serverTimestamp,
  increment,
  runTransaction,
} from "firebase/database";
import { avatarImages, fbAvatarKey } from "../utils/avatarImages";
import { loadProfile } from "../utils/profile";
import type {
  Room,
  RoomPlayer,
  ActiveQuestion,
  RoomPhase,
  Quiz,
  Question,
  ScoreHistoryEntry,
  RoomAbilityEffect,
} from "../types/jeopardy";
import { getAbilityForAvatar } from "../abilities/config";
import {
  isQuestionScopedKind,
  isImmediateKind,
  computeCorrectAward,
  computeWrongPenalty,
  buzzGate,
  jokerRoll,
  boostAmount,
  stealTransfer,
  taxPayout,
  confiscatePayout,
  resolveAutoTarget,
  rankBuzzes,
  leaderOf,
  highestOf,
  activeModiShareFor,
} from "../abilities/engine";
import { abilityNoticeBus } from "../abilities/internal";

// ─── session persistence ─────────────────────────────────────────────────────

const SESSION_KEY = "jeopardy_room_session";

interface RoomSession {
  roomCode: string;
  isHost: boolean;
}

const saveSession = (roomCode: string, isHost: boolean) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, isHost }));
    // Also reflect in the URL hash so refresh always lands on the room.
    if (window.location.hash !== `#${roomCode}`) {
      history.replaceState(null, "", `#${roomCode}`);
    }
  } catch {
    // storage unavailable — session won't survive refresh
  }
};

const loadSession = (): RoomSession | null => {
  try {
    // Prefer URL hash (source of truth after direct navigation).
    const hash = window.location.hash.replace("#", "").trim().toUpperCase();
    if (hash.length >= 4) {
      const stored = localStorage.getItem(SESSION_KEY);
      const parsed: RoomSession | null = stored ? JSON.parse(stored) : null;
      // Trust hash if it differs from stored (user navigated directly).
      if (parsed && parsed.roomCode !== hash) {
        return { roomCode: hash, isHost: parsed.isHost };
      }
      return parsed ?? { roomCode: hash, isHost: false };
    }
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RoomSession;
  } catch {
    return null;
  }
};

const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  if (window.location.hash) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
};

// ─── helpers ─────────────────────────────────────────────────────────────────

const genId = (len = 6) =>
  Math.random()
    .toString(36)
    .toUpperCase()
    .slice(2, 2 + len);

const genEntryId = () =>
  `sh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** Builds a score-history entry + the score-change update for a single player. */
const buildScoreChange = (
  playerId: string,
  currentScore: number,
  changeAmount: number,
  description: string,
  questionId?: string,
): { entry: ScoreHistoryEntry; newScore: number } => {
  const newScore = currentScore + changeAmount;
  return {
    newScore,
    entry: {
      id: genEntryId(),
      timestamp: Date.now(),
      description,
      teamId: playerId,
      changeAmount,
      previousScore: currentScore,
      newScore,
      questionId,
    },
  };
};

/** Recursively strip `undefined` values so Firebase doesn't silently reject writes. */
const sanitize = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (typeof obj === "object") {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) clean[k] = sanitize(v);
    }
    return clean;
  }
  return obj;
};

/** Player ids holding applied question-scoped effects for the given question. */
const questionScopedEffectPlayers = (room: Room, qId: string | undefined): string[] =>
  Object.entries(room.abilityEffects || {})
    .filter(
      ([, e]) =>
        isQuestionScopedKind(e.kind) &&
        e.status === "applied" &&
        e.appliedToQuestionId === qId,
    )
    .map(([pid]) => pid);

/** Update-path deletions for question-scoped + consumed effects. */
const effectCleanupUpdates = (
  room: Room,
  qId: string | undefined,
  extraConsume: string[] = [],
): Record<string, any> => {
  const updates: Record<string, any> = {};
  const targets = new Set<string>([
    ...questionScopedEffectPlayers(room, qId),
    ...extraConsume.filter((id) => room.abilityEffects?.[id]),
  ]);
  for (const pid of targets) updates[`abilityEffects/${pid}`] = null;
  return updates;
};

// ─── context shape ────────────────────────────────────────────────────────────

interface RoomContextProps {
  // identities
  myId: string;
  myName: string;
  isHost: boolean;

  // live room state
  room: Room | null;
  loading: boolean;
  error: string | null;

  // True once any persisted session has been restored (or confirmed absent).
  // Components can use this to avoid flashing the lobby while auto-join runs.
  hydrated: boolean;

  // host actions
  createRoom: (quiz: Quiz, hostName: string, avatar?: string) => Promise<string>;
  startGame: () => Promise<void>;
  openQuestion: (question: Question, categoryName: string) => Promise<void>;
  setAudioPlaying: (playing: boolean) => Promise<void>;
  judgeAnswer: (correct: boolean) => Promise<void>;
  splitPoints: (playerIds: string[]) => Promise<void>;
  adjustScore: (playerId: string, delta: number, reason: string) => Promise<void>;
  undoLastScoreChange: () => Promise<void>;
  revealAnswer: (answerText: string) => Promise<void>;
  closeQuestion: () => Promise<void>;
  endGame: () => Promise<void>;
  resetGame: () => Promise<void>;
  kickPlayer: (playerId: string) => Promise<void>;

  // player actions
  joinRoom: (code: string, playerName: string, avatar?: string) => Promise<void>;
  buzz: () => Promise<"ok" | "muted">;
  sendReaction: (emoji: string) => Promise<void>;

  // character abilities
  activateAbility: (payload: {
    abilityId: string;
    targetId?: string;
    option?: string;
  }) => Promise<void>;
  setRiskChoice: (choice: "normal" | "risk") => Promise<void>;
  applyImmediateAbility: (effectPlayerId: string) => Promise<void>;

  // leave
  leaveRoom: () => Promise<void>;
}

const RoomContext = createContext<RoomContextProps | undefined>(undefined);

// ─── provider ────────────────────────────────────────────────────────────────

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [myId] = useState<string>(() => {
    const stored = sessionStorage.getItem("jeopardy_player_id");
    if (stored) return stored;
    const id = genId(12);
    sessionStorage.setItem("jeopardy_player_id", id);
    return id;
  });
  const [myName, setMyName] = useState<string>(
    () => sessionStorage.getItem("jeopardy_player_name") || "",
  );
  const [roomCode, setRoomCode] = useState<string | null>(() => {
    const session = loadSession();
    return session?.roomCode ?? null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When there's no session to restore, start hydrated immediately so the
  // lobby renders right away. Only start false when a restore is pending.
  const sessionToRestore = useRef(loadSession());
  const [hydrated, setHydrated] = useState(() => sessionToRestore.current === null);
  const listenerRef = useRef<(() => void) | null>(null);

  const isHost = room ? room.hostId === myId : false;

  // ── Subscribe to room on roomCode change ──────────────────────────────────
  useEffect(() => {
    if (!roomCode) return;

    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(
      roomRef,
      (snap) => {
        if (snap.exists()) {
          setRoom(snap.val() as Room);
          setError(null);
        } else {
          setRoom(null);
          setRoomCode(null);
          setError("Room no longer exists.");
          clearSession();
        }
      },
      (err) => {
        setError(err.message);
      },
    );

    listenerRef.current = unsub;
    return () => {
      unsub();
      listenerRef.current = null;
    };
  }, [roomCode]);

  // ── Auto-join on mount / refresh ──────────────────────────────────────────
  // If a room session was persisted (URL hash or localStorage), rejoin
  // automatically so refresh never drops the user back to the lobby.
  useEffect(() => {
    const session = sessionToRestore.current;
    if (!roomCode || room || !session || session.roomCode !== roomCode) {
      // No session to restore or already subscribed — mark hydrated.
      if (!room) setHydrated(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Guard against a stalled Firebase read leaving the UI on a permanent
        // blank/black screen. If the lookup can't resolve within the timeout,
        // treat it as "no room to restore" and fall through to the lobby.
        const snap = await Promise.race([
          get(ref(db, `rooms/${roomCode}`)),
          new Promise<null>((resolve) => {
            window.setTimeout(() => resolve(null), 2500);
          }),
        ]);
        if (cancelled) return;
        if (!snap || !snap.exists()) {
          clearSession();
          setRoomCode(null);
          setHydrated(true);
          setError("Room no longer exists.");
          return;
        }

        const existingRoom = snap.val() as Room;
        const existingPlayer = existingRoom.players?.[myId];
        const isRejoin = !!existingPlayer;

        if (session.isHost && existingRoom.hostId === myId) {
          // Host rejoining: update presence and re-register onDisconnect.
          const connectedRef = ref(db, `rooms/${roomCode}/players/${myId}/connected`);
          const lastSeenRef = ref(db, `rooms/${roomCode}/players/${myId}/lastSeen`);
          await update(ref(db, `rooms/${roomCode}`), {
            [`players/${myId}/connected`]: true,
            [`players/${myId}/lastSeen`]: serverTimestamp(),
          });
          await onDisconnect(connectedRef).set(false);
          await onDisconnect(lastSeenRef).set(serverTimestamp());
        } else {
          // Player rejoining: use existing join logic.
          const player: RoomPlayer = {
            id: myId,
            name: myName || existingPlayer?.name || "Player",
            score: existingPlayer?.score ?? 0,
            joinedAt: existingPlayer?.joinedAt ?? Date.now(),
            isHost: false,
            connected: true,
            lastSeen: Date.now(),
            buzzCount: existingPlayer?.buzzCount ?? 0,
            correctCount: existingPlayer?.correctCount ?? 0,
            wrongCount: existingPlayer?.wrongCount ?? 0,
            fastestBuzz: existingPlayer?.fastestBuzz ?? null,
            streak: existingPlayer?.streak ?? 0,
            bestStreak: existingPlayer?.bestStreak ?? 0,
            abilityId:
              existingPlayer?.abilityId ?? getAbilityForAvatar(existingPlayer?.avatar)?.id,
            abilityUnlocked: existingPlayer?.abilityUnlocked ?? false,
            abilityUsed: existingPlayer?.abilityUsed ?? false,
          };

          const updates: Record<string, any> = {
            [`players/${myId}`]: player,
          };
          if (!isRejoin) {
            updates[`buzzes/${myId}`] = null;
          }
          await update(ref(db, `rooms/${roomCode}`), updates);

          const connectedRef = ref(db, `rooms/${roomCode}/players/${myId}/connected`);
          const lastSeenRef = ref(db, `rooms/${roomCode}/players/${myId}/lastSeen`);
          await onDisconnect(connectedRef).set(false);
          await onDisconnect(lastSeenRef).set(serverTimestamp());

          // Persist the name we just used.
          const resolvedName = myName || existingPlayer?.name || "Player";
          setMyName(resolvedName);
          sessionStorage.setItem("jeopardy_player_name", resolvedName);
        }
      } catch {
        // Network or parse error — let the user see the lobby with a note.
        clearSession();
        setRoomCode(null);
      } finally {
        setHydrated(true);
      }
    })();

    return () => { cancelled = true; };
  }, [roomCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Host: create room ─────────────────────────────────────────────────────
  const createRoom = useCallback(
    async (quiz: Quiz, hostName: string, avatar?: string): Promise<string> => {
      setLoading(true);
      setError(null);
      try {
const code = genId(6);
        const hostAvatar = avatar || loadProfile().avatar || avatarImages[0]?.id;
        const hostPlayer: RoomPlayer = {
          id: myId,
          name: hostName,
          avatar: hostAvatar,
          score: 0,
          joinedAt: Date.now(),
          isHost: true,
          connected: true,
          lastSeen: Date.now(),
          buzzCount: 0,
          correctCount: 0,
          wrongCount: 0,
          streak: 0,
          bestStreak: 0,
          abilityId: getAbilityForAvatar(hostAvatar)?.id,
          abilityUnlocked: false,
          abilityUsed: false,
        };

        const newRoom: Room = {
          id: code,
          hostId: myId,
          quizId: quiz.id,
          quizTitle: quiz.title,
          phase: "lobby",
          players: { [myId]: hostPlayer },
          completedQuestions: {},
          activeQuestion: null,
          createdAt: Date.now(),
        };

        await set(ref(db, `rooms/${code}`), sanitize(newRoom));
        // Store the quiz so the host can open questions
        await set(ref(db, `quizzes/${quiz.id}`), sanitize(quiz));

        setMyName(hostName);
        sessionStorage.setItem("jeopardy_player_name", hostName);
        setRoomCode(code);
        saveSession(code, true);
        return code;
      } catch (e: any) {
        setError(e.message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [myId],
  );

  // ── Host: start game ──────────────────────────────────────────────────────
  // Flips to "starting" so every client shows the 5-4-3-2-1 countdown from the
  // same server-stamped instant, then flips to "board" shortly after the
  // countdown window elapses. The flip delay is measured against the server
  // timestamp (elapsed wall time around the write) plus a margin so every
  // screen reliably sees "1" and "Let's Buzz!" before the board appears.
  // The timer is tracked so leaving the room mid-countdown cancels it (the
  // room must never be resurrected by a stale write).
  const startTimerRef = useRef<number | null>(null);
  const startGame = useCallback(async () => {
    if (!roomCode) return;
    const localStart = Date.now();
    await update(ref(db, `rooms/${roomCode}`), {
      phase: "starting" as RoomPhase,
      startAt: serverTimestamp() as unknown as number,
    });
    const elapsed = Date.now() - localStart;
    const flipDelay = Math.max(1000, COUNTDOWN_MS - elapsed + 600);
    if (startTimerRef.current) window.clearTimeout(startTimerRef.current);
    startTimerRef.current = window.setTimeout(() => {
      if (!roomCode) return;
      update(ref(db, `rooms/${roomCode}`), {
        phase: "board" as RoomPhase,
        startAt: null,
      }).catch(() => {});
    }, flipDelay);
  }, [roomCode]);

  // ── Host: open a question ─────────────────────────────────────────────────
  // Fix #2 & #3: reset buzzes on the server atomically when opening a question.
  // This guarantees all clients transition simultaneously (server-authoritative)
  // and there are no stale buzzes from a prior question.
  const openQuestion = useCallback(
    async (question: Question, categoryName: string) => {
      if (!roomCode) return;
      const aq: Partial<ActiveQuestion> = {
        questionId: question.id,
        categoryName,
        value: question.value,
        text: question.text,
        type: question.type,
        revealAnswer: false,
        audioPlaying: true,
        // Server-clock start time so reaction times are comparable to the
        // server-stamped buzz timestamps, regardless of any device clock.
        // (Stored as the Firebase sentinel; resolves to an epoch-ms number.)
        openedAt: serverTimestamp() as unknown as number,
      };
      // Only copy working media (data:/http(s):). blob: URLs are session-only
      // object URLs from an old upload method — they can never load on players' devices.
      if (question.mediaUrl && !question.mediaUrl.startsWith("blob:")) aq.mediaUrl = question.mediaUrl;
      if (question.isDailyDouble) aq.isDailyDouble = question.isDailyDouble;
      // Optimistic local update: the host must see the question the instant it
      // is opened, not wait for the Firebase round-trip. We flip the local room
      // state immediately; the server echo arrives a moment later with the real
      // `openedAt` and simply reconciles (it is identical data). Players still
      // receive the authoritative snapshot over the wire, so everyone ends up
      // in sync — but the host is never left staring at the board.
      const optimistic = { ...aq, openedAt: 0 } as ActiveQuestion;
      const nextJail = room?.jailNext ?? [];
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              activeQuestion: optimistic,
              buzzes: {},
              reactions: {},
              phase: "buzzing" as RoomPhase,
              jail: nextJail.length > 0 ? nextJail : undefined,
              jailNext: undefined,
            }
          : prev,
      );
      // Write activeQuestion, clear buzzes, and flip phase atomically.
      // Every subscriber (host + all players) reacts to the same snapshot.
      const abilityUpdates: Record<string, any> = {};
      for (const [pid, fx] of Object.entries(room?.abilityEffects || {})) {
        if (isQuestionScopedKind(fx.kind) && fx.status === "pending") {
          abilityUpdates[`abilityEffects/${pid}/status`] = "applied";
          abilityUpdates[`abilityEffects/${pid}/appliedToQuestionId`] = question.id;
        }
      }
      // Jail: apply pending jail list to the question that is now opening,
      // then clear the pending list so the next open is unjaild unless
      // the question being judged re-populates it.
      const jailUpdate: Record<string, any> = {
        jail: nextJail.length > 0 ? nextJail : null,
        jailNext: null,
      };
      await update(ref(db, `rooms/${roomCode}`), {
        activeQuestion: aq,
        buzzes: null as any,
        reactions: null as any,
        phase: "buzzing" as RoomPhase,
        ...abilityUpdates,
        ...jailUpdate,
      });
    },
    [roomCode, room],
  );

  const setAudioPlaying = useCallback(
    async (playing: boolean) => {
      if (!roomCode || !room?.activeQuestion) return;
      setRoom((prev) =>
        prev && prev.activeQuestion
          ? {
              ...prev,
              activeQuestion: {
                ...prev.activeQuestion,
                audioPlaying: playing,
              },
            }
          : prev,
      );
      await update(ref(db, `rooms/${roomCode}/activeQuestion`), {
        audioPlaying: playing,
      });
    },
    [roomCode, room],
  );

  // ── Host: judge answer correct / incorrect ────────────────────────────────
  // Fix #1/#2: use server-side sorted buzz timestamps so priority is never
  // determined on the client.  The first entry in the sorted array is always
  // the real #1 buzzer regardless of who joined/rejoined.
  const judgeAnswer = useCallback(
    async (correct: boolean) => {
      if (!roomCode || !room) return;

      // Server-authoritative buzz priority — a frontOfLine effect forces the
      // owner to #1 no matter when they slammed the button. Once it gets the
      // owner the first crack at the clue, the guarantee itself is spent.
      const ranked = rankBuzzes(room.buzzes, room.abilityEffects);
      const buzzPlayerId = ranked[0]?.playerId;
      if (!buzzPlayerId) return;
      const spentFrontOfLine = ranked[0]?.override ? [buzzPlayerId] : [];

      const value = room.activeQuestion?.value ?? 0;
      const qId = room.activeQuestion?.questionId;
      const effects = room.abilityEffects || {};
      const players = room.players;

      // Reaction time: both timestamps are server-resolved, so the diff is
      // accurate even if players' device clocks are skewed.
      const openedAt = room.activeQuestion?.openedAt ?? 0;
      const buzzTs = room.buzzes?.[buzzPlayerId] ?? 0;
      const reactionMs =
        openedAt > 0 && buzzTs > openedAt ? buzzTs - openedAt : undefined;

      // First-buzz bonus: +10% (rounded) for a correct answer buzzed within
      // the first second. Rolled into a single score change so "Undo Last"
      // reverts the whole call in one step.
      const firstBuzzBonus =
        correct && reactionMs !== undefined && reactionMs <= 1000
          ? Math.max(1, Math.round(value * 0.1))
          : 0;

      const updates: Record<string, any> = {};

      if (correct) {
        const award = computeCorrectAward({
          ownerId: buzzPlayerId,
          value,
          firstBuzzBonus,
          effects,
          players,
        });
        const payeeName = players[award.payeeId]?.name ?? "Player";
        const ownerName = players[buzzPlayerId]?.name ?? "Player";
        const bonusNote =
          firstBuzzBonus > 0 ? ` (+$${firstBuzzBonus} ⚡ first-buzz bonus)` : "";
        const redirectNote =
          award.payeeId !== buzzPlayerId ? ` → redirected to ${payeeName}` : "";
        const { entry, newScore } = buildScoreChange(
          award.payeeId,
          players[award.payeeId]?.score ?? 0,
          award.points,
          `${ownerName} answered correctly — "${room.activeQuestion?.categoryName ?? ""}" for $${value}${bonusNote}${redirectNote}${award.note ? ` [${award.note}]` : ""}`,
          qId,
        );
        updates[`players/${award.payeeId}/score`] = newScore;
        updates[`scoreHistory/${entry.id}`] = entry;

        // Modi Share (modi-fied points): whoever answers correctly wins the
        // points, and Modi banks the same amount — whether Modi buzzed or not.
        const modiShareFx = activeModiShareFor(effects, qId);
        if (modiShareFx && modiShareFx.playerId !== buzzPlayerId) {
          const mId = modiShareFx.playerId;
          const mDef = getAbilityForAvatar(modiShareFx.abilityId);
          const mEntry = buildScoreChange(
            mId,
            players[mId]?.score ?? 0,
            award.points,
            `${players[mId]?.name ?? "Player"} shared ${ownerName}'s correct — +$${award.points} [${mDef?.abilityName}]`,
            qId,
          );
          updates[`players/${mId}/score`] = mEntry.newScore;
          updates[`scoreHistory/${mEntry.entry.id}`] = mEntry.entry;
        }

        // Reflex + streak stats always land on the owner (even a redirect still
        // counts as their correct answer).
        const prevStreak = players[buzzPlayerId]?.streak ?? 0;
        const newCorrectCount = (players[buzzPlayerId]?.correctCount ?? 0) + 1;
        updates[`players/${buzzPlayerId}/correctCount`] = newCorrectCount;
        const newStreak = prevStreak + 1;
        updates[`players/${buzzPlayerId}/streak`] = newStreak;
        const prevBest = players[buzzPlayerId]?.bestStreak ?? 0;
        if (newStreak > prevBest) {
          updates[`players/${buzzPlayerId}/bestStreak`] = newStreak;
        }
        // Unlock the once-per-game ability at 2 total correct answers.
        if (
          newCorrectCount >= 2 &&
          players[buzzPlayerId]?.abilityId &&
          !players[buzzPlayerId]?.abilityUsed
        ) {
          updates[`players/${buzzPlayerId}/abilityUnlocked`] = true;
        }

        updates[`completedQuestions/${qId}`] = true;
        updates["activeQuestion"] = null;
        updates["phase"] = "board" as RoomPhase;
        updates["buzzes"] = null;
        // Question-scoped effects expire and consumed effects are deleted.
        Object.assign(
          updates,
          effectCleanupUpdates(room, qId, [...award.consume, ...spentFrontOfLine]),
        );
      } else {
        const res = computeWrongPenalty({
          playerId: buzzPlayerId,
          value,
          effects,
        });

        if (res.forgiven) {
          // Bounce-back (second chance): no penalty, buzz is kept, question
          // stays live. A shield, by contrast, absorbs the loss but the turn
          // passes on (buzz removed).
          if (effects[buzzPlayerId]?.kind === "secondChance") {
            updates[`abilityEffects/${buzzPlayerId}/secondChanceUsed`] = true;
          }
          // A spent frontOfLine guarantee still ends here — they got their
          // guaranteed crack at the clue even though it bounced back.
          for (const pid of spentFrontOfLine) updates[`abilityEffects/${pid}`] = null;
          if (!res.keepBuzz) updates[`buzzes/${buzzPlayerId}`] = null;
        } else {
          const playerName = players[buzzPlayerId]?.name ?? "Player";
          const { entry, newScore } = buildScoreChange(
            buzzPlayerId,
            players[buzzPlayerId]?.score ?? 0,
            -res.penalty,
            `${playerName} answered incorrectly — "${room.activeQuestion?.categoryName ?? ""}" for -$${value}${res.note ? ` [${res.note}]` : ""}`,
            qId,
          );
          updates[`players/${buzzPlayerId}/score`] = newScore;
          updates[`scoreHistory/${entry.id}`] = entry;

          if (res.wrongCount) {
            updates[`players/${buzzPlayerId}/wrongCount`] = increment(1);
          }
          updates[`players/${buzzPlayerId}/streak`] = 0;

          // Dark Jokes = Jail (samay): if his jailWrong effect is live on THIS
          // question, a real wrong answer books the offender for the next open.
          const samayJailActive =
            qId !== undefined &&
            Object.values(effects).some(
              (e) =>
                e.kind === "jailWrong" &&
                e.status === "applied" &&
                e.appliedToQuestionId === qId,
            ) &&
            !res.keepBuzz &&
            res.wrongCount;
          if (samayJailActive) {
            const nextList = new Set(room?.jailNext ?? []);
            nextList.add(buzzPlayerId);
            updates["jailNext"] = [...nextList];
          }

          if (!res.keepBuzz) {
            // Incorrect — remove this player's buzz so next in queue is evaluated
            updates[`buzzes/${buzzPlayerId}`] = null;
          }
          Object.assign(
            updates,
            effectCleanupUpdates(room, qId, [...res.consume, ...spentFrontOfLine]),
          );
        }
      }

      // Reflex stat tracked for the buzzer regardless of correctness.
      const prevFastest = players[buzzPlayerId]?.fastestBuzz;
      if (
        reactionMs !== undefined &&
        (prevFastest === undefined || prevFastest === null || reactionMs < prevFastest)
      ) {
        updates[`players/${buzzPlayerId}/fastestBuzz`] = reactionMs;
      }

      await update(ref(db, `rooms/${roomCode}`), updates);
    },
    [roomCode, room],
  );

  // ── Host: split points between multiple players ───────────────────────────
  // Fix #6: allows awarding fractional/split points to a list of players.
  const splitPoints = useCallback(
    async (playerIds: string[]) => {
      if (!roomCode || !room || playerIds.length === 0) return;
      const value = room.activeQuestion?.value ?? 0;
      const share = Math.round(value / playerIds.length);

      const updates: Record<string, any> = {};
      for (const pid of playerIds) {
        const currentScore = room.players[pid]?.score ?? 0;
        const playerName = room.players[pid]?.name ?? "Player";
        const { entry, newScore } = buildScoreChange(
          pid,
          currentScore,
          share,
          `${playerName} split credit — "${room.activeQuestion?.categoryName ?? ""}" for $${value} (÷${playerIds.length})`,
          room.activeQuestion?.questionId,
        );
        updates[`players/${pid}/score`] = newScore;
        updates[`scoreHistory/${entry.id}`] = entry;
      }

      if (room.activeQuestion) {
        updates[`completedQuestions/${room.activeQuestion.questionId}`] = true;
        updates["activeQuestion"] = null;
        updates["phase"] = "board" as RoomPhase;
        updates["buzzes"] = null;
      }

      await update(ref(db, `rooms/${roomCode}`), updates);
    },
    [roomCode, room],
  );

  // ── Host: manually adjust a player's score ────────────────────────────────
  // For ad-hoc corrections outside the normal judge/split flow (e.g. fixing a
  // typo'd award). Still logged to scoreHistory so it's part of the audit trail.
  const adjustScore = useCallback(
    async (playerId: string, delta: number, reason: string) => {
      if (!roomCode || !room || delta === 0) return;
      const currentScore = room.players[playerId]?.score ?? 0;
      const playerName = room.players[playerId]?.name ?? "Player";
      const { entry, newScore } = buildScoreChange(
        playerId,
        currentScore,
        delta,
        reason || `Manual adjustment for ${playerName}`,
      );
      await update(ref(db, `rooms/${roomCode}`), {
        [`players/${playerId}/score`]: newScore,
        [`scoreHistory/${entry.id}`]: entry,
      });
    },
    [roomCode, room],
  );

  // ── Host: undo the most recent score change ───────────────────────────────
  // Reverts the affected player's score back to `previousScore` and removes
  // the entry from the history (a corresponding "undo" note is *not* kept as
  // a separate entry — the offending entry simply disappears, since the goal
  // is to let a host cleanly walk back a misjudged call).
  const undoLastScoreChange = useCallback(async () => {
    if (!roomCode || !room?.scoreHistory) return;
    const entries = Object.values(room.scoreHistory).sort(
      (a, b) => b.timestamp - a.timestamp,
    );
    const last = entries[0];
    if (!last || !last.teamId) return;

    // Guard against undoing a change that's no longer the latest true state
    // (e.g. more score changes for that player happened after logging, out
    // of order due to network timing) by reverting relative to the entry's
    // own recorded delta rather than blindly setting previousScore.
    const currentScore = room.players[last.teamId]?.score ?? 0;
    const revertedScore = currentScore - last.changeAmount;

    await update(ref(db, `rooms/${roomCode}`), {
      [`players/${last.teamId}/score`]: revertedScore,
      [`scoreHistory/${last.id}`]: null,
    });
  }, [roomCode, room]);

  // ── Host: reveal the answer text ─────────────────────────────────────────
  const revealAnswer = useCallback(async (answerText: string) => {
    if (!room?.activeQuestion) return;
    // Optimistic: reveal for the host immediately.
    setRoom((prev) =>
      prev && prev.activeQuestion
        ? {
            ...prev,
            phase: "answer" as RoomPhase,
            activeQuestion: { ...prev.activeQuestion, answer: answerText, revealAnswer: true },
          }
        : prev,
    );
    await update(ref(db, `rooms/${roomCode}/activeQuestion`), {
      answer: answerText,
      revealAnswer: true,
    });
    await update(ref(db, `rooms/${roomCode}`), {
      phase: "answer" as RoomPhase,
    });
  }, [roomCode, room]);

  // ── Host: close question without awarding ────────────────────────────────
  const closeQuestion = useCallback(async () => {
    if (!roomCode || !room?.activeQuestion) return;
    const qId = room.activeQuestion.questionId;
    // Optimistic: return the host to the board instantly.
    setRoom((prev) =>
      prev
        ? {
            ...prev,
            phase: "board" as RoomPhase,
            activeQuestion: null,
            buzzes: {},
            reactions: {},
            [`completedQuestions/${qId}`]: true,
          }
        : prev,
    );
    await update(ref(db, `rooms/${roomCode}`), {
      phase: "board" as RoomPhase,
      activeQuestion: null,
      buzzes: null as any,
      [`completedQuestions/${qId}`]: true,
      ...effectCleanupUpdates(room, qId),
    });
  }, [roomCode, room]);

  // ── Host: end the game ────────────────────────────────────────────────────
  const endGame = useCallback(async () => {
    if (!roomCode) return;
    await update(ref(db, `rooms/${roomCode}`), { phase: "ended" as RoomPhase });
  }, [roomCode]);

  // ── Host: play again (rematch in the same room) ────────────────────────────
  // Wipes scores, per-player stats, completed tiles, buzzes and score history
  // while keeping the same room, quiz and players — everyone lands back on
  // the board ready for a fresh game.
  const resetGame = useCallback(async () => {
    if (!roomCode || !room || room.hostId !== myId) return;
    const updates: Record<string, any> = {
      phase: "board" as RoomPhase,
      activeQuestion: null,
      buzzes: null,
      completedQuestions: null,
      scoreHistory: null,
      abilityEffects: null,
    };
    for (const pid of Object.keys(room.players)) {
      updates[`players/${pid}/score`] = 0;
      updates[`players/${pid}/buzzCount`] = 0;
      updates[`players/${pid}/correctCount`] = 0;
      updates[`players/${pid}/wrongCount`] = 0;
      updates[`players/${pid}/fastestBuzz`] = null;
      updates[`players/${pid}/abilityUnlocked`] = false;
      updates[`players/${pid}/abilityUsed`] = false;
    }
    await update(ref(db, `rooms/${roomCode}`), updates);
  }, [roomCode, room, myId]);

  // ── Host: kick a player ────────────────────────────────────────────────────
  // Fix #6: removes the player from players map and clears any pending buzz.
  const kickPlayer = useCallback(
    async (playerId: string) => {
      if (!roomCode) return;
      await remove(ref(db, `rooms/${roomCode}/players/${playerId}`));
      await remove(ref(db, `rooms/${roomCode}/buzzes/${playerId}`));
      await remove(ref(db, `rooms/${roomCode}/abilityEffects/${playerId}`));
      // Release any avatar slot the kicked player held.
      const avatarId = Object.entries(room?.avatarOwners || {}).find(
        ([, owner]) => owner === playerId,
      )?.[0];
      if (avatarId) {
        await update(ref(db, `rooms/${roomCode}`), {
          [`avatarOwners/${avatarId}`]: null,
        });
      }
    },
    [roomCode, room],
  );

  // ── Player: join a room ───────────────────────────────────────────────────
  // Rejoin/reconnect handling: a refresh or dropped connection must NOT cost a
  // player their spot in an in-progress buzz queue. We only treat this as a
  // "fresh" join (new joinedAt, cleared buzz) the first time we ever see this
  // playerId in the room. On every subsequent join — i.e. a rejoin after a
  // refresh/disconnect — we keep the original joinedAt and, crucially, leave
  // any existing `buzzes/{myId}` entry untouched so a mid-"buzzing"-phase
  // refresh silently preserves (rather than erases) their queue position.
  const joinRoom = useCallback(
    async (code: string, playerName: string, avatar?: string) => {
      setLoading(true);
      setError(null);
      const upperCode = code.toUpperCase().trim();
      try {
        const snap = await get(ref(db, `rooms/${upperCode}`));
        if (!snap.exists()) throw new Error(`Room "${upperCode}" not found.`);

const existingRoom = snap.val() as Room;
        const existingPlayer = existingRoom.players?.[myId];
        const isRejoin = !!existingPlayer;
        const resolvedAvatar =
          avatar || existingPlayer?.avatar || loadProfile().avatar || avatarImages[0]?.id;

        // Atomic avatar-uniqueness: one player per character in a room, enforced
        // server-side via a transaction. Rejoining your own avatar is a no-op.
        if (resolvedAvatar !== existingPlayer?.avatar) {
          const avatarRef = ref(db, `rooms/${upperCode}/avatarOwners/${fbAvatarKey(resolvedAvatar)}`);
          const claim = await runTransaction(avatarRef, (cur) => {
            if (cur && cur !== myId) return undefined; // taken → abort
            return myId;
          });
          if (!claim.committed) {
            throw new Error("That character is already taken in this room.");
          }
          // If we previously owned a different avatar, release the old slot.
          if (existingPlayer?.avatar && existingPlayer.avatar !== resolvedAvatar) {
            await update(ref(db, `rooms/${upperCode}`), {
              [`avatarOwners/${fbAvatarKey(existingPlayer.avatar)}`]: null,
            });
          }
        }

        const player: RoomPlayer = {
          id: myId,
          name: playerName,
          avatar: resolvedAvatar,
          score: existingPlayer?.score ?? 0,
          // Preserve the original joinedAt on rejoin so lobby ordering and
          // "who has been here longest" stay stable across refreshes.
          joinedAt: existingPlayer?.joinedAt ?? Date.now(),
          isHost: false,
          connected: true,
          lastSeen: Date.now(),
          buzzCount: existingPlayer?.buzzCount ?? 0,
          correctCount: existingPlayer?.correctCount ?? 0,
          wrongCount: existingPlayer?.wrongCount ?? 0,
          fastestBuzz: existingPlayer?.fastestBuzz ?? null,
          streak: existingPlayer?.streak ?? 0,
          bestStreak: existingPlayer?.bestStreak ?? 0,
          abilityId: getAbilityForAvatar(resolvedAvatar)?.id ?? existingPlayer?.abilityId,
          abilityUnlocked: existingPlayer?.abilityUnlocked ?? false,
          abilityUsed: existingPlayer?.abilityUsed ?? false,
        };

        const connectedRef = ref(db, `rooms/${upperCode}/players/${myId}/connected`);
        const lastSeenRef = ref(db, `rooms/${upperCode}/players/${myId}/lastSeen`);

        const updates: Record<string, any> = {
          [`players/${myId}`]: player,
        };
        // Only clear a buzz for a genuinely new identity. A rejoin keeps
        // whatever buzz (if any) was already recorded for this player, since
        // that buzz's server timestamp is still the true, fair record of when
        // they buzzed — refreshing the page shouldn't un-buzz them.
        if (!isRejoin) {
          updates[`buzzes/${myId}`] = null;
        }
        await update(ref(db, `rooms/${upperCode}`), updates);

        // Presence: on disconnect, mark the player as disconnected instead of
        // removing them — the player, their score, and any buzz stay put so
        // reconnecting mid-question restores exactly where they left off.
        // Never auto-remove the buzz on disconnect: a dropped connection right
        // after buzzing shouldn't erase a legitimately-recorded buzz time.
        await onDisconnect(connectedRef).set(false);
        await onDisconnect(lastSeenRef).set(serverTimestamp());

        setMyName(playerName);
        sessionStorage.setItem("jeopardy_player_name", playerName);
        setRoomCode(upperCode);
        saveSession(upperCode, false);
      } catch (e: any) {
        setError(e.message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [myId],
  );

  // Re-arm the onDisconnect presence handlers whenever the underlying socket
  // reconnects (Firebase clears onDisconnect registrations on every
  // disconnect, so they must be re-registered each time `.info/connected`
  // flips back to true — otherwise a second drop wouldn't be detected).
  useEffect(() => {
    if (!roomCode || !myId) return;
    const connectedInfoRef = ref(db, ".info/connected");
    const unsub = onValue(connectedInfoRef, (snap) => {
      if (snap.val() !== true) return;
      const connectedRef = ref(db, `rooms/${roomCode}/players/${myId}/connected`);
      const lastSeenRef = ref(db, `rooms/${roomCode}/players/${myId}/lastSeen`);
      update(ref(db, `rooms/${roomCode}`), {
        [`players/${myId}/connected`]: true,
        [`players/${myId}/lastSeen`]: serverTimestamp(),
      }).catch(() => {});
      onDisconnect(connectedRef).set(false);
      onDisconnect(lastSeenRef).set(serverTimestamp());
    });
    return () => unsub();
  }, [roomCode, myId]);

  // ── Player: buzz in ────────────────────────────────────────────────────────
  // Fix: ordering must never depend on the buzzing client's own clock — a
  // player on high-latency wifi vs. one on 4G, or with a merely-skewed system
  // clock, could otherwise "win" despite pressing later. We write Firebase's
  // serverTimestamp() sentinel instead of Date.now(); the *database server*
  // stamps the value the instant it processes the write, so every buzz is
  // ordered on one single authoritative clock regardless of whose device sent
  // it or how fast their connection was.
  const buzz = useCallback(async (): Promise<"ok" | "muted"> => {
    if (!roomCode || !room) return "muted";
    // Only allowed when phase is 'buzzing'
    if (room.phase !== "buzzing") return "muted";
    // Ignore duplicate buzz from this client
    if (room.buzzes?.[myId]) return "muted";

    // Ability gates: silenced players and everyone outside a window lock are
    // blocked server-side by refusing to write the buzz.
    const gate = buzzGate({
      meId: myId,
      effects: room.abilityEffects,
      appliedToQuestionId: room.activeQuestion?.questionId,
      jail: room.jail,
      openedAt: room.activeQuestion?.openedAt,
    });
    if (gate === "muted") {
      abilityNoticeBus.emit({
        tone: "lock",
        icon: "🔒",
        title: "LOCKED OUT",
      });
      return "muted";
    }
    if (gate === "owner") {
      abilityNoticeBus.emit({
        tone: "ace",
        icon: "⚡",
        title: "YOUR WINDOW",
        subtitle: "only you can buzz right now",
      });
    }

    await update(ref(db, `rooms/${roomCode}`), {
      [`buzzes/${myId}`]: serverTimestamp(),
      [`players/${myId}/buzzCount`]: increment(1),
    });
    return "ok";
  }, [roomCode, room, myId]);

  // ── Player: send an emoji reaction ─────────────────────────────────────────
  // Each reaction gets a unique id so every client can animate it exactly once
  // (overlay diffs on the id). Reactions are cleared automatically whenever a
  // new question opens.
  const sendReaction = useCallback(
    async (emoji: string) => {
      if (!roomCode || !room) return;
      if (room.phase !== "buzzing" && room.phase !== "answer") return;
      await update(ref(db, `rooms/${roomCode}/reactions/${myId}`), {
        emoji,
        id: genId(8),
        ts: Date.now(),
      });
    },
    [roomCode, room, myId],
  );

  // ── Player: activate their once-per-game character ability ────────────────
  // The claim itself is atomic (a transaction keyed on `abilityEffects/{myId}`)
  // so a double-tap can never create two abilities. The effect is written
  // server-side; immediate kinds are resolved by the host watcher; question-
  // scoped kinds are stamped "applied" when a question opens.
  const activateAbility = useCallback(
    async ({
      abilityId,
      targetId,
      option,
    }: {
      abilityId: string;
      targetId?: string;
      option?: string;
    }): Promise<void> => {
      if (!roomCode || !room) return;
      const me = room.players?.[myId];
      if (!me || me.abilityUsed || !me.abilityUnlocked || !me.abilityId) {
        throw new Error("Ability is not ready.");
      }
      const def = getAbilityForAvatar(abilityId);
      if (!def || def.id !== me.abilityId) return;
      if (room.abilityEffects?.[myId]) {
        throw new Error("You already have an ability active.");
      }

      const resolution = resolveAutoTarget(room.players, myId, def.params?.targetMode);
      const effect: RoomAbilityEffect = sanitize({
        id: genId(8),
        playerId: myId,
        abilityId: def.id,
        kind: def.kind,
        targetId: targetId ?? resolution,
        option:
          option ??
          (def.params?.roll ? jokerRoll() : def.kind === "risky" ? "risk" : undefined),
        immediate: isImmediateKind(def.kind),
        status: "pending",
        createdAt: Date.now(),
      });

      const effRef = ref(db, `rooms/${roomCode}/abilityEffects/${myId}`);
      const claim = await runTransaction(effRef, (cur) => {
        if (cur) return undefined; // already claimed → abort
        return effect;
      });
      if (!claim.committed) {
        throw new Error("Ability already active.");
      }
      await update(ref(db, `rooms/${roomCode}`), {
        [`players/${myId}/abilityUsed`]: true,
      });
    },
    [roomCode, room, myId],
  );

  // ── Player: choose NORMAL or RISK for the risky buzzer (lee) mid-buzzing ──
  const setRiskChoice = useCallback(
    async (choice: "normal" | "risk") => {
      if (!roomCode || !room) return;
      const fx = room.abilityEffects?.[myId];
      if (!fx || fx.kind !== "risky" || fx.status !== "pending") return;
      await update(ref(db, `rooms/${roomCode}`), {
        [`abilityEffects/${myId}/option`]: choice,
      });
    },
    [roomCode, room, myId],
  );

  // ── Host: resolve an instant ability (boost / steal / halve / tax) ────────
  // Called by the host room's watcher when a pending immediate effect appears.
  const applyImmediateAbility = useCallback(
    async (effectPlayerId: string) => {
      if (!roomCode || !room || room.hostId !== myId) return;
      let fx = room.abilityEffects?.[effectPlayerId];
      // Race guard: the watcher fired from a snapshot that may already be
      // stale (the player's effect landing milliseconds behind). If the local
      // effect is missing, pull the live one so an immediate ability can never
      // silently fail to resolve — applying it is a one-shot, so re-reading is safe.
      if (!fx) {
        const live = await get(ref(db, `rooms/${roomCode}/abilityEffects/${effectPlayerId}`));
        fx = live.val() as RoomAbilityEffect | null ?? undefined;
      }
      if (!fx || fx.status !== "pending" || !isImmediateKind(fx.kind)) return;
      const players = room.players;
      const def = getAbilityForAvatar(fx.abilityId);
      const abilityName = def?.abilityName ?? "Ability";
      const updates: Record<string, any> = {};
      const roundScore = Math.round;

      if (fx.kind === "boostNow") {
        const pid = fx.playerId;
        const amt = boostAmount(fx, players);
        const name = players[pid]?.name ?? "Player";
        const { entry, newScore } = buildScoreChange(
          pid,
          players[pid]?.score ?? 0,
          amt,
          `${name} ${abilityName} (+$${amt})`,
        );
        updates[`players/${pid}/score`] = newScore;
        updates[`scoreHistory/${entry.id}`] = entry;
      } else if (fx.kind === "stealNow" || fx.kind === "stealAuto") {
        const transfer = stealTransfer(fx, players);
        if (transfer) {
          const fromP = players[transfer.from];
          const toP = players[transfer.to];
          const fromE = buildScoreChange(
            transfer.from,
            fromP?.score ?? 0,
            -transfer.amount,
            `${fromP?.name ?? "Player"} lost $${transfer.amount} to ${toP?.name ?? "Player"} [${abilityName}]`,
          );
          const toE = buildScoreChange(
            transfer.to,
            toP?.score ?? 0,
            transfer.amount,
            `${toP?.name ?? "Player"} ${abilityName} — took $${transfer.amount} from ${fromP?.name ?? "Player"}`,
          );
          updates[`players/${transfer.from}/score`] = fromE.newScore;
          updates[`players/${transfer.to}/score`] = toE.newScore;
          updates[`scoreHistory/${fromE.entry.id}`] = fromE.entry;
          updates[`scoreHistory/${toE.entry.id}`] = toE.entry;
        }
      } else if (fx.kind === "halveNow") {
        const pid = fx.targetId ?? leaderOf(players)?.id ?? fx.playerId;
        const p = players[pid];
        const amt = roundScore((p?.score ?? 0) / 2);
        const name = p?.name ?? "Player";
        const { entry, newScore } = buildScoreChange(
          pid,
          p?.score ?? 0,
          -amt,
          `${name} halved by ${abilityName} (−$${amt})`,
        );
        updates[`players/${pid}/score`] = newScore;
        updates[`scoreHistory/${entry.id}`] = entry;
      } else if (fx.kind === "taxNow") {
        const { from, total } = taxPayout(fx, players);
        const owner = players[fx.playerId];
        for (const [pid, amt] of Object.entries(from)) {
          const p = players[pid];
          const e = buildScoreChange(
            pid,
            p?.score ?? 0,
            -amt,
            `${p?.name ?? "Player"} taxed $${amt} by ${owner?.name ?? "Player"} [${abilityName}]`,
          );
          updates[`players/${pid}/score`] = e.newScore;
          updates[`scoreHistory/${e.entry.id}`] = e.entry;
        }
        if (total > 0) {
          const e = buildScoreChange(
            fx.playerId,
            owner?.score ?? 0,
            total,
            `${owner?.name ?? "Player"} ${abilityName} collected $${total} in taxes`,
          );
          updates[`players/${fx.playerId}/score`] = e.newScore;
          updates[`scoreHistory/${e.entry.id}`] = e.entry;
        }
      } else if (fx.kind === "doubleNow") {
        const pid = fx.playerId;
        const amt = players[pid]?.score ?? 0;
        const name = players[pid]?.name ?? "Player";
        const { entry, newScore } = buildScoreChange(
          pid,
          amt,
          amt,
          `${name} ${abilityName} — doubled to $${amt * 2}`,
        );
        updates[`players/${pid}/score`] = newScore;
        updates[`scoreHistory/${entry.id}`] = entry;
      } else if (fx.kind === "multiplyNow") {
        const pid = fx.playerId;
        const mult = getAbilityForAvatar(fx.abilityId)?.params?.mult ?? 2;
        const current = players[pid]?.score ?? 0;
        const amt = roundScore(current * mult) - current;
        const name = players[pid]?.name ?? "Player";
        const { entry, newScore } = buildScoreChange(
          pid,
          current,
          amt,
          `${name} ${abilityName} — multiplied to $${roundScore(current * mult)} (×${mult})`,
        );
        updates[`players/${pid}/score`] = newScore;
        updates[`scoreHistory/${entry.id}`] = entry;
      } else if (fx.kind === "copyLeader") {
        const pid = fx.playerId;
        const leader = leaderOf(players);
        const targetScore = leader ? leader.score : players[pid]?.score ?? 0;
        const current = players[pid]?.score ?? 0;
        const delta = targetScore - current;
        const name = players[pid]?.name ?? "Player";
        const { entry, newScore } = buildScoreChange(
          pid,
          current,
          delta,
          `${name} ${abilityName} — matched the leader ($${targetScore})`,
        );
        updates[`players/${pid}/score`] = newScore;
        updates[`scoreHistory/${entry.id}`] = entry;
      } else if (fx.kind === "grabHighest") {
        const def0 = getAbilityForAvatar(fx.abilityId);
        const pct = def0?.params?.pct ?? 0.9;
        const target = highestOf(players, fx.playerId);
        if (target) {
          const amt = roundScore((target.score ?? 0) * pct);
          const ownerName = players[fx.playerId]?.name ?? "Player";
          const fromE = buildScoreChange(
            target.id,
            amt,
            -amt,
            `${target.name ?? "Player"} lost ${Math.round(pct * 100)}% ($${amt}) to ${ownerName} [${abilityName}]`,
          );
          const toE = buildScoreChange(
            fx.playerId,
            players[fx.playerId]?.score ?? 0,
            amt,
            `${ownerName} took $${amt} from ${target.name ?? "Player"} [${abilityName}]`,
          );
          updates[`players/${target.id}/score`] = fromE.newScore;
          updates[`players/${fx.playerId}/score`] = toE.newScore;
          updates[`scoreHistory/${fromE.entry.id}`] = fromE.entry;
          updates[`scoreHistory/${toE.entry.id}`] = toE.entry;
        }
      } else if (fx.kind === "swapNow") {
        const targetId = fx.targetId;
        const a = players[fx.playerId];
        const b = targetId ? players[targetId] : undefined;
        if (a && b && targetId && targetId !== fx.playerId) {
          const aName = a?.name ?? "Player";
          const bName = b?.name ?? "Player";
          const aScore = a?.score ?? 0;
          const bScore = b?.score ?? 0;
          updates[`players/${fx.playerId}/score`] = bScore;
          updates[`players/${targetId}/score`] = aScore;
          const ea = buildScoreChange(fx.playerId, aScore, bScore - aScore, `${aName} swapped scores with ${bName} [${abilityName}]`);
          const eb = buildScoreChange(targetId, bScore, aScore - bScore, `${bName} swapped scores with ${aName} [${abilityName}]`);
          updates[`scoreHistory/${ea.entry.id}`] = ea.entry;
          updates[`scoreHistory/${eb.entry.id}`] = eb.entry;
        }
      } else if (fx.kind === "confiscate") {
        const from = confiscatePayout(fx, players);
        for (const [pid, amt] of Object.entries(from)) {
          const p = players[pid];
          const e = buildScoreChange(
            pid,
            p?.score ?? 0,
            -amt,
            `${p?.name ?? "Player"} confiscated $${amt} by ${abilityName}`,
          );
          updates[`players/${pid}/score`] = e.newScore;
          updates[`scoreHistory/${e.entry.id}`] = e.entry;
        }
      } else if (fx.kind === "subCount") {
        const pid = fx.playerId;
        const completed = room?.completedQuestions
          ? Object.keys(room.completedQuestions).filter((k) => room.completedQuestions[k]).length
          : 0;
        const amt = completed * 50;
        const name = players[pid]?.name ?? "Player";
        const { entry, newScore } = buildScoreChange(
          pid,
          players[pid]?.score ?? 0,
          amt,
          `${name} ${abilityName} — ${completed} × $50 (+$${amt})`,
        );
        updates[`players/${pid}/score`] = newScore;
        updates[`scoreHistory/${entry.id}`] = entry;
      } else if (fx.kind === "prime") {
        const pid = fx.playerId;
        const amt = 250;
        const name = players[pid]?.name ?? "Player";
        const { entry, newScore } = buildScoreChange(
          pid,
          players[pid]?.score ?? 0,
          amt,
          `${name} ${abilityName} (+$${amt})`,
        );
        updates[`players/${pid}/score`] = newScore;
        updates[`scoreHistory/${entry.id}`] = entry;
      }

      updates[`abilityEffects/${effectPlayerId}`] = null;
      await update(ref(db, `rooms/${roomCode}`), updates);
    },
    [roomCode, room, myId],
  );

  // ── Leave / cleanup ───────────────────────────────────────────────────────
  const leaveRoom = useCallback(async () => {
    if (startTimerRef.current) {
      window.clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    if (roomCode) {
      if (room?.hostId === myId) {
        await remove(ref(db, `rooms/${roomCode}`));
        if (room?.quizId) {
          // Clean up the temporary quiz copy used for this room to save database storage
          await remove(ref(db, `quizzes/${room.quizId}`));
        }
      } else {
        await remove(ref(db, `rooms/${roomCode}/players/${myId}`));
        await remove(ref(db, `rooms/${roomCode}/buzzes/${myId}`));
        await remove(ref(db, `rooms/${roomCode}/abilityEffects/${myId}`));
        // Release our avatar slot so a future player can take the character.
        const avatarId = Object.entries(room?.avatarOwners || {}).find(
          ([, owner]) => owner === myId,
        )?.[0];
        if (avatarId) {
          await update(ref(db, `rooms/${roomCode}`), {
            [`avatarOwners/${avatarId}`]: null,
          });
        }
      }
    }

    if (listenerRef.current) listenerRef.current();
    setRoom(null);
    setRoomCode(null);
    setError(null);
    clearSession();
  }, [roomCode, myId, room]);

  return (
    <RoomContext.Provider
      value={{
        myId,
        myName,
        isHost,
        room,
        loading,
        error,
        hydrated,
        createRoom,
        startGame,
        openQuestion,
        setAudioPlaying,
        judgeAnswer,
        splitPoints,
        adjustScore,
        undoLastScoreChange,
        revealAnswer,
        closeQuestion,
        endGame,
        resetGame,
        kickPlayer,
        joinRoom,
        buzz,
        sendReaction,
        activateAbility,
        setRiskChoice,
        applyImmediateAbility,
        leaveRoom,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used inside <RoomProvider>");
  return ctx;
};
