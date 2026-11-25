export type ToastLevel = "info" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  level: ToastLevel;
  title: string;
  message?: string;
  duration?: number;
}

type Listener = (t: Toast) => void;
const listeners = new Set<Listener>();

export const toastBus = {
  emit(input: Omit<Toast, "id">): string {
    const full: Toast = {
      ...input,
      id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      duration: input.duration ?? 4500,
    };
    listeners.forEach((l) => l(full));
    return full.id;
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export const toast = {
  info: (title: string, message?: string) => toastBus.emit({ level: "info", title, message }),
  success: (title: string, message?: string) => toastBus.emit({ level: "success", title, message }),
  warning: (title: string, message?: string) => toastBus.emit({ level: "warning", title, message }),
  error: (title: string, message?: string) => toastBus.emit({ level: "error", title, message }),
};