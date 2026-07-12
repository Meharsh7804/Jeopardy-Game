/**
 * RoomContext — Firebase Realtime Database multiplayer room management.
 *
 * Flow:
 *  Host:   createRoom() → picks quiz → starts game → opens questions → grades buzzes
 *  Player: joinRoom(code, name) → sees board & buzzes in → host grades
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../firebase';
import {
  ref,
  set,
  get,
  update,
  onValue,
} from 'firebase/database';
import type { Room, RoomPlayer, ActiveQuestion, RoomPhase, Quiz, Question } from '../types/jeopardy';

// ─── helpers ─────────────────────────────────────────────────────────────────

const genId = (len = 6) =>
  Math.random().toString(36).toUpperCase().slice(2, 2 + len);

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
  enableBuzzing: () => Promise<void>;
  judgeAnswer: (correct: boolean) => Promise<void>;
  revealAnswer: () => Promise<void>;
  closeQuestion: () => Promise<void>;
  endGame: () => Promise<void>;

  // player actions
  joinRoom: (code: string, playerName: string) => Promise<void>;
  buzz: () => Promise<void>;

  // leave
  leaveRoom: () => void;
}

const RoomContext = createContext<RoomContextProps | undefined>(undefined);

// ─── provider ────────────────────────────────────────────────────────────────

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [myId] = useState<string>(() => {
    const stored = sessionStorage.getItem('jeopardy_player_id');
    if (stored) return stored;
    const id = genId(12);
    sessionStorage.setItem('jeopardy_player_id', id);
    return id;
  });
  const [myName, setMyName] = useState<string>(
    () => sessionStorage.getItem('jeopardy_player_name') || ''
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
    const unsub = onValue(roomRef, (snap) => {
      if (snap.exists()) {
        setRoom(snap.val() as Room);
        setError(null);
      } else {
        setRoom(null);
        setRoomCode(null);
        setError('Room no longer exists.');
      }
    }, (err) => {
      setError(err.message);
    });

    listenerRef.current = unsub;
    return () => {
      unsub();
      listenerRef.current = null;
    };
  }, [roomCode]);

  // ── Host: create room ─────────────────────────────────────────────────────
  const createRoom = useCallback(async (quiz: Quiz, hostName: string): Promise<string> => {
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
      };

      const newRoom: Room = {
        id: code,
        hostId: myId,
        quizId: quiz.id,
        quizTitle: quiz.title,
        phase: 'lobby',
        players: { [myId]: hostPlayer },
        completedQuestions: {},
        activeQuestion: null,
        buzz: null,
        createdAt: Date.now(),
      };

      await set(ref(db, `rooms/${code}`), newRoom);
      // Store the quiz so the host can open questions
      await set(ref(db, `quizzes/${quiz.id}`), quiz);

      setMyName(hostName);
      sessionStorage.setItem('jeopardy_player_name', hostName);
      setRoomCode(code);
      return code;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [myId]);

  // ── Host: start game ──────────────────────────────────────────────────────
  const startGame = useCallback(async () => {
    if (!roomCode) return;
    await update(ref(db, `rooms/${roomCode}`), { phase: 'board' as RoomPhase });
  }, [roomCode]);

  // ── Host: open a question ─────────────────────────────────────────────────
  const openQuestion = useCallback(async (question: Question, categoryName: string) => {
    if (!roomCode) return;
    const aq: ActiveQuestion = {
      questionId: question.id,
      categoryName,
      value: question.value,
      text: question.text,
      answer: question.answer,
      type: question.type,
      mediaUrl: question.mediaUrl,
      isDailyDouble: question.isDailyDouble,
      revealAnswer: false,
    };
    await update(ref(db, `rooms/${roomCode}`), {
      activeQuestion: aq,
      buzz: null,
      phase: 'question' as RoomPhase,
    });
  }, [roomCode]);

  // ── Host: enable buzzing ──────────────────────────────────────────────────
  const enableBuzzing = useCallback(async () => {
    if (!roomCode) return;
    await update(ref(db, `rooms/${roomCode}`), { phase: 'buzzing' as RoomPhase, buzz: null });
  }, [roomCode]);

  // ── Host: judge answer correct / incorrect ────────────────────────────────
  const judgeAnswer = useCallback(async (correct: boolean) => {
    if (!roomCode || !room) return;
    const buzzPlayerId = room.buzz?.playerId;
    if (!buzzPlayerId) return;

    const value = room.activeQuestion?.value ?? 0;
    const delta = correct ? value : -value;
    const currentScore = room.players[buzzPlayerId]?.score ?? 0;

    const updates: Record<string, any> = {
      [`players/${buzzPlayerId}/score`]: currentScore + delta,
      phase: correct ? ('board' as RoomPhase) : ('buzzing' as RoomPhase),
      buzz: correct ? null : null,
    };

    if (correct && room.activeQuestion) {
      updates[`completedQuestions/${room.activeQuestion.questionId}`] = true;
      updates['activeQuestion'] = null;
      updates['phase'] = 'board' as RoomPhase;
    } else {
      // Incorrect — re-open buzzing so others can try
      updates['buzz'] = null;
      updates['phase'] = 'buzzing' as RoomPhase;
    }

    await update(ref(db, `rooms/${roomCode}`), updates);
  }, [roomCode, room]);

  // ── Host: reveal the answer text ─────────────────────────────────────────
  const revealAnswer = useCallback(async () => {
    if (!roomCode || !room?.activeQuestion) return;
    await update(ref(db, `rooms/${roomCode}/activeQuestion`), { revealAnswer: true });
    await update(ref(db, `rooms/${roomCode}`), { phase: 'answer' as RoomPhase });
  }, [roomCode, room]);

  // ── Host: close question without awarding ────────────────────────────────
  const closeQuestion = useCallback(async () => {
    if (!roomCode || !room?.activeQuestion) return;
    const qId = room.activeQuestion.questionId;
    await update(ref(db, `rooms/${roomCode}`), {
      phase: 'board' as RoomPhase,
      activeQuestion: null,
      buzz: null,
      [`completedQuestions/${qId}`]: true,
    });
  }, [roomCode, room]);

  // ── Host: end the game ────────────────────────────────────────────────────
  const endGame = useCallback(async () => {
    if (!roomCode) return;
    await update(ref(db, `rooms/${roomCode}`), { phase: 'ended' as RoomPhase });
  }, [roomCode]);

  // ── Player: join a room ───────────────────────────────────────────────────
  const joinRoom = useCallback(async (code: string, playerName: string) => {
    setLoading(true);
    setError(null);
    const upperCode = code.toUpperCase().trim();
    try {
      const snap = await get(ref(db, `rooms/${upperCode}`));
      if (!snap.exists()) throw new Error(`Room "${upperCode}" not found.`);

      const player: RoomPlayer = {
        id: myId,
        name: playerName,
        score: 0,
        joinedAt: Date.now(),
        isHost: false,
      };

      await update(ref(db, `rooms/${upperCode}/players`), { [myId]: player });
      setMyName(playerName);
      sessionStorage.setItem('jeopardy_player_name', playerName);
      setRoomCode(upperCode);
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [myId]);

  // ── Player: buzz in ────────────────────────────────────────────────────────
  const buzz = useCallback(async () => {
    if (!roomCode || !room) return;
    // Only allowed when phase is 'buzzing'
    if (room.phase !== 'buzzing') return;
    // Already buzzed
    if (room.buzz) return;

    const buzzEvent = {
      playerId: myId,
      playerName: myName,
      timestamp: Date.now(),
    };

    await update(ref(db, `rooms/${roomCode}`), {
      buzz: buzzEvent,
      phase: 'judging' as RoomPhase,
    });
  }, [roomCode, room, myId, myName]);

  // ── Leave / cleanup ───────────────────────────────────────────────────────
  const leaveRoom = useCallback(() => {
    if (listenerRef.current) listenerRef.current();
    setRoom(null);
    setRoomCode(null);
    setError(null);
  }, []);

  return (
    <RoomContext.Provider value={{
      myId, myName, isHost,
      room, loading, error,
      createRoom, startGame, openQuestion, enableBuzzing,
      judgeAnswer, revealAnswer, closeQuestion, endGame,
      joinRoom, buzz,
      leaveRoom,
    }}>
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used inside <RoomProvider>');
  return ctx;
};
