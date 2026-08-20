import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { Lang } from "../i18n";
import { translate } from "../i18n";
import { soundManager, type SoundTheme } from "../utils/sound";

export type AnimationSpeed = "slow" | "normal" | "fast";

export interface Settings {
  soundVolume: number; // 0..1
  isSoundMuted: boolean;
  soundTheme: SoundTheme;
  largeFontMode: boolean;
  animationSpeed: AnimationSpeed;
  language: Lang;
}

export const DEFAULT_SETTINGS: Settings = {
  soundVolume: 0.5,
  isSoundMuted: false,
  soundTheme: "classic",
  largeFontMode: false,
  animationSpeed: "normal",
  language: "en",
};

const STORAGE_KEY = "jeopardy_settings";

/** Duration multiplier applied by CSS-driven animations (confetti, reactions…). */
export const ANIM_MULT: Record<AnimationSpeed, number> = {
  slow: 1.6,
  normal: 1,
  fast: 0.6,
};

const loadSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  // Push sound settings into the shared SoundManager (which lazily inits the
  // AudioContext on first user interaction).
  useEffect(() => {
    soundManager.updateSettings(settings.soundVolume, settings.isSoundMuted, settings.soundTheme);
  }, [settings.soundVolume, settings.isSoundMuted, settings.soundTheme]);

  // Large-font mode scales all rem-based sizing; data-anim drives CSS
  // animation-duration overrides (see index.css).
  useEffect(() => {
    document.documentElement.classList.toggle("font-large", settings.largeFontMode);
    document.documentElement.setAttribute("data-anim", settings.animationSpeed);
  }, [settings.largeFontMode, settings.animationSpeed]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable (private mode) — settings still work in-memory
      }
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(settings.language, key, params),
    [settings.language],
  );

  return (
    <SettingsContext.Provider value={{ settings, update, t }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
};