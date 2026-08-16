import type { Room } from "../types/jeopardy";

export interface PlayerProfile {
  name: string;
  gamesPlayed: number;
  gamesWon: number;
  totalCorrect: number;
  totalWrong: number;
  bestStreak: number;
  fastestBuzz: number | null; // ms
  totalPoints: number;
  favoriteCategory: string | null;
}

const KEY = "jeopardy_profile";
const DEDUPE_KEY = "jeopardy_profile_recorded";

const emptyProfile = (): PlayerProfile => ({
  name: "",
  gamesPlayed: 0,
  gamesWon: 0,
  totalCorrect: 0,
  totalWrong: 0,
  bestStreak: 0,
  fastestBuzz: null,
  totalPoints: 0,
  favoriteCategory: null,
});

const persist = (p: PlayerProfile) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage unavailable — stats stay in-memory only
  }
};

export const loadProfile = (): PlayerProfile => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProfile();
    return { ...emptyProfile(), ...JSON.parse(raw) };
  } catch {
    return emptyProfile();
  }
};

export const saveProfileName = (name: string) => {
  const p = loadProfile();
  if (p.name === name) return;
  p.name = name;
  persist(p);
};

/**
 * Records a finished game into the local player's profile. Dedupes via
 * sessionStorage so remounts/reconnects (and StrictMode double-effects) never
 * double-count; a rematch in the same room is a new marker because scores and
 * completed questions reset.
 */
export const recordGameEnd = (room: Room, myId: string): PlayerProfile => {
  const questionCount = Object.keys(room.completedQuestions || {}).length;
  const totalScore = Object.values(room.players).reduce((s, p) => s + (p.score || 0), 0);
  const marker = `${room.id}:${questionCount}:${totalScore}`;
  try {
    if (sessionStorage.getItem(DEDUPE_KEY) === marker) return loadProfile();
    sessionStorage.setItem(DEDUPE_KEY, marker);
  } catch {
    // no sessionStorage — proceed anyway
  }

  const me = room.players[myId];
  if (!me || me.isHost) return loadProfile();

  const ranked = Object.values(room.players)
    .filter((p) => !p.isHost)
    .sort((a, b) => b.score - a.score);
  const won = ranked[0]?.id === myId && (ranked[0]?.score ?? 0) > 0;

  const p = loadProfile();
  p.gamesPlayed += 1;
  if (won) p.gamesWon += 1;
  p.totalCorrect += me.correctCount ?? 0;
  p.totalWrong += me.wrongCount ?? 0;
  p.totalPoints += me.score ?? 0;
  p.bestStreak = Math.max(p.bestStreak, me.bestStreak ?? 0);
  if ((me.fastestBuzz ?? null) !== null) {
    const fb = me.fastestBuzz as number;
    if (p.fastestBuzz === null || fb < p.fastestBuzz) p.fastestBuzz = fb;
  }

  // Favorite category: tally this game's correct answers per category. The
  // score-history entries carry the category name in the description and the
  // player's id in teamId; when a question was re-judged, only the latest
  // entry per question counts.
  const categoryCounts = new Map<string, number>();
  const seenQuestions = new Set<string>();
  const myEntries = Object.values(room.scoreHistory || {})
    .filter((e) => e.teamId === myId && e.changeAmount > 0)
    .sort((a, b) => b.timestamp - a.timestamp);
  for (const e of myEntries) {
    if (e.questionId) {
      if (seenQuestions.has(e.questionId)) continue;
      seenQuestions.add(e.questionId);
    }
    const m = e.description.match(/— "([^"]+)"/);
    if (m) categoryCounts.set(m[1], (categoryCounts.get(m[1]) ?? 0) + 1);
  }
  let bestCategory: string | null = null;
  let bestCount = 0;
  for (const [name, n] of categoryCounts) {
    if (n > bestCount) {
      bestCategory = name;
      bestCount = n;
    }
  }
  if (bestCategory) p.favoriteCategory = bestCategory;

  persist(p);
  return p;
};