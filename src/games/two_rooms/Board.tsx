import { useState, useEffect, useMemo } from 'react';
import type { Game, Player } from '../../types';
import { useTwoRoomsGame } from './useTwoRoomsGame';
import { TowerSprite, CastleSprite } from '../../components/sprites';

interface BoardProps {
  game: Game;
  players: Player[];
  currentPlayer: Player;
}

interface TwoRoomsState {
  round: number;
  rounds_total: number;
  round_ends_at: string | null;
  hostages_per_round: number[];
  room_a_leader: string | null;
  room_b_leader: string | null;
  selected_hostages: { a: string[]; b: string[] };
  usurp_votes?: { a: Record<string, string[]>; b: Record<string, string[]> };
  prior_leaders?: { a: string[]; b: string[] };
  phase: string;
}

function teamColor(team: string | undefined): string {
  if (team === 'red') return 'text-[color:var(--color-team2)]';
  if (team === 'blue') return 'text-[color:var(--color-team1)]';
  return 'text-[color:var(--color-ink-mid)]';
}

interface CardRevealProps {
  character: string;
  team: string | undefined;
}

function CardReveal({ character, team }: CardRevealProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setRevealed(false), 2000);
    return () => clearTimeout(t);
  }, [revealed]);

  return (
    <button
      type="button"
      onClick={() => setRevealed((r) => !r)}
      className="w-full border border-[color:var(--color-ink)] bg-[color:var(--color-paper-bright)] px-4 py-7 text-center hover:bg-[color:var(--color-paper-dim)] transition-colors"
      style={{ boxShadow: revealed ? 'inset 0 0 0 2px var(--color-ink)' : 'none' }}
    >
      {revealed ? (
        <>
          <div
            className={`illuminated text-[34px] leading-none ${teamColor(team)}`}
            style={{ fontFamily: 'var(--font-illuminated)' }}
          >
            {character}
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            tap to hide · auto-hides in 2s
          </div>
        </>
      ) : (
        <>
          <div className="font-mono text-[14px] uppercase tracking-[0.14em] text-[color:var(--color-ink-mid)]">
            tap to view your card
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            auto-hides in 2s
          </div>
        </>
      )}
    </button>
  );
}

