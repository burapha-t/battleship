# Battleship — Stack & Architecture Design

## Context

A 7-person team must build the Battleship networked-game assignment
(`docs/instruction.md`): socket programming, client–server, 8×8 grid,
4 ships of 4 connected cells, 10-second turns, a server dashboard with a reset
button, rematch, and at least one AI feature. Graded out of 25 — 10 for
fundamentals, 5 for demo creativity, 10 for extra features.

Constraints established with the tech lead:

- **Nobody has written C#.** Everyone knows Python and Java at minimum.
- **Machine OS is mixed/unknown** across the 7 members — cross-platform is mandatory.
- **4+ weeks** until the demo.
- **`docs/demo/v1`** (a working Node.js prototype) is **reference only**. The protocol
  and rules are designed fresh in C#; the prototype is not ported and not submitted.
- Extra features will be chosen by the team later — this design only makes them
  cheap to add. **Do not specify or build extras yet.**

Intended outcome: a stack and architecture where seven people work in parallel
without blocking each other, a team new to C# ramps safely, and every graded
criterion has a named owner.

## Why C# is safe for a team that has never used it

Java → C# is the smallest jump in mainstream programming: same C-family syntax,
same class/interface/generics/GC model, same `try`/`catch`. The complete list of
things that will surprise a Java developer on this project:

| Java habit | C# equivalent |
|---|---|
| `getScore()` / `setScore()` | properties — `public int Score { get; set; }` |
| `camelCase` methods | `PascalCase` methods |
| `import` / `package` | `using` / `namespace` |
| Jackson / Gson | `System.Text.Json` |
| threads + blocking I/O | `async` / `await` + `Task` |
| — | nullable reference types (`string?`) — disable in the `.csproj` if noisy |

Only `async`/`await` is a genuinely new concept, and it makes socket code simpler
than Java's thread-per-client model. The socket surface for this entire assignment
is five types: `TcpListener`, `TcpClient`, `NetworkStream`,
`StreamReader.ReadLineAsync()`, `StreamWriter.WriteLineAsync()`. `ReadLineAsync()`
provides newline-delimited framing for free.

The real ramp cost is tooling (SDK, `.csproj`, NuGet, solution layout), not the
language. Budget a one-day kickoff, not a week.

## Stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | **.NET 8** — except `Battleship.Core`, see below | Cross-platform; same code on Windows/macOS/Linux |
| Game rules, server, client core | **C#** | Java-adjacent; ~1–2 day ramp for Java devs |
| Player UI | **React + TypeScript** (Vite) | Stateful 5-screen UI; TS turns the protocol into a compile-time contract |
| AI feature | **Python** | Separate process, own socket; ~100 lines |
| Tests | **xUnit** | Pure-logic unit tests + a headless integration harness |

Three languages, but every boundary is a **process** boundary with a frozen JSON
protocol. Nobody needs to know all three. This is also on-message for the
assignment: the point of socket programming is a language-agnostic wire protocol,
and a Python bot playing a C# client over your own protocol is a demonstrable
creativity point rather than a liability.

### Target frameworks

> **⚠ Changed from the original design.** `Battleship.Core` was specified as
> **`net8.0`** and now targets **`netstandard2.1`**. Every other project stays on
> `net8.0`. If you scaffolded `Core` before this revision, update its `.csproj`.

| Project | Target |
|---|---|
| `Battleship.Core` | **`netstandard2.1`** |
| `Battleship.Server` | `net8.0` |
| `Battleship.Client` | `net8.0` |
| `tests/*` | `net8.0` |

**Why:** Unity runs Mono against .NET Standard, not .NET 8. Targeting
`netstandard2.1` keeps `Battleship.Core` droppable into a Unity client as-is, so
placement validation and board rules get reused rather than reimplemented if the
team builds one (see *Unity as a stretch client* below). It is a one-line
`.csproj` change now and an irritating retrofit later.

**What it costs:** `netstandard2.1` defaults to **C# 8**. Nullable reference types
and pattern matching work as-is. Raising `<LangVersion>` is allowed, but `record`
types and `init` accessors then need the well-known five-line `IsExternalInit`
shim. Simplest avoidance: declare `Coord` as a plain `readonly struct` rather than
a `record struct`. Nothing in the rule set needs anything newer.

### Unity as a stretch client

