import type { AchievementId } from "./profile";

type Listener = (id: AchievementId) => void;

const listeners = new Set<Listener>();

/** Tiny event bus so any code (game loops, game-end logic) can fire an
 *  achievement-unlock notification and the toast layer picks it up. */
export const achievementBus = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  emit(id: AchievementId) {
    listeners.forEach((l) => l(id));
  },
};
