import { useEffect } from "react";
import { momentBus } from "./moments";
import { soundManager } from "../utils/sound";

// ─── Global secret listener ──────────────────────────────────────────────────
// Watches the whole document for *curious* input: typing certain words, or the
// classic konami code. Intentionally ignores typing inside form fields, so it
// only triggers when you play with the page itself — never while filling in
// your name or a room code. Each secret is harmless: a witty moment, a sound,
// or a brief cosmetic flourish. None affect gameplay.

const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a",
];

const WORDS: { match: string; fire: () => void }[] = [
  {
    // The whole product is built around buzzing — say the word.
    match: "buzz",
    fire: () => {
      soundManager.playBuzzer();
      momentBus.emit({
        icon: "🔔",
        title: "You rang?",
        subtitle: "The buzzer hears you. Always.",
        tone: "playful",
      });
    },
  },
  {
    match: "jeopardy",
    fire: () => {
      soundManager.playDiscover();
      momentBus.emit({
        icon: "🗺️",
        title: "A map unfolds",
        subtitle: "You whispered the old word. The board glows a little.",
        tone: "ink",
      });
      flashParty(900);
    },
  },
  {
    match: "hello",
    fire: () => {
      soundManager.playPop();
      momentBus.emit({
        icon: "👋",
        title: "Hello, traveler",
        subtitle: "The game waves back. You're not alone here.",
        tone: "warm",
      });
    },
  },
];

let partyTimer: number | undefined;

/** Briefly toggles a subtle cosmetic "the page is alive" flourish. */
export const flashParty = (ms = 1200): void => {
  if (typeof document === "undefined") return;
  document.body.classList.add("secret-party");
  if (partyTimer) window.clearTimeout(partyTimer);
  partyTimer = window.setTimeout(() => {
    document.body.classList.remove("secret-party");
  }, ms);
};

const isTypingTarget = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
};

/** Mount once (in DelightLayer). Silently watches for secret input patterns. */
export const useGlobalSecrets = (): void => {
  useEffect(() => {
    let typed = "";
    let konamiIdx = 0;

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      // Konami
      const expected = KONAMI[konamiIdx];
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === expected) {
        konamiIdx += 1;
        if (konamiIdx === KONAMI.length) {
          konamiIdx = 0;
          soundManager.playEgg();
          momentBus.emit({
            icon: "🌈",
            title: "CHEAT CODE ACCEPTED",
            subtitle: "30 lives granted. (Emotionally. The score is safe.)",
            tone: "celebrate",
          });
          flashParty(2200);
        }
      } else {
        konamiIdx = key === KONAMI[0] ? 1 : 0;
      }

      // Typed words (only printable single chars)
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        typed = (typed + e.key.toLowerCase()).slice(-12);
        for (const w of WORDS) {
          if (typed.endsWith(w.match)) {
            w.fire();
            typed = "";
            break;
          }
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
};

// ─── Per-element secret helpers ──────────────────────────────────────────────

/**
 * Calls `cb` after the pointer has rested on the element for `ms` without
 * leaving. Great for "long hover reveals a secret" interactions.
 */
export const useLongHover = (
  ref: React.RefObject<HTMLElement | null>,
  ms: number,
  cb: () => void,
): void => {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let t: number | undefined;
    const enter = () => {
      t = window.setTimeout(cb, ms);
    };
    const leave = () => {
      if (t) window.clearTimeout(t);
    };
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    return () => {
      el.removeEventListener("mouseenter", enter);
      el.removeEventListener("mouseleave", leave);
      leave();
    };
  }, [ref, ms, cb]);
};
