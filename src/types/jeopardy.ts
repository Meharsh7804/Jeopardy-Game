// ─── Question / Quiz types ───────────────────────────────────────────────────

import type { AbilityKind } from "../abilities/types";

export type QuestionType = "text" | "image" | "audio" | "video" | "both";

export interface Question {
  id: string;
  text: string;
  answer: string;
  value: number;
  type: QuestionType;
  mediaUrl?: string;
  isDailyDouble?: boolean;
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
  password?: string; // optional password to restrict who can edit this quiz
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
  avatar?: string; // player avatar id or image url
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
  abilityId?: string; // avatar ability this player wields (every avatar maps to one)
  abilityUnlocked?: boolean; // true once the player has 2 total correct answers
  abilityUsed?: boolean; // true once their once-per-game ability has been fired
}

// ─── Character Ability (Powerup) types ───────────────────────────────────────

export type RoomAbilityEffectStatus = "pending" | "applied";

/**
 * One active ability instance, keyed by the activating player's id.
 *
 * Lifecycle:
 *  - "pending": freshly activated (or armed & waiting). Immediate kinds
 *    (boost/tax/steal/halve) are resolved by the host and then deleted.
 *    Question-scoped kinds (clue/window/…) are stamped "applied" + tagged with
 *    the question id when a question opens.
 *  - "applied": live for the current question (question-scoped kinds). Deleted
 *    when the question resolves. Carry-forward kinds (multiplier, second
 *    chance, redirect, …) stay "pending" until the engine consumes them.
 */
export interface RoomAbilityEffect {
  id: string; // unique instance id
  playerId: string; // who activated it
  abilityId: string; // "modi", "hritik", …
  kind?: AbilityKind; // resolved at activation (mirrors the config def)
  targetId?: string; // chosen or auto-resolved recipient of the effect
  option?: string; // joker roll / risky choice / boost amount / etc.
  immediate?: boolean; // true → host applies & deletes on activation
  status: RoomAbilityEffectStatus;
  appliedToQuestionId?: string; // set when stamped onto a question
  secondChanceUsed?: boolean; // dead/srk: forgiveness already spent
  createdAt: number; // server-resolved epoch ms
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
  audioPlaying?: boolean; // master host audio state: true = playing, false = paused
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
  avatarOwners?: Record<string, string>; // avatarId → playerId, atomic avatar-uniqueness claims
  abilityEffects?: Record<string, RoomAbilityEffect>; // playerId → active ability instance
  jail?: string[]; // ids jailed for the current open question (buzz-gated)
  jailNext?: string[]; // ids being jailed by the question being judged — applied when the next question opens
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
  largeFontMode: boolean;
  animationSpeed: "slow" | "normal" | "fast";
  language: "en" | "es" | "fr" | "de";
}
