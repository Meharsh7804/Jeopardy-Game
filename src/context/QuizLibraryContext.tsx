/**
 * QuizLibraryContext — manages saved quiz packs in localStorage.
 * Used by the host to create / edit / delete quizzes and pick one to play.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
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

interface QuizLibraryContextProps {
  quizzes: Quiz[];
  settings: GameSettings;
  saveQuiz: (quiz: Quiz) => void;
  deleteQuiz: (id: string) => void;
  updateSettings: (partial: Partial<GameSettings>) => void;
}

const QuizLibraryContext = createContext<QuizLibraryContextProps | undefined>(undefined);

export const QuizLibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>(() => {
    try {
      const saved = localStorage.getItem(QUIZZES_KEY);
      if (saved) {
        const parsed: Quiz[] = JSON.parse(saved);
        if (parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    localStorage.setItem(QUIZZES_KEY, JSON.stringify([DEFAULT_QUIZ]));
    return [DEFAULT_QUIZ];
  });

  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return DEFAULT_SETTINGS;
  });

  const saveQuiz = useCallback((quiz: Quiz) => {
    setQuizzes((prev) => {
      const idx = prev.findIndex((q) => q.id === quiz.id);
      const next = idx > -1
        ? prev.map((q, i) => (i === idx ? quiz : q))
        : [quiz, ...prev];
      try {
    localStorage.setItem(QUIZZES_KEY, JSON.stringify(next));
    } catch (error) {
    console.error("Failed to save quiz:", error);
    alert(
        "Quiz is too large to save. Uploaded images are exceeding browser storage."
      );
    }
      return next;
    });
  }, []);

  const deleteQuiz = useCallback((id: string) => {
    setQuizzes((prev) => {
      const next = prev.filter((q) => q.id !== id);
      try {
    localStorage.setItem(QUIZZES_KEY, JSON.stringify(next));
    } catch (error) {
    console.error(error);
    }
      return next;
    });
  }, []);

  const updateSettings = useCallback((partial: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <QuizLibraryContext.Provider value={{ quizzes, settings, saveQuiz, deleteQuiz, updateSettings }}>
      {children}
    </QuizLibraryContext.Provider>
  );
};

export const useQuizLibrary = () => {
  const ctx = useContext(QuizLibraryContext);
  if (!ctx) throw new Error('useQuizLibrary must be inside <QuizLibraryProvider>');
  return ctx;
};
