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

`C→S` client to server (4 verbs) · `S→C` server to client (12 events)

| Type | Dir | Sent when |
|---|---|---|
| `connected` | S→C | Immediately on TCP accept |
| `join` | C→S | Player submits a nickname |
| `welcome` | S→C | Nickname accepted |
| `lobby` | S→C | Any client connects, names itself, changes state, or leaves |
| `matchStart` | S→C | Two idle players are paired |
| `place` | C→S | Player finishes placing 4 ships |
| `placed` | S→C | Placement accepted |
| `turn` | S→C | A turn begins |
| `fire` | C→S | Active player selects a target cell |
| `fireResult` | S→C | A shot resolves (including a timeout auto-fire) |
| `matchEnd` | S→C | All 4 of one player's ships are sunk |
| `rematch` | C→S | Player presses Rematch |
| `rematchPending` | S→C | One player has asked for a rematch |
| `opponentLeft` | S→C | The other player's socket closed |
| `reset` | S→C | The dashboard RESET button was pressed |
| `error` | S→C | A client message was rejected |

---

## 3. Client state machine

```
      TCP connect
           │
           ▼
   ┌───────────────┐  join    ┌────────┐  matchStart  ┌──────────┐
   │  CONNECTING   │─────────►│  IDLE  │─────────────►│ PLACING  │
   └───────────────┘ welcome  └────────┘              └──────────┘
                                  ▲                         │ place
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
```

`PLACING` is entered on every `matchStart`, including rematches — boards are
cleared and both players place again.

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

`status` is one of `"connecting"` (socket open, no nickname yet), `"idle"`,
`"placing"`, `"in-match"`. `count` equals the length of `clients` and is sent
explicitly so the dashboard needs no derivation.

### `matchStart`

```json
{"type":"matchStart","matchId":"m1","players":[
  {"id":"p1","name":"Alice","score":1},
  {"id":"p2","name":"Bob","score":0}
],"firstPlayerId":"p1"}
```

`players` always has exactly 2 entries and carries current scores, so the UI can
render both names and scores from this one message.

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
wire so the UI never hardcodes it. `turnNumber` starts at 1 and increments for
every turn in the match.

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

The surviving player returns to `IDLE`. Scores are retained — a disconnect is not
a loss, and awarding a win for it would be trivially exploitable in a demo.

### `reset`

```json
{"type":"reset"}
```

Triggered by the dashboard RESET button. Every client abandons any match, clears
its board, zeroes both scores, and returns to `IDLE`. A fresh `lobby` follows.

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
| `not-in-match` | `place`, `fire`, or `rematch` sent in the wrong state |
| `unknown` | Anything else |

---

## 5. Client → Server messages

### `join`

```json
{"type":"join","nickname":"Alice"}
```

Nickname is trimmed and must be 1–16 characters after trimming. The server may
de-duplicate (`"Alice"` → `"Alice (2)"`); the authoritative result comes back in
`welcome`. Sent once, in `CONNECTING`.

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
    │                             │◄─── join "Bob" ────────────┤
    │◄──── lobby (2) ─────────────┼──── welcome, lobby ───────►│
    │                             │                            │
    │◄──── matchStart ────────────┼──── matchStart ───────────►│  both → PLACING
    ├───── place ────────────────►│                            │
    │◄──── placed p1 ─────────────┼──── placed p1 ────────────►│
    │                             │◄─── place ─────────────────┤
    │◄──── placed p2 ─────────────┼──── placed p2 ────────────►│
    │                             │                            │
    │◄──── turn (active p1) ──────┼──── turn (active p1) ─────►│  both → PLAYING
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
```

---

## 7. Server rules the protocol depends on

Server obligations, not client concerns, but every implementer should know them.

1. **Matchmaking** pairs the first two `idle` players. A third client stays in the
   lobby and receives `lobby` updates only.
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
  | { type: "place"; ships: Cell[][] }
  | { type: "fire"; row: number; col: number }
  | { type: "rematch" };
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

The bot needs `connected`, `welcome`, `matchStart`, `turn`, `fireResult`, and
`matchEnd`. It may ignore the rest.

---

## 9. Deliberately out of scope for v1

Listed so nobody adds them by reflex, and so the extension path is obvious once
the team picks its extra features:

- **Reconnection.** A dropped socket is a departed player.
- **Heartbeats.** TCP close detection is sufficient on a LAN.
- **Chat, spectators, rooms, replay.** All reachable by adding new `type` values
  under the ignore-unknown rules in section 1 — no re-freeze required.
- **Placement time limit.** Only the 10-second turn timer is specified.
