import { useEffect, useCallback, useState } from 'react';
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

interface RoomPageProps {
  roomName: string;
  onChangeRoom: (name: string) => void;
}

export function RoomPage({ roomName, onChangeRoom }: RoomPageProps) {
  const { room, loading: roomLoading, deactivateRoom } = useRoom(roomName);
  const {
    players,
    currentPlayer,
    registerPlayer,
    tryReconnect,
    leaveRoom,
    storedName,
  } = usePlayers(room?.id, room?.current_game_id);
  const {
    game,
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
    if (room?.id && players.length === 0 && currentPlayer === null && joinAttempted) {
      deactivateRoom();
    }
  }, [room?.id, players.length, currentPlayer, joinAttempted, deactivateRoom]);

  const handleStartGame = useCallback(
    async (wordListId: string) => {
      if (!players.length) return;
      const words = await loadWordList(wordListId);
      setLastWordListId(wordListId);
      await startGame(players, words, wordListId);
    },
    [players, startGame, loadWordList],
  );

  const handleNewRound = useCallback(
    async (wordListId: string) => {
      if (!players.length) return;
      const words = await loadWordList(wordListId);
      setLastWordListId(wordListId);
      await startGame(players, words, wordListId);
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
      declareWord(currentPlayer.id, currentPlayer.display_name, word);
    },
    [currentPlayer, declareWord],
  );

  // Only the original declarer triggers reveal on timer expiry
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

  if (!currentPlayer && joinAttempted) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-border px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight">Castlefall</h1>
            <RoomSelector currentRoom={roomName} onChangeRoom={onChangeRoom} />
          </div>
        </header>
        <main className="flex-1 max-w-2xl mx-auto w-full px-4">
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
      <header className="border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Castlefall</h1>
          <div className="flex items-center gap-3">
            <RoomSelector currentRoom={roomName} onChangeRoom={onChangeRoom} />
            <button
              onClick={leaveRoom}
              className="rounded-lg bg-surface-alt border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
              title="Leave room and change name"
            >
              {currentPlayer.display_name} &times;
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {phase === 'lobby' && (
          <Lobby
            players={players}
            currentPlayerId={currentPlayer.id}
            wordLists={wordLists}
            wordListsLoading={wordListsLoading}
            onStartGame={handleStartGame}
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
            onNewRound={handleNewRound}
          />
        )}
      </main>

      <Chat roomId={room.id} playerName={currentPlayer.display_name} />
    </div>
  );
}
