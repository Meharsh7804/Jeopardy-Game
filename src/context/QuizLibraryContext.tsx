/**
 * QuizLibraryContext — manages saved quiz packs.
 *
 * Quizzes are synced to Firebase Realtime Database under `quizLibrary/{id}`
 * so anyone in the office pointed at the same Firebase project can see and
 * host from the same shared pool of quizzes — not just whoever built it on
 * their own machine. localStorage is kept as a fast-loading offline cache
 * (so the app still shows something instantly / while offline) but Firebase
 * is the source of truth once it's reachable.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, set, remove } from 'firebase/database';
import { db, isFirebaseConfigValid } from '../firebase';
import type { Quiz, GameSettings } from '../types/jeopardy';
import { DEFAULT_QUIZ } from '../utils/defaultQuiz';

const QUIZZES_KEY = 'jeopardy_quizzes';
const SETTINGS_KEY = 'jeopardy_settings';

const DEFAULT_SETTINGS: GameSettings = {
  soundVolume: 0.5,
  isSoundMuted: false,
  defaultTimer: 15,
  largeFontMode: false,
  animationSpeed: 'normal',
  language: 'en',
};

/** Recursively strip `undefined` values so Firebase doesn't silently reject writes. */
const sanitize = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (typeof obj === 'object') {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) clean[k] = sanitize(v);
    }
    return clean;
  }
  return obj;
};

const loadLocalQuizzes = (): Quiz[] => {
  try {
    const saved = localStorage.getItem(QUIZZES_KEY);
    if (saved) {
      const parsed: Quiz[] = JSON.parse(saved);
      if (parsed.length > 0) return stripBlobMedia(parsed);
    }
  } catch { /* ignore */ }
  return [DEFAULT_QUIZ];
};

const persistLocalCache = (quizzes: Quiz[]) => {
  try {
    localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes));
  } catch { /* ignore quota errors — cache is best-effort */ }
};

interface QuizLibraryContextProps {
  quizzes: Quiz[];
  settings: GameSettings;
  /** true once we're synced with the shared Firebase library (vs. showing local cache only) */
  isSynced: boolean;
  saveQuiz: (quiz: Quiz) => Promise<void>;
  deleteQuiz: (id: string) => void;
  updateSettings: (partial: Partial<GameSettings>) => void;
  /** Produces a JSON string of a single quiz, for exporting/sharing outside Firebase (e.g. across projects). */
  exportQuiz: (id: string) => string | null;
  /** Imports a quiz from an exported JSON string, saving it into the (shared) library under a fresh id. */
  importQuiz: (json: string) => Quiz;
}

/**
 * Recursively strips `blob:` media URLs — an old upload method stored
 * session-only object URLs that can never load on another device. Once
 * cleared, the host can re-upload those images as base64 data URLs.
 */
const stripBlobMedia = (value: any): any => {
  if (Array.isArray(value)) return value.map(stripBlobMedia);
  if (value && typeof value === "object") {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "mediaUrl" && typeof v === "string" && v.startsWith("blob:")) continue;
      clean[k] = stripBlobMedia(v);
    }
    return clean;
  }
  return value;
};

const QuizLibraryContext = createContext<QuizLibraryContextProps | undefined>(undefined);

export const QuizLibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>(() => loadLocalQuizzes());
  const [isSynced, setIsSynced] = useState(false);
  // Tracks whether we've received at least one snapshot from Firebase, so we
  // know whether to seed it with the default quiz or trust an empty result.
  const seededRef = useRef(false);

  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return DEFAULT_SETTINGS;
  });

  // ── Subscribe to the shared quiz library in Firebase ──────────────────────
  useEffect(() => {
    if (!isFirebaseConfigValid()) return; // stay on localStorage-only mode

    const libRef = ref(db, 'quizLibrary');
    const unsub = onValue(
      libRef,
      (snap) => {
        if (snap.exists()) {
          const val = snap.val() as Record<string, Quiz>;
          const list: Quiz[] = Object.values(stripBlobMedia(val) as Record<string, Quiz>).sort((a, b) => b.createdAt - a.createdAt);
          setQuizzes(list);
          persistLocalCache(list);
        } else if (!seededRef.current) {
          // Nobody in the office has created a quiz yet — seed the shared
          // library with the default quiz so there's something to host.
          set(ref(db, `quizLibrary/${DEFAULT_QUIZ.id}`), sanitize(DEFAULT_QUIZ)).catch(() => {});
          setQuizzes([DEFAULT_QUIZ]);
        } else {
          setQuizzes([]);
        }
        seededRef.current = true;
        setIsSynced(true);
      },
      () => {
        // Firebase unreachable — fall back to whatever's cached locally.
        setIsSynced(false);
      },
    );

    return () => unsub();
  }, []);

  const saveQuiz = useCallback((quiz: Quiz): Promise<void> => {
    // Optimistic local update so the editor feels instant even before the
    // Firebase round-trip / listener callback comes back.
    setQuizzes((prev) => {
      const idx = prev.findIndex((q) => q.id === quiz.id);
      const next = idx > -1 ? prev.map((q, i) => (i === idx ? quiz : q)) : [quiz, ...prev];
      persistLocalCache(next);
      return next;
    });

    if (!isFirebaseConfigValid()) return Promise.resolve();

    // Reject on failure so callers can surface why a save didn't stick
    // (e.g. a data URL too large for the database) instead of failing silently.
    return set(ref(db, `quizLibrary/${quiz.id}`), sanitize(quiz)).catch((err) => {
      console.error("Failed to save quiz to Firebase:", err);
      throw err;
    });
  }, []);

  const deleteQuiz = useCallback((id: string) => {
    setQuizzes((prev) => {
      const next = prev.filter((q) => q.id !== id);
      persistLocalCache(next);
      return next;
    });

    if (isFirebaseConfigValid()) {
      remove(ref(db, `quizLibrary/${id}`)).catch(() => {});
    }
  }, []);

  const updateSettings = useCallback((partial: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Export / import for sharing a quiz outside the Firebase project ───────
  // (e.g. handing a quiz to someone on a different Firebase project/config,
  // or making a portable backup).
  const exportQuiz = useCallback((id: string): string | null => {
    const quiz = quizzes.find((q) => q.id === id);
    if (!quiz) return null;
    return JSON.stringify(quiz, null, 2);
  }, [quizzes]);

  const importQuiz = useCallback((json: string): Quiz => {
    const parsed = JSON.parse(json) as Quiz;
    // Always assign a fresh id on import so it can never silently clobber an
    // existing quiz with the same id (e.g. re-importing your own export).
    const imported: Quiz = {
      ...parsed,
      id: `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    saveQuiz(imported).catch(() => {});
    return imported;
  }, [saveQuiz]);

  return (
    <QuizLibraryContext.Provider
      value={{ quizzes, settings, isSynced, saveQuiz, deleteQuiz, updateSettings, exportQuiz, importQuiz }}
    >
      {children}
    </QuizLibraryContext.Provider>
  );
};

export const useQuizLibrary = () => {
  const ctx = useContext(QuizLibraryContext);
  if (!ctx) throw new Error('useQuizLibrary must be inside <QuizLibraryProvider>');
  return ctx;
};
