import React, { useEffect, useState } from "react";
import { ConfettiBurst } from "../components/ConfettiBurst";
import { soundManager } from "../utils/sound";
import { momentBus, type MomentTone } from "./moments";
import { recordComeback, recordStreak } from "./memories";

// ─── Global confetti bus ─────────────────────────────────────────────────────

interface BurstOpts {
  count?: number;
  colors?: string[];
  duration?: number;
  origin?: { x: number; y: number };
}

const confettiListeners = new Set<(o: BurstOpts) => void>();

export const confettiBus = {
  burst(o: BurstOpts = {}): void {
    confettiListeners.forEach((l) => l(o));
  },
  subscribe(l: (o: BurstOpts) => void): () => void {
    confettiListeners.add(l);
    return () => {
      confettiListeners.delete(l);
    };
  },
};

/** A confetti source mounted once for the whole app, fired via confettiBus. */
export const GlobalConfetti: React.FC = () => {
  const [bursts, setBursts] = useState<{ id: string; opts: BurstOpts }[]>([]);

  useEffect(() => {
    const unsub = confettiBus.subscribe((opts) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setBursts((prev) => [...prev, { id, opts }]);
      window.setTimeout(
        () => setBursts((prev) => prev.filter((b) => b.id !== id)),
        (opts.duration ?? 3000) + 250,
      );
    });
    return unsub;
  }, []);

  return (
    <>
      {bursts.map((b) => (
        <ConfettiBurst
          key={b.id}
          count={b.opts.count ?? 180}
          colors={b.opts.colors}
          duration={b.opts.duration ?? 3000}
          origin={b.opts.origin}
        />
      ))}
    </>
  );
};

const THEME_COLORS = ["#10b981", "#f59e0b", "#6366f1", "#f43f5e", "#5eead4", "#fbbf24"];

// ─── Celebration detection ───────────────────────────────────────────────────

const STREAK_MILESTONES = [3, 5, 7, 10];
const streakSeen = new Set<string>();
const fourDigitsSeen = new Set<string>();

export interface CelebrateInput {
  before: Record<string, number>;
  after: Record<string, number>;
  beforeStreaks?: Record<string, number>;
  afterStreaks?: Record<string, number>;
  changedId?: string;
  isCorrect?: boolean;
  tileValue?: number;
  myId: string;
}

const emit = (icon: React.ReactNode, title: string, subtitle: string | undefined, tone: MomentTone) => {
  momentBus.emit({ icon, title, subtitle, tone });
};

/**
 * Compares a leaderboard before/after a scoring event and emits satisfying
 * moments (new leader, comeback, big haul, hot streak) + sound + confetti.
 * Pure: call it with the scores you already have — no Firebase reads.
 */
