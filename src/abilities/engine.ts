// ─── Ability engine (pure / framework) ────────────────────────────────────────
// Pure helpers the host + all clients share so buzz ranking, scoring and hint
// generation agree on the same rules. Nothing here writes to Firebase.

import type { RoomPlayer, RoomAbilityEffect } from "../types/jeopardy";
import type { CorrectResolution, WrongResolution, RankedBuzz, AbilityKind, AbilityParams } from "./types";
import { getAbilityForAvatar } from "./config";

export const isImmediateKind = (kind?: AbilityKind): boolean =>
  kind === "boostNow" ||
  kind === "stealNow" ||
  kind === "stealAuto" ||
  kind === "halveNow" ||
  kind === "taxNow" ||
  kind === "doubleNow" ||
  kind === "multiplyNow" ||
  kind === "copyLeader" ||
  kind === "grabHighest" ||
  kind === "swapNow" ||
  kind === "confiscate" ||
  kind === "subCount" ||
  kind === "prime";

/** Carry-forward kinds survive question boundaries until the engine consumes them. */
export const isQuestionScopedKind = (kind?: AbilityKind): boolean =>
  kind === "clue" ||
  kind === "clueSkeleton" ||
  kind === "clue2" ||
  kind === "clue3" ||
  kind === "clueFirstLast" ||
  kind === "clueLength" ||
  kind === "clueVague" ||
  kind === "clueCommunity" ||
  kind === "windowLock" ||
  kind === "silence" ||
  kind === "hide" ||
  kind === "answerWindow" ||
  kind === "trapWrong" ||
  kind === "jailWrong" ||
  kind === "modiShare" ||
  kind === "multiplier" ||
  kind === "chaseMult" ||
  kind === "hike" ||
  kind === "echo" ||
  kind === "refuel" ||
  kind === "draft" ||
  kind === "jinx" ||
  kind === "shield" ||
  kind === "risky" ||
  kind === "rollNow" ||
  kind === "redirect" ||
  kind === "secondChance" ||
  kind === "halfWrong" ||
  kind === "frontOfLine";

const round = (n: number) => Math.round(n);

/** Effect params always come from config — the DB effect only stores the player's choice bits. */
const paramsOf = (fx: RoomAbilityEffect): AbilityParams | undefined =>
  getAbilityForAvatar(fx.abilityId)?.params;

export const eligiblePlayers = (players: Record<string, RoomPlayer>) =>
  Object.values(players).filter((p) => !p.isHost);

const sortDesc = (players: RoomPlayer[]) =>
  [...players].sort((a, b) => b.score - a.score || (a.joinedAt ?? 0) - (b.joinedAt ?? 0));

const sortAsc = (players: RoomPlayer[]) =>
  [...players].sort((a, b) => a.score - b.score || (a.joinedAt ?? 0) - (b.joinedAt ?? 0));

/** Highest scoring non-host player. */
export const leaderOf = (players: Record<string, RoomPlayer>): RoomPlayer | undefined =>
  sortDesc(eligiblePlayers(players))[0];

/** Auto-target resolution for host-applied effects. */
export const resolveAutoTarget = (
  players: Record<string, RoomPlayer>,
  seedId: string,
  mode?: string,
): string | undefined => {
  const sorted = sortDesc(eligiblePlayers(players));
  if (mode === "leader") return sorted[0]?.id;
  if (mode === "above") {
    const idx = sorted.findIndex((p) => p.id === seedId);
    return idx > 0 ? sorted[idx - 1]?.id : sorted.find((p) => p.id !== seedId)?.id;
  }
  if (mode === "lowest") return sortAsc(eligiblePlayers(players))[0]?.id;
  return undefined;
};

/**
 * Buzz ranking. Timestamps sort normally except a "frontOfLine" player — their
 * buzz is forced to #1 no matter when they slammed the button.
 */
