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
- `Battleship.sln`: scaffolded.
- `Battleship.Core`: in progress — the shared game rules (ships, board and shots,
  placement checks, random placement, nicknames, protocol messages), written one
  class per person. Check `src/Battleship.Core/` for what exists.
- `Battleship.Server`, `Battleship.Client`: empty console apps.
- `web/`, `bot/`: not scaffolded yet (see the plan's *First steps*).

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
- `dotnet test tests/Battleship.Core.Tests` — Core unit tests only

The UI needs Node 24 LTS. Run these in `web/`, after `npm ci` once:

- `npm run dev` — Vite dev server on :5173 with hot reload
- `npm run build` — type-check (strict) and bundle into `web/dist/`

## Maintaining this file

Coding with an agent? Update AGENT.md in the same change that makes it stale — a
new command, a new invariant, the stage moving on.

- Edit or delete the wrong line; don't append a correction next to it.
- One line per fact. Link to a doc instead of summarizing it.
- A section growing past ~10 lines belongs in `docs/`, linked from the table above.
