import { MotionConfig } from 'framer-motion';
import { useAuth } from './hooks/useAuth';
import { useGameData } from './hooks/useGameData';
import { LoginScreen } from './components/LoginScreen';
import { CharacterCreation } from './components/CharacterCreation';
import { Dashboard } from './components/Dashboard';

export default function App() {
  // reducedMotion="user" makes every framer-motion animation respect the OS
  // prefers-reduced-motion setting (the CSS override in index.css cannot reach
  // framer's rAF/WAAPI-driven inline styles).
  return (
    <MotionConfig reducedMotion="user">
      <AppBody />
    </MotionConfig>
  );
}

function AppBody() {
  const auth = useAuth();
  const game = useGameData(auth.user);

  if (auth.loading) {
    return <CenteredMessage>システム初期化中…</CenteredMessage>;
  }

  if (!auth.user) {
    return <LoginScreen onSignIn={auth.signIn} configured={auth.ready} />;
  }

  if (game.loading) {
    return <CenteredMessage>ステータスを読み込み中…</CenteredMessage>;
  }

  if (game.needsCharacter) {
    return <CharacterCreation onCreate={game.createCharacterWithName} />;
  }

  if (!game.character) {
    return <CenteredMessage>キャラクター情報の取得に失敗しました。</CenteredMessage>;
  }

  return (
    <Dashboard
      user={auth.user}
      character={game.character}
      game={game}
      onSignOut={auth.signOut}
    />
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <p className="sys-title">{children}</p>
    </div>
  );
}