export const rankBuzzes = (
  buzzes: Record<string, number> | undefined,
  effects: Record<string, RoomAbilityEffect> | undefined,
): RankedBuzz[] => {
  const entries = Object.entries(buzzes || {});
  const jumbo = entries.filter(([pid]) => effects?.[pid]?.kind === "frontOfLine");
  const rest = entries.filter(([pid]) => effects?.[pid]?.kind !== "frontOfLine");
  rest.sort((a, b) => a[1] - b[1]);
  return [...jumbo, ...rest].map(([playerId, ts]) => ({
    playerId,
    ts,
    override: jumbo.some(([pid]) => pid === playerId),
  }));
};

/** Joker's roll, captured at activation: ×1.5, ×2 or ×2.5 — no negatives. */
export const jokerRoll = (): string => {
  const r = Math.random();
  if (r < 0.5) return "150";
  if (r < 0.8) return "200";
  return "250";
};

const randomLetters = (s: string, n: number): string[] => {
  const letters = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (letters.length === 0) return ["…"];
  const out = new Set<string>();
  while (out.size < Math.min(n, letters.length)) {
    out.add(letters[Math.floor(Math.random() * letters.length)]);
  }
  return [...out];
};

/** Mask a word: reveal the first (and last, when ≥4 chars) letter, hide the rest. */
export const maskedWord = (word: string): string => {
  const len = word.length;
  if (len <= 1) return word;
  if (len === 2 || len === 3) return word[0] + "•".repeat(len - 1);
  return word[0] + "•".repeat(len - 2) + word[len - 1];
};

