import { useState } from 'react';
import { WordList } from './WordList';
import { VictoryDeclaration } from './VictoryDeclaration';
import { CrownSprite, ScrollSprite } from './sprites';
import { EyeIcon, EyeOffIcon } from './icons';
import { useWordHidden } from '../hooks/useWordHidden';
import { splitByRound } from '../lib/gameLogic';
import type { Game, Player } from '../types';

interface GameBoardProps {
  game: Game;
  words: string[];
  assignedWord: string | null;
  players: Player[];
  currentPlayer: Player;
  /** The player joined after this round was dealt: no word, no team. */
  isSpectator: boolean;
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
  isSpectator,
  onDeclareTeam,
  onDeclareWord,
  onTimerExpired,
  onVoteToReveal,
  onUnvoteToReveal,
}: GameBoardProps) {
  const [showDeclaration, setShowDeclaration] = useState(false);
  const [wordHidden, toggleWordHidden] = useWordHidden();

  const hasActiveDeclaration = game.declaration_type === 'team';
  const revealVotes: string[] = Array.isArray(game.reveal_votes) ? game.reveal_votes : [];
  const hasVoted = revealVotes.includes(currentPlayer.id);

  // vote_to_reveal derives its threshold from the players in the game, not
  // the room, so the count shown here has to be drawn from the same set.
  const { participants, spectators } = splitByRound(players, game);
  const voteThreshold = Math.ceil(participants.length / 2);

  return (
    <div className="space-y-6 animate-fade-in">
      {isSpectator ? (
        <SpectatorCard />
      ) : (
        <SecretWordCard word={assignedWord} hidden={wordHidden} onToggle={toggleWordHidden} />
      )}

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
        <WordList words={words} assignedWord={assignedWord} concealed={wordHidden || isSpectator} />
      </section>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-ink-mid)]">
          {participants.length} {participants.length === 1 ? 'player' : 'players'} at the table
          {spectators.length > 0 && (
            <span className="text-[color:var(--color-violet)]"> · {spectators.length} spectating</span>
          )}
        </span>
        <div className="flex-1" />
        {!hasActiveDeclaration && !isSpectator && (
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

      {(hasActiveDeclaration || (!isSpectator && showDeclaration)) && (
        <VictoryDeclaration
          game={game}
          players={participants}
          currentPlayer={currentPlayer}
          canDeclare={!isSpectator}
          onDeclareTeam={onDeclareTeam}
          onDeclareWord={onDeclareWord}
          onTimerExpired={onTimerExpired}
        />
      )}
    </div>
  );
}

function SecretWordCard({
  word,
  hidden,
  onToggle,
}: {
  word: string | null;
  hidden: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="parchment-card relative z-[1] px-6 py-5 text-center space-y-2">
      <div className="flex items-center justify-center gap-2">
        <CrownSprite tone="gold" className="h-3.5 w-auto" />
        <span className="section-label">// Your secret word</span>
        <CrownSprite tone="gold" className="h-3.5 w-auto" />
      </div>

      {hidden ? (
        <div className="flex justify-center py-1">
          <div className="redacted-bar" role="img" aria-label="Your word is hidden" />
        </div>
      ) : (
        <p
          className="illuminated text-[34px] sm:text-[42px] leading-none text-[color:var(--color-ink)] tracking-tight"
          style={{ fontFamily: 'var(--font-illuminated)' }}
        >
          {word ?? '—'}
        </p>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        {hidden ? 'Hidden — reveal when nobody is looking' : "Find your team. Don't tip off the others."}
      </p>

      <div className="pt-1">
        <button
          onClick={onToggle}
          aria-pressed={hidden}
          className="btn-ink !text-[11px]"
          title={hidden ? 'Show your word' : 'Hide your word from onlookers'}
        >
          {hidden ? <EyeIcon className="w-3.5 h-3.5" /> : <EyeOffIcon className="w-3.5 h-3.5" />}
          {hidden ? 'Reveal word' : 'Hide word'}
        </button>
      </div>
    </section>
  );
}

function SpectatorCard() {
  return (
    <section className="spectator-card px-6 py-5 text-center space-y-2">
      <span className="section-label font-semibold !text-[color:var(--color-violet)]">
        // Spectating this round
      </span>
      <p className="display-heading text-[24px] sm:text-[30px] leading-tight text-[color:var(--color-ink)]">
        You have no word
      </p>
      <p className="text-[12px] text-[color:var(--color-ink-mid)] max-w-sm mx-auto">
        You joined after this round began, so you're not on a team and can't declare
        victory. You'll be dealt in when the next round starts.
      </p>
    </section>
  );
}
