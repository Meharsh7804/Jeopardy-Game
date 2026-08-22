import { useState, type ReactNode } from 'react';
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
  const { room } = useRoom();
  const [view, setView] = useState<AppView>('lobby');
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);

  const handleHostEntersRoom = () => setView('host');
  const handlePlayerEntersRoom = () => setView('player');
  const handleLeave = () => setView('lobby');

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

  let content: ReactNode;
  if (view === 'editor') {
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
