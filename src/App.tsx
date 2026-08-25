import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { RoomProvider, useRoom } from './context/RoomContext';
import { QuizLibraryProvider } from './context/QuizLibraryContext';
import { SettingsProvider } from './context/SettingsContext';
import { RoomLobby } from './components/RoomLobby';
import { HostRoom } from './components/HostRoom';
import { PlayerRoom } from './components/PlayerRoom';
import { QuizEditor } from './components/QuizEditor';
import { FirebaseSetup } from './components/FirebaseSetup';
import { isFirebaseConfigValid } from './firebase';
import { DelightLayer } from './delight/DelightLayer';
import type { Quiz } from './types/jeopardy';

type AppView = 'lobby' | 'host' | 'player' | 'editor';

function AppContent() {
  const { room, isHost, leaveRoom, hydrated } = useRoom();

  // 'editor' is local-only (no room), so track it separately.
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [view, setView] = useState<AppView>('lobby');
  const [navReady, setNavReady] = useState(false);

  // ── Derive view from room state once hydrated ────────────────────────────
  // On refresh, the room context auto-rejoins the persisted room. We wait for
  // hydration before choosing a view so the lobby never flashes.
  useEffect(() => {
    if (!hydrated) return;
    setNavReady(true);
    if (room) {
      setView(isHost ? 'host' : 'player');
    } else if (!editingQuiz) {
      setView('lobby');
    }
  }, [hydrated, room, isHost, editingQuiz]);

  // ── Browser Back via popstate ────────────────────────────────────────────
  // When the user presses Back after entering a room, leave cleanly.
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

  // ── Navigation helpers ───────────────────────────────────────────────────
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
    // replaceState so Back doesn't re-enter the room we just left.
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

  // ── Render ───────────────────────────────────────────────────────────────
  // Gate rendering until hydration completes to avoid a flash of the lobby.
  let content: ReactNode;
  if (!navReady) {
    content = null; // or a minimal loader
  } else if (view === 'editor') {
    content = (
      <div className="min-h-screen flex flex-col">
        <QuizEditor quizToEdit={editingQuiz} onClose={handleCloseEditor} />
      </div>
    );
  } else if (view === 'host' && room) {
    content = <HostRoom onLeave={handleLeave} />;
  } else if (view === 'player' && room) {
    content = <PlayerRoom onLeave={handleLeave} />;
  } else {
    content = (
      <RoomLobby
        onHostEntersRoom={handleHostEntersRoom}
        onPlayerEntersRoom={handlePlayerEntersRoom}
        onCreateQuiz={handleCreateQuiz}
        onEditQuiz={handleEditQuiz}
      />
    );
  }

  return (
    <>
      {content}
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