export const celebrateScoreChange = (input: CelebrateInput): void => {
  const { before, after, beforeStreaks, afterStreaks, changedId, isCorrect, tileValue } = input;

  const ids = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const rankOf = (scores: Record<string, number>) =>
    ids
      .filter((id) => scores[id] != null)
      .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));

  const beforeRank = rankOf(before);
  const afterRank = rankOf(after);
  const beforeLeader = beforeRank[0];
  const afterLeader = afterRank[0];
  const afterLeaderScore = after[afterLeader] ?? 0;

  // 1) Leader changed hands.
  if (
    beforeLeader &&
    afterLeader &&
    beforeLeader !== afterLeader &&
    afterLeaderScore > 0
  ) {
    const prevRankOfNewLeader = beforeRank.indexOf(afterLeader);
    const wasTrailing = prevRankOfNewLeader >= Math.max(1, beforeRank.length - 2);
    // How far the new leader was behind *in points* before this swing.
    const beforeGap = (before[beforeLeader] ?? 0) - (before[afterLeader] ?? 0);
    const epic = beforeGap >= 500;
    if (epic) {
      recordComeback(beforeGap);
      emit("🌟", "EPIC Comeback!", `Climbed back from ${beforeGap} down to take the lead.`, "celebrate");
      soundManager.playComeback();
      confettiBus.burst({ count: 240, colors: THEME_COLORS, duration: 3000 });
    } else if (wasTrailing) {
      recordComeback(Math.max(beforeGap, 0));
      emit("🔙", "Comeback!", "Snatched the lead from the depths.", "warm");
      soundManager.playComeback();
      confettiBus.burst({ count: 160, colors: THEME_COLORS, duration: 2600 });
    } else {
      emit("👑", "New Leader!", "The map redraws around them.", "celebrate");
      soundManager.playClutch();
      confettiBus.burst({ count: 120, colors: THEME_COLORS });
    }
  }

  // 2) A hefty single haul (the deep-end tiles) — only for the current player.
  if (changedId != null && changedId === input.myId && isCorrect && tileValue && tileValue >= 400) {
    emit("💎", "Big Haul!", `+${tileValue} from the uncharted deep.`, "playful");
  }

  // 3) Hot-streak milestones — only fire for the current player's own streak.
  if (beforeStreaks && afterStreaks) {
    const now = afterStreaks[input.myId] ?? 0;
    for (const m of STREAK_MILESTONES) {
      const key = `${input.myId}-${m}`;
      if (now >= m && (beforeStreaks[input.myId] ?? 0) < m && !streakSeen.has(key)) {
        streakSeen.add(key);
        recordStreak(m);
        emit(
          "🔥",
          m >= 7 ? "Unstoppable!" : "On Fire!",
          `You're ${m}-streak strong.`,
          "forest",
        );
        soundManager.playStreak();
        if (m >= 5) confettiBus.burst({ count: 90, colors: ["#10b981", "#fbbf24"] });
      }
    }
  }
};

/**
 * Convenience hook: watches a room's players and celebrates score / streak
 * transitions on the local device. Safe to mount once per screen.
 */
export const useScoreCelebrations = (
  players: Record<string, { id: string; score?: number; streak?: number; isHost?: boolean }> | undefined,
  myId: string,
): void => {
  const prev = React.useRef<{
    scores: Record<string, number>;
    streaks: Record<string, number>;
  }>({ scores: {}, streaks: {} });

  useEffect(() => {
    if (!players) return;
    const nonHost = Object.values(players).filter((p) => !p.isHost);
    const scores: Record<string, number> = {};
    const streaks: Record<string, number> = {};
    nonHost.forEach((p) => {
      scores[p.id] = p.score ?? 0;
      streaks[p.id] = p.streak ?? 0;
    });

    const before = prev.current.scores;
    const beforeStreaks = prev.current.streaks;
    const changed =
      Object.keys(scores).find((id) => scores[id] !== (before[id] ?? 0)) ?? undefined;

    // Only celebrate when something actually moved.
    const moved = Object.keys(scores).some((id) => scores[id] !== (before[id] ?? 0));
    if (moved) {
      celebrateScoreChange({
        before,
        after: scores,
        beforeStreaks,
        afterStreaks: streaks,
        changedId: changed,
        myId,
      });
    }

    // "Four Digits": landing on exactly 1000 (a perfectly round milestone)
    // is a tiny, delightful coincidence worth calling out — only for the current player.
    for (const id of Object.keys(scores)) {
      if (id !== myId) continue;
      const now = scores[id];
      const was = before[id] ?? 0;
      if (now !== was && now === 1000 && was !== 1000 && !fourDigitsSeen.has(id)) {
        fourDigitsSeen.add(id);
        soundManager.playClutch();
        momentBus.emit({
          icon: "🔟",
          title: "Four Digits!",
          subtitle: "You landed exactly on 1000. Suspiciously clean.",
          tone: "celebrate",
        });
      }
    }

    prev.current = { scores, streaks };
  }, [players, myId]);
};
