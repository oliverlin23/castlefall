import { useState, useCallback } from 'react';
import { WordList } from './WordList';
import { VictoryDeclaration } from './VictoryDeclaration';
import { CrownSprite, ScrollSprite } from './sprites';
import { isWordHidden, setWordHidden } from '../lib/wordVisibility';
import type { Game, Player } from '../types';

interface GameBoardProps {
  game: Game;
  words: string[];
  assignedWord: string | null;
  players: Player[];
  currentPlayer: Player;
  /** True when the player joined after this round started: no word, no team,
   *  no stake in the outcome. */
  isSpectator: boolean;
  onDeclareTeam: (selectedPlayerIds: string[]) => void;
  onDeclareWord: (word: string) => void;
  onTimerExpired: () => void;
  onVoteToReveal: () => void;
  onUnvoteToReveal: () => void;
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path
        fillRule="evenodd"
        d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
        clipRule="evenodd"
      />
      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
    </svg>
  );
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
  const [wordHidden, setWordHiddenState] = useState(isWordHidden);

  const hasActiveDeclaration = game.declaration_type === 'team';
  const revealVotes: string[] = Array.isArray(game.reveal_votes) ? game.reveal_votes : [];
  const hasVoted = revealVotes.includes(currentPlayer.id);

  // Only players dealt into this round have a word and a team; anyone who
  // joined mid-round is a spectator. The reveal threshold and the team-size
  // range are both derived server-side from the players in the game, so the
  // board has to use the same set or the numbers on screen won't match.
  // If no row carries this game's id yet the player rows simply haven't
  // resynced after the deal — fall back to everyone rather than claiming the
  // table is empty.
  const dealtIn = players.filter((p) => p.game_id === game.id);
  const participants = dealtIn.length > 0 ? dealtIn : players;
  const spectators = dealtIn.length > 0 ? players.filter((p) => p.game_id !== game.id) : [];
  const voteThreshold = Math.max(1, Math.ceil(participants.length / 2));

  const toggleWordHidden = useCallback(() => {
    setWordHiddenState((prev) => {
      const next = !prev;
      setWordHidden(next);
      return next;
    });
  }, []);

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
      {isSpectator ? (
        /* SPECTATOR BANNER — replaces the secret-word hero */
        <section
          className="relative z-[1] px-6 py-5 text-center space-y-2 bg-[color:var(--color-paper-dim)]"
          style={{ border: '2px dashed var(--color-violet)' }}
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-[color:var(--color-violet)]">
            // Spectating this round
          </span>
          <p className="display-heading text-[24px] sm:text-[30px] leading-tight text-[color:var(--color-ink)]">
            You have no word
          </p>
          <p className="text-[12px] text-[color:var(--color-ink-mid)] max-w-sm mx-auto">
            You joined after this round began, so you're not on a team and can't
            declare victory. You'll be dealt in when the next round starts.
          </p>
        </section>
      ) : (
        /* ASSIGNED WORD HERO BANNER */
        <section className="parchment-card relative z-[1] px-6 py-5 text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <CrownSprite tone="gold" className="h-3.5 w-auto" />
            <span className="section-label">// Your secret word</span>
            <CrownSprite tone="gold" className="h-3.5 w-auto" />
          </div>

          {wordHidden ? (
            <div className="flex flex-col items-center gap-2 py-1">
              <div
                aria-hidden
                className="w-[68%] max-w-[280px] h-[38px] sm:h-[46px] border border-[color:var(--color-ink)]"
                style={{
                  background:
                    'repeating-linear-gradient(45deg, var(--color-ink-soft) 0px, var(--color-ink-soft) 3px, var(--color-paper-dim) 3px, var(--color-paper-dim) 9px)',
                }}
              />
              <span className="sr-only">Your word is hidden</span>
            </div>
          ) : (
            <p
              className="illuminated text-[34px] sm:text-[42px] leading-none text-[color:var(--color-ink)] tracking-tight"
              style={{ fontFamily: 'var(--font-illuminated)' }}
            >
              {assignedWord ?? '—'}
            </p>
          )}

          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            {wordHidden
              ? 'Hidden — reveal when nobody is looking'
              : "Find your team. Don't tip off the others."}
          </p>

          <div className="pt-1">
            <button
              onClick={toggleWordHidden}
              aria-pressed={wordHidden}
              className="btn-ink !text-[11px]"
              title={wordHidden ? 'Show your word' : 'Hide your word from onlookers'}
            >
              {wordHidden ? (
                <>
                  <EyeIcon className="w-3.5 h-3.5" />
                  Reveal word
                </>
              ) : (
                <>
                  <EyeOffIcon className="w-3.5 h-3.5" />
                  Hide word
                </>
              )}
            </button>
          </div>
        </section>
      )}

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
        <WordList
          words={words}
          assignedWord={assignedWord}
          concealed={wordHidden || isSpectator}
        />
      </section>

      {/* ACTION FOOTER */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-ink-mid)]">
          {participants.length} {participants.length === 1 ? 'player' : 'players'} at the table
          {spectators.length > 0 && (
            <span className="text-[color:var(--color-violet)]">
              {' '}
              · {spectators.length} spectating
            </span>
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

      {/* Spectators still see a live declaration play out, but can't counter it. */}
      {(hasActiveDeclaration || (!isSpectator && showDeclaration)) && (
        <VictoryDeclaration
          game={game}
          players={participants}
          currentPlayer={currentPlayer}
          canDeclare={!isSpectator}
          onDeclareTeam={handleDeclareTeam}
          onDeclareWord={handleDeclareWord}
          onTimerExpired={onTimerExpired}
        />
      )}
    </div>
  );
}
