# Battleship — Net-Centric assignment

Two-player online Battleship built on **raw TCP sockets** (`node:net`), client–server model.

```
browser UI ──SSE / POST──► client.js ──TCP socket──► server.js ◄── another client.js ◄── browser UI
                                                        │
                                                   HTTP dashboard (status + reset)
```

* `server.js` — authoritative game server. Listens on a TCP port for game clients
  and runs all game logic (matchmaking, ship validation, turn timer, scoring).
  Also serves an HTTP **status dashboard** (online count, client list, reset button).
* `client.js` — one per machine. Opens **one TCP socket** to the server and serves
  the web UI locally, bridging the browser to that socket. The player never types
  an IP or port.
* `lib/game.js` — pure Battleship rules. `lib/wire.js` — newline-delimited JSON framing.
* `public/` — the web UI (vanilla HTML/CSS/JS, no build step).

No external dependencies. Node ≥ 14.

## Run it (single machine, for testing)

```bash
node server.js                 # TCP :5050, dashboard http://localhost:8080
node client.js                 # player 1 -> http://localhost:3000
PORT=3001 node client.js       # player 2 -> http://localhost:3001
```

Open each client URL in a browser tab, enter a nickname, place ships, play.

## Run it (the graded setup: two computers)

**Computer A** (runs server + one client):

1. Find A's LAN IP (`ipconfig getifaddr en0` on macOS, `hostname -I` on Linux).
2. Put that IP in `config.js` → `SERVER_HOST` **on both computers**.
3. `node server.js` then `node client.js`, open `http://localhost:3000`.

**Computer B** (runs a client only):

* `node client.js`, open `http://localhost:3000`.

The server's IP/port live in `config.js` (source code) — clients never prompt for them.

> macOS note: ports 5000/7000 are taken by AirPlay Receiver, so the game port
> defaults to **5050**. Change it in `config.js` if needed.

## Self-check

```bash
node server.js &
node selfcheck.js     # two headless TCP clients play a full match + rematch
```

## How gameplay maps to the spec

| Requirement | Where |
|---|---|
| Socket programming, client–server | `server.js` `net.createServer`, `client.js` `net.connect` |
| No manual IP/port entry | `config.js` |
| Server shows online count + client list | dashboard `http://<server>:8080` |
| Server reset button (game + scores) | dashboard → `RESET` |
| Nickname + "Welcome, X." | name screen → `welcome` message |
| Name + score on client | header/score line every phase |
| 8×8 grid, 4 ships × 4 connected slots | `lib/game.js` `validatePlacement`, placement screen |
| Private ship placement, both must finish | server waits for both `place` messages |
| Alternating turns, 10 s per turn | `server.js` `startTurn` timer (`TURN_SECONDS`) |
| hit / miss / sunk | `lib/game.js` `fireAt` |
| Match ends when all 4 ships sunk, winner +1 | `server.js` `endMatch` |
| Win / Lost + both scores + Rematch | end screen |
| Rematch needs both players; previous winner goes first | `server.js` `handleRematch` (`lastWinner`) |
| Server randomises first player (first match) | `server.js` `tryStartMatch` |

**On turn timeout:** the server auto-fires a random un-hit slot for that player,
so the match always progresses.

## Adding extra features (for part c)

Game logic is isolated in `lib/game.js` and the server is authoritative, so an
**AI opponent** (bot that joins as a client and plays via hunt/target targeting)
is the natural AI feature — build it as a separate `bot.js` that speaks the same
protocol.
