// ─── Internal buses for the ability system ────────────────────────────────────
// Lightweight pub/sub so the cinematic overlay + one-shot notices can be fired
// from anywhere (watchers, the activation flow, buzz gates) and rendered once.

export interface AbilityOverlayEvent {
  id: string; // effect instance id — clients render each exactly once
  abilityId: string;
  playerId: string;
  playerName: string;
  animation: string;
}

type OverlayListener = (e: AbilityOverlayEvent) => void;
const overlayListeners = new Set<OverlayListener>();

export const abilityOverlayBus = {
  emit(e: AbilityOverlayEvent): void {
    overlayListeners.forEach((l) => l(e));
  },
  subscribe(l: OverlayListener): () => void {
    overlayListeners.add(l);
    return () => {
      overlayListeners.delete(l);
    };
  },
};

export interface AbilityNotice {
  id: string;
  icon?: string;
  title: string;
  subtitle?: string;
  tone: "warn" | "info" | "lock" | "ace";
}

type NoticeListener = (n: AbilityNotice) => void;
const noticeListeners = new Set<NoticeListener>();

/** One-shot local toast (e.g. "LOCKED — John Cena's window is live"). */
export const abilityNoticeBus = {
  emit(n: Omit<AbilityNotice, "id">): string {
    const full: AbilityNotice = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    noticeListeners.forEach((l) => l(full));
    return full.id;
  },
  subscribe(l: NoticeListener): () => void {
    noticeListeners.add(l);
    return () => {
      noticeListeners.delete(l);
    };
  },
};