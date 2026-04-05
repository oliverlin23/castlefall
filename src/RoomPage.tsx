import { useEffect, useCallback, useState, useRef } from 'react';
import { useRoom } from './hooks/useRoom';
import { usePlayers } from './hooks/usePlayers';
import { useGame } from './hooks/useGame';
import { useWordLists } from './hooks/useWordLists';
import { RoomSelector } from './components/RoomSelector';
import { NameEntry } from './components/NameEntry';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { GameResults } from './components/GameResults';
import { Chat } from './components/Chat';
import { playSound, isSoundEnabled, setSoundEnabled } from './lib/sounds';
import type { GameSettings } from './types';

interface RoomPageProps {
  roomName: string;
  onChangeRoom: (name: string) => void;
}

export function RoomPage({ roomName, onChangeRoom }: RoomPageProps) {
  const { room, loading: roomLoading, deactivateRoom } = useRoom(roomName);
  const {
    players,
    currentPlayer,
    reconnecting,
    registerPlayer,
    tryReconnect,
    leaveRoom,
    kickPlayer,
    storedName,
    playersLoaded,
  } = usePlayers(room?.id, room?.current_game_id);
  const {
    game,
    pastGames,
    startGame,
    revealGame,
    declareTeam,
    declareWord,
    voteToReveal,
    unvoteToReveal,
  } = useGame(room?.id, room?.current_game_id);
  const { lists: wordLists, loading: wordListsLoading, loadWordList } = useWordLists();
  const [joinAttempted, setJoinAttempted] = useState(false);
  const [lastWordListId, setLastWordListId] = useState('general');
  const [lastSettings, setLastSettings] = useState<GameSettings>({ wordCount: 18, timerDurationMs: 60000 });
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const prevPhaseRef = useRef<string | null>(null);
  const prevPlayerCountRef = useRef(0);

  // Auto-join with stored name
  useEffect(() => {
    if (!room?.id || currentPlayer || joinAttempted) return;
    setJoinAttempted(true);

    if (storedName) {
      tryReconnect().then((reconnected) => {
        if (!reconnected) {
          registerPlayer(storedName);
        }
      });
    }
  }, [room?.id, currentPlayer, joinAttempted, storedName, tryReconnect, registerPlayer]);

  // Deactivate room when all players leave
  useEffect(() => {
    if (room?.id && players.length === 0 && currentPlayer === null && joinAttempted && playersLoaded && !reconnecting) {
      deactivateRoom();
    }
  }, [room?.id, players.length, currentPlayer, joinAttempted, playersLoaded, reconnecting, deactivateRoom]);

  // Sound effects for phase changes and player joins
  useEffect(() => {
    const phase =
      game?.status === 'revealed'
        ? 'revealed'
        : game?.status === 'active'
          ? 'playing'
          : 'lobby';

    if (prevPhaseRef.current && prevPhaseRef.current !== phase) {
      if (phase === 'playing') playSound('roundStart');
      else if (phase === 'revealed') playSound('reveal');
    }
    prevPhaseRef.current = phase;
  }, [game?.status]);

  useEffect(() => {
    if (prevPlayerCountRef.current > 0 && players.length > prevPlayerCountRef.current) {
      playSound('join');
    }
    prevPlayerCountRef.current = players.length;
  }, [players.length]);

  // Beforeunload warning during active game
  useEffect(() => {
    const phase =
      game?.status === 'active' ? 'playing' : null;
    if (phase !== 'playing') return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [game?.status]);

  const handleStartGame = useCallback(
    async (wordListId: string, settings: GameSettings) => {
      if (!players.length) return;
      const words = await loadWordList(wordListId);
      setLastWordListId(wordListId);
      setLastSettings(settings);
      await startGame(players, words, wordListId, settings);
    },
    [players, startGame, loadWordList],
  );

  const handleNewRound = useCallback(
    async (wordListId: string, settings: GameSettings) => {
      if (!players.length) return;
      const words = await loadWordList(wordListId);
      setLastWordListId(wordListId);
      setLastSettings(settings);
      await startGame(players, words, wordListId, settings);
    },
    [players, startGame, loadWordList],
  );

  const handleDeclareTeam = useCallback(
    (selectedPlayerIds: string[]) => {
      if (!currentPlayer) return;
      declareTeam(currentPlayer.id, currentPlayer.display_name, selectedPlayerIds);
    },
    [currentPlayer, declareTeam],
  );

  const handleDeclareWord = useCallback(
    (word: string) => {
      if (!currentPlayer) return;
      declareWord(currentPlayer.id, currentPlayer.display_name, word, players);
    },
    [currentPlayer, declareWord, players],
  );

  const handleTimerExpired = useCallback(() => {
    if (!game || !currentPlayer) return;
    if (game.declaration_player_id === currentPlayer.id) {
      revealGame(players);
    }
  }, [game, currentPlayer, revealGame, players]);

  const handleVoteToReveal = useCallback(() => {
    if (!currentPlayer) return;
    voteToReveal(currentPlayer.id, players.length);
  }, [currentPlayer, players.length, voteToReveal]);

  const handleUnvoteToReveal = useCallback(() => {
    if (!currentPlayer) return;
    unvoteToReveal(currentPlayer.id);
  }, [currentPlayer, unvoteToReveal]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  }

  const soundToggleButton = (
    <button
      onClick={toggleSound}
      className="rounded-md p-1 text-text-secondary hover:text-text-primary"
      title={soundOn ? 'Mute sounds' : 'Enable sounds'}
    >
      {soundOn ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );

  if (roomLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-text-secondary animate-pulse">Joining room...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-text-secondary">Failed to join room. Try refreshing.</div>
      </div>
    );
  }

  if (reconnecting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-text-secondary animate-pulse">Reconnecting...</div>
      </div>
    );
  }

  if (!currentPlayer && joinAttempted) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-surface px-3 sm:px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <h1 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-secondary">Castlefall</h1>
            <RoomSelector currentRoom={roomName} onChangeRoom={onChangeRoom} />
          </div>
        </header>
        <main className="flex-1 max-w-2xl mx-auto w-full px-3 sm:px-4">
          <NameEntry defaultName={storedName} onSubmit={registerPlayer} />
        </main>
      </div>
    );
  }

  if (!currentPlayer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-text-secondary animate-pulse">Joining room...</div>
      </div>
    );
  }

  const phase =
    game?.status === 'revealed'
      ? 'revealed'
      : game?.status === 'active'
        ? 'playing'
        : 'lobby';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface px-3 sm:px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-secondary">Castlefall</h1>
          <div className="flex items-center gap-1.5">
            {soundToggleButton}
            <RoomSelector currentRoom={roomName} onChangeRoom={onChangeRoom} />
            <button
              onClick={leaveRoom}
              className="rounded-md bg-surface-alt border border-border px-2.5 py-1 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              title="Leave room and change name"
            >
              {currentPlayer.display_name} &times;
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-3 sm:px-4 py-8">
        {phase === 'lobby' && (
          <Lobby
            players={players}
            currentPlayerId={currentPlayer.id}
            wordLists={wordLists}
            wordListsLoading={wordListsLoading}
            pastGames={pastGames}
            lastSettings={lastSettings}
            onStartGame={handleStartGame}
            onKickPlayer={kickPlayer}
          />
        )}

        {phase === 'playing' && game && (
          <GameBoard
            game={game}
            words={currentPlayer.word_order ?? game.game_words}
            assignedWord={currentPlayer.assigned_word}
            players={players}
            currentPlayer={currentPlayer}
            onDeclareTeam={handleDeclareTeam}
            onDeclareWord={handleDeclareWord}
            onTimerExpired={handleTimerExpired}
            onVoteToReveal={handleVoteToReveal}
            onUnvoteToReveal={handleUnvoteToReveal}
          />
        )}

        {phase === 'revealed' && game && (
          <GameResults
            game={game}
            players={players}
            currentPlayerId={currentPlayer.id}
            wordLists={wordLists}
            lastWordListId={lastWordListId}
            lastSettings={lastSettings}
            pastGames={pastGames}
            onNewRound={handleNewRound}
          />
        )}
      </main>

      <Chat roomId={room.id} playerName={currentPlayer.display_name} />
    </div>
  );
}
