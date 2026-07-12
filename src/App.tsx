import { useState } from 'react';
import { RoomProvider, useRoom } from './context/RoomContext';
import { QuizLibraryProvider } from './context/QuizLibraryContext';
import { RoomLobby } from './components/RoomLobby';
import { HostRoom } from './components/HostRoom';
import { PlayerRoom } from './components/PlayerRoom';
import { QuizEditor } from './components/QuizEditor';
import { FirebaseSetup } from './components/FirebaseSetup';
import { isFirebaseConfigValid } from './firebase';
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

  if (view === 'editor') {
    return (
      <div className="min-h-screen flex flex-col">
        <QuizEditor quizToEdit={editingQuiz} onClose={handleCloseEditor} />
      </div>
    );
  }

  if (view === 'host' && room) {
    return <HostRoom onLeave={handleLeave} />;
  }

  if (view === 'player' && room) {
    return <PlayerRoom onLeave={handleLeave} />;
  }

  return (
    <RoomLobby
      onHostEntersRoom={handleHostEntersRoom}
      onPlayerEntersRoom={handlePlayerEntersRoom}
      onCreateQuiz={handleCreateQuiz}
      onEditQuiz={handleEditQuiz}
    />
  );
}

export default function App() {
  const [configured, setConfigured] = useState(isFirebaseConfigValid);

  if (!configured) {
    return <FirebaseSetup onConfigured={() => setConfigured(true)} />;
  }

  return (
    <QuizLibraryProvider>
      <RoomProvider>
        <AppContent />
      </RoomProvider>
    </QuizLibraryProvider>
  );
}
