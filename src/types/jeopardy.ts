// ─── Question / Quiz types ───────────────────────────────────────────────────

export type QuestionType = "text" | "image" | "both";

export interface Question {
  id: string;
  text: string;
  answer: string;
  value: number;
  type: QuestionType;
  mediaUrl?: string;
  isDailyDouble?: boolean;
  timer?: number;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  questions: Question[];
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  categories: Category[];
  createdAt: number;
}

// ─── Multiplayer Room types (Firebase) ───────────────────────────────────────

export type RoomPhase =
  | "lobby" // waiting for players to join
  | "starting" // host started the game — 3-2-1 countdown
  | "board" // showing the Jeopardy board
  | "question" // a question card is open
  | "buzzing" // accepting buzzes
  | "judging" // someone buzzed — host judging
  | "answer" // host revealed answer
  | "ended"; // game over

export interface RoomPlayer {
  id: string; // playerId (nanoid / random)
  name: string;
  score: number;
  joinedAt: number;
  isHost: boolean;
  connected: boolean; // live presence — false while the client is disconnected, but the player stays in the room
  lastSeen: number; // server-resolved timestamp of last connect/disconnect transition
  buzzCount?: number; // total buzz-ins this game
  correctCount?: number; // questions answered correctly
  wrongCount?: number; // questions answered incorrectly
  fastestBuzz?: number | null; // fastest buzz reaction time in ms
  streak?: number; // current consecutive-correct streak (0 = no streak)
  bestStreak?: number; // longest streak reached this game
}

export interface BuzzEvent {
  playerId: string;
  playerName: string;
  timestamp: number;
}

export interface ActiveQuestion {
  questionId: string;
  categoryName: string;
  value: number;
  text: string;
  answer?: string;
  type: QuestionType;
  mediaUrl?: string;
  isDailyDouble?: boolean;
  revealAnswer: boolean;
  openedAt?: number; // server-resolved timestamp of when buzzing opened — reaction time = buzz - openedAt
  timer?: number; // seconds players have to buzz, before the urgency phase kicks in
}

export interface RoomReaction {
  emoji: string;
  id: string; // unique per reaction so clients can animate each one
  ts: number;
}

export interface Room {
  id: string; // 6-char room code
  hostId: string;
  quizId: string;
  quizTitle: string;
  phase: RoomPhase;
  players: Record<string, RoomPlayer>; // playerId → player
  completedQuestions: Record<string, boolean>; // questionId → true
  activeQuestion: ActiveQuestion | null;
  buzzes?: Record<string, number>; // playerId -> timestamp
  scoreHistory?: Record<string, ScoreHistoryEntry>; // entryId → entry, audit trail of every score change
  reactions?: Record<string, RoomReaction>; // playerId → current reaction
  startAt?: number; // server-resolved timestamp when the start countdown began
  createdAt: number;
}

// ─── Local UI / quiz library types ───────────────────────────────────────────

export interface ScoreHistoryEntry {
  id: string;
  timestamp: number;
  description: string;
  teamId?: string;
  changeAmount: number;
  previousScore: number;
  newScore: number;
  questionId?: string;
}

export interface GameSettings {
  soundVolume: number;
  isSoundMuted: boolean;
  defaultTimer: number;
  largeFontMode: boolean;
  animationSpeed: "slow" | "normal" | "fast";
  language: "en" | "es" | "fr" | "de";
}
