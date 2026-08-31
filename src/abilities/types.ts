// ─── Character Ability model ──────────────────────────────────────────────────
// Each avatar in src/assets/avatars maps to exactly one AbilityDef (via
// avatar id). The framework is data-driven: one generic `kind` + a handful of
// params describes every ability, and the engine (`engine.ts`) interprets them.

export type AbilityKind =
  // ── Owner-only hints (each reveals a distinct slice of the answer) ─────────
  | "clue" // generic: reveal part of the live question's answer via params.clueType
  | "clueSkeleton" // first/last letter of every word
  | "clue2" // two random letters + total length
  | "clue3" // first three letters
  | "clueFirstLast" // first + last letter
  | "clueLength" // length + vowel count
  | "clueVague" // length only
  | "clueCommunity" // kr$na: letter skeleton revealed to EVERYONE on the question
  // ── Scoring carried into the next correct answer ───────────────────────────
  | "multiplier" // owner's next correct is worth × mult
  | "chaseMult" // virat: ×1.5 on next correct only while trailing the leader
  | "hike" // pw: next question, EVERY correct answer is worth ×1.5
  | "echo" // raftaar: owner's next correct earns +40% of the value on top
  | "refuel" // luffy: owner's next correct earns +$150 flat on top
  | "draft" // john: target earnings 0 on the next question
  | "jinx" // hamza: target's next correct is worth half
  | "redirect" // (reserved) owner's next correct points go to targetId (stats kept)
  | "modiShare" // modi: whoever answers correctly gets points AND modi banks the same
  // ── Wrong-answer defenses / punishments ────────────────────────────────────
  | "secondChance" // dead: first wrong forgiven, buzz kept, rebound = half
  | "shield" // srk: next wrong ignored (no penalty) but the buzz turn is lost
  | "halfWrong" // honey: owner's next wrong only costs half
  | "trapWrong" // tate: if targetId's next answer is wrong → −2× value on them
  | "jailWrong" // samay: wrong answerers on this question are jailed next question
  // ── Buzz control ───────────────────────────────────────────────────────────
  | "frontOfLine" // billy: owner's next buzz is ranked #1
  | "windowLock" // for windowMs only the owner may buzz
  | "silence" // thomas: targetId can't buzz for windowMs
  | "risky" // lee: choose NORMAL (×1) or RISK (×2 / −2× on wrong)
  | "rollNow" // joker: random × roll for next correct, rolled at activation
  // ── Instant score plays (host resolves on activation) ──────────────────────
  | "stealNow" // kratos: transfer pct% of targetId's score to owner
  | "halveNow" // thanos: halve targetId's score
  | "taxNow" // selmon: everyone else −15%, owner gains the total
  | "doubleNow" // hritik: double the owner's own score
  | "multiplyNow" // msd: multiply the owner's own score by params.mult (×7)
  | "copyLeader" // walter: owner's score becomes the leader's score
  | "grabHighest" // homelander: steal 90% from the highest scorer
  | "swapNow" // anime: swap the owner's score with a chosen player's
  | "confiscate" // prabhas: everyone else loses 10% (owner gains nothing)
  | "subCount" // techno: +50 × questions already completed
  | "prime" // ryder: +$250 flat
  | "boostNow" // (reserved) flat/percent self boost
  | "stealAuto" // (reserved) auto-target steal
  | "hide" // perry: owner hidden from other clients' leaderboards while applied
  | "answerWindow"; // owner-only countdown (presentational)

/** Absolute- or percentage-based hint ladder for clue kinds. */
export type ClueType =
  | "answer" // full answer revealed
  | "skeletonAnswer" // word skeleton: first + last letter of each word revealed
  | "letters3" // first 3 letters
  | "letters2" // 2 random letters + length
  | "firstLast" // first + last letter
  | "length" // length + vowel count
  | "vague"; // answer length only

/** Overlay animation language each ability runs in. */
export type AbilityAnimationName =
  | "spotlight"
  | "shake"
  | "impact"
  | "flash"
  | "burst"
  | "zoom"
  | "freeze"
  | "glitch"
  | "chaos";

export type AutoTargetMode = "leader" | "above" | "lowest";

export interface AbilityParams {
  clueType?: ClueType;
  mult?: number;
  onlyIfChasing?: boolean; // multiplier only counts while owner trails the leader
  windowMs?: number;
  pct?: number; // stealNow / taxNow percentage (0..1)
  boost?: "flat" | "pctScore"; // boostNow flavor
  boostValue?: number; // flat amount
  boostPct?: number; // fraction of current score
  boostMin?: number; // floor for pctScore boosts
  targetMode?: AutoTargetMode;
  roll?: boolean; // joker: capture a random outcome at activation
  risky?: boolean; // lee: deferred choice during buzzing
  confirm?: boolean; // needs a confirm sheet before activating
}

export interface AbilityDef {
  id: string; // == avatar id
  avatarId: string; // which avatar wields it (=== id today)
  name: string; // character display name
  abilityName: string; // e.g. "Modi-fied Points"
  tagline: string; // one-line description shown in UI
  longDesc: string; // full effect text shown in the confirm sheet
  kind: AbilityKind;
  params?: AbilityParams;
  animation: AbilityAnimationName;
  needsTarget?: boolean; // requires picking a target player
  autoTarget?: boolean; // target resolved automatically (stealAuto / solos)
  needsChoice?: boolean; // operator drops options in at activation or during buzzing
  immediate?: boolean; // host resolves on activation (boost/steal/tax/halve)
  emoji: string; // compact icon for pills & chips
  accent: "primary" | "secondary" | "warning" | "danger" | "success" | "ink";
}

/** What the buzzer is owed for answering correctly / wrong, after abilities. */
export interface CorrectResolution {
  ownerId: string;
  points: number; // to whom the points go (redirect), & value
  payeeId: string; // who logs the +points (may differ from owner under redirect)
  creditOwner: boolean; // owner still gains correct stats & streak
  note: string;
  closeQuestion: boolean;
  reboundHalf: boolean; // second-chance rebound correct → half points
  consume: string[]; // effect instance ids to delete
}

export interface WrongResolution {
  playerId: string;
  penalty: number; // negative number already applied magnitude
  forgiven: boolean; // second chance ate the penalty entirely
  keepBuzz: boolean; // keep the player in the queue (second chance)
  wrongCount: boolean; // does this count in wrongCount
  note?: string; // human-readable why (RISK ×2, trapped, half-loss…)
  consume: string[];
}

export interface RankedBuzz {
  playerId: string;
  ts: number;
  override: boolean; // frontOfLine jump — shown with a "!"
}