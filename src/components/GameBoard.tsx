import { useState, useCallback } from 'react';
import { WordList } from './WordList';
import { VictoryDeclaration } from './VictoryDeclaration';
import { CrownSprite, ScrollSprite } from './sprites';
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
    <div className="space-y-6 animate-fade-in">
      {/* ASSIGNED WORD HERO BANNER */}
      <section className="parchment-card relative z-[1] px-6 py-5 text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <CrownSprite tone="gold" className="h-3.5 w-auto" />
          <span className="section-label">// Your secret word</span>
          <CrownSprite tone="gold" className="h-3.5 w-auto" />
        </div>
        <p
          className="illuminated text-[34px] sm:text-[42px] leading-none text-[color:var(--color-ink)] tracking-tight"
          style={{ fontFamily: 'var(--font-illuminated)' }}
        >
          {assignedWord ?? '—'}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          Find your team. Don't tip off the others.
        </p>
      </section>

      {/* WORD LIST GRID */}
      <section className="ink-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="section-label flex items-center gap-2">
            <ScrollSprite className="h-3.5 w-auto" />
            // Words on the table
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            {words.length} total
          </span>
        </div>
        <WordList words={words} assignedWord={assignedWord} />
      </section>

      {/* ACTION FOOTER */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-ink-mid)]">
          {players.length} {players.length === 1 ? 'player' : 'players'} at the table
        </span>
        <div className="flex-1" />
        {!hasActiveDeclaration && (
          <button
            onClick={() => setShowDeclaration(!showDeclaration)}
            className={showDeclaration ? 'btn-ink' : 'btn-seal !py-2 !px-4 !text-[12px]'}
          >
            {showDeclaration ? 'Cancel' : 'Declare Victory'}
          </button>
        )}
        <button
          onClick={hasVoted ? onUnvoteToReveal : onVoteToReveal}
          className={`btn-ink !text-[11px] ${
            hasVoted ? '!text-[color:var(--color-violet)] !border-[color:var(--color-violet)]' : ''
          }`}
        >
          {hasVoted ? 'Retract' : 'Vote Reveal'} ({revealVotes.length}/{voteThreshold})
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
