# Castlefall RPC catalog

A pointer-style index to every Postgres function the client calls. Migrations are an append-only ledger — when an RPC changes, a *new* migration redefines it via `create or replace function`, so the **latest** migration in this list is the source of truth for that function's current behaviour.

This file is documentation, not executable. If a function changes, update the "Current def" pointer here too; if you forget, `grep -l "function <name>" supabase/migrations/*.sql | sort | tail -1` will still find the truth.

## Schema (canonical: `20250101000001_initial_schema.sql`)

| Table | Purpose | Notes |
|---|---|---|
| `rooms` | One row per named room. `active=false` when empty (auto-deactivated by trigger; reactivated by `get_or_create_room`). | `current_game_id` points at the latest game; `null` between games. |
| `games` | One row per game played in a room. `status ∈ {active, revealed}`. Castlefall stores `game_words`, `team_words`, `player_teams`, declaration fields, `reveal_votes`. Two Rooms uses `game_state` JSON. | `enforce_game_state_machine` trigger blocks edits once `status='revealed'`. |
| `players` | One row per player in a room. `game_id` set while in a game; nulled by `return_to_lobby`. `role` is two-rooms-specific. | `last_seen` is the heartbeat; stale rows pruned by `prune_stale_players`. |
| `chat_messages` | Room chat history. | Free insert/select via RLS. |
| `word_lists` | Custom word-list storage (unused by current client; lists ship as static files in `public/wordlists/`). | |

## Room management

| Function | Current def | Purpose / invariants |
|---|---|---|
| `get_or_create_room(name)` | `…000008` | Returns the room id for `name`. Reactivates an inactive room with the same name; only inserts if no row exists. |
| `set_room_game_type(room_id, game_type)` | `…000012` | Switches `rooms.game_type` between `'castlefall'` and `'two_rooms'`. **No auth.** Refuses while `current_game_id is not null`. |
| `deactivate_room(room_id)` | `…000009` | Sets `rooms.active=false`. Called by the client when the last tab closes — but the trigger below now handles the case where no client survives to call it. |
| `deactivate_empty_room()` | `…000028` | Trigger function on `players AFTER DELETE`: deactivates the room when no players remain. Back-filled on install. |

## Player management

| Function | Current def | Purpose / invariants |
|---|---|---|
| `update_heartbeat(player_id)` | `…000009` | Bumps `last_seen`. **No auth.** Anyone knowing a player uuid can keep that row warm — defeats prune for that row. Needs a `players.secret` column to fix properly. |
| `leave_room(player_id)` | `…000009` | Deletes the player row. **No auth.** Same caveat. |
| `kick_player(kicker_id, target_id)` | `…000027` | Deletes the target player. **No auth** (host check was removed). `kicker_id` is in the signature for client compatibility only. |
| `release_disconnected_player(player_id)` | `…000019` | Deletes the player iff their `game_id` is null, OR their `game_id` is not the room's `current_game_id` and the game is not active. Called from the realtime presence-leave path. |
| `prune_stale_players(threshold_minutes default 5)` | `…000024` | Cron-driven cleanup of `last_seen`-stale players. Spares anyone whose `game_id` is the room's `current_game_id` (any status) OR is in an `active` game. Scheduled by `…000023` (requires `pg_cron` enabled in dashboard). |

## Castlefall game flow

