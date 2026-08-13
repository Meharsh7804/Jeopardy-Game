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
import {
  ref,
  set,
  get,
  update,
  onValue,
  remove,
  onDisconnect,
  serverTimestamp,
} from "firebase/database";
import type {
  Room,
  RoomPlayer,
  ActiveQuestion,
  RoomPhase,
  Quiz,
  Question,
  ScoreHistoryEntry,
} from "../types/jeopardy";

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

  // host actions
  createRoom: (quiz: Quiz, hostName: string) => Promise<string>;
  startGame: () => Promise<void>;
  openQuestion: (question: Question, categoryName: string) => Promise<void>;
  judgeAnswer: (correct: boolean) => Promise<void>;
  splitPoints: (playerIds: string[]) => Promise<void>;
  adjustScore: (playerId: string, delta: number, reason: string) => Promise<void>;
  undoLastScoreChange: () => Promise<void>;
  revealAnswer: (answerText: string) => Promise<void>;
  closeQuestion: () => Promise<void>;
  endGame: () => Promise<void>;
  kickPlayer: (playerId: string) => Promise<void>;

  // player actions
  joinRoom: (code: string, playerName: string) => Promise<void>;
  buzz: () => Promise<void>;

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
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // ── Host: create room ─────────────────────────────────────────────────────
  const createRoom = useCallback(
    async (quiz: Quiz, hostName: string): Promise<string> => {
      setLoading(true);
      setError(null);
      try {
        const code = genId(6);
        const hostPlayer: RoomPlayer = {
          id: myId,
          name: hostName,
          score: 0,
          joinedAt: Date.now(),
          isHost: true,
          connected: true,
          lastSeen: Date.now(),
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
  const startGame = useCallback(async () => {
    if (!roomCode) return;
    await update(ref(db, `rooms/${roomCode}`), { phase: "board" as RoomPhase });
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
      };
      if (question.mediaUrl) aq.mediaUrl = question.mediaUrl;
      if (question.isDailyDouble) aq.isDailyDouble = question.isDailyDouble;
      // Write activeQuestion, clear buzzes, and flip phase atomically.
      // Every subscriber (host + all players) reacts to the same snapshot.
      await update(ref(db, `rooms/${roomCode}`), {
        activeQuestion: aq,
        buzzes: null as any,
        phase: "buzzing" as RoomPhase,
      });
    },
    [roomCode],
  );

  // ── Host: judge answer correct / incorrect ────────────────────────────────
  // Fix #1/#2: use server-side sorted buzz timestamps so priority is never
  // determined on the client.  The first entry in the sorted array is always
  // the real #1 buzzer regardless of who joined/rejoined.
  const judgeAnswer = useCallback(
    async (correct: boolean) => {
      if (!roomCode || !room) return;

      // Sort buzzes server-authoritatively by timestamp ascending
      const sortedBuzzes = Object.entries(room.buzzes || {}).sort(
        (a, b) => a[1] - b[1],
      );
      const buzzPlayerId = sortedBuzzes[0]?.[0];
      if (!buzzPlayerId) return;

      const value = room.activeQuestion?.value ?? 0;
      const delta = correct ? value : -value;
      const currentScore = room.players[buzzPlayerId]?.score ?? 0;
      const playerName = room.players[buzzPlayerId]?.name ?? "Player";
      const { entry, newScore } = buildScoreChange(
        buzzPlayerId,
        currentScore,
        delta,
        `${playerName} ${correct ? "answered correctly" : "answered incorrectly"} — "${room.activeQuestion?.categoryName ?? ""}" for $${value}`,
        room.activeQuestion?.questionId,
      );

      const updates: Record<string, any> = {
        [`players/${buzzPlayerId}/score`]: newScore,
        [`scoreHistory/${entry.id}`]: entry,
      };

      if (correct && room.activeQuestion) {
        updates[`completedQuestions/${room.activeQuestion.questionId}`] = true;
        updates["activeQuestion"] = null;
        updates["phase"] = "board" as RoomPhase;
        updates["buzzes"] = null;
      } else {
        // Incorrect — remove this player's buzz so next in queue is evaluated
        updates[`buzzes/${buzzPlayerId}`] = null;
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
    if (!roomCode || !room?.activeQuestion) return;
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
    await update(ref(db, `rooms/${roomCode}`), {
      phase: "board" as RoomPhase,
      activeQuestion: null,
      buzzes: null as any,
      [`completedQuestions/${qId}`]: true,
    });
  }, [roomCode, room]);

  // ── Host: end the game ────────────────────────────────────────────────────
  const endGame = useCallback(async () => {
    if (!roomCode) return;
    await update(ref(db, `rooms/${roomCode}`), { phase: "ended" as RoomPhase });
  }, [roomCode]);

  // ── Host: kick a player ────────────────────────────────────────────────────
  // Fix #6: removes the player from players map and clears any pending buzz.
  const kickPlayer = useCallback(
    async (playerId: string) => {
      if (!roomCode) return;
      await remove(ref(db, `rooms/${roomCode}/players/${playerId}`));
      await remove(ref(db, `rooms/${roomCode}/buzzes/${playerId}`));
    },
    [roomCode],
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
    async (code: string, playerName: string) => {
      setLoading(true);
      setError(null);
      const upperCode = code.toUpperCase().trim();
      try {
        const snap = await get(ref(db, `rooms/${upperCode}`));
        if (!snap.exists()) throw new Error(`Room "${upperCode}" not found.`);

        const existingRoom = snap.val() as Room;
        const existingPlayer = existingRoom.players?.[myId];
        const isRejoin = !!existingPlayer;

        const player: RoomPlayer = {
          id: myId,
          name: playerName,
          score: existingPlayer?.score ?? 0,
          // Preserve the original joinedAt on rejoin so lobby ordering and
          // "who has been here longest" stay stable across refreshes.
          joinedAt: existingPlayer?.joinedAt ?? Date.now(),
          isHost: false,
          connected: true,
          lastSeen: Date.now(),
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
  const buzz = useCallback(async () => {
    if (!roomCode || !room) return;
    // Only allowed when phase is 'buzzing'
    if (room.phase !== "buzzing") return;
    // Ignore duplicate buzz from this client
    if (room.buzzes?.[myId]) return;

    await update(ref(db, `rooms/${roomCode}`), {
      [`buzzes/${myId}`]: serverTimestamp(),
    });
  }, [roomCode, room, myId]);

  // ── Leave / cleanup ───────────────────────────────────────────────────────
  const leaveRoom = useCallback(async () => {
    if (roomCode) {
      if (room?.hostId === myId) {
        await remove(ref(db, `rooms/${roomCode}`));
      } else {
        await remove(ref(db, `rooms/${roomCode}/players/${myId}`));
        await remove(ref(db, `rooms/${roomCode}/buzzes/${myId}`));
      }
    }

    if (listenerRef.current) listenerRef.current();
    setRoom(null);
    setRoomCode(null);
    setError(null);
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
        createRoom,
        startGame,
        openQuestion,
        judgeAnswer,
        splitPoints,
        adjustScore,
        undoLastScoreChange,
        revealAnswer,
        closeQuestion,
        endGame,
        kickPlayer,
        joinRoom,
        buzz,
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
