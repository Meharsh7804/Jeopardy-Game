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
  achievements: Record<string, number>; // achievement id -> unlock timestamp (ms)
}

export interface MatchRecord {
  date: number; // ms
  myScore: number;
  rank: number; // 1-based among non-hosts
  totalPlayers: number;
  won: boolean;
  correct: number;
  wrong: number;
  scores: { name: string; score: number }[]; // final standings, highest first
}

export interface SeasonStats {
  points: number;
  games: number;
  wins: number;
}

const KEY = "jeopardy_profile";
const DEDUPE_KEY = "jeopardy_profile_recorded";
const HISTORY_KEY = "jeopardy_match_history";
const SEASONS_KEY = "jeopardy_seasons";

const HISTORY_LIMIT = 20;

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
  achievements: {},
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

const loadJSON = <T,>(storageKey: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

/** Recent finished games, newest first. */
export const loadMatchHistory = (): MatchRecord[] => loadJSON<MatchRecord[]>(HISTORY_KEY, []);

/** Per-calendar-month standings, keyed "YYYY-MM". */
export const loadSeasons = (): Record<string, SeasonStats> => loadJSON(SEASONS_KEY, {});

export const seasonKeyOf = (date: Date = new Date()): string => {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${m}`;
};

// ─── XP & levels ─────────────────────────────────────────────────────────────

/** Lifetime XP derived deterministically from the profile totals. */
export const xpOf = (p: PlayerProfile): number =>
  p.gamesPlayed * 10 + p.gamesWon * 75 + p.totalCorrect * 15;

export interface LevelInfo {
  level: number;
  into: number; // XP earned inside the current level
  need: number; // XP required to reach the next level
}

/** Level 1 starts at 0; each next level needs 50 more XP than the last. */
export const levelInfo = (xp: number): LevelInfo => {
  let level = 1;
  let threshold = 100;
  while (xp >= threshold) {
    xp -= threshold;
    level += 1;
    threshold += 50;
  }
  return { level, into: xp, need: threshold };
};

// ─── Achievements ────────────────────────────────────────────────────────────

export type AchievementId =
  | "firstWin"
  | "onFire"
  | "sharpshooter"
  | "regular"
  | "lightning"
  | "highRoller"
  | "flawless"
  | "centurion";

export const ACHIEVEMENT_IDS: AchievementId[] = [
  "firstWin",
  "onFire",
  "sharpshooter",
  "regular",
  "lightning",
  "highRoller",
  "flawless",
  "centurion",
];

const checkAchievements = (p: PlayerProfile, history: MatchRecord[]): Record<string, number> => {
  const unlocked: Record<string, number> = { ...p.achievements };
  const now = Date.now();
  const grant = (id: AchievementId, met: boolean) => {
    if (met && !unlocked[id]) unlocked[id] = now;
  };

  grant("firstWin", p.gamesWon >= 1);
  grant("onFire", p.bestStreak >= 3);
  grant("sharpshooter", p.totalCorrect >= 25);
  grant("regular", p.gamesPlayed >= 10);
  grant("lightning", p.fastestBuzz !== null && (p.fastestBuzz as number) <= 3000);
  grant("highRoller", p.totalPoints >= 5000);
  grant(
    "flawless",
    history.some((m) => m.won && m.wrong === 0 && m.correct >= 3),
  );
  grant("centurion", history.some((m) => m.myScore >= 1000));

  return unlocked;
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
  const rank = ranked.findIndex((p) => p.id === myId) + 1;
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

  // Match history (newest first, capped).
  const match: MatchRecord = {
    date: Date.now(),
    myScore: me.score ?? 0,
    rank,
    totalPlayers: ranked.length,
    won,
    correct: me.correctCount ?? 0,
    wrong: me.wrongCount ?? 0,
    scores: ranked.map((r) => ({ name: r.name, score: r.score ?? 0 })),
  };
  const history = [match, ...loadMatchHistory()].slice(0, HISTORY_LIMIT);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // storage unavailable — history stays in-memory only
  }

  // Season standings (per calendar month).
  const seasons = loadSeasons();
  const skey = seasonKeyOf();
  const s = seasons[skey] ?? { points: 0, games: 0, wins: 0 };
  s.points += me.score ?? 0;
  s.games += 1;
  if (won) s.wins += 1;
  seasons[skey] = s;
  try {
    localStorage.setItem(SEASONS_KEY, JSON.stringify(seasons));
  } catch {
    // storage unavailable — seasons stay in-memory only
  }

  p.achievements = checkAchievements(p, history);
  persist(p);
  return p;
};