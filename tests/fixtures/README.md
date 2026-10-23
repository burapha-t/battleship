# Test fixtures

## `match-transcript.jsonl` — golden transcript

Hand-written from [`protocol.md`](../../docs/implement/protocol.md), not recorded
from a server. If the two disagree, `protocol.md` wins and this file is the bug.
The C# (CORE-6), TypeScript (UIF-3, UIF-4) and Python (BOT-5) tests all read it.

### Format

One JSON object per line, UTF-8, LF line endings:

```json
{"from":"server","to":"p1","frame":{"type":"placed","id":"p2"}}
{"from":"p1","to":"server","frame":{"type":"fire","row":3,"col":5}}
```

- `from` / `to` — `"server"` or a player id. Exactly one side is `"server"`, so
  together they give the direction and the recipient.
- `frame` — exactly what goes on the wire: compact, keys in `protocol.md` order.
- One line per recipient. A frame sent to both players appears twice, with
  identical bytes (protocol §2, perspective-free messages).
- Lines are in the order the server handles them. Only the order *per connection*
  is guaranteed on a real network.

To replay one player's view, keep the lines where `to` is that player.

### The story

Cast: `p1` Alice, a guest; `p2` Bob, who signs up for an account; and `p3`, a
guest who asks for "Alice" and is welcomed as "Alice (2)". `p3` stays idle in
the lobby throughout.

1. **Lobby.** All three connect. Alice joins. Bob's first nickname (`"   "`) gets
   `bad-nickname`; his `signup` with a 3-character password gets `invalid-input`;
   then he signs up as "Bob" (`welcome`). `p3` tries to `login` as "bob" with
   Bob's password (`already-logged-in`, since Bob is online), as "Bob" with a
   wrong password (`bad-credentials`), and to `signup` as "BOB"
   (`username-taken`), then joins as "Alice". `p3` asks for its match history
   (`historyList`) and gets zeros and no matches (`history`), then asks for the leaderboard
   (`leaderboardGet`) and gets no rows (`leaderboard`), then asks for its
   badges (`achievementsGet`) and gets zeros and none (`achievements`), then
   asks for its profile (`profileGet`) and gets an empty one marked `guest`
   (`profile`); trying to save one (`profileUpdate`) gets `not-logged-in`.
2. **Match `m1`, played to the end.** Bob moves first. On the way:
   `invalid-placement` (Bob), `not-your-turn` (Alice), `not-in-match` (`p3`),
   `out-of-range` and `already-fired` (Alice), and one of Bob's turns times out
   (`auto: true`). Each side sinks ships; Alice sinks all four → `matchEnd`, 1–0.
3. **Rematch `m2`.** Bob asks first (`rematchPending`), then Alice → `matchStart`
   with the winner, Alice, first. Two shots.
4. **Dashboard RESET** mid-turn → `reset` to all three, then a lobby with everyone idle.
5. **Match `m3`.** Its `matchStart` shows both scores back at 0. Alice places,
   then Bob disconnects → `opponentLeft` to Alice, who ends idle in the lobby.

Every message type except `leave` and all five lobby statuses appear.
`achievementUnlocked` appears only as an example line (below). The `unknown` error
code does not, and neither does `invalid-profile`, which needs a logged-in player
to send a bad profile.

The server under test has a fresh, empty database, so Bob's account exists only
for this story. Alice is a guest, so no match is saved, and a guest gets the same
`history`, `leaderboard`, `achievements` and `profile` replies with a database as
without one.

### Don't depend on

- The order of `players`: `m3` lists `p2` first. Find yourself by `id`.
- Error `message` texts: they are placeholders. Branch on `code`.

### Changing it

A protocol change updates this file in the same PR as `protocol.md`,
`web/src/protocol.ts` and the C# DTOs.

### Example lines

A line with `"example": true` is a hand-written wire example, not part of the
story. The `achievementUnlocked` line after `m1`'s `matchEnd` shows what an
account would get (#41); here Alice is a guest, so no match is saved and nobody
earns anything. The protocol round-trip tests read it; the replay against the
real server and the web `?replay=` skip it. `example` is line metadata, not part of the frame.
