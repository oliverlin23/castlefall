import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useRoom } from './hooks/useRoom';
import { usePlayers } from './hooks/usePlayers';
import { useGame } from './hooks/useGame';
import { useWordLists } from './hooks/useWordLists';
import { useRoomSubscription } from './hooks/useRoomSubscription';
import { RoomSelector } from './components/RoomSelector';
import { NameEntry } from './components/NameEntry';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { GameResults } from './components/GameResults';
import { Chat } from './components/Chat';
import { TwoRoomsBoard } from './games/two_rooms/Board';
import { TwoRoomsResults } from './games/two_rooms/Results';
import { playSound, isSoundEnabled, setSoundEnabled } from './lib/sounds';
import { CastleIcon, QuillSprite } from './components/sprites';
import type { CastlefallSettings } from './types';

interface RoomPageProps {
  roomName: string;
  onChangeRoom: (name: string) => void;
}

export function RoomPage({ roomName, onChangeRoom }: RoomPageProps) {
  const { room, loading: roomLoading, deactivateRoom, handleRoomUpdate, setGameType } = useRoom(roomName);
  const {
    players,
    currentPlayer,
    reconnecting,
    registerPlayer,
    tryReconnect,
    leaveRoom,
    kickPlayer,
    handlePlayerEvent,
    storedName,
    playersLoaded,
  } = usePlayers(room?.id);
  const {
    game,
    pastGames,
    startGame,
    startTwoRoomsGame,
    revealGame,
    declareTeam,
    declareWord,
    voteToReveal,
    unvoteToReveal,
    returnToLobby,
    handleGameUpdate,
  } = useGame(room?.id, room?.current_game_id);

  // Unified realtime subscription for room, players, and games
  const subscriptionCallbacks = useMemo(() => ({
    onRoomUpdate: handleRoomUpdate,
    onPlayerEvent: handlePlayerEvent,
    onGameUpdate: handleGameUpdate,
  }), [handleRoomUpdate, handlePlayerEvent, handleGameUpdate]);
  useRoomSubscription(room?.id, subscriptionCallbacks, currentPlayer?.id, currentPlayer?.display_name, players);
  const { lists: wordLists, loading: wordListsLoading, loadWordList } = useWordLists();
  const [joinAttempted, setJoinAttempted] = useState(false);
  const [lastSettings, setLastSettings] = useState<CastlefallSettings>({ wordCount: 18, timerDurationMs: 60000 });
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
    async (wordListId: string, settings: CastlefallSettings) => {
      if (!players.length) return;
      const words = await loadWordList(wordListId);
      setLastSettings(settings);
      await startGame(words, wordListId, settings);
    },
    [players.length, startGame, loadWordList],
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
      declareWord(currentPlayer.id, currentPlayer.display_name, word);
    },
    [currentPlayer, declareWord],
  );

  const handleTimerExpired = useCallback(() => {
    if (!game || !currentPlayer) return;
    if (game.declaration_player_id === currentPlayer.id) {
      revealGame();
    }
  }, [game, currentPlayer, revealGame]);

  const handleVoteToReveal = useCallback(() => {
    if (!currentPlayer) return;
    voteToReveal(currentPlayer.id, players.length);
  }, [currentPlayer, players.length, voteToReveal]);

  const handleUnvoteToReveal = useCallback(() => {
    if (!currentPlayer) return;
    unvoteToReveal(currentPlayer.id);
  }, [currentPlayer, unvoteToReveal]);

  const handleStartTwoRoomsGame = useCallback(async () => {
    if (!players.length) return;
    await startTwoRoomsGame();
  }, [players.length, startTwoRoomsGame]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  }

  const soundToggleButton = (
    <button
      onClick={toggleSound}
      className="btn-ghost"
      title={soundOn ? 'Mute sounds' : 'Enable sounds'}
    >
      {soundOn ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );

  const wordmark = (
    <a
      href="#"
      className="flex items-center gap-2 text-[color:var(--color-ink)] hover:text-[color:var(--color-seal-red)] transition-colors"
      title="Castlefall"
    >
      <CastleIcon className="h-5 w-5 shrink-0" />
      <span className="display-heading text-[15px] font-bold tracking-tight">
        Castlefall
      </span>
      <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
        // {roomName}
      </span>
    </a>
  );

  if (roomLoading) {
    return <StatusScreen message="Unsealing the room…" />;
  }

  if (!room) {
    return <StatusScreen message="The herald could not find that chamber. Try refreshing." muted />;
  }

  if (reconnecting) {
    return <StatusScreen message="Reconnecting the courier…" />;
  }

  if (!currentPlayer && joinAttempted) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 border-b border-[color:var(--color-ink)] bg-[color:var(--color-paper)] px-3 sm:px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
            {wordmark}
            <RoomSelector currentRoom={roomName} onChangeRoom={onChangeRoom} />
          </div>
        </header>
        <main className="flex-1 max-w-3xl mx-auto w-full px-3 sm:px-4">
          <NameEntry defaultName={storedName} onSubmit={registerPlayer} />
        </main>
      </div>
    );
  }

  if (!currentPlayer) {
    return <StatusScreen message="Joining the chamber…" />;
  }

  const phase =
    game?.status === 'revealed'
      ? 'revealed'
      : game?.status === 'active'
        ? 'playing'
        : 'lobby';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-[color:var(--color-ink)] bg-[color:var(--color-paper)]/95 backdrop-blur-[2px] px-3 sm:px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-2">
          {wordmark}
          <div className="flex items-center gap-1.5">
            {soundToggleButton}
            <RoomSelector currentRoom={roomName} onChangeRoom={onChangeRoom} />
            <button
              onClick={leaveRoom}
              className="btn-ink !px-2.5 !py-1 !text-[11px]"
              title="Leave room and change name"
            >
              {currentPlayer.display_name} &times;
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-3 sm:px-4 py-8">
        {phase === 'lobby' && (
          <Lobby
            players={players}
            currentPlayerId={currentPlayer.id}
            wordLists={wordLists}
            wordListsLoading={wordListsLoading}
            pastGames={pastGames}
            lastSettings={lastSettings}
            gameType={room.game_type}
            onChangeGameType={setGameType}
            onStartGame={handleStartGame}
            onStartTwoRoomsGame={handleStartTwoRoomsGame}
            onKickPlayer={kickPlayer}
          />
        )}

        {phase === 'playing' && game && game.game_type === 'castlefall' && (
          <GameBoard
            game={game}
            words={currentPlayer.game_id === game.id ? (currentPlayer.word_order ?? game.game_words) : game.game_words}
            assignedWord={currentPlayer.game_id === game.id ? currentPlayer.assigned_word : null}
            players={players}
            currentPlayer={currentPlayer}
            onDeclareTeam={handleDeclareTeam}
            onDeclareWord={handleDeclareWord}
            onTimerExpired={handleTimerExpired}
            onVoteToReveal={handleVoteToReveal}
            onUnvoteToReveal={handleUnvoteToReveal}
          />
        )}

        {phase === 'playing' && game && game.game_type === 'two_rooms' && (
          <TwoRoomsBoard game={game} players={players} currentPlayer={currentPlayer} />
        )}

        {phase === 'revealed' && game && game.game_type === 'castlefall' && (
          <GameResults
            game={game}
            players={players}
            currentPlayerId={currentPlayer.id}
            pastGames={pastGames}
            onReturnToLobby={returnToLobby}
          />
        )}

        {phase === 'revealed' && game && game.game_type === 'two_rooms' && (
          <TwoRoomsResults game={game} players={players} onReturnToLobby={returnToLobby} />
        )}
      </main>

      <Chat roomId={room.id} playerName={currentPlayer.display_name} />
    </div>
  );
}

function StatusScreen({ message, muted = false }: { message: string; muted?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="parchment-card px-8 py-7 flex items-center gap-3 animate-fade-in">
        <QuillSprite className={`h-5 w-5 ${muted ? 'opacity-50' : 'animate-flicker text-[color:var(--color-ink)]'}`} />
        <span className={`font-mono text-[12px] uppercase tracking-[0.18em] ${muted ? 'text-[color:var(--color-ink-soft)]' : 'text-[color:var(--color-ink-mid)]'}`}>
          {message}
          <span className="inline-block w-2 ml-0.5 animate-quill-blink">▌</span>
        </span>
      </div>
    </div>
  );
}
