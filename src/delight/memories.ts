import { useEffect, useRef } from "react";
import type { Room } from "../types/jeopardy";

export interface MatchMemory {
  longestStreak: number; // longest correct streak anyone reached
  biggestComeback: number; // points overcome to snatch the lead
  fastestAnswer: number | null; // fastest buzz (ms)
  hardestQuestion: number; // highest-value question answered correctly
  biggestSwing: number; // largest single score change (abs)
  buzzerBattle: number; // most players who buzzed a single question
  closestFinish: number | null; // final margin between top two (set at end)
}

const empty = (): MatchMemory => ({
  longestStreak: 0,
  biggestComeback: 0,
  fastestAnswer: null,
  hardestQuestion: 0,
  biggestSwing: 0,
  buzzerBattle: 0,
  closestFinish: null,
});

// Module-level store: populated by the room components while a game plays,
// read once by ResultsScreen when the match ends. Never mutates scores.
let store: MatchMemory = empty();

export const resetMatchMemory = (): void => {
  store = empty();
};

export const getMatchMemory = (): MatchMemory => store;

export const recordComeback = (points: number): void => {
  if (points > store.biggestComeback) store.biggestComeback = points;
};

export const recordStreak = (n: number): void => {
  if (n > store.longestStreak) store.longestStreak = n;
};

export const recordFastBuzz = (ms: number): void => {
  store.fastestAnswer = store.fastestAnswer === null ? ms : Math.min(store.fastestAnswer, ms);
};

export const recordHardest = (value: number): void => {
  if (value > store.hardestQuestion) store.hardestQuestion = value;
};

export const recordSwing = (amount: number): void => {
  const a = Math.abs(amount);
  if (a > store.biggestSwing) store.biggestSwing = a;
};

export const recordBuzzerBattle = (count: number): void => {
  if (count > store.buzzerBattle) store.buzzerBattle = count;
};

/**
 * Observes a room and accumulates the "story" of the match into the shared
 * memory store. Pure read-only: it never changes scores, only remembers.
 * Resets itself when a brand-new game (same room id, new creation time) starts.
 */
export const useMatchMemory = (room: Room | null | undefined, myId: string): void => {
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!room) return;
    const key = `${room.id}:${room.createdAt}`;
    if (keyRef.current !== key) {
      keyRef.current = key;
      resetMatchMemory();
    }
  }, [room?.id, room?.createdAt]);

  useEffect(() => {
    if (!room) return;
    for (const p of Object.values(room.players)) {
      recordStreak(p.bestStreak ?? p.streak ?? 0);
      if (p.fastestBuzz != null) recordFastBuzz(p.fastestBuzz);
    }
    for (const e of Object.values(room.scoreHistory ?? {})) {
      recordSwing(e.changeAmount);
      if (e.changeAmount > 0) recordHardest(e.changeAmount);
    }
    const n = Object.keys(room.buzzes ?? {}).length;
    if (room.phase === "buzzing" || room.phase === "judging" || room.phase === "question") {
      recordBuzzerBattle(n);
    }
  }, [room, myId]);
};