Unity would be **another client**, not a rewrite: it opens its own `TcpClient` to
the same server, speaks the same `docs/implement/protocol.md`, and the server
cannot tell it apart from the React client. Worth it only for the 5 creativity points (3D ships,
explosions, camera work) — for an 8×8 grid it is otherwise overkill next to React.

Two gotchas for whoever attempts it: GameObjects cannot be touched from a socket
thread (queue events, drain them in `Update()`), and `System.Text.Json` is patchy
in Unity — use Newtonsoft via Package Manager. The protocol is plain JSON, so
either parses it.

## Architecture

```
Computer A                                        Computer B
┌───────────────────────────────────┐            ┌──────────────────────────┐
│ Battleship.Server                 │            │ Battleship.Client        │
│  TcpListener :5050  ◄─────────────┼── LAN TCP ─┼─►  TcpClient             │
│  authoritative rules, timer,      │            │      ▲ WebSocket         │
│  scoring, lobby                   │            │      │ localhost         │
│  ASP.NET dashboard :8080          │            │   browser (React + TS)   │
│         ▲ TCP localhost           │            └──────────────────────────┘
│  Battleship.Client + browser      │
└───────────────────────────────────┘            bot/main.py ──TCP──► server
```

Clients **never** socket to each other. The assignment's diagram shows arrows
between the two laptops, but the requirement text specifies a client–server
model; those arrows are logical gameplay, routed through the server.

The browser↔client WebSocket is **localhost-only presentation plumbing** and never
leaves the machine. The graded socket programming is the raw TCP between
`Battleship.Client` and `Battleship.Server`.

### Why not point browsers straight at the server?

Simpler, and rejected anyway. "One computer runs only the game client" and
"clients don't enter an IP or port" both get shaky when the client is a browser
tab someone typed an address into — roughly 1.5 graded points riding on a
grader's charity.

## Repository layout

```
battleship/
├─ AGENT.md                       agent entry point: doc index + invariants
├─ Battleship.sln
├─ src/
│  ├─ Battleship.Core/            pure rules + protocol DTOs, no I/O
│  ├─ Battleship.Server/          TcpListener, match orchestration, dashboard
│  └─ Battleship.Client/          TcpClient + local web host + WS bridge
├─ web/                           React + TS UI (Vite); dist/ served by Battleship.Client
├─ bot/                           Python AI client
├─ tests/
│  ├─ Battleship.Core.Tests/      xUnit, pure logic
│  └─ Battleship.IntegrationTests/ headless two-client full match + rematch
└─ docs/
   ├─ instruction.md              (exists) assignment + grading criteria
   ├─ implement/
   │  ├─ protocol.md              THE CONTRACT — frozen in week 1
   │  └─ implementation-plan.md   (this document)
   └─ demo/v1/                    (exists) Node prototype, reference only
```

Separate `.csproj` per project is not ceremony — it is how 7 people avoid
constant merge conflicts. `Battleship.Core` depends on nothing, so it cannot
break anyone.

## Components

### `Battleship.Core` — pure layer

**Targets `netstandard2.1`, not `net8.0`** — see *Target frameworks* above.

No sockets, no `async`, no I/O. Unit-testable in isolation. This is the week-1
C# onboarding exercise for the whole team.

