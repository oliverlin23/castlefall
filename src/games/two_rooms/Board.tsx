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
  round_ends_at: string;
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

export function TwoRoomsBoard({ game, players, currentPlayer }: BoardProps) {
  const state = game.game_state as unknown as TwoRoomsState;
  const role = currentPlayer.role as { room?: 'a' | 'b'; character?: string; team?: string } | null;
  const myRoom = role?.room;

  const { appointLeader, abdicateLeader, selectHostages, advanceRound } = useTwoRoomsGame(game.id);

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
  const hostagesExpected = state.hostages_per_round[state.round - 1] ?? 1;
  const mySelected = (myRoom === 'a' ? state.selected_hostages.a : state.selected_hostages.b) ?? [];
  const otherSelected = (myRoom === 'a' ? state.selected_hostages.b : state.selected_hostages.a) ?? [];

  const [pendingHostages, setPendingHostages] = useState<Set<string>>(new Set(mySelected));
  useEffect(() => {
    setPendingHostages(new Set(mySelected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySelected.join(','), state.round]);

  // Timer countdown
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const endsAt = new Date(state.round_ends_at).getTime();
  const remainingMs = Math.max(0, endsAt - now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  const timeUp = remainingMs === 0;

  // Both rooms have submitted hostages?
  const bothReady = mySelected.length === hostagesExpected && otherSelected.length === hostagesExpected;

  function togglePending(id: string) {
    if (!iAmLeader) return;
    if (id === currentPlayer.id) return;  // can't pick self
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
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
        </div>
      </div>

      {/* My card */}
      <div className="rounded-xl bg-surface-alt border border-border p-5 space-y-1">
        <div className="text-xs text-text-secondary uppercase tracking-wider">Your card</div>
        <div className={`text-2xl font-bold ${teamColor(role?.team)}`}>{role?.character ?? '—'}</div>
        <div className="text-xs text-text-secondary">
          Show your card only to players you trust. Hidden from everyone by default.
        </div>
      </div>

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
            return (
              <li
                key={p.id}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                  iAmLeader && !isSelf && !timeUp
                    ? selected
                      ? 'bg-accent/20 border border-accent cursor-pointer'
                      : 'bg-surface border border-border hover:bg-surface-hover cursor-pointer'
                    : 'bg-surface border border-border'
                }`}
                onClick={() => iAmLeader && !timeUp && togglePending(p.id)}
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

        {iAmLeader && (
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
            {mySelected.length === hostagesExpected && (
              <p className="text-[11px] text-text-secondary text-center">
                ✓ Your selection is locked in. Waiting for the other room.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Advance round / waiting for other room */}
      <div className="rounded-xl bg-surface-alt border border-border p-4 space-y-2">
        <div className="text-xs text-text-secondary">
          Room A: {state.selected_hostages.a.length}/{hostagesExpected} selected ·
          Room B: {state.selected_hostages.b.length}/{hostagesExpected} selected
        </div>
        {bothReady && (
          <button
            onClick={handleAdvance}
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            {state.round >= state.rounds_total ? 'Reveal all cards' : 'Swap hostages & start next round'}
          </button>
        )}
      </div>
    </div>
  );
}
