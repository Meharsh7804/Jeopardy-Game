import type { Room } from "../types/jeopardy";

export interface PlayerProfile {
  name: string;
  avatar?: string;
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
const SEASON_FIX_KEY = "jeopardy_season_fix_v1";

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

export const saveProfileAvatar = (avatar: string) => {
  const p = loadProfile();
  if (p.avatar === avatar) return;
  p.avatar = avatar;
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

/**
 * Per-calendar-month standings, keyed "YYYY-MM".
 *
 * Runs a one-time fix for the old double-counting bug: the previous
 * sessionStorage-based dedupe recorded a finished game twice when a tab was
 * reopened on an already-ended room, inflating the current month's game count
 * by one. Subtracts that single phantom count once per device.
 */
export const loadSeasons = (): Record<string, SeasonStats> => {
  const seasons = loadJSON<Record<string, SeasonStats>>(SEASONS_KEY, {});
  try {
    if (!localStorage.getItem(SEASON_FIX_KEY)) {
      localStorage.setItem(SEASON_FIX_KEY, "1");
      const s = seasons[seasonKeyOf()];
      if (s && s.games > 0) {
        s.games = Math.max(s.games - 1, 0);
        localStorage.setItem(SEASONS_KEY, JSON.stringify(seasons));
      }
    }
  } catch {
    // storage unavailable — leave season data untouched
  }
  return seasons;
};

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
  | "centurion"
  | "collector"
  // ── New: skill, funny & secret ───────────────────────────────────────────
  | "theProfessor"
  | "speedDemon"
  | "brainFreeze"
  | "buttonMasher"
  | "onePointWonder"
  | "clutchMaster"
  | "comebackKid"
  | "eggHunter"
  | "buzzWhisperer"
  | "riskTaker"
  | "perfectRound";

export const ACHIEVEMENT_IDS: AchievementId[] = [
  "firstWin",
  "onFire",
  "sharpshooter",
  "regular",
  "lightning",
  "highRoller",
  "flawless",
  "centurion",
  "collector",
  "theProfessor",
  "speedDemon",
  "brainFreeze",
  "buttonMasher",
  "onePointWonder",
  "clutchMaster",
  "comebackKid",
  "eggHunter",
  "buzzWhisperer",
  "riskTaker",
  "perfectRound",
];

/**
 * Achievements whose name/description stay hidden until unlocked. They're
 * earned through playful, curious behavior (mashing, finding eggs, absurdly
 * fast buzzes) rather than shown as goals — the player discovers them.
 */
export const SECRET_ACHIEVEMENTS: ReadonlySet<AchievementId> = new Set<AchievementId>([
  "buttonMasher",
  "eggHunter",
  "buzzWhisperer",
]);

export const isSecretAchievement = (id: AchievementId): boolean => SECRET_ACHIEVEMENTS.has(id);

/** i18n key for an achievement's display name (e.g. "firstWin" → "achFirstWin"). */
export const achievementKey = (id: AchievementId): string =>
  `ach${id[0].toUpperCase()}${id.slice(1)}`;

/** Achievements that can unlock while a game is still running. */
export const LIVE_ACHIEVEMENT_IDS: AchievementId[] = ["onFire", "lightning"];

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
  // New skill badges, evaluated from lifetime/merged stats.
  grant("theProfessor", p.bestStreak >= 5);
  grant("speedDemon", p.fastestBuzz !== null && (p.fastestBuzz as number) <= 1500);
  grant("perfectRound", history.some((m) => m.correct >= 5 && m.wrong === 0));
  // Meta badge: earned once 4 other achievements are unlocked.
  const othersUnlocked = Object.keys(unlocked).filter((id) => id !== "collector").length;
  grant("collector", othersUnlocked >= 4);

  return unlocked;
};

/**
 * Re-evaluates all achievements against the profile and returns the ids that
 * are newly unlocked (never duplicates). Used live mid-game and at game end.
 */
export const evaluateAchievements = (p: PlayerProfile): { profile: PlayerProfile; newly: AchievementId[] } => {
  const before = new Set(Object.keys(p.achievements));
  const history = loadMatchHistory();
  const achievements = checkAchievements(p, history);
  const newly = ACHIEVEMENT_IDS.filter((id) => achievements[id] && !before.has(id));
  return { profile: { ...p, achievements }, newly };
};

/**
 * Unlocks a single achievement outside the normal stat evaluation (used for
 * playful/secret/unlock-on-event badges like Button Masher or Egg Hunter).
 * Returns true only the first time it's earned, so callers can fire a toast.
 */
export const grantAchievement = (id: AchievementId): boolean => {
  const p = loadProfile();
  if (p.achievements[id]) return false;
  p.achievements[id] = Date.now();
  persist(p);
  return true;
};

/**
 * Live mid-game check: merges the player's in-game stats into the stored
 * profile, unlocks whatever is now earned (e.g. "On Fire" for a 3-streak,
 * "Lightning" for a sub-3s buzz), persists once, and returns the new ids.
 */
export const checkLiveAchievements = (opts: {
  bestStreak?: number;
  fastestBuzzMs?: number;
}): AchievementId[] => {
  const p = loadProfile();
  if (opts.bestStreak != null) p.bestStreak = Math.max(p.bestStreak, opts.bestStreak);
  if (opts.fastestBuzzMs != null) {
    p.fastestBuzz =
      p.fastestBuzz === null ? opts.fastestBuzzMs : Math.min(p.fastestBuzz, opts.fastestBuzzMs);
  }
  const { profile, newly } = evaluateAchievements(p);
  if (newly.length > 0) persist(profile);
  return newly;
};

// ─── Encouragement: progress & hints for locked achievements ─────────────────

/** 0..1 progress toward each achievement (unlocked ones read 1). */
export const achievementProgress = (p: PlayerProfile): Record<AchievementId, number> => {
  const othersUnlocked = ACHIEVEMENT_IDS.filter((id) => id !== "collector" && p.achievements[id]).length;
  const history = loadMatchHistory();
  return {
    firstWin: Math.min(1, p.gamesWon),
    onFire: Math.min(1, p.bestStreak / 3),
    sharpshooter: Math.min(1, p.totalCorrect / 25),
    regular: Math.min(1, p.gamesPlayed / 10),
    lightning: p.fastestBuzz !== null ? Math.min(1, 3000 / (p.fastestBuzz as number)) : 0,
    highRoller: Math.min(1, p.totalPoints / 5000),
    flawless: history.some((m) => m.won && m.wrong === 0 && m.correct >= 3) ? 1 : 0,
    centurion: history.some((m) => m.myScore >= 1000) ? 1 : 0,
    theProfessor: Math.min(1, p.bestStreak / 5),
    speedDemon: p.fastestBuzz !== null ? Math.min(1, 1500 / (p.fastestBuzz as number)) : 0,
    brainFreeze: 0,
    buttonMasher: 0,
    onePointWonder: 0,
    clutchMaster: 0,
    comebackKid: 0,
    eggHunter: 0,
    buzzWhisperer: 0,
    riskTaker: 0,
    perfectRound: history.some((m) => m.correct >= 5 && m.wrong === 0) ? 1 : 0,
    collector: Math.min(1, othersUnlocked / 4),
  };
};

/** The locked achievement the player is closest to unlocking (null if all done). */
export const nextAchievementGoal = (p: PlayerProfile): AchievementId | null => {
  const progress = achievementProgress(p);
  let best: AchievementId | null = null;
  for (const id of ACHIEVEMENT_IDS) {
    if (p.achievements[id]) continue;
    if (best === null || progress[id] > progress[best]) best = id;
  }
  return best;
};

/** Motivational hint text for a locked achievement (i18n key + optional params). */
export const achievementHint = (
  id: AchievementId,
  p: PlayerProfile,
): { key: string; params?: Record<string, number> } => {
  const othersUnlocked = ACHIEVEMENT_IDS.filter((a) => a !== "collector" && p.achievements[a]).length;
  const key = `achHint${id[0].toUpperCase()}${id.slice(1)}`;
  switch (id) {
    case "sharpshooter":
      return { key, params: { n: Math.max(0, 25 - p.totalCorrect) } };
    case "regular":
      return { key, params: { n: Math.max(0, 10 - p.gamesPlayed) } };
    case "highRoller":
      return { key, params: { n: Math.max(0, 5000 - p.totalPoints) } };
    case "collector":
      return { key, params: { n: Math.max(0, 4 - othersUnlocked) } };
    case "theProfessor":
      return { key, params: { n: Math.max(0, 5 - p.bestStreak) } };
    case "speedDemon":
      return {
        key,
        params: { n: p.fastestBuzz !== null ? Math.max(0, Math.round((p.fastestBuzz as number) - 1500)) : 1500 },
      };
    default:
      return { key };
  }
};

/**
 * Records a finished game into the local player's profile. Dedupes via
 * localStorage so remounts/reconnects, StrictMode double-effects and new
 * tabs/sessions rejoining an already-ended room never double-count.
 *
 * The marker is built from fields that cannot change once a game has ended:
 * room id, room creation time, the OLDEST score-history timestamp (the host's
 * "Undo Last" only ever removes the newest entry) and the completed-question
 * count. A rematch in the same room wipes scoreHistory, so it always produces
 * a fresh marker.
 */
export const recordGameEnd = (room: Room, myId: string): PlayerProfile => {
  const me = room.players[myId];
  if (!me || me.isHost) return loadProfile();

  const questionCount = Object.keys(room.completedQuestions || {}).length;
  const entryTs = Object.values(room.scoreHistory || {})
    .map((e) => e?.timestamp ?? 0)
    .filter((ts) => ts > 0);
  const oldestTs = entryTs.length > 0 ? Math.min(...entryTs) : 0;
  const marker = `${room.id}:${room.createdAt}:${oldestTs}:${questionCount}`;
  try {
    if (localStorage.getItem(DEDUPE_KEY) === marker) return loadProfile();
    localStorage.setItem(DEDUPE_KEY, marker);
  } catch {
    // storage unavailable — stats stay in-memory only
  }

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

  const { profile: evaluated } = evaluateAchievements(p);
  p.achievements = evaluated.achievements;
  persist(p);
  return p;
};