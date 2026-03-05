import { useState, useCallback } from 'react';
import { WordList } from './WordList';
import { VictoryDeclaration } from './VictoryDeclaration';
import type { Game, Player } from '../types';

interface GameBoardProps {
  game: Game;
  words: string[];
  assignedWord: string | null;
  players: Player[];
  currentPlayer: Player;
  onDeclareTeam: (selectedPlayerIds: string[]) => void;
  onDeclareWord: (word: string) => void;
  onTimerExpired: () => void;
  onVoteToReveal: () => void;
  onUnvoteToReveal: () => void;
}

export function GameBoard({
  game,
  words,
  assignedWord,
  players,
  currentPlayer,
  onDeclareTeam,
  onDeclareWord,
  onTimerExpired,
  onVoteToReveal,
  onUnvoteToReveal,
}: GameBoardProps) {
  const [showDeclaration, setShowDeclaration] = useState(false);

  const hasActiveDeclaration = game.declaration_type === 'team';
  const revealVotes: string[] = Array.isArray(game.reveal_votes) ? game.reveal_votes : [];
  const hasVoted = revealVotes.includes(currentPlayer.id);
  const voteThreshold = Math.ceil(players.length / 2);

  const handleDeclareTeam = useCallback(
    (selectedPlayerIds: string[]) => {
      onDeclareTeam(selectedPlayerIds);
    },
    [onDeclareTeam],
  );

  const handleDeclareWord = useCallback(
    (word: string) => {
      onDeclareWord(word);
    },
    [onDeclareWord],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-surface-alt border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Your Words</h2>
          <span className="text-xs text-text-secondary">
            Your word is highlighted
          </span>
        </div>
        <WordList words={words} assignedWord={assignedWord} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-text-secondary">
          {players.length} players in round
        </span>
        <div className="flex-1" />
        {!hasActiveDeclaration && (
          <button
            onClick={() => setShowDeclaration(!showDeclaration)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              showDeclaration
                ? 'bg-surface-hover border border-border text-text-primary'
                : 'bg-accent text-white hover:bg-accent-hover'
            }`}
          >
            {showDeclaration ? 'Hide Declaration' : 'Declare Victory'}
          </button>
        )}
        <button
          onClick={hasVoted ? onUnvoteToReveal : onVoteToReveal}
          className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
            hasVoted
              ? 'bg-accent/10 border-accent text-accent hover:bg-accent/20'
              : 'bg-surface-alt border-border text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }`}
        >
          {hasVoted ? 'Retract Vote' : 'Vote to Reveal'} ({revealVotes.length}/{voteThreshold})
        </button>
      </div>

      {(showDeclaration || hasActiveDeclaration) && (
        <VictoryDeclaration
          game={game}
          players={players}
          currentPlayer={currentPlayer}
          onDeclareTeam={handleDeclareTeam}
          onDeclareWord={handleDeclareWord}
          onTimerExpired={onTimerExpired}
        />
      )}
    </div>
  );
}
