# AGENT.md

Battleship class assignment: C# server + client over raw TCP, React/TS UI, Python
bot. 7 people, 4 weeks, graded.

## Canonical docs — read the relevant one before coding; don't restate it here

| Doc | Decides |
|---|---|
| `docs/instruction.md` | Requirements and grading criteria |
| `docs/implement/protocol.md` | **FROZEN wire contract** — wins over any code |
| `docs/implement/implementation-plan.md` | Stack, repo layout, components, verification, team split |
| `docs/demo/v1/` | Node prototype — reference only; never ported, never shipped |

## Stage

Protocol frozen; **no application code exists yet**. `src/`, `web/`, `bot/`, and
`tests/` are still to be scaffolded per the plan's *First steps*.

## Invariants

- `Battleship.Core` targets `netstandard2.1`; every other project `net8.0`.
- Server is authoritative; `Battleship.Client` carries zero game logic.
- The server never sends a player's ship positions to their opponent.
- A protocol change updates `protocol.md`, `web/src/protocol.ts`, and the C# DTOs
  in one PR — otherwise it is not a protocol change.

## Commands

_None yet. Add each one here when it starts working._

## Maintaining this file

Coding with an agent? Update AGENT.md in the same change that makes it stale — a
new command, a new invariant, the stage moving on.

- Edit or delete the wrong line; don't append a correction next to it.
- One line per fact. Link to a doc instead of summarizing it.
- A section growing past ~10 lines belongs in `docs/`, linked from the table above.
