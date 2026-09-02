import { useEffect, useRef } from "react";
import { momentBus, type MomentTone } from "./moments";
import { soundManager } from "../utils/sound";
import { confettiBus } from "./celebrate";
import { grantAchievement } from "../utils/profile";
import { achievementBus } from "../utils/achievementBus";

// ─── Rapid repeat (the "easy, tiger" detector) ───────────────────────────────
// Returns a stable `press(key)` you call on every tap. When the SAME key is hit
// `threshold` times within `windowMs`, the callback fires once (then cools
// down). Perfect for catching a player mashing the same on-screen tile.

export function useRapidRepeat(opts: {
  threshold?: number;
  windowMs?: number;
  cooldownMs?: number;
  onRepeat: (key: string) => void;
}): (key: string) => void {
  const { threshold = 5, windowMs = 3000, cooldownMs = 9000, onRepeat } = opts;
  const taps = useRef<Map<string, number[]>>(new Map());
  const lastFired = useRef<Map<string, number>>(new Map());
  const cb = useRef(onRepeat);
  cb.current = onRepeat;

  return useRef((key: string) => {
    const now = Date.now();
    const recent = (taps.current.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    taps.current.set(key, recent);
    const last = lastFired.current.get(key) ?? 0;
    if (recent.length >= threshold && now - last > cooldownMs) {
      lastFired.current.set(key, now);
      taps.current.set(key, []);
      cb.current(key);
    }
  }).current;
}

// ─── Consecutive-wrong encouragement ─────────────────────────────────────────
// Watches a player's own score history and reacts with worsening-but-warm
// humor as they stack up misses, and a little cheer when they finally break it.

export function useWrongStreakEncouragement(
  room: { scoreHistory?: Record<string, { id: string; teamId?: string; changeAmount: number; timestamp: number }> } | null | undefined,
  myId: string,
): void {
  const seen = useRef<Set<string> | null>(null);
  const streak = useRef(0);

  useEffect(() => {
    const entries = Object.values(room?.scoreHistory ?? {});
    if (seen.current === null) {
      seen.current = new Set(entries.map((e) => e.id));
      return;
    }
    const fresh = entries
      .filter((e) => !seen.current!.has(e.id))
      .sort((a, b) => a.timestamp - b.timestamp);
    for (const e of fresh) {
      seen.current!.add(e.id);
      if (e.teamId !== myId) continue;
      if (e.changeAmount < 0) {
        streak.current += 1;
        if (streak.current === 2) {
          soundManager.playWobble();
          momentBus.emit({
            icon: "🫠",
            title: "Rough patch",
            subtitle: "Two misses — the map is playing hard to get.",
            tone: "warm",
          });
        } else if (streak.current === 4) {
          soundManager.playWobble();
          momentBus.emit({
            icon: "🧭",
            title: "Don't panic",
            subtitle: "Four wrong? Even Magellan got lost.",
            tone: "playful",
          });
        } else if (streak.current >= 3) {
          momentBus.emit({
            icon: "🌫️",
            title: "Fog of war",
            subtitle: "You're in a slump — every slump ends.",
            tone: "ink",
          });
        }
        // Funny secret badge: a full brain freeze.
        if (streak.current >= 3 && grantAchievement("brainFreeze")) {
          soundManager.playEgg();
          achievementBus.emit("brainFreeze");
        }
      } else if (e.changeAmount > 0) {
        // Risk Taker: nailed the highest-value tile (the biggest single gain).
        if (e.changeAmount >= 400 && grantAchievement("riskTaker")) {
          soundManager.playEgg();
          achievementBus.emit("riskTaker");
        }
        if (streak.current >= 2) {
          momentBus.emit({
            icon: "✨",
            title: "Broke the streak!",
            subtitle: "The compass points true again.",
            tone: "forest",
          });
        }
        streak.current = 0;
      }
    }
  }, [room?.scoreHistory, myId]);
}

// ─── Idle nudge (the "still watching you" detector) ─────────────────────────
// While `active` stays true, fires a rotating contextual message, first after
// `firstDelayMs` and then every `intervalMs`. Fires once on activation, clears
// itself the moment `active` flips false (e.g. someone finally buzzes in).

export function useIdleNudge(opts: {
  active: boolean;
  messages: string[];
  intervalMs?: number;
  firstDelayMs?: number;
  tone?: MomentTone;
  icon?: string;
}): void {
  const { active, messages, intervalMs = 14000, firstDelayMs = 11000, tone = "ink", icon = "💭" } = opts;
  const key = `${messages.join("|")}`;
  useEffect(() => {
    if (!active || messages.length === 0) return;
    let n = 0;
    let interval = 0;
    const fire = () => {
      momentBus.emit({ icon, title: messages[n % messages.length], tone });
      n += 1;
    };
    const first = window.setTimeout(() => {
      fire();
      interval = window.setInterval(fire, intervalMs);
    }, firstDelayMs);
    return () => {
      window.clearTimeout(first);
      if (interval) window.clearInterval(interval);
    };
  }, [active, key, intervalMs, firstDelayMs, tone, icon]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ─── Close-win / photo-finish detector ───────────────────────────────────────
// Called once when results land. A one-point squeaker gets its own gasp; a
// nail-biter finish (<=5 pts) gets a "photo finish" moment.

export function emitCloseWin(
  players: { id: string; name: string; score: number }[],
  myId?: string,
): void {
  if (players.length < 2) return;
  const top = players[0];
  const second = players[1];
  if (!top || (top.score ?? 0) <= 0) return;
  const margin = (top.score ?? 0) - (second.score ?? 0);
  if (margin <= 0) return;

  const iWon = top.id === myId;
  if (margin === 100) {
    momentBus.emit({
      icon: "📸",
      title: iWon ? "Won by 100 points!" : "100 points margin!",
      subtitle: iWon ? "100 points. Perfect precision." : `${top.name} edged it by 100 points.`,
      tone: "celebrate",
    });
    soundManager.playClutch();
    confettiBus.burst({ count: 200, colors: ["#10b981", "#f59e0b", "#f43f5e", "#6366f1"], duration: 3000 });
  } else if (margin <= 5) {
    momentBus.emit({
      icon: "🏁",
      title: "Photo finish!",
      subtitle: `${top.name} took it by just ${margin}.`,
      tone: "celebrate",
    });
    soundManager.playClutch();
  }
}
