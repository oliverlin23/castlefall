import { useState } from 'react';
import type { Player, Game, GameSettings } from '../types';
import type { WordListMeta } from '../hooks/useWordLists';
import { PlayerList } from './PlayerList';
import { Scoreboard } from './Scoreboard';

interface LobbyProps {
  players: Player[];
  currentPlayerId?: string;
  wordLists: WordListMeta[];
  wordListsLoading: boolean;
  pastGames: Game[];
  lastSettings: GameSettings;
  onStartGame: (wordListId: string, settings: GameSettings) => void;
  onKickPlayer?: (playerId: string) => void;
}

const WORD_COUNTS = [12, 18, 24] as const;
const TIMER_OPTIONS = [
  { label: '30s', value: 30000 },
  { label: '60s', value: 60000 },
  { label: '90s', value: 90000 },
] as const;

export function Lobby({
  players,
  currentPlayerId,
  wordLists,
  wordListsLoading,
  pastGames,
  lastSettings,
  onStartGame,
  onKickPlayer,
}: LobbyProps) {
  const [selectedList, setSelectedList] = useState(wordLists[0]?.id ?? '');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wordCount, setWordCount] = useState<12 | 18 | 24>(lastSettings.wordCount);
  const [timerMs, setTimerMs] = useState<30000 | 60000 | 90000>(lastSettings.timerDurationMs);
  const [copied, setCopied] = useState(false);

  if (!selectedList && wordLists.length > 0) {
    setSelectedList(wordLists[0].id);
  }

  const canStart = players.length >= 4 && !!selectedList && !wordListsLoading;
  const isHost = !!currentPlayerId && players.length > 0 && players[0].id === currentPlayerId;

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Scoreboard pastGames={pastGames} />

      <div className="rounded-xl bg-surface-alt border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">
            Players
            <span className="ml-1.5 text-text-secondary font-normal">{players.length}</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="rounded-md bg-surface border border-border px-2.5 py-1 text-[11px] text-text-secondary hover:text-text-primary hover:border-accent/50"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            {players.length < 4 && (
              <span className="text-xs text-text-secondary">
                Need {4 - players.length} more
              </span>
            )}
          </div>
        </div>

        {players.length === 0 ? (
          <p className="text-sm text-text-secondary py-4 text-center">
            No one has joined yet. Share the link to invite players.
          </p>
        ) : (
          <PlayerList players={players} currentPlayerId={currentPlayerId} isHost={isHost} onKick={onKickPlayer} />
        )}
      </div>

      <div className="rounded-xl bg-surface-alt border border-border p-5 space-y-3">
        <label htmlFor="word-list-select" className="block text-sm font-semibold">
          Word list
        </label>
        {wordListsLoading ? (
          <div className="h-9 rounded-lg bg-surface-hover animate-pulse" />
        ) : (
          <select
            id="word-list-select"
            value={selectedList}
            onChange={(e) => setSelectedList(e.target.value)}
            className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            {wordLists.map((wl) => (
              <option key={wl.id} value={wl.id}>
                {wl.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="rounded-xl bg-surface-alt border border-border overflow-hidden">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="w-full flex items-center justify-between px-5 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider hover:text-text-primary"
        >
          Settings
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-3.5 h-3.5 transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        {settingsOpen && (
          <div className="px-5 pb-4 space-y-4 animate-fade-in">
            <div className="space-y-2">
              <label className="block text-xs text-text-secondary">Word count</label>
              <div className="flex rounded-lg bg-surface border border-border p-0.5">
                {WORD_COUNTS.map((wc) => (
                  <button
                    key={wc}
                    type="button"
                    onClick={() => setWordCount(wc)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      wordCount === wc ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {wc}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs text-text-secondary">Declaration timer</label>
              <div className="flex rounded-lg bg-surface border border-border p-0.5">
                {TIMER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTimerMs(opt.value as 30000 | 60000 | 90000)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      timerMs === opt.value ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => onStartGame(selectedList, { wordCount, timerDurationMs: timerMs })}
        disabled={!canStart}
        className="w-full rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {canStart ? 'Start Round' : `Waiting for players (${players.length}/4)...`}
      </button>

      <div className="rounded-xl bg-surface-alt border border-border overflow-hidden">
        <button
          onClick={() => setRulesOpen(!rulesOpen)}
          className="w-full flex items-center justify-between px-5 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider hover:text-text-primary"
        >
          How to play
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-3.5 h-3.5 transition-transform duration-200 ${rulesOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        {rulesOpen && (
          <ul className="px-5 pb-4 text-sm text-text-secondary space-y-2 list-disc list-inside animate-fade-in">
            <li>Everyone receives the same list of words, but shuffled differently.</li>
            <li>You'll be secretly assigned to one of two teams. Your teammates share the same highlighted word.</li>
            <li>Give clues about your word to find teammates -- but don't make it too obvious, or the other team will figure it out!</li>
            <li>Win by either naming your teammates or guessing the other team's word.</li>
          </ul>
        )}
      </div>
    </div>
  );
}
