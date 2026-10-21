# Battleship Wire Protocol — v1

**Status: FROZEN.** Every lane in the project depends on this document.

A change to this file must land in the same pull request as the matching changes
to `web/src/protocol.ts` and the C# DTOs in `Battleship.Core`. If those three
disagree, this document wins.

---

## 1. Transport

| Property | Value |
|---|---|
| Protocol | TCP |
| Server port | `5050` |
| Encoding | UTF-8 |
| Framing | One JSON object per line, terminated by `\n` (LF, not CRLF) |
| Connections | Exactly one long-lived socket per client |

Every frame is a **single-line JSON object** with a `"type"` field. No frame may
contain a literal newline — JSON string escaping (`\n`) is required if a value
ever needs one.

`StreamReader.ReadLineAsync()` (C#), `readline` over a buffered socket (Python),
and a split-on-`\n` accumulator (the client's bridge) all satisfy this framing
without extra work.

### Robustness rules — all three implementations must obey these

1. **Ignore unknown `type` values.** Do not error, do not disconnect. This is what
   makes extra features additive rather than breaking.
2. **Ignore unknown fields** in a known message. Same reason.
3. **A malformed line is skipped, not fatal.** Log it; keep the connection open.
4. **Never assume frame boundaries match TCP reads.** One read may contain two
   messages, half a message, or both. Buffer until you see `\n`.

Rules 1 and 2 are the reason extras can be added in week 4 without a protocol
re-freeze. Take them seriously in week 1.

---

## 2. Conventions

### Coordinates

Zero-indexed. `row` is 0 (top) to 7 (bottom); `col` is 0 (left) to 7 (right).
A cell is the pair `[row, col]`. The grid is 8×8, so both are in `0..7`.

### Ships

A ship is an array of exactly 4 cells: `[[r,c],[r,c],[r,c],[r,c]]`. A placement is
an array of exactly 4 ships. Ships must be straight (all same row or all same
column), contiguous, in bounds, and non-overlapping.

### Player identity

The server assigns each connection an `id` string (e.g. `"p1"`) at connect time,
stable for the life of that connection. All messages refer to players by `id`,
never by nickname.

### Perspective-free messages — the core design rule

**The server sends both players the same bytes.** No `"your": true`, no
`"youWin"`. A message names the player it concerns by `id`, and each client
derives its own perspective by comparing against the `id` it received in
`connected`.

This costs nothing now and buys three things: the Python bot needs no special
casing, spectators become nearly free, and a recorded match replays correctly for
either side.

### Message direction

`C→S` client to server (11 verbs) · `S→C` server to client (17 events)

| Type | Dir | Sent when |
|---|---|---|
| `connected` | S→C | Immediately on TCP accept |
| `join` | C→S | Player submits a nickname |
| `welcome` | S→C | Nickname accepted |
| `lobby` | S→C | Any client connects, names itself, changes state, or leaves |
| `findMatch` | C→S | Player presses *Start game* in the lobby |
| `matchStart` | S→C | Two searching players are paired, or both asked for a rematch |
| `place` | C→S | Player finishes placing 4 ships |
| `placed` | S→C | Placement accepted |
| `turn` | S→C | A turn begins |
| `fire` | C→S | Active player selects a target cell |
| `fireResult` | S→C | A shot resolves (including a timeout auto-fire) |
| `matchEnd` | S→C | All 4 of one player's ships are sunk |
| `rematch` | C→S | Player presses Rematch |
| `rematchPending` | S→C | One player has asked for a rematch |
| `leave` | C→S | Player presses Home after a match ends |
| `opponentLeft` | S→C | The other player's socket closed, or they went back to the lobby |
| `reset` | S→C | The dashboard RESET button was pressed |
| `historyList` | C→S | Player opens Match history, or scrolls to the next page |
| `history` | S→C | Reply to `historyList` |
| `leaderboardGet` | C→S | Player opens the Leaderboard |
| `leaderboard` | S→C | Reply to `leaderboardGet` |
| `achievementsGet` | C→S | Player opens Badges |
| `achievements` | S→C | Reply to `achievementsGet` |
| `achievementUnlocked` | S→C | A saved match earned the player new badges |
| `profileGet` | C→S | Player opens Profile |
| `profileUpdate` | C→S | Player presses Save profile |
| `profile` | S→C | Reply to `profileGet` or `profileUpdate` |
| `error` | S→C | A client message was rejected |

---

## 3. Client state machine

```
      TCP connect
           │
           ▼
   ┌───────────────┐  join    ┌────────┐  findMatch  ┌───────────┐
   │  CONNECTING   │─────────►│  IDLE  │────────────►│ SEARCHING │
   └───────────────┘ welcome  └────────┘             └───────────┘
                                  ▲                         │ matchStart
                                  │                         ▼
                                  │                   ┌──────────┐
                                  │                   │ PLACING  │
                                  │                   └──────────┘
                                  │                         │ place
                                  │                         ▼ placed
                                  │                   ┌──────────┐
                    opponentLeft  │        turn ─────►│ PLAYING  │
                    reset         │        fire  ◄────│          │
                                  │        fireResult └──────────┘
                                  │                         │ matchEnd
                                  │                         ▼
                                  │                   ┌──────────┐
                                  └───────────────────│ MATCHEND │
                                       matchStart     └──────────┘
                                    (both rematched)     rematch
                                    leave / opponentLeft → IDLE
```

`PLACING` is entered on every `matchStart`, including rematches — boards are
cleared and both players place again. A rematch goes straight from `MATCHEND` to
`PLACING`; it never passes through `SEARCHING`.

`IDLE` means "in the lobby, not looking for a match". The server never pairs an
`IDLE` player. Every return to `IDLE` (`leave`, `opponentLeft`, `reset`) needs a new
`findMatch` before the player is paired again.

---

## 4. Server → Client messages

### `connected`

First frame on every connection, before anything else.

```json
{"type":"connected","id":"p1","protocolVersion":1}
```

A client receiving a `protocolVersion` it does not support should show an error
and stop, rather than proceeding and failing confusingly later.

### `welcome`

```json
{"type":"welcome","id":"p1","nickname":"Alice"}
```

The UI renders `"Welcome, Alice."` from this. The server may have altered the
submitted nickname (trimming, de-duplication) — **use the value returned here**,
not the one that was sent.

### `lobby`

Broadcast to every named client whenever the roster changes. This satisfies both
"the server provides information about the other connected clients" and the
dashboard's own display.

```json
{"type":"lobby","count":3,"clients":[
  {"id":"p1","name":"Alice","status":"in-match"},
  {"id":"p2","name":"Bob","status":"in-match"},
  {"id":"p3","name":"Carol","status":"idle"}
]}
```

`count` equals the length of `clients` and is sent explicitly so the dashboard
needs no derivation. Every connected client is listed, including one that has not
joined yet: its `name` is `null` until its `welcome`.

| `status` | From | Until |
|---|---|---|
| `"connecting"` | TCP accept — socket open, no nickname yet | `welcome` |
| `"idle"` | `welcome`, `leave`, `opponentLeft` or `reset` | `findMatch` |
| `"searching"` | `findMatch` — pressed *Start game*, waiting for an opponent | `matchStart` or `reset` |
| `"placing"` | `matchStart`, rematches included | the match's first `turn`, `opponentLeft` or `reset` |
| `"in-match"` | the match's first `turn` | a rematch's `matchStart`, `leave`, `opponentLeft` or `reset` |

Both players in a match change status together. A player stays `"in-match"`
after `matchEnd`; there is no match-over status. A client that disconnects
leaves the list.

Whatever changes the roster — a client message, a disconnect, a RESET — produces
one `lobby`, sent after its other frames and showing the result. When a second
`findMatch` completes a pair, the server sends `matchStart` to both players, then
one `lobby` with both `"placing"`; the second player never appears as
`"searching"`.

### `matchStart`

```json
{"type":"matchStart","matchId":"m1","players":[
  {"id":"p1","name":"Alice","score":1},
  {"id":"p2","name":"Bob","score":0}
],"firstPlayerId":"p1"}
```

`players` always has exactly 2 entries and carries current scores, so the UI can
render both names and scores from this one message. Every match has its own
`matchId`, rematches included.

`firstPlayerId` is **random** for a first match, and is the **previous match's
winner** for a rematch.

On receipt: clear both boards and enter `PLACING`. `firstPlayerId` matters only
once placement finishes.

### `placed`

```json
{"type":"placed","id":"p1"}
```

Sent to **both** players, so each can show "waiting for opponent" accurately. A
rejected placement produces an `error` instead, and that player stays in
`PLACING`.

### `turn`

```json
{"type":"turn","activePlayerId":"p1","seconds":10,"turnNumber":1}
```

Sent to both players when a turn begins. `seconds` is always `10`; it is on the
wire so the UI never hardcodes it. `turnNumber` starts at 1 in every match,
rematches included, and increments for every turn.

The client starts its countdown on receipt. **The countdown is display only —
the server's timer is authoritative.** Never let the client decide a turn expired.

### `fireResult`

Sent to both players after every shot.

```json
{"type":"fireResult","by":"p1","target":"p2","row":3,"col":5,
 "result":"hit","sunk":true,"sunkCells":[[3,2],[3,3],[3,4],[3,5]],
 "allSunk":false,"auto":false}
```

| Field | Meaning |
|---|---|
| `by` | id of the player who fired |
| `target` | id of the player who was fired upon |
| `result` | `"hit"` or `"miss"` |
| `sunk` | `true` if this shot completed a ship |
| `sunkCells` | the 4 cells of the sunk ship, or `null` when `sunk` is `false` |
| `allSunk` | `true` if this shot sank the target's last ship |
| `auto` | `true` if the server fired this shot because the turn timer expired |

`sunkCells` is only ever populated for a ship that is already fully sunk, so it
reveals nothing hidden. It lets the UI draw the whole destroyed ship at once.

When `auto` is `true`, the UI should say so — "Alice ran out of time" reads far
better in a demo than a shot appearing from nowhere.

### `matchEnd`

```json
{"type":"matchEnd","matchId":"m1","winnerId":"p1","players":[
  {"id":"p1","name":"Alice","score":2},
  {"id":"p2","name":"Bob","score":0}
]}
```

Scores in `players` are already updated (winner +1). The client compares
`winnerId` against its own id to display **Win** or **Lost**, and shows the
Rematch button.

### `rematchPending`

```json
{"type":"rematchPending","from":"p1"}
```

Sent to both. The requester's UI shows "waiting for opponent"; the other side
shows "Alice wants a rematch". When the second `rematch` arrives, the server
sends a fresh `matchStart` instead of another `rematchPending`.

### `opponentLeft`

```json
{"type":"opponentLeft","id":"p2"}
```

Sent when the other player's socket closes, or when they send `leave`. The remaining player returns to `IDLE` and must send `findMatch` again to be
paired. Scores are retained — a disconnect is not a loss, and awarding a win for
it would be trivially exploitable in a demo.

### `reset`

```json
{"type":"reset"}
```

Triggered by the dashboard RESET button. Every client abandons any match, clears
its board, zeroes both scores, and returns to `IDLE`. A fresh `lobby` follows.
Searching players stop searching too — after a reset nobody is paired until
they send `findMatch` again.

### `history`

The reply to `historyList`, sent only to the player who asked, and only ever
about that player. Added with HIST-1, under the ignore-unknown rules (§1).

```json
{"type":"history","page":1,
 "stats":{"matchCount":12,"winCount":8,"loseCount":4,"winRate":66.7,"accuracy":50.4},
 "matches":[
  {"won":true,"opponent":"Bob","endedAt":"2026-10-19T07:00:00Z","accuracy":57.1},
  {"won":false,"opponent":"Carol","endedAt":"2026-10-18T19:42:00Z","accuracy":38.5}
 ],"more":false}
```

| Field | Meaning |
|---|---|
| `page` | The page this is, from 1 (the newest) |
| `stats` | Totals over all of the player's saved matches, whatever the page |
| `stats.winRate` | wins ÷ matches, as a percentage with one decimal; `0` with no matches |
| `stats.accuracy` | hits ÷ shots over all matches, as a percentage with one decimal |
| `matches` | Up to 20 matches, newest first |
| `won` | `true` if this player won that match |
| `opponent` | The opponent's username at the time |
| `endedAt` | When the match ended, UTC, ISO 8601 (`…Z`). The UI shows it in local time |
| `accuracy` | This player's hits ÷ shots in that match, a percentage with one decimal |
| `more` | `true` if an older page exists |

Only finished matches between two logged-in players are saved
(`docs/implement/database.md`), so a guest always gets zeros, no matches and
`more: false`. Every shot counts toward accuracy, timeout auto-shots included.

### `leaderboard`

The reply to `leaderboardGet`, sent only to the player who asked. Added with
LB-1, under the ignore-unknown rules (§1).

```json
{"type":"leaderboard","rows":[
  {"rank":1,"name":"Alice","points":11,"accuracy":62.5},
  {"rank":1,"name":"Bob","points":11,"accuracy":62.5},
  {"rank":3,"name":"Carol","points":7,"accuracy":48.0}
]}
```

| Field | Meaning |
|---|---|
| `rows` | Up to 50 players, best first; empty when nobody has a saved match |
| `rank` | 1 for the best. Players tied on `points` and `accuracy` share a rank: 1, 1, 3 |
| `name` | The account's username |
| `points` | Total wins over all the player's saved matches |
| `accuracy` | hits ÷ shots over all their saved matches, a percentage with one decimal; `0` with no shots |

All-time, from every saved match (`docs/implement/database.md`); a dashboard
RESET doesn't change it. Only accounts with at least one saved match are listed.
Rows are ordered by `points`, then `accuracy` (both highest first), then `name`
A–Z ignoring case. Every shot counts toward accuracy, timeout auto-shots included.

### `achievements`

The reply to `achievementsGet`, sent only to the player who asked, and only ever
about that player. Added with ACH-1 (#41), under the ignore-unknown rules (§1).

```json
{"type":"achievements","wins":12,"bestAccuracy":64.3,"bestStreak":7,"badges":[
  {"code":"wins-5","unlockedAt":"2026-10-12T07:00:00Z"},
  {"code":"accuracy-40","unlockedAt":"2026-10-15T19:42:00Z"}
]}
```

| Field | Meaning |
|---|---|
| `wins` | Total wins over all the player's saved matches |
| `bestAccuracy` | Best hits ÷ shots in one match, a percentage with one decimal; `0` with no matches |
| `bestStreak` | Longest run of hits in a row in one match; `0` with no matches |
| `badges` | Every badge the player owns, oldest first; badges unlocked together are in the order of the table below |
| `code` | One of the 15 badge codes below |
| `unlockedAt` | When it was unlocked (the end of the match that earned it), UTC, ISO 8601 (`…Z`) |

There are 15 badges in three groups of five. Each is owned at most once.

| Codes | Earned when |
|---|---|
| `wins-5`, `wins-10`, `wins-20`, `wins-50`, `wins-100` | Total wins reach the number |
| `accuracy-40`, `accuracy-50`, `accuracy-60`, `accuracy-70`, `accuracy-80` | Accuracy in one match is strictly over the number (40.0% is not over 40) |
| `streak-4`, `streak-6`, `streak-8`, `streak-10`, `streak-12` | The longest run of hits in one match reaches the number |

Every shot counts toward accuracy, timeout auto-shots included. A timeout
auto-shot breaks a hit streak, even one that hits, the same as the in-game
streak (#40). The loser of a match can earn
accuracy and streak badges. Only saved matches count, so a guest always gets
zeros and no badges (`docs/implement/database.md`).

### `achievementUnlocked`

Sent after `matchEnd`, only to a player whose match was saved and earned them
badges they didn't own yet. Never sent to guests, nor when nothing is new.
Added with ACH-1 (#41).

```json
{"type":"achievementUnlocked","matchId":"m1","badges":[
  {"code":"accuracy-40","unlockedAt":"2026-10-19T07:00:00Z"},
  {"code":"streak-4","unlockedAt":"2026-10-19T07:00:00Z"}
]}
```

| Field | Meaning |
|---|---|
| `matchId` | The `matchId` from that match's `matchEnd` |
| `badges` | Only the new badges, in the order of the `achievements` table. One match can earn several |

The server saves the match first and checks badges afterwards, off the game
loop, so this arrives a moment after `matchEnd` and may come after a rematch's
`matchStart`. The UI shows it with the result of `matchId` and ignores it
otherwise; the badges are owned either way.

### `profile`

The reply to `profileGet`, and to a `profileUpdate` that was saved. Sent only to
the player who asked, and only ever about that player. Added with #42, under the
ignore-unknown rules (§1).

```json
{"type":"profile","guest":false,"avatar":"pufferfish","shownBadges":["wins-5","accuracy-70","streak-6"],"rank":3,"wins":8}
```

| Field | Meaning |
|---|---|
| `guest` | `true` when the player isn't logged in. A guest can't save a profile, so the UI disables Save |
| `avatar` | The chosen picture, one of the codes under `profileUpdate`, or `""` for none (the UI shows the name's first letter) |
| `shownBadges` | 0–3 badge codes to show, in the player's order |
| `rank` | The player's place on the leaderboard (`leaderboard`), counted over every account, not only the top 50; `null` with no saved match |
| `wins` | Total wins over all the player's saved matches |

Earned badges and best accuracy and streak are in `achievements`; the profile
screen asks for both. A guest gets `"guest":true`, `""`, `[]`, `null` and `0`.

### `error`

```json
{"type":"error","code":"not-your-turn","message":"It is not your turn."}
```

`code` is for UI branching, `message` is human-readable text safe to display.
Errors never change client state — the client stays where it was.

| `code` | Cause |
|---|---|
| `bad-nickname` | Empty, too long, or otherwise rejected |
| `invalid-placement` | Failed `PlacementValidator` — `message` says why |
| `not-your-turn` | `fire` from the player who is not active |
| `already-fired` | That cell was already targeted this match |
| `out-of-range` | `row` or `col` outside `0..7` |
| `not-in-match` | `findMatch`, `place`, `fire`, `rematch`, or `leave` sent in the wrong state |
| `invalid-profile` | `profileUpdate` broke a rule under it — `message` says which. Nothing was saved |
| `not-logged-in` | A guest sent `profileUpdate` |
| `unknown` | Anything else, e.g. the match history, the leaderboard, the badges or the profile couldn't be read or saved |

---

## 5. Client → Server messages

### `join`

```json
{"type":"join","nickname":"Alice"}
```

Nickname is trimmed and must be 1–16 characters after trimming. The server may
de-duplicate (`"Alice"` → `"Alice (2)"`); the authoritative result comes back in
`welcome`. Sent once, in `CONNECTING`.

### `findMatch`

```json
{"type":"findMatch"}
```

Sent when the player presses *Start game*. Valid only in `IDLE`. The player's
lobby status becomes `"searching"`, and the server pairs them as soon as a second
player is searching. Sending it again while `SEARCHING` is idempotent — ignored,
not an error. There is no cancel in v1: a searching player stays searching until
paired or disconnected.

### `place`

```json
{"type":"place","ships":[
  [[0,0],[0,1],[0,2],[0,3]],
  [[2,1],[3,1],[4,1],[5,1]],
  [[7,0],[7,1],[7,2],[7,3]],
  [[1,6],[2,6],[3,6],[4,6]]
]}
```

Exactly 4 ships of exactly 4 cells. **The server re-validates everything** — the
client's own validation is a convenience for the player, never a trust boundary.

### `fire`

```json
{"type":"fire","row":3,"col":5}
```

Valid only from the active player during `PLAYING`. The target is implicit: you
always fire at your opponent.

### `rematch`

```json
{"type":"rematch"}
```

Valid only in `MATCHEND`. Sending it twice is idempotent — the second is ignored,
not an error.

### `leave`

```json
{"type":"leave"}
```

The player pressed **Home** on the end screen instead of Rematch. Valid in
`MATCHEND`, and in `PLACING` for the race where the opponent's rematch starts a
new match just as the player presses Home. The match and any pending rematch are
dropped, both players return to `IDLE` and keep their scores, and the other
player gets `opponentLeft`. The sender gets no reply beyond the `lobby` update;
its UI goes home on its own and ignores a `matchStart` until a `lobby` lists it
`idle`. From `PLAYING` or `SEARCHING` it is `not-in-match`. From `IDLE` (both
players pressed Home) it is ignored.

### `historyList`

```json
{"type":"historyList","page":1}
```

Asks for one page of the sender's own match history; the server replies with
`history`. `page` starts at 1 (the newest 20 matches); a missing `page`, or one
below 1, means 1. Valid in any state and changes none. There is no way to ask
for another player's history.

### `leaderboardGet`

```json
{"type":"leaderboardGet"}
```

Asks for the leaderboard; the server replies with `leaderboard`. Valid in any
state and changes none. A guest may ask too: the leaderboard isn't personal.

### `achievementsGet`

```json
{"type":"achievementsGet"}
```

Asks for the sender's own badges and best stats; the server replies with
`achievements`. Valid in any state and changes none. There is no way to ask for
another player's badges.

### `profileGet`

```json
{"type":"profileGet"}
```

Asks for the sender's own profile; the server replies with `profile`. Valid in
any state and changes none. A guest gets an empty profile with `"guest":true`.

### `profileUpdate`

```json
{"type":"profileUpdate","avatar":"pufferfish","shownBadges":["wins-5","accuracy-70","streak-6"]}
```

Saves the sender's picture and the badges they show, both at once; the server
replies with the saved `profile`. Valid in any state; changes no game state.
Both fields are required:

- `avatar`: `""` (no picture) or one of `whale`, `octopus`, `crab`,
  `pufferfish`, `turtle`, `jellyfish`, `starfish`, `shark`. Case matters.
- `shownBadges`: at most 3 codes, no repeats, each one a badge the player has
  earned (`achievements`).

Anything else gets `error` `invalid-profile` and saves nothing. A guest gets
`error` `not-logged-in`.

---

## 6. Full match sequence

```
Alice(p1)                      Server                      Bob(p2)
    │                             │                            │
    │◄──── connected p1 ──────────┤                            │
    ├───── join "Alice" ─────────►│                            │
    │◄──── welcome ───────────────┤                            │
    │◄──── lobby (1) ─────────────┤                            │
    │                             ├──── connected p2 ─────────►│
    │◄──── lobby (2) ─────────────┤                            │  p2 listed "connecting"
    │                             │◄─── join "Bob" ────────────┤
    │◄──── lobby (2) ─────────────┼──── welcome, lobby ───────►│
    │                             │                            │
    ├───── findMatch ────────────►│                            │  p1 → SEARCHING
    │◄──── lobby ─────────────────┼──── lobby ────────────────►│
    │                             │◄─── findMatch ─────────────┤  p2 → SEARCHING
    │◄──── matchStart ────────────┼──── matchStart ───────────►│  both → PLACING
    │◄──── lobby ─────────────────┼──── lobby ────────────────►│  both listed "placing"
    ├───── place ────────────────►│                            │
    │◄──── placed p1 ─────────────┼──── placed p1 ────────────►│
    │                             │◄─── place ─────────────────┤
    │◄──── placed p2 ─────────────┼──── placed p2 ────────────►│
    │                             │                            │
    │◄──── turn (active p1) ──────┼──── turn (active p1) ─────►│  both → PLAYING
    │◄──── lobby ─────────────────┼──── lobby ────────────────►│  both listed "in-match"
    ├───── fire 3,5 ─────────────►│                            │
    │◄──── fireResult hit ────────┼──── fireResult hit ───────►│
    │◄──── turn (active p2) ──────┼──── turn (active p2) ─────►│
    │                             │   (10 s elapse, no fire)   │
    │◄──── fireResult auto ───────┼──── fireResult auto ──────►│
    │                             │             ...            │
    │◄──── fireResult allSunk ────┼──── fireResult allSunk ───►│
    │◄──── matchEnd winner p1 ────┼──── matchEnd winner p1 ───►│  both → MATCHEND
    ├───── rematch ──────────────►│                            │
    │◄──── rematchPending p1 ─────┼──── rematchPending p1 ────►│
    │                             │◄─── rematch ───────────────┤
    │◄──── matchStart ────────────┼──── matchStart ───────────►│  p1 first (won)
    │◄──── lobby ─────────────────┼──── lobby ────────────────►│  both listed "placing"
```

---

## 7. Server rules the protocol depends on

Server obligations, not client concerns, but every implementer should know them.

1. **Matchmaking** pairs the first two `searching` players. `idle` players are
   never paired. A third client stays in the lobby and receives `lobby` updates
   only.
2. **The turn timer is 10 seconds**, started when `turn` is sent. On expiry the
   server fires a uniformly random cell the active player has not yet targeted,
   and emits `fireResult` with `auto: true`. A match can therefore never stall on
   an absent player.
3. **Ship positions are never transmitted to the opponent.** The only board
   information crossing to the other player is `fireResult`. Verify by inspecting
   WebSocket frames in browser devtools — it is a requirement, and worth showing
   a grader.
4. **The server owns both boards.** A client that lies about a hit changes nothing.
5. **Scores** persist across rematches and reset to zero only on `reset`.

---

## 8. Implementation notes

### TypeScript — `web/src/protocol.ts`

Model server events as a discriminated union on `type`. A `switch` over it in the
reducer then fails to compile whenever an event is added but not handled — the
reason TypeScript is on this project.

```ts
export type PlayerInfo = { id: string; name: string; score: number };
export type Cell = [row: number, col: number];

export type ServerEvent =
  | { type: "connected"; id: string; protocolVersion: number }
  | { type: "welcome"; id: string; nickname: string }
  | { type: "turn"; activePlayerId: string; seconds: number; turnNumber: number }
  // ...one variant per section 4 message
  ;

export type ClientVerb =
  | { type: "join"; nickname: string }
  | { type: "findMatch" }
  | { type: "place"; ships: Cell[][] }
  | { type: "fire"; row: number; col: number }
  | { type: "rematch" }
  | { type: "leave" }
  | { type: "historyList"; page: number }
  | { type: "leaderboardGet" }
  | { type: "achievementsGet" }
  | { type: "profileGet" }
  | { type: "profileUpdate"; avatar: string; shownBadges: string[] };
```

### C# — `Battleship.Core`

`System.Text.Json` with
`JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }`
matches the field names above without per-property attributes. Deserialize to a
base type discriminated on `type`, or read the `type` property first and dispatch.

### Python — `bot/`

```python
buf = ""
while chunk := sock.recv(4096).decode("utf-8"):
    buf += chunk
    while "\n" in buf:
        line, buf = buf.split("\n", 1)
        if line.strip():
            handle(json.loads(line))
```

The bot needs `connected`, `welcome`, `matchStart`, `turn`, `fireResult`,
`matchEnd`, `opponentLeft`, and `reset`. It may ignore the rest, `history`, `leaderboard`, `profile` and the badge messages included. It must send
`findMatch` after `welcome`, and again after `opponentLeft` or `reset`, or it
will never be paired.

---

## 9. Deliberately out of scope for v1

Listed so nobody adds them by reflex, and so the extension path is obvious once
the team picks its extra features:

- **Reconnection.** A dropped socket is a departed player.
- **Heartbeats.** TCP close detection is sufficient on a LAN.
- **Chat, spectators, rooms, replay.** All reachable by adding new `type` values
  under the ignore-unknown rules in section 1 — no re-freeze required.
- **Placement time limit.** Only the 10-second turn timer is specified.
- **Cancelling a search.** Once `findMatch` is sent the player stays searching.
  A cancel verb can be added later under the ignore-unknown rules.
