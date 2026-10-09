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
| `docs/frontend/` | Static HTML mockups (home, placement, gameplay, result, server dashboard) — the visual direction |
| `tests/fixtures/README.md` | Golden transcript `match-transcript.jsonl`: format, story, what not to depend on |
| `README.md` | Building `publish/` and running the demo on machines with nothing installed |

## Stage

Everything but the bot is built, and `IntegrationTests` plays full matches end to end.

- Protocol: frozen.
- `Battleship.Core`: complete — rules (`Ship`, `Board`, `PlacementValidator`, `RandomPlacement`,
  `NicknamePolicy`, `GameRules`) and the protocol DTOs + `ProtocolJson`.
- `Battleship.Server`: complete — TCP :5050, lobby, matchmaking, 10 s turn timer with auto-fire, scoring, rematch; dashboard on :8080 with RESET.
- `Battleship.Client`: complete — `client.json`, serves `web/dist` as `wwwroot/`, `/ws` ↔ TCP relay (CLI-0), opens the browser.
- `web/`: complete — all five screens plus sound. `?replay=p1|p2|p3` plays the golden transcript with no server; `?preview=board` shows every cell state.
- Demo build: `scripts/publish.*` makes self-contained folders for win-x64, osx-arm64 and linux-x64.
- `bot/` (BOT-1…8): not scaffolded yet — the remaining work.

## Invariants

- `Battleship.Core` targets `netstandard2.1`; every other project `net8.0`.
- Server is authoritative; `Battleship.Client` carries zero game logic.
- The server never sends a player's ship positions to their opponent.
- Only the `GameHost` loop touches server state; sessions, the turn timer and the dashboard `Post` a `HostInput` to it.
- `Engine/` and `Lobby/` stay socket-free, so `Battleship.Server.Tests` drives them directly.
- A protocol change updates `protocol.md`, `web/src/protocol.ts`, the C# DTOs and
  `tests/fixtures/match-transcript.jsonl` in one PR — otherwise it is not a protocol change.

## Commands

Run from the repo root. Needs the .NET 8 SDK (`dotnet --list-sdks` shows `8.0.x`).

- `dotnet build` — build the whole solution
- `dotnet test` — every test project: `Battleship.Core.Tests` (rules, protocol), `Battleship.Server.Tests`
  (engine, no sockets), `Battleship.IntegrationTests` (real server + client relay on loopback ports)
- `dotnet test tests/<project>` — one test project only
- `dotnet run --project src/Battleship.Server` — game server (all interfaces :5050) + dashboard http://localhost:8080
- `dotnet run --project src/Battleship.Client -- [--web-port 3001] [--no-browser]` — a player's client; UI on http://localhost:3000
- `powershell -ExecutionPolicy Bypass -File scripts/publish.ps1 [-Rids win-x64]` / `sh scripts/publish.sh [osx-arm64]` —
  self-contained server + client into `publish/<rid>/`

The client copies `web/dist` when it builds: run `npm run build` first, then rebuild the client.
`web/dist/` and `publish/` are gitignored build output. CI runs `dotnet test`, `npm test` and `npm run build` — not lint.

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
