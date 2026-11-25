import { useState, useEffect, useCallback, Suspense, type ReactNode, lazy } from 'react';
import { RoomProvider, useRoom } from './context/RoomContext';
import { QuizLibraryProvider } from './context/QuizLibraryContext';
import { SettingsProvider } from './context/SettingsContext';
import { RoomLobby } from './components/RoomLobby';
import { FirebaseSetup } from './components/FirebaseSetup';
import { LoadingSplash } from './components/LoadingSplash';
import { isFirebaseConfigValid } from './firebase';
import { DelightLayer } from './delight/DelightLayer';
import { DynamicBackground } from './components/DynamicBackground';
import type { Quiz } from './types/jeopardy';

// Code-split heavy screens so the initial bundle stays small and the first
// paint is fast. Each falls back to the branded splash while it loads.
const HostRoom = lazy(() => import('./components/HostRoom').then((m) => ({ default: m.HostRoom })));
const PlayerRoom = lazy(() => import('./components/PlayerRoom').then((m) => ({ default: m.PlayerRoom })));
const QuizEditor = lazy(() => import('./components/QuizEditor').then((m) => ({ default: m.QuizEditor })));
const ProfilePage = lazy(() => import('./components/ProfilePage').then((m) => ({ default: m.ProfilePage })));

type AppView = 'lobby' | 'host' | 'player' | 'editor' | 'profile';

function AppContent() {
  const { room, isHost, leaveRoom, hydrated } = useRoom();

  // 'editor' is local-only (no room), so track it separately.
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [view, setView] = useState<AppView>('lobby');
  const [navReady, setNavReady] = useState(false);

  // ── Derive view from room state once hydrated ────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    setNavReady(true);
    if (room) {
      setView(isHost ? 'host' : 'player');
    } else if (!editingQuiz) {
      setView('lobby');
    }
  }, [hydrated, room, isHost, editingQuiz]);

  // ── Browser Back via popstate ─────────────────────────────────────────────
  const handlePopState = useCallback(() => {
    const hash = window.location.hash.replace('#', '').trim();
    if (!hash && (view === 'host' || view === 'player') && room) {
      leaveRoom();
    }
  }, [view, room, leaveRoom]);

  useEffect(() => {
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handlePopState]);

  const handleHostEntersRoom = () => {
    setView('host');
    history.pushState({ view: 'host' }, '');
  };
  const handlePlayerEntersRoom = () => {
    setView('player');
    history.pushState({ view: 'player' }, '');
  };
  const handleLeave = () => {
    setView('lobby');
    history.replaceState({ view: 'lobby' }, '', window.location.pathname);
    leaveRoom();
  };

  const handleCreateQuiz = () => {
    setEditingQuiz(null);
    setView('editor');
  };
  const handleEditQuiz = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setView('editor');
  };
  const handleCloseEditor = () => {
    setEditingQuiz(null);
    setView('lobby');
  };
  const handleOpenProfile = () => {
    setView('profile');
  };
  const handleCloseProfile = () => {
    setView('lobby');
  };

  let content: ReactNode;
  if (!navReady) {
    content = <LoadingSplash message="Restoring your session…" />;
  } else if (view === 'editor') {
    content = (
      <Suspense fallback={<LoadingSplash message="Opening editor…" />}>
        <div className="min-h-screen flex flex-col">
          <QuizEditor quizToEdit={editingQuiz} onClose={handleCloseEditor} />
        </div>
      </Suspense>
    );
  } else if (view === 'host' && room) {
    content = (
      <Suspense fallback={<LoadingSplash message="Loading host dashboard…" />}>
        <HostRoom onLeave={handleLeave} />
      </Suspense>
    );
  } else if (view === 'player' && room) {
    content = (
      <Suspense fallback={<LoadingSplash message="Joining game…" />}>
        <PlayerRoom onLeave={handleLeave} />
      </Suspense>
    );
  } else if (view === 'profile') {
    content = (
      <Suspense fallback={<LoadingSplash message="Loading profile…" />}>
        <ProfilePage onBack={handleCloseProfile} />
      </Suspense>
    );
  } else {
    content = (
      <RoomLobby
        onHostEntersRoom={handleHostEntersRoom}
        onPlayerEntersRoom={handlePlayerEntersRoom}
        onCreateQuiz={handleCreateQuiz}
        onEditQuiz={handleEditQuiz}
        onOpenProfile={handleOpenProfile}
      />
    );
  }

  return (
    <>
      <DynamicBackground />
      <div className="relative z-10 min-h-screen">
        {content}
      </div>
      <DelightLayer />
    </>
  );
}

export default function App() {
  const [configured, setConfigured] = useState(isFirebaseConfigValid);

  if (!configured) {
    return <FirebaseSetup onConfigured={() => setConfigured(true)} />;
  }

  return (
    <SettingsProvider>
      <QuizLibraryProvider>
        <RoomProvider>
          <AppContent />
        </RoomProvider>
      </QuizLibraryProvider>
    </SettingsProvider>
  );
}