/** Deterministic letter-skeleton for an answer: "Iron Man" → "I••n M•n". */
export const maskedAnswer = (answer: string): string =>
  answer
    .split(/([\s\-'’/&,.!?()]+)/)
    .map((chunk) =>
      /^[A-Za-z0-9]+$/.test(chunk) ? maskedWord(chunk) : chunk,
    )
    .join("");

/** Owner-only hint text for a clue effect, given the answer string. */
export const clueText = (answer: string, clueType?: string): string => {
  const a = (answer || "").trim();
  switch (clueType) {
    case "answer":
      return a;
    case "skeletonAnswer":
      return a ? maskedAnswer(a) : "…";
    case "letters3":
      return a ? `Starts with "${a.slice(0, 3)}"` : "…";
    case "letters2": {
      const ls = randomLetters(a, 2);
      return a ? `Has letters "${ls.join('", "')}" · ${a.replace(/[a-z0-9]/gi, "•")}` : "…";
    }
    case "firstLast":
      return a ? `"${a[0]}" … ends with "${a[a.length - 1]}"` : "…";
    case "length": {
      const vowels = (a.match(/[aeiou]/gi) || []).length;
      return `${a.length} characters · ${vowels} vowels`;
    }
    case "vague":
      return `${a.length} characters`;
    default:
      return a;
  }
};

/**
 * What the buzzer earns for a CORRECT answer after ability math. Pure —
 * callers write the resulting score changes + consume ids to Firebase.
 */
export const computeCorrectAward = (args: {
  ownerId: string;
  value: number;
  firstBuzzBonus: number;
  effects: Record<string, RoomAbilityEffect>;
  players: Record<string, RoomPlayer>;
}): CorrectResolution => {
  const { ownerId, value, firstBuzzBonus, effects, players } = args;
  const fx = effects[ownerId];
  const leader = leaderOf(players);
  // virat's "chase" means actively trailing the leader — once you ARE the leader
  // (or tied for first) you're no longer chasing, so the boost shouldn't trigger.
  const owned = players[ownerId];
  const chasing = !!leader &&
    !!owned &&
    leader.id !== ownerId &&
    (owned.score ?? 0) < (leader.score || 0);

  let points = value + firstBuzzBonus;
  let payeeId = ownerId;
  const consume: string[] = [];
  const notes: string[] = [];
  let reboundHalf = false;

  // PW's hike: every correct answer on this question is worth 1.5× for the
  // buzzer (the boost belongs to the crowd, not the owner).
  const hikeFx = Object.values(effects || {}).find(
    (e) => e.kind === "hike" && e.status === "applied",
  );
  // John's draft / Hamza's jinx are aimed AT the buzzer, so they resolve here.
  const draftFx = Object.values(effects || {}).find(
    (e) => e.kind === "draft" && e.targetId === ownerId && e.status === "applied",
  );
  const jinxFx = Object.values(effects || {}).find(
    (e) => e.kind === "jinx" && e.targetId === ownerId && e.status === "applied",
  );

  if (fx) {
    if (fx.kind === "multiplier" || fx.kind === "chaseMult") {
      const mult = paramsOf(fx)?.mult ?? 1;
      const chaseGate = fx.kind === "chaseMult" || fx.abilityId === "virat";
      if (!chaseGate || chasing) {
        points = round(points * mult);
        notes.push(`${mult}×` + (chaseGate && chasing ? " chase" : ""));
        consume.push(ownerId);
      } else {
        notes.push("Chase unmet");
      }
    } else if (fx.kind === "risky") {
      if (fx.option === "risk") points = round(points * 2);
      notes.push(fx.option === "risk" ? "RISK ×2" : "NORMAL ×1");
      consume.push(ownerId);
    } else if (fx.kind === "rollNow") {
      const pct = parseInt(fx.option || "150", 10);
      points = round((points * pct) / 100);
      notes.push(pct === 250 ? "×2.5" : pct === 200 ? "×2" : "×1.5");
      consume.push(ownerId);
    } else if (fx.kind === "echo") {
      points = round(points * 1.4);
      notes.push("+40% echo");
      consume.push(ownerId);
    } else if (fx.kind === "refuel") {
      points += 150;
      notes.push("+$150 refuel");
      consume.push(ownerId);
    }
    if (fx.kind === "secondChance" && fx.secondChanceUsed) {
      points = round(points / 2);
      reboundHalf = true;
      notes.push("Bounce-back half");
      consume.push(ownerId);
    }
    if (fx.kind === "redirect") {
      if (fx.targetId) {
        payeeId = fx.targetId;
        notes.push("→ redirected");
      }
      consume.push(ownerId);
    }
  }

  if (hikeFx) {
    points = round(points * 1.5);
    notes.push("×1.5 hike");
  }
  if (draftFx) {
    points = 0;
    consume.push(draftFx.playerId);
    notes.push("drafted (0)");
  } else if (jinxFx) {
    points = round(points / 2);
    consume.push(jinxFx.playerId);
    notes.push("jinxed (half)");
  }

  return {
    ownerId,
    points,
    payeeId,
    creditOwner: true,
    note: notes.join(" "),
    closeQuestion: true,
    reboundHalf,
    consume,
  };
};

/**
 * What a buzzer loses (or escapes) for a WRONG answer after ability math.
 */
export const computeWrongPenalty = (args: {
  playerId: string;
  value: number;
  effects: Record<string, RoomAbilityEffect>;
}): WrongResolution => {
  const { playerId, value, effects } = args;
  const fx = effects[playerId];
  const consume: string[] = [];
  let penalty = value;
  let forgiven = false;
  let keepBuzz = false;
  let wrongCount = true;
  let note = "";

  const trapOwner = Object.keys(effects).find(
    (pid) => effects[pid]?.kind === "trapWrong" && effects[pid]?.targetId === playerId,
  );

  if (fx) {
    if (fx.kind === "risky" && fx.option === "risk") {
      penalty = value * 2;
      note = "RISK wrong ×2";
      consume.push(playerId);
    } else if (fx.kind === "secondChance" && !fx.secondChanceUsed) {
      penalty = 0;
      forgiven = true;
      keepBuzz = true;
      wrongCount = false;
      note = "Bounce-back kept the buzz";
    } else if (fx.kind === "secondChance" && fx.secondChanceUsed) {
      // Rebound already spent on the bounce-back; a follow-up wrong ends it.
      consume.push(playerId);
    } else if (fx.kind === "halfWrong") {
      penalty = round(value / 2);
      note = "Half-loss";
      consume.push(playerId);
    } else if (fx.kind === "shield") {
      penalty = 0;
      forgiven = true;
      keepBuzz = false;
      wrongCount = false;
      note = "Shield absorbed the wrong answer";
      consume.push(playerId);
    }
  }

  // Tate's trap applies to the victim no matter what the victim has active —
  // it can't be nested under `if (fx)` or it would only fire when the target
  // happened to hold their own effect. RESERVES priority above the victim's
  // own shield/bounce-back (a trap doesn't get forgiven twice).
  if (trapOwner && !forgiven) {
    penalty = value * 2;
    note = "Trapped ×2";
    consume.push(trapOwner);
  }

  return {
    playerId,
    penalty,
    forgiven,
    keepBuzz,
    wrongCount,
    note,
    consume,
  };
};

/**
 * Gates one player's buzz write by the live lock/silence/jail effects.
 *
 * windowLock (`john`, `anime`, `raftaar`) and silence (`thomas`) are
 * time-bound: they only hold while the owner-only window is open. Once
 * `windowMs` has elapsed from when the question opened (`openedAt`), the lock
 * lifts and everyone is free to buzz again.
 */
export const buzzGate = (args: {
  meId: string;
  effects?: Record<string, RoomAbilityEffect>;
  appliedToQuestionId?: string;
  jail?: string[];
  openedAt?: number;
}): "muted" | "allowed" | "owner" => {
  const { meId, effects, appliedToQuestionId, jail, openedAt } = args;
  if (jail && jail.includes(meId)) return "muted";
  const active = Object.values(effects || {}).filter(
    (e) =>
      (e.kind === "windowLock" || e.kind === "silence") &&
      e.status === "applied" &&
      e.appliedToQuestionId === appliedToQuestionId,
  );
  for (const fx of active) {
    const windowMs = getAbilityForAvatar(fx.abilityId)?.params?.windowMs;
    // The owner-only window has lapsed — release the lock for everyone.
    if (openedAt && windowMs && Date.now() - openedAt >= windowMs) continue;
    if (fx.kind === "silence" && fx.targetId === meId) return "muted";
    if (fx.kind === "windowLock") {
      if (fx.playerId === meId) return "owner";
      return "muted";
    }
  }
  return "allowed";
};

/** Instant point award for boostNow effects (host applies). Includes the
 *  special-cased flat amounts (ryder's prime = +250) so the helper never
 *  disagrees with what the host applies at runtime. */
export const boostAmount = (
  fx: RoomAbilityEffect,
  players: Record<string, RoomPlayer>,
): number => {
  const def = getAbilityForAvatar(fx.abilityId);
  if (def?.kind === "prime") return 250;
  const player = players[fx.playerId];
  const base = player?.score ?? 0;
  if (def?.params?.boost === "flat") return def.params.boostValue ?? 150;
  return Math.max(def?.params?.boostMin ?? 50, round(base * (def?.params?.boostPct ?? 0.15)));
};

/** Steal transfer for host-applied steal effects: returns {from, to, amount}. */
export const stealTransfer = (
  fx: RoomAbilityEffect,
  players: Record<string, RoomPlayer>,
): { from: string; to: string; amount: number } | null => {
  const from = fx.targetId;
  if (!from || !players[from]) return null;
  const def = getAbilityForAvatar(fx.abilityId);
  const pct = def?.params?.pct ?? 0.3;
  return { from, to: fx.playerId, amount: round((players[from]?.score ?? 0) * pct) };
};

/** Rate everyone else, hand the whole pot to the tax collector (host applies). */
export const taxPayout = (
  fx: RoomAbilityEffect,
  players: Record<string, RoomPlayer>,
): { from: Record<string, number>; total: number } => {
  const pct = getAbilityForAvatar(fx.abilityId)?.params?.pct ?? 0.15;
  const from: Record<string, number> = {};
  let total = 0;
  for (const p of Object.values(players)) {
    if (p.id === fx.playerId || p.isHost) continue;
    const amt = round(p.score * pct);
    if (amt > 0) {
      from[p.id] = amt;
      total += amt;
    }
  }
  return { from, total };
};

/** Prabhas' confiscation: everyone else loses a flat % — owner gains nothing. */
export const confiscatePayout = (
  fx: RoomAbilityEffect,
  players: Record<string, RoomPlayer>,
): Record<string, number> => {
  const pct = getAbilityForAvatar(fx.abilityId)?.params?.pct ?? 0.1;
  const from: Record<string, number> = {};
  for (const p of Object.values(players)) {
    if (p.id === fx.playerId || p.isHost) continue;
    const amt = round(p.score * pct);
    if (amt > 0) from[p.id] = amt;
  }
  return from;
};

/** Highest current scorer (the natural grabHighest target). Optionally skips
 *  a given id so a leader can't steal from themselves. */
export const highestOf = (
  players: Record<string, RoomPlayer>,
  excludeId?: string,
): RoomPlayer | undefined =>
  sortDesc(eligiblePlayers(players)).filter((p) => p.id !== excludeId)[0];

/**
 * Shared accumulator for an active clue: the effect instance id that applies.
 * Any of the "reveal a hint" kinds count, so the client renders the hint for
 * the effect's owner (or for everyone, in the kr$na community case).
 */
const CLUE_KINDS: ReadonlySet<string> = new Set([
  "clue", "clueSkeleton", "clue2", "clue3", "clueFirstLast",
  "clueLength", "clueVague", "clueCommunity",
]);

export const activeClueFor = (
  effects: Record<string, RoomAbilityEffect> | undefined,
  meId: string,
  questionId?: string,
): RoomAbilityEffect | undefined =>
  Object.values(effects || {}).find(
    (e) =>
      e.playerId === meId &&
      e.kind !== undefined &&
      CLUE_KINDS.has(e.kind) &&
      e.status === "applied" &&
      e.appliedToQuestionId === questionId,
  );

/** kr$na's community clue: revealed to EVERYONE on this question, if any. */
export const activeCommunityClueFor = (
  effects: Record<string, RoomAbilityEffect> | undefined,
  questionId?: string,
): RoomAbilityEffect | undefined =>
  Object.values(effects || {}).find(
    (e) =>
      e.kind === "clueCommunity" &&
      e.status === "applied" &&
      e.appliedToQuestionId === questionId,
  );

/** Window-lock owner for the current question, if any. */
export const activeWindowOwner = (
  effects: Record<string, RoomAbilityEffect> | undefined,
  questionId?: string,
): string | undefined =>
  Object.values(effects || {}).find(
    (e) =>
      e.kind === "windowLock" &&
      e.status === "applied" &&
      e.appliedToQuestionId === questionId,
  )?.playerId;

/** Active Modi Share effect on the given question, if any. */
export const activeModiShareFor = (
  effects: Record<string, RoomAbilityEffect> | undefined,
  questionId?: string,
): RoomAbilityEffect | undefined =>
  Object.values(effects || {}).find(
    (e) =>
      e.kind === "modiShare" &&
      e.status === "applied" &&
      e.appliedToQuestionId === questionId,
  );

/** Whether `playerId` is currently hidden from other players (perry). */
export const isHidden = (
  playerId: string,
  effects: Record<string, RoomAbilityEffect> | undefined,
): boolean =>
  Object.values(effects || {}).some(
    (e) => e.kind === "hide" && e.playerId === playerId && e.status === "applied",
  );