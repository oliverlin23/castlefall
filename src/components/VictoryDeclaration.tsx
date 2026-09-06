import { useState, useMemo, type FormEvent } from 'react';
import { Timer } from './Timer';
import { suggestedN } from '../lib/gameLogic';
import { playSound } from '../lib/sounds';
import { WaxSealSprite } from './sprites';
import type { Game, Player } from '../types';

interface VictoryDeclarationProps {
  game: Game;
  players: Player[];
  currentPlayer: Player;
  /** False for spectators: they watch the declaration and its timer, but have
   *  no team to counter with. */
  canDeclare?: boolean;
  onDeclareTeam: (selectedPlayerIds: string[]) => void;
  onDeclareWord: (word: string) => void;
  onTimerExpired: () => void;
}

export function VictoryDeclaration({
  game,
  players,
  currentPlayer,
  canDeclare = true,
  onDeclareTeam,
  onDeclareWord,
  onTimerExpired,
}: VictoryDeclarationProps) {
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(
    new Set([currentPlayer.id]),
  );
  const [wordGuess, setWordGuess] = useState('');
  const [showWordGuess, setShowWordGuess] = useState(false);

  // Teams are split ceil(N/2) / floor(N/2), and a team declaration only wins on
  // an exact match, so the only counts that can ever be correct are the two
  // possible team sizes: floor(N/2)–ceil(N/2). (Even N collapses to a single
  // required count, N/2.)
  const maxN = useMemo(() => suggestedN(players.length), [players.length]);
  const minN = useMemo(() => Math.floor(players.length / 2), [players.length]);
  const rangeLabel = minN === maxN ? `${maxN}` : `${minN}–${maxN}`;
  const timerDurationMs =
    (game.settings && 'timerDurationMs' in game.settings ? game.settings.timerDurationMs : undefined) ?? 60_000;

  function togglePlayer(playerId: string) {
    setSelectedPlayers((prev) => {
      const next = new Set(prev);
      if (playerId === currentPlayer.id) return next;
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  }

  function handleDeclareTeam(e: FormEvent) {
    e.preventDefault();
    if (selectedPlayers.size >= minN && selectedPlayers.size <= maxN) {
      playSound('declare');
      onDeclareTeam(Array.from(selectedPlayers));
    }
  }

  function handleDeclareWord(e: FormEvent) {
    e.preventDefault();
    if (wordGuess.trim()) {
      playSound('declare');
      onDeclareWord(wordGuess.trim());
    }
  }

  // ---------- Active team-declaration timer view ----------
  if (game.declaration_type === 'team' && game.declaration_at) {
    const declarerName = game.declaration_player_name ?? 'Someone';
    const iDeclared = game.declaration_player_id === currentPlayer.id;
    const selectedIds: string[] = game.declaration_data?.selectedPlayers ?? [];
    const declarationTimestamp = new Date(game.declaration_at).getTime();

    return (
      <section className="parchment-card relative z-[1] p-6 space-y-5 animate-slide-up">
        <div className="text-center space-y-1">
          <span className="section-label">// {iDeclared ? 'Your' : `${declarerName}'s`} declaration</span>
          <h3 className="display-heading text-[20px] text-[color:var(--color-ink)]">
            Naming a team
          </h3>
          <p className="text-[12px] text-[color:var(--color-ink-mid)]">
            {declarerName} claims these players are on their team.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 justify-center">
          {players
            .filter((p) => selectedIds.includes(p.id))
            .map((p) => (
              <span
                key={p.id}
                className="border border-[color:var(--color-banner-gold)] bg-[color:var(--color-banner-gold-soft)]/40 text-[color:var(--color-ink)] px-2.5 py-1 text-[12px] font-medium font-mono uppercase tracking-[0.08em]"
              >
                {p.display_name}
              </span>
            ))}
        </div>

        <Timer
          durationMs={timerDurationMs}
          startedAt={declarationTimestamp}
          onExpired={onTimerExpired}
          label="Time to counter with a word guess"
        />

        <div className="border-t border-dashed border-[color:var(--color-ink-soft)] pt-4 space-y-3">
          {!canDeclare ? (
            <p className="text-[12px] text-[color:var(--color-violet)] text-center font-mono uppercase tracking-[0.14em]">
              You're spectating — you can't counter this declaration
            </p>
          ) : (
            <>
              <p className="text-[12px] text-[color:var(--color-ink-mid)] text-center">
                Counter with a word guess to override the declaration:
              </p>
              <form onSubmit={handleDeclareWord} className="flex flex-col sm:flex-row gap-2 justify-center">
                <select
                  value={wordGuess}
                  onChange={(e) => setWordGuess(e.target.value)}
                  className="flex-1 sm:flex-initial sm:w-56"
                >
                  <option value="">Select a word…</option>
                  {game.game_words
                    .filter((w) => w !== currentPlayer.assigned_word)
                    .map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                </select>
                <button type="submit" disabled={!wordGuess} className="btn-seal !py-2.5 !px-4 !text-[12px]">
                  Guess Word
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    );
  }

  // ---------- Active declaration form ----------
  return (
    <section className="parchment-card relative z-[1] p-6 space-y-5 animate-slide-up">
      <div className="flex items-center gap-3 justify-center">
        <WaxSealSprite tone="seal" className="h-8 w-8" />
        <div className="text-center">
          <span className="section-label block">// Declare victory</span>
          <h3 className="display-heading text-[18px] text-[color:var(--color-ink)] leading-none">
            Stake your claim
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-2 border border-[color:var(--color-ink)]">
        <button
          type="button"
          onClick={() => setShowWordGuess(false)}
          className={`px-3 py-2 text-[12px] font-mono uppercase tracking-[0.12em] border-r border-[color:var(--color-ink)] ${
            !showWordGuess
              ? 'bg-[color:var(--color-ink)] text-[color:var(--color-paper-bright)]'
              : 'bg-[color:var(--color-paper-bright)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-dim)]'
          }`}
        >
          Name teammates
        </button>
        <button
          type="button"
          onClick={() => setShowWordGuess(true)}
          className={`px-3 py-2 text-[12px] font-mono uppercase tracking-[0.12em] ${
            showWordGuess
              ? 'bg-[color:var(--color-ink)] text-[color:var(--color-paper-bright)]'
              : 'bg-[color:var(--color-paper-bright)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-dim)]'
          }`}
        >
          Guess word
        </button>
      </div>

      {!showWordGuess ? (
        <form onSubmit={handleDeclareTeam} className="space-y-3 animate-fade-in">
          <p className="text-[12px] text-[color:var(--color-ink-mid)]">
            Select{' '}
            <strong className="text-[color:var(--color-ink)]">
              {rangeLabel}
            </strong>{' '}
            players (including yourself) you believe are on your team. You win
            only if your selection exactly matches your team.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {players.map((p) => {
              const isSelected = selectedPlayers.has(p.id);
              const isSelf = p.id === currentPlayer.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlayer(p.id)}
                  disabled={isSelf}
                  className={`px-3 py-1.5 text-[12px] font-mono uppercase tracking-[0.06em] border ${
                    isSelected
                      ? 'border-[color:var(--color-banner-gold)] bg-[color:var(--color-banner-gold-soft)]/35 text-[color:var(--color-ink)]'
                      : 'border-[color:var(--color-ink)] bg-[color:var(--color-paper-bright)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-dim)]'
                  } ${isSelf ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {p.display_name}
                  {isSelf && <span className="ml-1 text-[color:var(--color-ink-soft)] normal-case">you</span>}
                </button>
              );
            })}
          </div>
          <button
            type="submit"
            disabled={
              selectedPlayers.size < minN || selectedPlayers.size > maxN
            }
            className="btn-seal w-full !py-2.5 !text-[12px]"
          >
            Declare Team ({selectedPlayers.size} selected)
          </button>
        </form>
      ) : (
        <form onSubmit={handleDeclareWord} className="space-y-3 animate-fade-in">
          <p className="text-[12px] text-[color:var(--color-ink-mid)]">
            Guess the other team's word. The round ends immediately.
          </p>
          <select
            value={wordGuess}
            onChange={(e) => setWordGuess(e.target.value)}
            className="w-full"
          >
            <option value="">Select a word…</option>
            {game.game_words
              .filter((w) => w !== currentPlayer.assigned_word)
              .map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
          </select>
          <button
            type="submit"
            disabled={!wordGuess}
            className="btn-seal w-full !py-2.5 !text-[12px]"
          >
            Guess Word
          </button>
        </form>
      )}
    </section>
  );
}
