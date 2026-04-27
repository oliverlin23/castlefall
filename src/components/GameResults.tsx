import type { Game, Player } from '../types';
import { PlayerList } from './PlayerList';
import { Scoreboard } from './Scoreboard';
import { CrownSprite, ShieldSprite, BannerStripSprite, FallenCastleSprite, CastleSprite } from './sprites';

interface GameResultsProps {
  game: Game;
  players: Player[];
  currentPlayerId?: string;
  pastGames: Game[];
  onReturnToLobby: () => void;
}

function outcomeMessage(game: Game, players: Player[]): string | null {
  if (!game.declaration_type) return 'Draw — revealed by vote of the court';

  const declarer = players.find((p) => p.id === game.declaration_player_id);
  const declarerName = game.declaration_player_name ?? 'Someone';

  if (game.declaration_type === 'team') {
    if (game.winner_team && declarer?.team === game.winner_team) {
      return `${declarerName} correctly named their teammates`;
    }
    return `${declarerName} got it wrong — the other team wins`;
  }

  if (game.declaration_type === 'word') {
    const guessedWord = game.declaration_data?.guessedWord;
    const wordDisplay = guessedWord ? ` "${guessedWord}"` : '';
    if (game.winner_team && declarer?.team === game.winner_team) {
      return `${declarerName} correctly guessed the other team's word:${wordDisplay}`;
    }
    return `${declarerName} guessed${wordDisplay} — wrong! The other team wins`;
  }

  return null;
}

export function GameResults({
  game,
  players,
  currentPlayerId,
  pastGames,
  onReturnToLobby,
}: GameResultsProps) {
  const team1Players = players.filter((p) => p.team === 1);
  const team2Players = players.filter((p) => p.team === 2);
  const teamWords = game.team_words as Record<number, string>;
  const outcome = outcomeMessage(game, players);
  const winner = game.winner_team;
  const winnerName = winner === 1 ? 'Blue Team' : winner === 2 ? 'Crimson Team' : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* WINNER BANNER — drapes down from above on reveal */}
      <section className="relative overflow-visible">
        <div className="text-center space-y-1">
          <span className="section-label">// Round complete</span>
        </div>
        {winner ? (
          <div className="mt-3 origin-top animate-banner-unfurl">
            <BannerStripSprite
              tone={winner === 1 ? 'team1' : 'team2'}
              className="w-full h-16"
            />
            <div className="-mt-12 relative z-10 flex flex-col items-center gap-1 text-[color:var(--color-paper-bright)]">
              <CrownSprite tone="gold" className="h-4 w-auto" />
              <p
                className="display-heading text-[26px] sm:text-[32px] leading-none drop-shadow-[1px_1px_0_var(--color-ink)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {winnerName} prevails
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-3 parchment-card relative z-[1] py-6 text-center">
            <p className="display-heading text-[24px] text-[color:var(--color-ink-mid)]">A draw</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] mt-1">
              No conclusive guess
            </p>
          </div>
        )}
        {outcome && (
          <p className="text-center text-[12px] text-[color:var(--color-ink-mid)] mt-3 italic">
            {outcome}
          </p>
        )}
      </section>

      <Scoreboard pastGames={pastGames} />

      {/* TEAM REVEAL — split tableau */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TeamCard
          team={1}
          isWinner={winner === 1}
          word={teamWords[1]}
          players={team1Players}
          currentPlayerId={currentPlayerId}
        />
        <TeamCard
          team={2}
          isWinner={winner === 2}
          word={teamWords[2]}
          players={team2Players}
          currentPlayerId={currentPlayerId}
        />
      </div>

      <button
        onClick={onReturnToLobby}
        className="btn-seal w-full !py-3.5"
      >
        Back to lobby
      </button>
    </div>
  );
}

function TeamCard({
  team,
  isWinner,
  word,
  players,
  currentPlayerId,
}: {
  team: 1 | 2;
  isWinner: boolean;
  word: string;
  players: Player[];
  currentPlayerId?: string;
}) {
  const teamLabel = team === 1 ? 'Blue Team' : 'Crimson Team';
  const tone = team === 1 ? 'team1' : 'team2';
  const washVar = team === 1 ? 'var(--color-team1-wash)' : 'var(--color-team2-wash)';
  const colorVar = team === 1 ? 'var(--color-team1)' : 'var(--color-team2)';

  return (
    <article
      className={`relative border-2 p-4 space-y-3 ${isWinner ? 'parchment-card' : ''}`}
      style={{
        borderColor: colorVar,
        background: isWinner ? washVar : 'var(--color-paper-bright)',
        opacity: isWinner ? 1 : 0.78,
      }}
    >
      <div className="flex items-center gap-3">
        {isWinner ? (
          <ShieldSprite tone={tone} className="h-10 w-auto" />
        ) : (
          <FallenCastleSprite className="h-10 w-auto text-[color:var(--color-ink-soft)]" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold"
              style={{ color: colorVar }}
            >
              // {teamLabel}
            </span>
            {isWinner && <CrownSprite tone="gold" className="h-3 w-auto" />}
          </div>
          <p
            className="illuminated text-[24px] leading-tight"
            style={{ color: colorVar, fontFamily: 'var(--font-illuminated)' }}
          >
            {word}
          </p>
        </div>
      </div>
      <PlayerList players={players} currentPlayerId={currentPlayerId} showTeams />
      {!isWinner && (
        <div className="flex items-center gap-1.5 pt-1">
          <CastleSprite className="h-3 w-auto text-[color:var(--color-ink-soft)] opacity-60" />
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            outmaneuvered
          </span>
        </div>
      )}
    </article>
  );
}
