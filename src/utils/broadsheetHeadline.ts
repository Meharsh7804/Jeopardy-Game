export interface BroadsheetHeadlineInput {
  winner?: {
    name: string;
    score: number;
    correctCount?: number;
    wrongCount?: number;
    fastestBuzz?: number | null;
  } | null;
  runnerUp?: { name: string; score: number } | null;
  players?: any[];
  fastestBuzzMs?: number;
  accuracy?: number | null;
  correctCount?: number;
  wrongCount?: number;
  roomCode?: string;
  matchCount?: number;
}

export interface BroadsheetHeadlineResult {
  kicker: string;
  headline: string;
  subdeck: string;
}

export function getDynamicBroadsheetHeadline(input: BroadsheetHeadlineInput = {}): BroadsheetHeadlineResult {
  const winner = input.winner ?? null;
  const runnerUp = input.runnerUp ?? null;
  const players = input.players ?? [];
  const name = (winner?.name || "CHAMPION").toUpperCase();
  const score = winner?.score ?? 0;
  const correctCount =
    typeof input.correctCount === "number"
      ? input.correctCount
      : winner?.correctCount ?? 0;
  const wrongCount =
    typeof input.wrongCount === "number"
      ? input.wrongCount
      : winner?.wrongCount ?? 0;
  const fastestBuzzMs =
    typeof input.fastestBuzzMs === "number"
      ? input.fastestBuzzMs
      : (winner?.fastestBuzz ?? 0) || 0;
  const accuracy =
    typeof input.accuracy === "number"
      ? input.accuracy
      : correctCount + wrongCount > 0
        ? Math.round((correctCount / (correctCount + wrongCount)) * 100)
        : 0;
  const runnerUpName = (runnerUp?.name || "THE FIELD").toUpperCase();
  const margin = winner && runnerUp ? (winner.score ?? 0) - (runnerUp.score ?? 0) : 0;

  const seed =
    (input.roomCode || "")
      .split("")
      .reduce((a, c) => a + c.charCodeAt(0), 0) + (input.matchCount || 0);

  // Priority 1 — Solo / 1-player broadcast
  if (players.length === 1) {
    const headlines = [
      `${name} CONQUERS THE SOLO STUDIO CHALLENGE!`,
      `ONE-PLAYER SHOWDOWN: ${name} CLEARS THE AIRWAVES!`,
      `SOLO MASTERCLASS: ${name} OWNS THE BROADCAST!`,
    ];
    return {
      kicker: "SOLO EDITION // SINGLE-PLAYER BROADCAST",
      headline: headlines[seed % headlines.length],
      subdeck: `Finished with ${score} PTS • ${correctCount} correct clues (${accuracy}% accuracy).`,
    };
  }

  // Priority 2 — Razor-thin photo finish
  if (margin > 0 && margin <= 100) {
    const headlines = [
      `${name} SURVIVES IN HEART-STOPPING PHOTO FINISH!`,
      `${name} STEALS THE CROWN BY JUST ${margin} POINTS!`,
      `DOWN TO THE WIRE: ${name} EDGES OUT ${runnerUpName}!`,
    ];
    return {
      kicker: "PHOTO-FINISH EDITION // DECIDED ON THE WIRE",
      headline: headlines[seed % headlines.length],
      subdeck: `A razor-thin ${margin}-point victory over ${runnerUpName} in the final seconds.`,
    };
  }

  // Priority 3 — Flawless / zero-miss run
  if (wrongCount === 0 && correctCount >= 3) {
    const headlines = [
      `UNTOUCHABLE! ${name} RUNS A FLAWLESS BOARD!`,
      `100% PERFECTION: ${name} NEVER MISSES A BEAT!`,
    ];
    return {
      kicker: "PERFECT BROADCAST // ZERO MISSES",
      headline: headlines[seed % headlines.length],
      subdeck: `Went ${correctCount}-for-${correctCount} with zero penalties to lock down ${score} PTS.`,
    };
  }

  // Priority 4 — Lightning reflexes
  if (fastestBuzzMs > 0 && fastestBuzzMs <= 1500) {
    const headlines = [
      `LIGHTNING-FAST ${name} BLITZES THE BUZZER!`,
      `TOO QUICK TO TOUCH: ${name} DOMINATES THE DRAW!`,
    ];
    return {
      kicker: "SPEED RECORD // HAIR-TRIGGER REFLEXES",
      headline: headlines[seed % headlines.length],
      subdeck: `Clocked a blistering ${(fastestBuzzMs / 1000).toFixed(2)}s buzz on the way to ${score} PTS.`,
    };
  }

  // Priority 5 — Total blowout
  if (margin >= 500) {
    const headlines = [
      `STOP THE PRESSES: ${name} DEMOLISHES THE FIELD!`,
      `${name} RUNS AWAY WITH THE SHOW IN ${margin}-PT ROUT!`,
    ];
    return {
      kicker: "LANDSLIDE VICTORY // TOTAL DOMINATION",
      headline: headlines[seed % headlines.length],
      subdeck: `Left the studio in the dust, finishing ${margin} points ahead of ${runnerUpName}.`,
    };
  }

  // Priority 6 — General prime-time pool
  const headlines = [
    `${name} SEIZES THE GOLDEN BUZZER!`,
    `PRIME-TIME TRIUMPH: ${name} RULES THE STUDIO!`,
    `${name} OUTSMARTS THE COMPETITION IN CLUTCH FINALE!`,
    `ALL HAIL ${name}: NEW STUDIO TRIVIA MONARCH!`,
    `${name} LOCKS DOWN THE BOARD & TAKES ALL!`,
    `BREAKING NEWS: ${name} STEALS THE SHOW!`,
  ];
  return {
    kicker: "FINALE EDITION! // OFFICIAL MATCH SIGN-OFF",
    headline: headlines[seed % headlines.length],
    subdeck: `Claimed #1 with ${score} PTS, ${correctCount} correct answers, and ${accuracy}% accuracy.`,
  };
}