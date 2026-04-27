# Future bugs

Lower-priority issues identified during the April 2026 audit. Tracked here so they don't fall off; not blocking but worth picking up between feature work.

## Castlefall game-flow

- **Stale player team / word between rounds.** `players.team`, `assigned_word`, `word_order` are only overwritten by the next `start_game_atomic`. Between a reveal and the next start, the values from the just-finished round persist. Lobby UI doesn't currently show them (PlayerList uses `showTeams` only inside game results), but anything reading `currentPlayer.assigned_word` would see stale data. Fix: null those fields in `reveal_game` / `declare_word_atomic`, or have the lobby ignore them when `room.current_game_id` references a revealed game.

- **`reveal_votes` counts left players.** `vote_to_reveal` (now server-side count, but still) keeps every player id ever added to `reveal_votes`. If a voter leaves, their vote remains and counts toward the threshold. Fix: when reading the vote count, intersect with `select id from players where game_id = p_game_id`.

- **Empty / tiny word-list footgun.** `start_game_atomic` doesn't validate that `p_words` has at least `wordCount` distinct items, nor that the two team words differ. A custom or accidentally-duplicated list can produce a game where both teams share the same word — declare-word logic can't resolve. Fix: add `if jsonb_array_length(v_game_words) < 2 or v_team1_word = v_team2_word then raise...`.

## Realtime / presence

- **`Timer` re-fires `onExpired` across re-renders.** `src/components/Timer.tsx:25-44` depends on `[durationMs, startedAt, onExpired]`. When the parent's `onExpired` identity changes (game state ticks), the effect tears down and rebuilds; the new interval finds elapsed >= duration immediately and re-fires. `reveal_game` is idempotent so it isn't catastrophic, but it's wasteful. Fix: stash `onExpired` in a ref inside `Timer` and depend only on `[durationMs, startedAt]`.

- **Presence-leave payload shape not validated.** `src/hooks/useRoomSubscription.ts:86-107` casts each `leftPresences` entry to `PresenceState` and reads `state.playerId`. If Supabase wraps the leave payload differently than expected, `departedId` is silently `undefined` and the cleanup branch never fires — producing slow ghost-player buildup with no error surfaced. Fix: log a sample payload once, then narrow the cast / add a runtime guard.

- **`_unregistered` literal is referenced but never set.** `useRoomSubscription.ts:94` skips presences whose `playerId === '_unregistered'`, but no code path tracks that value. Either remove the branch or wire it up if the original intent was to track an "unregistered" presence pre-name.

- **Last player closing tab doesn't deactivate room.** `RoomPage.tsx:81-85` runs the deactivate effect on a client that's still alive. If the last remaining player simply closes their tab, no client survives to mark the room inactive — orphaned `active=true, players=0` rooms accumulate. Fix: deactivate from the server when `prune_stale_players` removes the last player, or in `release_disconnected_player` if it leaves the room empty.

- **`prune_stale_players` not actually scheduled.** Defined in `supabase/migrations/20250101000011_prune_stale_players.sql:5-26`, but the cron line is commented out. Without it, players in active games are now never deleted automatically (because of the `release_disconnected_player` guard), and players not in active games still rely on this never-running job. Either schedule the cron (`select cron.schedule(...)`) in production, run it on a Vercel/Supabase Edge cron, or accept manual cleanup.

## Cross-game-mode

- **Game-type cross-contamination on player rows.** `start_two_rooms_game` (`20250101000017_*`) doesn't clear `assigned_word` / `word_order` left over from a prior castlefall round, and `start_game_atomic` doesn't clear `role` left over from a prior two_rooms round. Nothing reads across game types today, so no surface symptom — but it's a footgun for future code. Fix: explicitly null the irrelevant fields in each start function.

- **`useGame.handleGameUpdate` drops updates during the new-game transition.** `src/hooks/useGame.ts:47-63` gates updates on `game?.id && updated.id === game.id`. There's a window after `current_game_id` flips where the new game's id hasn't been fetched yet and any games-table UPDATE for the new game is silently ignored. Today the explicit fetch reads committed state so it's masked, but a vote/declaration that lands inside the window is only re-observed if a *later* update follows. Fix: drop the id guard and instead trust `currentGameId` from props.

## UI / DX

- **`localStorage` not cleared cross-room (sibling of fix 5).** Switching rooms within a single tab still overwrites the single key. Reloading a now-stale older tab forces re-naming. Acceptable for now, but if multi-room sessions grow common, key by room.

- **`Chat` optimistic merge can show duplicates.** `src/components/Chat.tsx:32-43` matches optimistic messages by `(player_name, message)`. Two rapid identical sends only resolve one — the other lingers as an `optimistic-` row alongside its realtime twin.

- **No host-only check on most RPCs (kick is an outlier).** `set_room_game_type`, `start_two_rooms_game`, `appoint_leader`, etc. don't verify the caller. The lobby button is host-only client-side, but a custom client could call these directly. `start_game_atomic` was just hardened in fix 3; the others are similar one-liners.

- **`tryReconnect` swallows errors silently.** `src/hooks/usePlayers.ts:117-118, 135-136` discards the `error` from each `.single()` lookup. Today the missing-row error is the expected case, but a real network/permission error is also dropped. Fix: distinguish PGRST116 (no rows) from other errors.

- **Word list import has no size cap.** `word_lists.words` is `jsonb` with no constraint. Submitting a multi-MB list would land in the database and be loaded by every client.
