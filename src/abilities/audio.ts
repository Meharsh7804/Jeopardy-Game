import { soundManager } from "../utils/sound";

/**
 * Plays a character's thematic sting (`/sounds/{avatarId}.mp3`) when their
 * ability triggers. The file is resolved dynamically per avatar so the user can
 * simply drop mp3s into `public/sounds/` without touching code. Missing files
 * fail silently — Web/HTTP errors are swallowed and nothing else plays.
 */
const cache = new Map<string, HTMLAudioElement | null>();

export const abilityAudioUrl = (avatarId: string): string => {
  // "$" is a valid URL character (kr$na.mp3); encode anyway for safety.
  return `${import.meta.env.BASE_URL}sounds/${encodeURIComponent(avatarId)}.mp3`;
};

export const playAbilityAudio = (avatarId: string): void => {
  try {
    const url = abilityAudioUrl(avatarId);
    let audio = cache.get(avatarId);
    if (audio === undefined) {
      const el = new Audio(url);
      el.preload = "auto";
      audio = el;
      cache.set(avatarId, el);
    }
    if (!audio) return;
    audio.volume = soundManager.isMuted() ? 0 : Math.min(1, soundManager.getVolume());
    if (soundManager.isMuted()) return;
    audio.pause();
    audio.currentTime = 0;
    audio.play().catch(() => {
      // File missing / blocked autoplay — graceful silence.
    });
  } catch {
    // Audio API unavailable — never let this break the game.
  }
};