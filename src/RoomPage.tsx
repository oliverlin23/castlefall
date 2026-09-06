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
import { DevPanel } from './components/DevPanel';
import { TwoRoomsBoard } from './games/two_rooms/Board';
import { TwoRoomsResults } from './games/two_rooms/Results';
import { playSound, isSoundEnabled, setSoundEnabled } from './lib/sounds';
import { CastleIcon, QuillSprite } from './components/sprites';
import { SpeakerIcon, SpeakerOffIcon } from './components/icons';
import { splitByRound } from './lib/gameLogic';
import type { CastlefallSettings } from './types';

interface RoomPageProps {
  roomName: string;
  onChangeRoom: (name: string) => void;
}

export function RoomPage({ roomName, onChangeRoom }: RoomPageProps) {
  const { room, loading: roomLoading, handleRoomUpdate, setGameType } = useRoom(roomName);
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
  } = usePlayers(room?.id, room?.current_game_id);
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
  const [startGameError, setStartGameError] = useState<string | null>(null);
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
      if (!players.length || !currentPlayer) return;
      setStartGameError(null);
      let words: string[];
      try {
        words = await loadWordList(wordListId, settings.wordCount);
      } catch (e) {
        setStartGameError(e instanceof Error ? e.message : String(e));
        return;
      }
      setLastSettings(settings);
      const { error } = await startGame(currentPlayer.id, words, wordListId, settings);
      if (error) setStartGameError(error);
    },
    [players.length, currentPlayer, startGame, loadWordList],
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
    // Every client triggers reveal so the game doesn't hang at "0s" when
    // the declarer's tab is closed mid-timer. reveal_game is idempotent
    // under its `for update where status='active'` lock, so duplicate
    // calls from N players are no-ops after the first. Deterministic
    // jitter keyed off player index keeps us from all hitting the RPC
    // in the same instant; the declarer fires immediately.
    const isDeclarer = game.declaration_player_id === currentPlayer.id;
    const idx = players.findIndex((p) => p.id === currentPlayer.id);
    const jitter = isDeclarer ? 0 : Math.min(750, Math.max(0, idx) * 150);
    setTimeout(() => {
      revealGame();
    }, jitter);
  }, [game, currentPlayer, players, revealGame]);

  const handleVoteToReveal = useCallback(() => {
    if (!currentPlayer) return;
    voteToReveal(currentPlayer.id);
  }, [currentPlayer, voteToReveal]);

  const handleUnvoteToReveal = useCallback(() => {
    if (!currentPlayer) return;
    unvoteToReveal(currentPlayer.id);
  }, [currentPlayer, unvoteToReveal]);

  const handleStartTwoRoomsGame = useCallback(async () => {
    if (!players.length) return;
    await startTwoRoomsGame();
  }, [players.length, startTwoRoomsGame]);

  const handleReturnToLobby = useCallback(() => {
    if (!currentPlayer) return;
    return returnToLobby(currentPlayer.id);
  }, [currentPlayer, returnToLobby]);

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
      {soundOn ? <SpeakerIcon className="w-3.5 h-3.5" /> : <SpeakerOffIcon className="w-3.5 h-3.5" />}
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
    return <StatusScreen message="Loading room…" />;
  }

  if (!room) {
    return <StatusScreen message="Couldn't load room. Try refreshing." muted />;
  }

  if (reconnecting) {
    return <StatusScreen message="Reconnecting…" />;
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
    return <StatusScreen message="Joining…" />;
  }

  const phase =
    game?.status === 'revealed'
      ? 'revealed'
      : game?.status === 'active'
        ? 'playing'
        : 'lobby';

  const inRound = !!game && currentPlayer.game_id === game.id;
  const isSpectator =
    !!game && splitByRound(players, game).spectators.some((p) => p.id === currentPlayer.id);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-[color:var(--color-ink)] bg-[color:var(--color-paper)]/95 backdrop-blur-[2px] px-3 sm:px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-2">
          {wordmark}
          <div className="flex items-center gap-1.5">
            {phase === 'playing' && isSpectator && (
              <span
                className="tag-chip !text-[9px] !text-[color:var(--color-violet)] !border-[color:var(--color-violet)]"
                title="You joined after this round started and will be dealt in next round"
              >
                Spectating
              </span>
            )}
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
            startGameError={startGameError}
          />
        )}

        {phase === 'playing' && game && game.game_type === 'castlefall' && (
          <GameBoard
            game={game}
            words={inRound ? (currentPlayer.word_order ?? game.game_words) : game.game_words}
            assignedWord={inRound ? currentPlayer.assigned_word : null}
            players={players}
            currentPlayer={currentPlayer}
            isSpectator={isSpectator}
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
            onReturnToLobby={handleReturnToLobby}
          />
        )}

        {phase === 'revealed' && game && game.game_type === 'two_rooms' && (
          <TwoRoomsResults game={game} players={players} onReturnToLobby={handleReturnToLobby} />
        )}
      </main>

      <Chat roomId={room.id} playerName={currentPlayer.display_name} />
      <DevPanel roomId={room.id} players={players} />
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