| Function | Current def | Purpose / invariants |
|---|---|---|
| `start_game_atomic(room_id, caller_id, words, word_list_name, settings)` | `…000025` | Creates a new game. Locks the room row + all player rows `for update`. Requires ≥4 players. Refuses if an active game already exists. **No host check** (removed); `caller_id` is signature-only. |
| `declare_team_atomic(game_id, player_id, player_name, selected)` | `…000008` | Locks the game row, records a team declaration. Idempotent: refuses if a declaration already exists. |
| `declare_word_atomic(game_id, player_id, player_name, guessed_word)` | `…000017` | Records a word declaration. Word overrides team declarations from the same player (see migration comment). |
| `vote_to_reveal(game_id, player_id)` | `…000021` | Locks the game row, appends `player_id` to `reveal_votes`, auto-reveals when count ≥ ceil(N/2). Counts players server-side (was previously client-supplied). |
| `unvote_to_reveal(game_id, player_id)` | `…000008` | Removes a player's reveal vote. |
| `reveal_game(game_id)` | `…000008` | Resolves the winner. Locks the game `for update where status='active'` so duplicate calls are no-ops. `winner_team=null` if no declaration was made before timer expiry (treated as a draw — possible bug, see FUTURE_BUGS). |
| `return_to_lobby(room_id, caller_id)` | `…000026` | Nulls `rooms.current_game_id` and per-player game state. **No auth** (host check was removed); `caller_id` is signature-only. Locks the room row first. |

## Two Rooms game flow

| Function | Current def | Purpose / invariants |
|---|---|---|
| `start_two_rooms_game(room_id)` | `…000020` | Creates a two-rooms game, shuffles players, assigns roles (President, Bomber, Gambler, plus team cards). Requires 6–30 players. **No host check.** |
| `appoint_leader(game_id, appointer_id, target_id)` | `…000015` | Appointer must be in the same physical room as target. Idempotent if already leader. |
| `abdicate_leader(game_id, leader_id, target_id)` | `…000015` | Caller must be current leader of their room; transfers to a same-room player. |
| `usurp_leader(game_id, voter_id, target_id)` | `…000015` | Threshold vote (ceil(room_size/2)) to replace the current leader. Player-row count is unlocked — minor race (see audit). |
| `_two_rooms_drop_voter(game_id, voter_id)` | `…000015` | Helper used by `release_disconnected_player`-style cleanup to drop a voter from any pending usurp tally. |
| `select_hostages(game_id, leader_id, hostage_ids)` | `…000013` | Leader chooses hostages for the current round. Validates same-room membership. |
| `advance_round(game_id)` | `…000015` | Either room's leader can advance once both have selected hostages. Swaps players between rooms per the selected sets, increments `round`. Ends the game and scores winner after the final round. |
| `start_round_timer(game_id, leader_id)` | `…000014` | Either room's leader can start the next round's timer. Records `round_started_at`. |

## Triggers

| Trigger | Current def | Purpose |
|---|---|---|
| `enforce_game_state_machine` (on `games`) | `…000018` | Raises `Cannot modify a revealed game` on any UPDATE once `status='revealed'`. Allows the `active → revealed` transition. |
| `trg_deactivate_empty_room` (on `players AFTER DELETE`) | `…000028` | Calls `deactivate_empty_room()`; deactivates the room if no players remain. |

## Cron

| Job | Schedule | Function | Defined in |
|---|---|---|---|
| `prune-stale-players` | `*/2 * * * *` | `prune_stale_players()` | `…000023` (skipped silently if `pg_cron` extension isn't enabled in the Supabase dashboard) |

## Conventions

- All RPCs are `security definer`, `set search_path = public`. RLS on tables is read-only for most rows (see `…000009`), so writes happen exclusively through these functions.
- "**No auth**" in the tables above means the function does not verify the caller. Players uuids are readable via `players_select` RLS, so a malicious client knowing a uuid can call these. Hardening these requires adding a `players.secret` column threaded through the client; deliberately deferred.
- Multi-statement migration files (drop + create, or several creates) are wrapped in a single `DO $migration$ ... $migration$` block so they survive Supabase's transaction-pooler deploy path, which only allows one command per prepared statement. Use the `$migration$ / $sql$ / $body$` nested-tag pattern in `…000022` as a template.
- The earliest-joined player in a room used to be the "host" with extra powers (start game, return to lobby, kick, change game type). The host concept was removed in migrations `…000025–000027`; `caller_id` args remain in some signatures only for client compatibility.
