import { useState } from 'react';
import type { Player, Game, CastlefallSettings, GameType } from '../types';
import type { WordListMeta } from '../hooks/useWordLists';
import { PlayerList } from './PlayerList';
import { Scoreboard } from './Scoreboard';
import { CastleSprite, ScrollSprite, TowerSprite } from './sprites';

interface LobbyProps {
  players: Player[];
  currentPlayerId?: string;
  wordLists: WordListMeta[];
  wordListsLoading: boolean;
  pastGames: Game[];
  lastSettings: CastlefallSettings;
  gameType: GameType;
  onChangeGameType?: (gameType: GameType) => void;
  onStartGame: (wordListId: string, settings: CastlefallSettings) => void;
  onStartTwoRoomsGame?: () => void;
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
  gameType,
  onChangeGameType,
  onStartGame,
  onStartTwoRoomsGame,
  onKickPlayer,
}: LobbyProps) {
  const [selectedList, setSelectedList] = useState(wordLists[0]?.id ?? '');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [twoRoomsRulesOpen, setTwoRoomsRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wordCount, setWordCount] = useState<12 | 18 | 24>(lastSettings.wordCount);
  const [timerMs, setTimerMs] = useState<30000 | 60000 | 90000>(lastSettings.timerDurationMs);
  const [copied, setCopied] = useState(false);

  if (!selectedList && wordLists.length > 0) {
    setSelectedList(wordLists[0].id);
  }

  const castlefallCanStart = players.length >= 4 && !!selectedList && !wordListsLoading;
  const twoRoomsCanStart = players.length >= 6 && players.length <= 30;
  const canStart = gameType === 'castlefall' ? castlefallCanStart : twoRoomsCanStart;
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

      {/* GAME MODE PICKER */}
      <section className="ink-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="section-label">// Game</span>
          {!isHost && (
            <span className="font-mono text-[10px] text-[color:var(--color-ink-soft)] uppercase tracking-[0.18em]">
              host only
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-0 border border-[color:var(--color-ink)]">
          {(
            [
              { id: 'castlefall', label: 'Castlefall', sub: 'words & treason' },
              { id: 'two_rooms', label: 'Two Rooms', sub: '& a Boom' },
            ] as const
          ).map((opt, i) => {
            const selected = gameType === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={!isHost || !onChangeGameType}
                onClick={() => onChangeGameType?.(opt.id)}
                className={`px-4 py-3 text-left ${i === 0 ? 'border-r border-[color:var(--color-ink)]' : ''} ${
                  selected
                    ? 'bg-[color:var(--color-ink)] text-[color:var(--color-paper-bright)]'
                    : 'bg-[color:var(--color-paper-bright)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-dim)]'
                } ${!isHost ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                <div className="font-display font-bold text-[15px] leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  {opt.label}
                </div>
                <div className={`font-mono text-[10px] uppercase tracking-[0.18em] ${selected ? 'text-[color:var(--color-paper-dim)]' : 'text-[color:var(--color-ink-soft)]'}`}>
                  {opt.sub}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* PLAYERS */}
      <section className="ink-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span className="section-label">// Court</span>
            <span className="font-mono text-[12px] text-[color:var(--color-ink)] tabular-nums font-semibold">
              {String(players.length).padStart(2, '0')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopyLink} className="btn-ghost border border-[color:var(--color-ink-soft)]">
              {copied ? '✓ Copied' : 'Copy invite'}
            </button>
            {gameType === 'castlefall' && players.length < 4 && (
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                +{4 - players.length} needed
              </span>
            )}
          </div>
        </div>

        {players.length === 0 ? (
          <div className="flex items-center gap-4 border border-dashed border-[color:var(--color-ink-soft)] px-5 py-6">
            <TowerSprite className="h-12 w-auto text-[color:var(--color-ink-soft)]" />
            <p className="text-[12px] text-[color:var(--color-ink-mid)] leading-relaxed">
              The chamber is empty. Share the invite link to summon players.
            </p>
          </div>
        ) : (
          <PlayerList players={players} currentPlayerId={currentPlayerId} isHost={isHost} onKick={onKickPlayer} />
        )}
      </section>

      {/* CASTLEFALL CONFIG */}
      {gameType === 'castlefall' && (
        <>
          <section className="ink-card p-5 space-y-3">
            <label htmlFor="word-list-select" className="section-label block">
              // Word list
            </label>
            {wordListsLoading ? (
              <div className="h-9 bg-[color:var(--color-paper-dim)] animate-pulse" />
            ) : (
              <select
                id="word-list-select"
                value={selectedList}
                onChange={(e) => setSelectedList(e.target.value)}
                className="w-full"
              >
                {wordLists.map((wl) => (
                  <option key={wl.id} value={wl.id}>
                    {wl.name}
                  </option>
                ))}
              </select>
            )}
          </section>

          <section className="ink-card overflow-hidden">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="w-full flex items-center justify-between px-5 py-3 section-label hover:text-[color:var(--color-ink)]"
            >
              <span>// Settings</span>
              <span className="text-[14px]">{settingsOpen ? '−' : '+'}</span>
            </button>
            {settingsOpen && (
              <div className="px-5 pb-5 space-y-4 animate-fade-in">
                <SettingGroup label="Word count">
                  {WORD_COUNTS.map((wc) => (
                    <SegButton key={wc} active={wordCount === wc} onClick={() => setWordCount(wc)}>
                      {wc}
                    </SegButton>
                  ))}
                </SettingGroup>
                <SettingGroup label="Declaration timer">
                  {TIMER_OPTIONS.map((opt) => (
                    <SegButton
                      key={opt.value}
                      active={timerMs === opt.value}
                      onClick={() => setTimerMs(opt.value as 30000 | 60000 | 90000)}
                    >
                      {opt.label}
                    </SegButton>
                  ))}
                </SettingGroup>
              </div>
            )}
          </section>

          <button
            onClick={() => onStartGame(selectedList, { wordCount, timerDurationMs: timerMs })}
            disabled={!canStart}
            className="btn-seal w-full !py-4 !text-[14px]"
          >
            <CastleSprite className="h-5 w-auto text-[color:var(--color-paper-bright)]" />
            {canStart ? 'Begin the round' : `Awaiting ${4 - players.length} more (${players.length}/4)`}
          </button>
        </>
      )}

      {/* TWO ROOMS CONFIG */}
      {gameType === 'two_rooms' && (
        <>
          <section className="parchment-card p-5 space-y-2 relative z-[1]">
            <h3 className="display-heading text-[18px] text-[color:var(--color-ink)]">Two Rooms &amp; a Boom</h3>
            <p className="text-[12px] text-[color:var(--color-ink-mid)] leading-relaxed">
              A hidden-role parlour game for 6–30 players. Everyone is secretly given a character.
              Players split into two rooms; each round, leaders trade hostages. The Crimson team wins
              if the Bomber ends the final round in the same room as the President. Else the Blue team
              prevails.
            </p>
          </section>
          <button
            onClick={() => onStartTwoRoomsGame?.()}
            disabled={!twoRoomsCanStart || !isHost}
            className="btn-seal w-full !py-4 !text-[14px]"
          >
            {twoRoomsCanStart
              ? 'Sound the horn'
              : players.length < 6
                ? `Awaiting ${6 - players.length} more (${players.length}/6)`
                : 'Too many players (max 30)'}
          </button>
        </>
      )}

      {/* RULES */}
      {gameType === 'castlefall' && (
        <section className="ink-card overflow-hidden">
          <button
            onClick={() => setRulesOpen(!rulesOpen)}
            className="w-full flex items-center justify-between px-5 py-3 section-label hover:text-[color:var(--color-ink)]"
          >
            <span className="flex items-center gap-2">
              <ScrollSprite className="h-3.5 w-auto" />
              // How to play
            </span>
            <span className="text-[14px]">{rulesOpen ? '−' : '+'}</span>
          </button>
          {rulesOpen && (
            <ol className="px-5 pb-4 space-y-2 text-[13px] text-[color:var(--color-ink-mid)] list-decimal list-inside marker:font-mono marker:text-[color:var(--color-ink-soft)] animate-fade-in">
              <li>All players receive the same word list, shuffled differently.</li>
              <li>You'll be secretly assigned to one of two teams. Your teammates share the same illuminated word.</li>
              <li>Give clues about your word to find teammates — but don't tip off the other team.</li>
              <li>Win by either naming your full team or guessing the other team's word.</li>
            </ol>
          )}
        </section>
      )}

      {gameType === 'two_rooms' && (
        <section className="ink-card overflow-hidden">
          <button
            onClick={() => setTwoRoomsRulesOpen(!twoRoomsRulesOpen)}
            className="w-full flex items-center justify-between px-5 py-3 section-label hover:text-[color:var(--color-ink)]"
          >
            <span className="flex items-center gap-2">
              <ScrollSprite className="h-3.5 w-auto" />
              // How to play
            </span>
            <span className="text-[14px]">{twoRoomsRulesOpen ? '−' : '+'}</span>
          </button>
          {twoRoomsRulesOpen && (
            <div className="px-5 pb-4 text-[13px] text-[color:var(--color-ink-mid)] space-y-3 animate-fade-in">
              <p>
                You'll be in one of two <strong className="text-[color:var(--color-ink)]">physically separate</strong> rooms.
                The app replaces the cards and the timer — everything else (talking, showing cards, bluffing)
                happens in person.
              </p>
              <ul className="list-disc list-inside space-y-1.5 marker:text-[color:var(--color-ink-soft)]">
                <li><strong className="text-[color:var(--color-ink)]">Goal:</strong> Crimson wins if the Bomber ends the final round in the same room as the President. Blue wins otherwise.</li>
                <li>Show your card by turning your phone toward another player. The app never reveals it to anyone else.</li>
                <li>Each room appoints a Leader (tap another player to appoint; the Leader can abdicate).</li>
                <li>Round durations: 3 min, 2 min, 1 min. Hostages per round: 1·1·1 (≤10), 2·1·1 (≤21), 3·2·1 (≤30).</li>
                <li>Between rounds: the Leader announces hostages, Leaders meet in the hallway, hostages walk to the other room, then a Leader starts the next round's timer.</li>
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] block">
        {label}
      </label>
      <div className="flex border border-[color:var(--color-ink)]">{children}</div>
    </div>
  );
}

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-[12px] font-mono uppercase tracking-[0.12em] border-r border-[color:var(--color-ink)] last:border-r-0 ${
        active
          ? 'bg-[color:var(--color-ink)] text-[color:var(--color-paper-bright)]'
          : 'bg-[color:var(--color-paper-bright)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-dim)]'
      }`}
    >
      {children}
    </button>
  );
}
