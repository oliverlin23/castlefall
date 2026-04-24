import { useState, useEffect, useMemo } from 'react';
import type { Game, Player } from '../../types';
import { useTwoRoomsGame } from './useTwoRoomsGame';

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
  phase: string;
}

function teamColor(team: string | undefined): string {
  if (team === 'red') return 'text-team2';
  if (team === 'blue') return 'text-team1';
  return 'text-text-secondary';
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
      className="w-full rounded-lg bg-surface border border-border px-4 py-6 text-center hover:border-accent/60 transition-colors"
    >
      {revealed ? (
        <>
          <div className={`text-3xl font-bold ${teamColor(team)}`}>{character}</div>
          <div className="mt-1 text-[11px] text-text-secondary">Tap to hide · auto-hides in 2s</div>
        </>
      ) : (
        <>
          <div className="text-xl font-semibold text-text-secondary tracking-wide">Tap to view your card</div>
          <div className="mt-1 text-[11px] text-text-secondary">Auto-hides in 2s</div>
        </>
      )}
    </button>
  );
}

export function TwoRoomsBoard({ game, players, currentPlayer }: BoardProps) {
  const state = game.game_state as unknown as TwoRoomsState;
  const role = currentPlayer.role as { room?: 'a' | 'b'; character?: string; team?: string } | null;
  const myRoom = role?.room;

  const { appointLeader, abdicateLeader, selectHostages, advanceRound, startRoundTimer } = useTwoRoomsGame(game.id);

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
  const bothLeadersSet = !!state.room_a_leader && !!state.room_b_leader;
  const hostagesExpected = state.hostages_per_round[state.round - 1] ?? 1;
  const mySelected = (myRoom === 'a' ? state.selected_hostages.a : state.selected_hostages.b) ?? [];
  const otherSelected = (myRoom === 'a' ? state.selected_hostages.b : state.selected_hostages.a) ?? [];

  const [pendingHostages, setPendingHostages] = useState<Set<string>>(new Set(mySelected));
  useEffect(() => {
    setPendingHostages(new Set(mySelected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySelected.join(','), state.round]);

  // Prep screen dismissal — per round, client-local. Re-appears when server.round changes.
  const [dismissedRound, setDismissedRound] = useState<number | null>(null);

  // Timer countdown
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

  async function handleAdvance() {
    await advanceRound();
  }

  async function handleStartTimer() {
    await startRoundTimer(currentPlayer.id);
  }

  // Prep screen — shown at game start and whenever round advances, until the
  // player taps "I'm in my room". Every client dismisses on its own.
  const showPrep = dismissedRound !== state.round;
  if (showPrep) {
    const subtitle =
      state.round === 1 ? 'Go to your room now.' : 'Move to your new room.';
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="rounded-xl bg-surface-alt border border-border p-6 text-center space-y-2">
          <div className="text-xs text-text-secondary uppercase tracking-wider">Round {state.round} / {state.rounds_total}</div>
          <div className="text-5xl font-extrabold tracking-tight">ROOM {myRoom?.toUpperCase() ?? '—'}</div>
          <div className="text-sm text-text-secondary">{subtitle}</div>
        </div>

        <CardReveal character={role?.character ?? '—'} team={role?.team} />

        <button
          onClick={() => setDismissedRound(state.round)}
          className="w-full rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          I'm in my room, let's play
        </button>

        <p className="text-[11px] text-text-secondary text-center">
          Show your card only by turning your phone toward another player. The app never reveals it to anyone else.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Timer + round */}
      <div className="rounded-xl bg-surface-alt border border-border p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-text-secondary uppercase tracking-wider">Round</div>
          <div className="text-lg font-bold">{state.round} / {state.rounds_total}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-text-secondary uppercase tracking-wider">Time</div>
          <div className={`text-lg font-mono font-bold ${timeUp ? 'text-team2' : 'text-text-primary'}`}>
            {timerStarted ? `${minutes}:${seconds.toString().padStart(2, '0')}` : '—:—'}
          </div>
        </div>
      </div>

      {/* My card */}
      <div className="rounded-xl bg-surface-alt border border-border p-5 space-y-2">
        <div className="text-xs text-text-secondary uppercase tracking-wider">Your card</div>
        <CardReveal character={role?.character ?? '—'} team={role?.team} />
      </div>

      {/* Timer-start gate */}
      {!timerStarted && (
        <div className="rounded-xl bg-surface-alt border border-border p-4 space-y-2">
          {iAmLeader && bothLeadersSet && (
            <>
              <p className="text-xs text-text-secondary">
                Both rooms have a Leader. Start the timer once everyone is physically in their room.
              </p>
              <button
                onClick={handleStartTimer}
                className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                Start round timer
              </button>
            </>
          )}
          {iAmLeader && !bothLeadersSet && (
            <p className="text-xs text-text-secondary">
              Waiting for the other room to appoint a Leader before the timer can start.
            </p>
          )}
          {!iAmLeader && (
            <p className="text-xs text-text-secondary">
              Waiting for a Leader to start the timer.
            </p>
          )}
        </div>
      )}

      {/* My room */}
      <div className="rounded-xl bg-surface-alt border border-border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Room {myRoom?.toUpperCase() ?? '—'}</h3>
          <span className="text-xs text-text-secondary">
            {sameRoomPlayers.length} {sameRoomPlayers.length === 1 ? 'player' : 'players'}
          </span>
        </div>
        {!leaderId && (
          <p className="text-xs text-text-secondary">
            No leader yet. Tap a player to appoint them (you cannot appoint yourself).
          </p>
        )}
        {leaderId && (
          <p className="text-xs text-text-secondary">
            Leader: <span className="text-text-primary font-medium">
              {players.find((p) => p.id === leaderId)?.display_name ?? '?'}
            </span>
            {iAmLeader && ' (you)'}
          </p>
        )}
        <ul className="space-y-1">
          {sameRoomPlayers.map((p) => {
            const isSelf = p.id === currentPlayer.id;
            const isLeader = p.id === leaderId;
            const selected = pendingHostages.has(p.id);
            const canPick = iAmLeader && timerStarted && !timeUp;
            return (
              <li
                key={p.id}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                  canPick && !isSelf
                    ? selected
                      ? 'bg-accent/20 border border-accent cursor-pointer'
                      : 'bg-surface border border-border hover:bg-surface-hover cursor-pointer'
                    : 'bg-surface border border-border'
                }`}
                onClick={() => canPick && togglePending(p.id)}
              >
                <span>
                  <span className="text-text-primary font-medium">{p.display_name}</span>
                  {isSelf && <span className="text-text-secondary ml-1">(you)</span>}
                  {isLeader && <span className="ml-2 text-[10px] text-accent uppercase tracking-wide">Leader</span>}
                </span>
                <div className="flex items-center gap-2">
                  {!leaderId && !isSelf && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAppoint(p.id);
                      }}
                      className="rounded-md bg-accent/20 border border-accent px-2 py-0.5 text-[11px] text-accent hover:bg-accent/30"
                    >
                      Appoint
                    </button>
                  )}
                  {iAmLeader && !isSelf && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAbdicate(p.id);
                      }}
                      className="rounded-md bg-surface-alt border border-border px-2 py-0.5 text-[11px] text-text-secondary hover:text-text-primary"
                      title="Hand leadership to this player"
                    >
                      Abdicate →
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {iAmLeader && timerStarted && (
          <div className="pt-3 border-t border-border space-y-2">
            <div className="text-xs text-text-secondary">
              Select {hostagesExpected} {hostagesExpected === 1 ? 'hostage' : 'hostages'} to send to the other room.
              Currently selected: {pendingHostages.size}/{hostagesExpected}
            </div>
            <button
              onClick={submitHostages}
              disabled={pendingHostages.size !== hostagesExpected}
              className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {mySelected.length > 0 ? 'Update hostage selection' : 'Lock in hostages'}
            </button>
          </div>
        )}
      </div>

      {/* Between-room status + exchange confirmation */}
      {timerStarted && (
        <div className="rounded-xl bg-surface-alt border border-border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="text-text-secondary uppercase tracking-wider">Your room</div>
              <div className={myRoomReady ? 'text-accent font-medium' : 'text-text-secondary'}>
                {myRoomReady ? 'Ready ✓' : iAmLeader ? 'Choose hostages' : 'Your leader is choosing…'}
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-text-secondary uppercase tracking-wider">Other room</div>
              <div className={otherRoomReady ? 'text-accent font-medium' : 'text-text-secondary'}>
                {otherRoomReady ? 'Ready ✓' : 'Waiting…'}
              </div>
            </div>
          </div>

          {bothReady && iAmLeader && (
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-xs text-text-secondary">
                Both rooms are ready. Meet the other Leader in the hallway, then confirm the exchange.
              </p>
              <button
                onClick={handleAdvance}
                className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                {state.round >= state.rounds_total ? 'Reveal all cards' : 'Confirm hostage exchange'}
              </button>
            </div>
          )}
          {bothReady && !iAmLeader && (
            <p className="pt-2 border-t border-border text-xs text-text-secondary">
              Both rooms are ready. Your Leader is meeting in the hallway to confirm the exchange.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
