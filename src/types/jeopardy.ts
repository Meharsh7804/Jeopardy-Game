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
  answer: string;
  type: QuestionType;
  mediaUrl?: string;
  isDailyDouble?: boolean;
  revealAnswer: boolean;
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
