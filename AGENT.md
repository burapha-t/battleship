# AGENT.md

Battleship class assignment: C# server + client over raw TCP, React/TS UI, Python
bot. 7 people, 4 weeks, graded.

## Canonical docs — read the relevant one before coding; don't restate it here

| Doc | Decides |
|---|---|
| `docs/instruction.md` | Requirements and grading criteria |
| `docs/setup.md` | Installing .NET 8, Node and Python; the firewall prompt |
| `docs/convention.md` | Branch, commit and PR names — every one must follow it |
| `docs/implement/protocol.md` | **FROZEN wire contract** — wins over any code |
| `docs/implement/implementation-plan.md` | Stack, repo layout, components, verification, team split |
| `docs/implement/userflow.md` | Plain-language player journey and device connections — explainer only; `protocol.md` wins |
| `docs/demo/v1/` | Node prototype — reference only; never ported, never shipped |

## Stage

- Protocol: frozen.
- `Battleship.Core`: complete — rules (`Ship`, `Board`, `PlacementValidator`,
  `RandomPlacement`, `NicknamePolicy`) and the protocol DTOs + `ProtocolJson`.
- `Battleship.Server`: TCP :5050, one `GameHost` loop (SRV-0), match engine, dashboard on :8080.
- `Battleship.Client`: `client.json`, serves `web/dist` as `wwwroot/`, `/ws` ↔ TCP relay (CLI-0), opens the browser.
- `web/`: all five screens. `?replay=p1|p2|p3` plays the golden transcript with no server; `?preview=board` shows every cell state.
- `bot/`: not scaffolded yet.

## Invariants

- `Battleship.Core` targets `netstandard2.1`; every other project `net8.0`.
- Server is authoritative; `Battleship.Client` carries zero game logic.
- The server never sends a player's ship positions to their opponent.
- A protocol change updates `protocol.md`, `web/src/protocol.ts`, and the C# DTOs
  in one PR — otherwise it is not a protocol change.

## Commands

Run from the repo root. Needs the .NET 8 SDK (`dotnet --list-sdks` shows `8.0.x`).

- `dotnet build` — build the whole solution
- `dotnet test` — run every test project
- `dotnet test tests/Battleship.Core.Tests` — Core unit tests only (`Battleship.Server.Tests`: engine, no sockets)
- `dotnet run --project src/Battleship.Server` — game server (all interfaces :5050) + dashboard http://localhost:8080
- `dotnet run --project src/Battleship.Client -- [--web-port 3001] [--no-browser]` — a player's client; UI on http://localhost:3000
- `scripts/publish.ps1` / `scripts/publish.sh` — self-contained server + client into `publish/<rid>/`

The client copies `web/dist` when it builds: run `npm run build` first, then rebuild the client.

The UI needs Node 24 LTS. Run these in `web/`, after `npm ci` once:

- `npm run dev` — Vite dev server on :5173 with hot reload; proxies `/ws` to a client on :3000
- `npm run build` — type-check (strict) and bundle into `web/dist/`
- `npm test` — vitest (reducer, placement rules) · `npm run lint` — oxlint

## Maintaining this file

Coding with an agent? Update AGENT.md in the same change that makes it stale — a
new command, a new invariant, the stage moving on.

- Edit or delete the wrong line; don't append a correction next to it.
- One line per fact. Link to a doc instead of summarizing it.
- A section growing past ~10 lines belongs in `docs/`, linked from the table above.