export function TwoRoomsBoard({ game, players, currentPlayer }: BoardProps) {
  const state = game.game_state as unknown as TwoRoomsState;
  const role = currentPlayer.role as { room?: 'a' | 'b'; character?: string; team?: string } | null;
  const myRoom = role?.room;

  const { appointLeader, abdicateLeader, selectHostages, advanceRound, startRoundTimer, usurpLeader } = useTwoRoomsGame(game.id);

  const sameRoomPlayers = useMemo(
    () =>
      players.filter((p) => {
        const r = p.role as { room?: string } | null;
        return r?.room === myRoom;
      }),
    [players, myRoom],
  );

  const leaderId = myRoom === 'a' ? state.room_a_leader : state.room_b_leader;
  const iAmLeader = leaderId === currentPlayer.id;
  const roomUsurpVotes: Record<string, string[]> =
    (myRoom === 'a' ? state.usurp_votes?.a : state.usurp_votes?.b) ?? {};
  const priorLeaders: string[] =
    (myRoom === 'a' ? state.prior_leaders?.a : state.prior_leaders?.b) ?? [];
  const myUsurpTarget: string | null = Object.entries(roomUsurpVotes).find(
    ([, voters]) => voters.includes(currentPlayer.id),
  )?.[0] ?? null;
  const usurpThreshold = Math.floor(sameRoomPlayers.length / 2) + 1;
  const bothLeadersSet = !!state.room_a_leader && !!state.room_b_leader;
  const hostagesExpected = state.hostages_per_round[state.round - 1] ?? 1;
  const mySelected = (myRoom === 'a' ? state.selected_hostages.a : state.selected_hostages.b) ?? [];
  const otherSelected = (myRoom === 'a' ? state.selected_hostages.b : state.selected_hostages.a) ?? [];

  const [pendingHostages, setPendingHostages] = useState<Set<string>>(new Set(mySelected));
  useEffect(() => {
    setPendingHostages(new Set(mySelected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySelected.join(','), state.round]);

  const [dismissedRound, setDismissedRound] = useState<number | null>(null);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const timerStarted = !!state.round_ends_at;
  const endsAt = state.round_ends_at ? new Date(state.round_ends_at).getTime() : 0;
  const remainingMs = timerStarted ? Math.max(0, endsAt - now) : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  const timeUp = timerStarted && remainingMs === 0;

  const bothReady = mySelected.length === hostagesExpected && otherSelected.length === hostagesExpected;
  const myRoomReady = mySelected.length === hostagesExpected;
  const otherRoomReady = otherSelected.length === hostagesExpected;

  function togglePending(id: string) {
    if (!iAmLeader) return;
    if (id === currentPlayer.id) return;
    const next = new Set(pendingHostages);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= hostagesExpected) return;
      next.add(id);
    }
    setPendingHostages(next);
  }

  async function submitHostages() {
    if (!iAmLeader) return;
    const ids = Array.from(pendingHostages);
    if (ids.length !== hostagesExpected) return;
    await selectHostages(currentPlayer.id, ids);
  }

  async function handleAppoint(targetId: string) {
    await appointLeader(currentPlayer.id, targetId);
  }

  async function handleAbdicate(targetId: string) {
    await abdicateLeader(currentPlayer.id, targetId);
  }

  async function handleUsurpVote(targetId: string) {
    // Toggle: clicking an already-selected target cancels the voter's vote.
    const cancel = myUsurpTarget === targetId;
    await usurpLeader(currentPlayer.id, cancel ? currentPlayer.id : targetId);
  }

  async function handleAdvance() {
    await advanceRound();
  }

  async function handleStartTimer() {
    await startRoundTimer(currentPlayer.id);
  }

  // Prep screen
  const showPrep = dismissedRound !== state.round;
  if (showPrep) {
    const subtitle = state.round === 1 ? 'Go to your room now.' : 'Move to your new room.';
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="parchment-card relative z-[1] p-7 text-center space-y-2">
          <span className="section-label">// Round {state.round} / {state.rounds_total}</span>
          <div className="flex items-center justify-center gap-3">
            <TowerSprite className="h-12 w-auto text-[color:var(--color-ink)]" />
            <p
              className="display-heading text-[44px] leading-none tracking-tight text-[color:var(--color-ink)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              ROOM {myRoom?.toUpperCase() ?? '—'}
            </p>
          </div>
          <p className="text-[13px] text-[color:var(--color-ink-mid)]">{subtitle}</p>
        </div>

        <CardReveal character={role?.character ?? '—'} team={role?.team} />

        <button onClick={() => setDismissedRound(state.round)} className="btn-seal w-full !py-3.5">
          I'm in my room — let's play
        </button>

        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-center text-[color:var(--color-ink-soft)]">
          // Show your card by turning your phone toward another player. The app never reveals it to anyone else.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Timer + round */}
      <div className="ink-card p-4 flex items-center justify-between gap-4">
        <div>
          <div className="section-label">// Round</div>
          <div className="font-mono text-[18px] font-semibold tabular-nums text-[color:var(--color-ink)]">
            {state.round} <span className="text-[color:var(--color-ink-soft)]">/</span> {state.rounds_total}
          </div>
        </div>
        <div className="text-right">
          <div className="section-label">// Time</div>
          <div
            className={`font-mono text-[20px] font-semibold tabular-nums ${
              timeUp ? 'text-[color:var(--color-team2)]' : 'text-[color:var(--color-ink)]'
            }`}
          >
            {timerStarted ? `${minutes}:${seconds.toString().padStart(2, '0')}` : '—:—'}
          </div>
        </div>
      </div>

      {/* My card */}
      <div className="ink-card p-5 space-y-2">
        <div className="section-label">// Your card</div>
        <CardReveal character={role?.character ?? '—'} team={role?.team} />
      </div>

      {/* Timer-start gate */}
      {!timerStarted && (
        <div className="ink-card p-4 space-y-2">
          {iAmLeader && bothLeadersSet && (
            <>
              <p className="text-[12px] text-[color:var(--color-ink-mid)]">
                Both rooms have a Leader. Start the timer once everyone is physically in their room.
              </p>
              <button onClick={handleStartTimer} className="btn-seal w-full !py-2.5 !text-[12px]">
                Start round timer
              </button>
            </>
          )}
          {iAmLeader && !bothLeadersSet && (
            <p className="text-[12px] text-[color:var(--color-ink-mid)]">
              Waiting for the other room to appoint a Leader before the timer can start.
            </p>
          )}
          {!iAmLeader && (
            <p className="text-[12px] text-[color:var(--color-ink-mid)]">
              Waiting for a Leader to start the timer.
            </p>
          )}
        </div>
      )}

      {/* My room */}
      <div className="ink-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="section-label flex items-center gap-2">
            <CastleSprite className="h-3.5 w-auto" />
            // Room {myRoom?.toUpperCase() ?? '—'}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            {sameRoomPlayers.length} {sameRoomPlayers.length === 1 ? 'player' : 'players'}
          </span>
        </div>
        {!leaderId && (
          <p className="text-[12px] text-[color:var(--color-ink-mid)]">
            No leader yet. Use the{' '}
            <span className="text-[color:var(--color-ink)] font-medium">Appoint as leader</span>{' '}
            button next to a player (you cannot appoint yourself).
          </p>
        )}
        {leaderId && (
          <>
            <p className="text-[12px] text-[color:var(--color-ink-mid)]">
              Leader:{' '}
              <span className="text-[color:var(--color-ink)] font-medium">
                {players.find((p) => p.id === leaderId)?.display_name ?? '?'}
              </span>
              {iAmLeader && ' (you)'}
            </p>
            {!iAmLeader && (
              <p className="text-[11px] text-[color:var(--color-ink-soft)] leading-relaxed">
                To replace the leader, {usurpThreshold} of {sameRoomPlayers.length} players in this
                room must vote for the same replacement. A player who has already led this round
                can't lead again.
              </p>
            )}
          </>
        )}
        <ul className="space-y-1">
          {sameRoomPlayers.map((p) => {
            const isSelf = p.id === currentPlayer.id;
            const isLeader = p.id === leaderId;
            const selected = pendingHostages.has(p.id);
            const canPick = iAmLeader && timerStarted && !timeUp;
            const hasLed = priorLeaders.includes(p.id);
            const voteCount = roomUsurpVotes[p.id]?.length ?? 0;
            const iVotedForThem = myUsurpTarget === p.id;
            const canVoteReplace = !!leaderId && !iAmLeader && !isSelf && !isLeader && !hasLed;
            return (
              <li
                key={p.id}
                className={`flex items-center justify-between border px-3 py-2 text-[13px] ${
                  canPick && !isSelf
                    ? selected
                      ? 'bg-[color:var(--color-banner-gold-soft)]/40 border-[color:var(--color-banner-gold)] cursor-pointer'
                      : 'bg-[color:var(--color-paper-bright)] border-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-dim)] cursor-pointer'
                    : 'bg-[color:var(--color-paper-bright)] border-[color:var(--color-ink)]'
                }`}
                onClick={() => canPick && togglePending(p.id)}
              >
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-[color:var(--color-ink)] font-medium">{p.display_name}</span>
                  {isSelf && (
                    <span className="text-[color:var(--color-ink-soft)] text-[11px]">(you)</span>
                  )}
                  {isLeader && (
                    <span className="font-mono text-[9px] text-[color:var(--color-banner-gold)] uppercase tracking-[0.18em]">
                      leader
                    </span>
                  )}
                  {!isLeader && hasLed && (
                    <span className="font-mono text-[9px] text-[color:var(--color-ink-soft)] uppercase tracking-[0.18em]">
                      already led
                    </span>
                  )}
                  {!isLeader && voteCount > 0 && (
                    <span className="font-mono text-[10px] text-[color:var(--color-ink-mid)] tabular-nums">
                      {voteCount} of {sameRoomPlayers.length} votes to make leader
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {!leaderId && !isSelf && !hasLed && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAppoint(p.id);
                      }}
                      className="btn-ink !px-2 !py-0.5 !text-[10px]"
                    >
                      Appoint {p.display_name} as leader
                    </button>
                  )}
                  {!leaderId && !isSelf && hasLed && (
                    <span
                      className="rounded-md bg-surface-alt border border-border px-2 py-0.5 text-[11px] text-text-secondary"
                      title="This player already led this round and can't lead again until next round."
                    >
                      Already led this round
                    </span>
                  )}
                  {iAmLeader && !isSelf && !hasLed && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAbdicate(p.id);
                      }}
                      className="btn-ghost !px-2 !py-0.5 !text-[10px] border border-[color:var(--color-ink-soft)]"
                      title="Hand the leader card to this player. You can't take it back this round."
                    >
                      Hand leader to {p.display_name}
                    </button>
                  )}
                  {canVoteReplace && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUsurpVote(p.id);
                      }}
                      className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.06em] border ${
                        iVotedForThem
                          ? 'bg-[color:var(--color-banner-gold-soft)]/40 border-[color:var(--color-banner-gold)] text-[color:var(--color-ink)]'
                          : 'bg-[color:var(--color-paper-bright)] border-[color:var(--color-ink)] text-[color:var(--color-ink-mid)] hover:bg-[color:var(--color-paper-dim)] hover:text-[color:var(--color-ink)]'
                      }`}
                      title={
                        iVotedForThem
                          ? `Click to undo your vote. ${voteCount} of ${usurpThreshold} needed.`
                          : `${voteCount} of ${usurpThreshold} votes needed to make ${p.display_name} leader.`
                      }
                    >
                      {iVotedForThem
                        ? `Voting for ${p.display_name} — click to undo`
                        : `Vote to crown ${p.display_name}`}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {iAmLeader && timerStarted && (
          <div className="pt-3 border-t border-dashed border-[color:var(--color-ink-soft)] space-y-2">
            <div className="text-[12px] text-[color:var(--color-ink-mid)]">
              Pick <strong className="text-[color:var(--color-ink)]">{hostagesExpected}</strong>{' '}
              {hostagesExpected === 1 ? 'player' : 'players'} to send to the other room at round end.
              Currently picked:{' '}
              <span className="font-mono tabular-nums">
                {pendingHostages.size}/{hostagesExpected}
              </span>
            </div>
            <button
              onClick={submitHostages}
              disabled={pendingHostages.size !== hostagesExpected}
              className="btn-seal w-full !py-2.5 !text-[12px]"
            >
              {(() => {
                const names = Array.from(pendingHostages)
                  .map((id) => players.find((pl) => pl.id === id)?.display_name ?? '?')
                  .join(', ');
                if (pendingHostages.size !== hostagesExpected) {
                  return `Pick ${hostagesExpected} to send to the other room`;
                }
                return mySelected.length > 0
                  ? `Update pick: send ${names} to the other room`
                  : `Send ${names} to the other room`;
              })()}
            </button>
          </div>
        )}
      </div>

      {/* Between-room status + exchange confirmation */}
      {timerStarted && (
        <div className="ink-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div className="space-y-0.5">
              <div className="section-label">// Your room</div>
              <div
                className={
                  myRoomReady
                    ? 'font-mono text-[color:var(--color-banner-gold)] font-semibold uppercase tracking-[0.12em] text-[11px]'
                    : 'text-[color:var(--color-ink-mid)]'
                }
              >
                {myRoomReady ? 'Ready ✓' : iAmLeader ? 'Choose hostages' : 'Your leader is choosing…'}
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="section-label">// Other room</div>
              <div
                className={
                  otherRoomReady
                    ? 'font-mono text-[color:var(--color-banner-gold)] font-semibold uppercase tracking-[0.12em] text-[11px]'
                    : 'text-[color:var(--color-ink-mid)]'
                }
              >
                {otherRoomReady ? 'Ready ✓' : 'Waiting…'}
              </div>
            </div>
          </div>

          {bothReady && iAmLeader && (
            <div className="pt-2 border-t border-dashed border-[color:var(--color-ink-soft)] space-y-2">
              <p className="text-[12px] text-[color:var(--color-ink-mid)]">
                Both rooms are ready. Meet the other Leader in the hallway, then confirm the exchange.
              </p>
              <button onClick={handleAdvance} className="btn-seal w-full !py-2.5 !text-[12px]">
                {state.round >= state.rounds_total ? 'Reveal all cards' : 'Confirm hostage exchange'}
              </button>
            </div>
          )}
          {bothReady && !iAmLeader && (
            <p className="pt-2 border-t border-dashed border-[color:var(--color-ink-soft)] text-[12px] text-[color:var(--color-ink-mid)]">
              Both rooms are ready. Your Leader is meeting in the hallway to confirm the exchange.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
