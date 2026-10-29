# Ghost Fleet V1

A standard-library-only Python 3.9+ opponent for the current C# server.

From the game lobby, click **Play vs Bot**. The C# client starts a
Python bot automatically and pairs it only with your current player connection.
The normal **Play vs player** button still uses public matchmaking. Rematch works as
usual. During bot placement and play, **Quit Game** asks for confirmation, then
stops the managed bot; its disconnect ends the unfinished match on the server
and returns the human to the lobby without a result or achievement. Home after
a completed match, reset and closing the browser also stop the managed bot.

Python 3.9+ must be installed on the computer running `Battleship.Client`, even
when the browser is on another device via `--lan`. The Python source files are
copied into client builds/publish output automatically. Set `pythonExecutable`
in `client.json` (or `BATTLESHIP_PYTHON`) if Python is not on PATH. A missing
runtime produces a visible error; public matchmaking remains available.
Rebuild and restart both the server and client for the private matchmaking
extension, and build `web/` before rebuilding the client.

Manual public-queue mode remains available from the repository root:

```sh
python3 -m bot.main --server 127.0.0.1 --seed 42
```

Use `--port` for a different TCP port or `--nickname` for another display name.
Omitting `--seed` generates a fresh seed from the operating system for each bot
process; pass `--seed` when a reproducible placement and decision sequence is useful.
A manually launched bot searches again after opponent departure or reset.
Restart the process to reconnect after socket closure; the protocol has no
session resumption. Guest games are not archived in SQLite.

## Architecture and compatibility

The current React UI sends messages through `/ws` to the C# client's TCP relay.
The server owns matchmaking, placements, hit/miss decisions, the 10-second timer,
auto-fire, and match completion. Ghost Fleet connects directly to that same TCP
server. The UI launcher intercepts only the local `playGhost` command and uses
the optional `findMatch.matchKey` field to isolate its pair from public searchers.
The server still owns all game rules; no account is required.

`feat/AI-9` was inspected read-only. Its `bot/protocol_client.py` transport and
`bot/main.py` event lifecycle are the basis of this client. Byte-oriented buffered
reading fixes its per-chunk UTF-8 decoding problem. V1 adds protocol-version
checking, duplicate-turn suppression, sunk-cell constraints, timeout-shot updates,
and clean state resets. The old branch's Random Forest shooting imitation,
JSONL history, AI proxy/service, Sonar and Decoy are not included. Current account,
profile, history and leaderboard events are additive and safely ignored.

- `engine.py`: legal placements, public shot knowledge, fleet inference and the
  `FleetPrior` extension point. No sockets, databases or enemy board input.
- `protocol_client.py`: LF-delimited UTF-8 JSON over one TCP connection; handles
  fragmentation, multiple frames, malformed lines and EOF.
- `main.py`: normal `join` → `findMatch` → `place` → `turn` / `fire` /
  `fireResult` → `matchEnd` / `rematch` lifecycle. Only results whose `by` matches
  the bot's connection ID reach its decision engine, including server auto-fire.

## Probability calculation

There are 80 possible straight four-cell ships on an 8×8 board. The engine uses
bit masks and depth-first constraint search to enumerate unordered full fleets
of four non-overlapping ships. It fixes publicly revealed sunk ships, excludes
misses and overlap, requires every hit to be covered, and excludes fully hit
ships that have not been reported sunk. Ships may touch. It prunes branches that
cannot cover the remaining hits or do not have enough slots left.

Each consistent full fleet has weight 1 in V1. For each unshot cell, its
probability is the sum of weights of fleets occupying it divided by all fleet
weights. Ship-level counters avoid updating 64 cells for every configuration.
The bot picks a maximum-probability cell with seeded tie breaking and reserves it
before sending, so it never deliberately fires at the same cell twice.

The empty board has 502,316 legal unordered fleets. Enumeration took about
0.64 seconds on the development machine. The default deadline is two seconds,
checked every 256 search nodes. A deadline-truncated randomized traversal is an
approximation and can be biased; `Estimate.complete` distinguishes it from exact
enumeration. Seeds reproduce full enumerations and decisions, but truncation
counts can vary with machine speed. This is a cooperative time budget, not a
hard real-time guarantee under OS stalls or slow custom priors.

If no positive-weight configuration is found, the budget expires before finding
one, or inference raises an exception, the bot chooses an unshot neighbor of an
unresolved hit, then an unshot checkerboard cell, then any unshot cell. With no
cells left it returns no shot. Confirmed shots and reserved attempts are kept
separately; unconfirmed attempts are never treated as misses.

## Verification

```sh
python3 -m unittest discover -s bot/tests -v
dotnet test
```

The .NET integration suite now starts the real Python bot against an isolated
C# server and a normal headless TCP client, plays a complete game, checks that
Ghost never repeats or times out, and verifies fresh placement on rematch.
It requires Python 3.9+ on PATH (`python3` on Unix, `python` on Windows); set
`BATTLESHIP_PYTHON` to override the executable. No persistent database is used.
Python tests cover exact probabilities, fleet weights, legal placements,
constraints, touching/sunk ships, fallbacks, reproducibility, public-information
isolation, UTF-8 fragmentation, lifecycle events and three simulated full games.

## Future V2 and V3

Implement `FleetPrior.weight(fleet)` with finite nonnegative weights to reuse the
same constraints and decision engine. V2 should supply global placement priors;
V3 should combine those with opponent-specific priors. Providers should load or
train outside the turn loop and perform only fast in-memory scoring here.
Account-ID resolution and authorized historical placement access still need a
separate design: the current guest bot sees connection IDs, not Account IDs, and
has no SQLite access. No ML, history loading, schema changes or data files are
part of V1.
