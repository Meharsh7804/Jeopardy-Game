// ─── Character Ability model ──────────────────────────────────────────────────
// Each avatar in src/assets/avatars maps to exactly one AbilityDef (via
// avatar id). The framework is data-driven: one generic `kind` + a handful of
// params describes every ability, and the engine (`engine.ts`) interprets them.

export type AbilityKind =
  | "clue" // reveal part of the live question's answer — owner sees it client-side
  | "multiplier" // owner's next correct answer is worth value × mult
  | "redirect" // owner's next correct points are awarded to targetId (stats kept)
  | "modiShare" // modi: whoever answers correctly this question gets points AND modi banks the same
  | "secondChance" // dead/srk: first wrong is forgiven, buzz kept, rebound = half
  | "halfWrong" // owner's next wrong only costs half
  | "frontOfLine" // owner's next buzz is ranked #1 regardless of reaction time
  | "windowLock" // for windowMs only the owner may buzz after a question opens
  | "silence" // targetId can't buzz for windowMs
  | "risky" // lee: choose NORMAL (×1) or RISK (×2 / −2× on wrong)
  | "rollNow" // joker: random × roll for next correct, rolled at activation
  | "trapWrong" // if targetId's next answer is wrong → −2× value on them
  | "hide" // perry: owner is hidden from other clients' leaderboards while applied
  | "answerWindow" // owner-only countdown (presentational)
  | "boostNow" // host applies instantly: owner gains points (option) 
  | "stealNow" // host applies instantly: transfer pct% of targetId's score to owner
  | "stealAuto" // host applies instantly: auto-resolve target (leader / above / lowest)
  | "halveNow" // host applies instantly: halve targetId's score
  | "taxNow" // host applies instantly: everyone else −15%, owner gains the total
  | "jailWrong"; // samay: wrong answerers on this question are jailed (can't buzz next question)

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