- `GameRules` — `GridSize = 8`, `ShipLength = 4`, `ShipCount = 4`, `TurnSeconds = 10`
- `Coord` — a plain `readonly struct` with `Row`/`Col` (not a `record struct`; see
  the C# 8 note under *Target frameworks*)
- `Ship` — cells + hit count; sunk when hits == `ShipLength`
- `Board` — grid, shots, ships; `Fire(Coord) → ShotResult { Hit, Sunk, AllSunk }`
- `PlacementValidator.Validate(ships) → string?` — exactly 4 ships, exactly 4 cells
  each, in bounds, straight line, contiguous, non-overlapping; `null` when valid
- `RandomPlacement.Generate()` — a valid random placement (used by the turn-timeout
  auto-fire and by the bot)

Reference `docs/demo/v1/lib/game.js` for the rule set worth reproducing — it is a
correct, compact statement of the same rules. Do not port it; write it in C#.

### `Battleship.Server` — authoritative

- `TcpListener` accept loop, one async task per connected client
- `ClientSession` — socket, reader/writer, id, nickname, state
- `Lobby` — connected clients; broadcasts count + list on every change
- `Match` — two players, two `Board`s, whose turn, scores, **full move log**
- `TurnTimer` — 10 s; **on expiry, auto-fire a random un-shot cell** for that player
  so a match can never stall (a stalled demo is worse than a random shot)
- Randomises the first player for the first match; the previous winner starts a rematch
- Dashboard: ASP.NET Core minimal API on `:8080` — online count, connected-client
  list, and a `RESET` button clearing the current game and both scores

**Concurrency rule (prescriptive):** every mutation of match state funnels through
a single async lock or channel. With a team new to `async`, the alternative is
seven private locking schemes and a race condition on demo eve.

### `Battleship.Client` — dumb relay

- `TcpClient` to the server; host/port from a config file beside the executable
  (the assignment explicitly permits a hard-coded server address — clients never prompt)
- ASP.NET Core host serving `web/dist/` as static files, plus one WebSocket endpoint
- **Zero game logic.** Browser message → TCP; TCP message → browser.

Consequence: the client cannot cheat, because it never holds the opponent's board.

### `web/` — React + TypeScript

Vite + React + TS. **No router, no state library, no CSS framework** — the entire
UI is a screen switch over one piece of state, and extra machinery would cost more
than it returns.

- `src/protocol.ts` — a discriminated union of every server event and client verb,
  mirroring `docs/implement/protocol.md`. **This is why TypeScript is here:** a
  protocol change the UI fails to handle becomes a build error rather than a
  demo-day bug.
- `src/useGameSocket.ts` — opens the WebSocket to the local `Battleship.Client`,
  parses frames into typed events, exposes `send(verb)`.
- `src/gameReducer.ts` — one `useReducer` over the server event stream. The server
  is authoritative, so UI state is a pure fold of what the server sent. No Redux.
- `src/components/Board.tsx` — the 8×8 grid, shared by the placement and game screens.

Five screens: `NicknameScreen` (→ `"Welcome, <name>."`) → `LobbyScreen` (connected
clients) → `PlacementScreen` (place 4 ships of 4 cells, rotate; opponent's grid
hidden) → `GameScreen` (own board + target board, both names and scores, 10 s
countdown) → `EndScreen` (Win/Lost, both scores, Rematch).

**Build and serve:**

- **Dev** — `npm run dev` (Vite on :5173), proxying the WebSocket to a running
  `Battleship.Client`. UI people get hot reload without restarting C#.
- **Demo** — `npm run build` → `web/dist/`, served as static files by
  `Battleship.Client`. **Commit `web/dist/` from week 3 onward** so demo machines
  need only the .NET runtime: no Node, no `npm install` at the venue.

Keep `node_modules/` gitignored; `web/dist/` stays gitignored until week 3.

### `bot/` — Python AI client

A plain protocol client: `socket.connect()`, read newline-delimited JSON, respond.
Joins the lobby indistinguishably from a human. Because it is a separate process,
AI work never touches C# and the game can be demoed with a single human player.

## Protocol

`docs/implement/protocol.md`, frozen in week 1 — **the critical path.** Until it
is frozen, server, client, UI, and bot people all block on each other; once
frozen, none of them do.

Newline-delimited JSON over TCP. Every message carries a `"type"` field. Flat
payloads, so `System.Text.Json`, `JSON.parse`, and `json.loads` all handle it
without custom converters — that cross-language property is why the Python bot
is cheap.

**Client → Server** (4 verbs): `join` · `place` · `fire` · `rematch`

**Server → Client** (events): `connected` · `welcome` · `lobby` · `matchStart` ·
`placed` · `turn` · `fireResult` · `matchEnd` · `rematchPending` · `opponentLeft` ·
`reset` · `error`

**Invariant:** the server never transmits a player's ship positions to their
opponent — only shot outcomes (`hit`/`miss`/`sunk`). This satisfies the
hidden-placement requirement and is worth demonstrating explicitly.

`docs/demo/v1/server.js` shows a working message set at the same granularity;
use it to sanity-check coverage, not as a source to copy.

## Extension points for extra features

Extras will be chosen by the team later. The architecture makes them cheap
without pre-committing to any:

- **Server-authoritative state** — a new mode is a server-side variation, not a
  client rewrite
- **Bot-as-protocol-client** — new AI behaviours are new processes; core untouched
- **`type`-tagged protocol** — new messages are additive, never breaking
- **Full move log on `Match`** — replay, stats, and analysis become reads rather
  than new plumbing
- **Lobby with per-client status** — spectators, rooms, and tournaments have a
  place to attach

## Team split (7 people)

| Who | Owns | Graded criteria covered |
|---|---|---|
| **Lead** | `protocol.md`, solution scaffolding, integration, review, demo run-of-show, network testing | System setup (2.0), demo creativity (5.0) |
| **2 people** | Server: accept loop, sessions, match state machine, turn timer, scoring, rematch | Turn timer, hit/miss, scoring, rematch, first-player randomisation (3.0) |
| **1 person** | Dashboard (count / list / reset) — small and independent; then the Python bot | Server display + reset (2.0), AI feature (2.0) |
| **1 person** | Client: `TcpClient` + web host + WebSocket bridge | No-manual-IP connect, lobby info (1.5) |
| **2 people** | Web UI: React components, the five screens, `protocol.ts` | Nickname, name+score display, 8×8 grid + placement (1.5), creativity |

Within the UI pair, the person with React experience takes `Board.tsx`,
`PlacementScreen`, and `GameScreen` — the grid interaction, drag/rotate, and
countdown are where the real difficulty is. The other takes the app shell,
nickname, lobby, and end screens, plus `protocol.ts`.

`Battleship.Core` is built by everyone together in week 1 as the C# onboarding
exercise, then handed to the server pair.

## Timeline (4 weeks)

- **Week 1** — C# onboarding by building `Battleship.Core` + xUnit tests together.
  Lead writes and **freezes `protocol.md`**; UI pair scaffolds Vite + React + TS
  and writes `src/protocol.ts` from it the same week. Run the network test below.
- **Week 2** — Server accept loop + match state machine; client bridge; nickname,
  lobby, and placement screens. Target: first end-to-end handshake across two machines.
- **Week 3** — Full match across two computers. Dashboard. Timer, scoring, rematch,
  reset all working. Python bot connects. **Start committing `web/dist/`.** Extras begin.
- **Week 4** — Extras, creativity polish, demo rehearsal on the real network,
  fallback rehearsal.

## Demo-day risk — act in week 1

The largest risk is **the network, not the code.** University Wi-Fi commonly
enables AP/client isolation, which silently blocks laptop-to-laptop traffic. Two
machines on the same SSID that cannot reach each other is the standard way this
assignment fails minutes before the demo. (The assignment's own hint list links
`vpn.net` — Hamachi — for exactly this reason.)

Required in week 1, before any real code exists:

1. Two laptops on the **actual demo network**; confirm one can reach a
   `TcpListener` on the other.
2. Expect and accept the Windows Firewall / macOS "allow incoming connections"
   prompts on first bind.
3. Rehearse a fallback: phone hotspot, wired ethernet, or Radmin/Hamachi VPN.

## Verification

- **Unit** — `dotnet test tests/Battleship.Core.Tests`: placement validation
  (bounds, straightness, contiguity, overlap, wrong count), `Fire` returning
  hit/miss, sunk at 4 hits, `allSunk` at 4 ships.
- **Integration** — `dotnet test tests/Battleship.IntegrationTests`: two headless
  `TcpClient`s play a complete match plus a rematch against a real server,
  asserting each graded requirement (first player randomised, 10 s timeout
  auto-fires, winner starts the rematch, scores increment, reset clears state).
  This is the regression net that lets 7 people merge without fear.
  `docs/demo/v1/selfcheck.js` is the shape to reproduce.
- **Manual, two computers** — the graded setup: Computer A runs server + client,
  Computer B runs client only. Play a full match, rematch, and press RESET on the
  dashboard mid-match. Confirm neither client ever receives opponent ship data
  (inspect the WebSocket frames in browser devtools).
- **UI** — `npm run build` in `web/` must succeed with zero TypeScript errors.
  Because `protocol.ts` is a discriminated union, an unhandled server event fails
  the build; treat a red build as a protocol mismatch, not a UI bug.
- **Bot** — `python bot/main.py` joins and completes a match against a human client.

## First steps

1. Write and freeze `docs/implement/protocol.md` — every other lane depends on it.
2. Scaffold `Battleship.sln` with the five projects, plus `bot/`.
3. Scaffold `web/` with Vite (`npm create vite web -- --template react-ts`)
   and hand-write `src/protocol.ts` to match `docs/implement/protocol.md`.
4. Run the two-laptop network test on the demo network.
5. Kick off `Battleship.Core` + xUnit as the team's C# onboarding exercise.