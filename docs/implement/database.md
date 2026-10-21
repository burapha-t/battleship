# Database

**Status:** DB-1 (#32) and DB-2 (#48) are built. The server saves every finished match between two logged-in players. Login (LOGIN-1, #46) isn't built yet, so for now every player is a guest and nothing is saved.

This file is the source of truth for the database. A copy for the whole team is in the planning
Google Doc, tab **db_schema**:
https://docs.google.com/document/d/1EQsVljB-CXfQDqPcvr6YnMYyff8McchEi7tznxaSmx8/edit?tab=t.1atkk7z8hgfu.
A change to a table updates this file in the same pull request, and the Google Doc after it merges.

---

## 1. Overview

- One SQLite file. Only the game server opens it.
- Clients (Computer B, browsers, other devices) never touch the file. They ask the server over the game connection, and the server reads or writes the file and answers.
- Library: Microsoft.Data.Sqlite 8.0.11 with plain SQL (no Entity Framework).
- Code: src/Battleship.Server/Data/GameDatabase.cs, and DatabaseWorker.cs, which runs every database job on one background task. Tests: tests/Battleship.Server.Tests/GameDatabaseTests.cs and MatchArchiveTests.cs.
- Why SQLite: no database server to install, everything is one file, and it ships inside the demo build for Windows, Mac and Linux.

## 2. Where the file lives

On the host computer (the one running the server), in the app-data folder:

- Mac: ~/Library/Application Support/battleship/battleship.db
- Windows: %LOCALAPPDATA%\battleship\battleship.db
- Linux: ~/.local/share/battleship/battleship.db

Good to know:

- The server prints the exact path when it starts ("Database: ...").
- It is not beside the server program, because scripts/publish.sh and publish.ps1 delete that folder on every rebuild, which would wipe all accounts.
- Never commit it. `*.db` is in .gitignore.
- To start fresh: stop the server and delete the file. It is created again on the next start.
- To look inside: the free app "DB Browser for SQLite", or `sqlite3 <path>` in a terminal.

## 3. Tables

Six tables. Times are stored as text in UTC (ISO 8601, e.g. 2026-10-19T07:00:00.0000000+00:00). True/false values are stored as 1/0. An arrow (→) means the column points to a row in another table.

### users: one row per account

| Column | Type | Meaning |
|---|---|---|
| `id` | INTEGER | Account id, given by the database |
| `username` | TEXT | Unique, ignoring case. Stored as typed |
| `salt` | BLOB | Random bytes used when hashing the password |
| `hash` | BLOB | The hashed password (the password itself is never stored) |
| `iterations` | INTEGER | Hashing rounds, kept so they can be raised later |
| `avatar` | TEXT | Chosen profile picture. Empty until that feature is built |
| `created_at` | TEXT | When the account was made |

### matches: one row per finished match

| Column | Type | Meaning |
|---|---|---|
| `id` | INTEGER | Match id, given by the database |
| `started_at` | TEXT | When the match started |
| `ended_at` | TEXT | When the match ended |
| `winner_id` | INTEGER | → users.id of the winner |

### match_players: two rows per match, one per player

A summary of each player's side of a match, so history and stats don't need to scan every shot. shots, hits and best_streak are counted from the shots table when the match is saved, and never change afterwards.

| Column | Type | Meaning |
|---|---|---|
| `match_id` | INTEGER | → matches.id |
| `user_id` | INTEGER | → users.id |
| `opponent_name` | TEXT | The opponent's username at the time |
| `won` | INTEGER | 1 = won, 0 = lost |
| `shots` | INTEGER | Shots this player fired |
| `hits` | INTEGER | How many of them hit |
| `best_streak` | INTEGER | Longest run of hits in a row |

### shots: every shot of every match

| Column | Type | Meaning |
|---|---|---|
| `match_id` | INTEGER | → matches.id |
| `turn` | INTEGER | 1, 2, 3, … (one shot per turn) |
| `by_user_id` | INTEGER | → users.id of the shooter |
| `row` | INTEGER | 0–7, top to bottom |
| `col` | INTEGER | 0–7, left to right |
| `hit` | INTEGER | 1 = hit, 0 = miss |
| `auto` | INTEGER | 1 = fired by the 10-second timeout |

### fleets: where each player's ships were

One row per ship cell: 4 ships × 4 cells = 16 rows per player per match. The AI ghost fleet and decoy can learn from this where a player likes to hide ships.

| Column | Type | Meaning |
|---|---|---|
| `match_id` | INTEGER | → matches.id |
| `user_id` | INTEGER | → users.id of the ship owner |
| `ship` | INTEGER | Which ship, 0–3 |
| `row` | INTEGER | 0–7 |
| `col` | INTEGER | 0–7 |

### achievements: badges a player has unlocked

Each badge at most once per player. The badge codes are not decided yet; they come with the achievements issue.

| Column | Type | Meaning |
|---|---|---|
| `user_id` | INTEGER | → users.id |
| `code` | TEXT | Which badge (names to be decided) |
| `unlocked_at` | TEXT | When it was unlocked |
| `match_id` | INTEGER | → matches.id of the match that unlocked it |

## 4. Rules

1. Save raw facts, work out stats with queries. Win rate, accuracy, the leaderboard and badge checks are queries. We don't keep running totals, because totals drift away from the matches.
2. Only finished matches are saved, all in one go (one transaction): the match, both players, every shot and both fleets. If anything fails, nothing from that match is saved. Disconnects and abandoned matches are not saved.
3. Only the server touches the file. Database work runs outside the game loop, so a slow disk never delays a turn.
4. Dashboard RESET clears the current session scores only. It never deletes accounts, history or badges.
5. Usernames are unique ignoring case: Alice and alice cannot both exist. The name is shown as it was typed.
6. Passwords are never stored, only a salted hash.
7. Every shot keeps its auto flag (fired by the 10-second timeout), so we can decide later whether those shots count toward accuracy.
8. Schema version: the file has user_version = 1. Whoever changes a table must raise the version and add an upgrade step. A server refuses a file made by a newer version instead of changing it.

## 5. How each feature uses it

| Feature | Tables | How |
|---|---|---|
| Login | users | Find by username, check the password hash |
| Match history: stats | match_players | Matches = count, wins = sum of won, win rate = wins / matches, accuracy = hits / shots |
| Match history: list | match_players, matches | My rows, newest first: win/lose, opponent, date and time, accuracy |
| Leaderboard | match_players, users | All-time. Points = wins. Rank by points, then accuracy (hits / shots, timeout shots included), then name A–Z; ties on both share a rank. Top 50, accounts with a saved match only |
| Badges: wins | match_players | Count of won = 1 reaches 5, 10, 20, 50, 100 |
| Badges: accuracy | match_players | hits / shots in one match above 40, 50, 60, 70, 80% |
| Badges: hit streak | match_players | best_streak in one match reaches the tier |
| Profile picture | users | avatar column |
| AI ghost fleet, decoy | fleets, shots | Where a player hides ships and how they shoot |
| Kill streak popup | none | The web counts hits live from fireResult |
| Language, sound, settings | none | Saved in the browser |

Example: the stats at the top of the match history screen, for one player:

```sql
SELECT COUNT(*)                                        AS matches,
       SUM(won)                                        AS wins,
       COUNT(*) - SUM(won)                             AS losses,
       ROUND(100.0 * SUM(won)  / COUNT(*), 1)           AS win_rate,
       ROUND(100.0 * SUM(hits) / NULLIF(SUM(shots), 0), 1) AS accuracy
FROM match_players
WHERE user_id = $me;
```

Example: the match list on the same screen, newest first:

```sql
SELECT mp.won, mp.opponent_name, m.ended_at,
       ROUND(100.0 * mp.hits / NULLIF(mp.shots, 0), 1) AS accuracy
FROM match_players mp JOIN matches m ON m.id = mp.match_id
WHERE mp.user_id = $me
ORDER BY m.ended_at DESC;
```

## 6. Code: GameDatabase

- new GameDatabase(path): opens the file, or creates it and the tables if missing.
- GameDatabase.DefaultPath(): the app-data path from section 2.
- CreateUser(username, salt, hash, iterations): adds an account and returns its id, or null if the name is taken.
- FindUser(username): the account, or null. Ignores case.
- SaveMatch(match): saves one finished match in one transaction and returns its id.
- GetHistory(userId, page): one player's stats and 20 matches, newest first (HIST-1). The server calls it on DatabaseWorker and sends the result as `history`.
- GetLeaderboard(): the top 50 accounts, ranked (LB-1). The server calls it on DatabaseWorker and sends the result as `leaderboard`.

Read methods for badges come with their own issue.

How a match gets saved (DB-2):

- Each player's roster record has a UserId: the account id once logged in, null for a guest. LOGIN-1 sets it.
- A match takes both UserIds when it starts. At matchEnd, if both were set, MatchEngine hands a MatchRecord to DatabaseWorker, which saves it on its background task. A failed save is logged; the game carries on.
- Disconnects, RESET mid-match and guests save nothing. A rematch is saved as its own match.

## 7. Plan

Issue codes after DB-1 are proposals until the issues are created.

| Issue | What | Status |
|---|---|---|
| DB-1 (#32) | Database file, tables, GameDatabase | Built (PR #33) |
| LOGIN-1 (#46) | Signup and login over the game connection, password hashing | Not started. Sets PlayerRecord.UserId |
| DB-2 (#48) | Save each finished match with SaveMatch | Built. Saves nothing until LOGIN-1 sets UserId |
| HIST-1 (#49) | History request and reply (`historyList` / `history`, protocol.md) | Built |
| LB-1 (#44) | Leaderboard request and reply (`leaderboardGet` / `leaderboard`, protocol.md) | Built |
| Achievements (server) | Check badges at match end, tell the player | Not started (needs DB-2) |
| Profile picture (server) | Save the chosen avatar | Not started (needs AUTH-1) |

## 8. Open questions

- Password length: the planning doc's Description tab says 4–16 characters; older drafts used 8–64 and 8–128. Pick one.
- Hit-streak badge tiers are listed as 5, 7, 6, 8, 9. Probably meant 5, 6, 7, 8, 9?
- Badge codes (names) for the achievements table.
