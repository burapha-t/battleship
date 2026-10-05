# Battleship — User Flow

A plain-language walkthrough of how the game is used, from turning the computers
on to playing a rematch. For exact message formats see
[`protocol.md`](protocol.md); for the code structure see
[`implementation-plan.md`](implementation-plan.md). If this file disagrees with
`protocol.md`, `protocol.md` wins.

---

## 1. The big picture

- There is **one server**. It knows the rules, keeps both boards, runs the
  10-second timer, and keeps the scores. It is the referee.
- Each player runs a **game client** and plays in a **web browser** on their own
  computer.
- Players **never talk to each other directly**. Every click goes to the server,
  and the server tells both players what happened.
- The server **never sends your ship positions to your opponent**. They only learn
  "hit", "miss", or "sunk".

---

## 2. Who runs what

| Device | Runs | Used by |
|---|---|---|
| **Computer A** | Server + game client + browser + server dashboard | Player 1 and the person running the server |
| **Computer B** | Game client + browser | Player 2 |
| *(optional)* any computer | Python bot (`bot/main.py`) | Nobody — the AI plays by itself |

This is the setup the assignment grades: one computer runs the server *and* a
client, the other runs only a client.

---

## 3. How the devices connect

```
            Computer A                                   Computer B
 ┌────────────────────────────────┐            ┌────────────────────────────┐
 │                                │            │                            │
 │  Browser (Player 1)            │            │  Browser (Player 2)        │
 │      │ WebSocket (same PC)     │            │      │ WebSocket (same PC) │
 │      ▼                         │            │      ▼                     │
 │  Game Client ──TCP──┐          │            │  Game Client               │
 │                     ▼          │            │      │                     │
 │  ┌──────────────────────────┐  │  TCP :5050 │      │                     │
 │  │         SERVER           │◄─┼────────────┼──────┘                     │
 │  │  rules · boards · timer  │  │  over LAN  │                            │
 │  │  scores · lobby          │  │            └────────────────────────────┘
 │  └──────────────────────────┘  │
 │      ▲                         │                Python bot (optional)
 │      │ HTTP :8080              │◄──── TCP :5050 ─── joins like a player
 │  Dashboard (count, list,       │
 │  RESET button)                 │
 └────────────────────────────────┘
```

There are three kinds of link. Only the first one crosses the network.

| Link | Between | What it is for |
|---|---|---|
| **TCP, port 5050** | Game client ↔ Server | The real game traffic. This is the graded socket programming. |
| **WebSocket** | Browser ↔ Game client, *on the same computer* | Lets the web page talk to the game client. Never leaves the machine. |
| **HTTP, port 8080** | Browser ↔ Server dashboard | Lets the server operator see who is online and press RESET. |

### Connecting, step by step

1. **Before the demo** — write Computer A's IP address into the game client's
   config file on **both** computers. Players never type an IP or port.
2. **Start the server** on Computer A. It listens on TCP port 5050 and opens the
   dashboard on port 8080.
3. **Start the game client** on each computer. It reads the server address from
   its config file and opens **one TCP connection** to the server.
4. The server replies with `connected` and gives that connection an id
   (e.g. `p1`).
5. **Open the browser** on each computer at the game client's local page. The page
   connects to the game client over a WebSocket.
6. From now on the game client is just a **messenger**: browser → server, and
   server → browser. It contains no game rules.

### What happens when a player clicks

Example: Player 1 fires at a cell.

```
Player 1 clicks a cell
  → browser sends "fire" to Player 1's game client   (WebSocket, same PC)
  → game client forwards it to the server            (TCP over the network)
  → server checks: is it your turn? already shot here? hit or miss?
  → server sends "fireResult" to BOTH game clients   (TCP)
  → each game client passes it to its browser        (WebSocket)
  → both screens draw the hit or miss
```

Every action in the game works this way.

> **Network warning:** university Wi-Fi often blocks laptops from reaching each
> other. Test the real demo network early, and have a backup ready (phone hotspot,
> cable, or a VPN like Hamachi/Radmin).

---

## 4. The player's journey

```
 Nickname ──► Lobby ──► press Start game ──► Place ships ──► Battle ──► Match over
                ▲                                                           │
                │                                                           ├─ both press Rematch ──► Place ships
                └────────────── opponent leaves / server RESET ─────────────┘
```

Back in the lobby, a player must press **Start game** again before they can be
matched. A rematch skips the lobby and goes straight to placing ships.

### Step 1 — Enter a nickname

- **Player sees:** a box asking for a nickname.
- **Player does:** types a name (1–16 characters) and submits.
- **Behind the scenes:** browser sends `join` → server accepts it and replies
  `welcome`.
- **Result:** the screen shows **"Welcome, Alice."** The server may change the
  name slightly (for example `Alice (2)` if the name is taken) — the screen shows
  the name the server sent back.

### Step 2 — Lobby

- **Player sees:** how many players are online, a list of their names and
  status (`idle`, `searching`, `placing`, `in-match`), and a **Start game**
  button.
- **Player does:** presses **Start game** when ready to play.
- **Behind the scenes:** browser sends `findMatch` → the server marks the player
  as `searching`. The server sends a `lobby` update to everyone whenever someone
  joins, leaves, or changes status.
- **Result:** as soon as **two players are searching**, the server pairs them and
  sends `matchStart` to both. A player who hasn't pressed Start game is never
  matched. There is no cancel button — to stop searching, close the game.

### Step 3 — Place ships

- **Player sees:** their own empty 8×8 grid, both players' names and scores. The
  opponent's grid is hidden.
- **Player does:** places **4 ships**, each **4 cells long**, in straight lines
  that don't overlap, then confirms.
- **Behind the scenes:** browser sends `place` → the server checks the placement
  again (it never trusts the client).
  - Good placement → server sends `placed` to both players, so the other side can
    show "opponent is ready".
  - Bad placement → server sends `error` and the player fixes it.
- **Result:** when **both** players have placed, the battle starts.

### Step 4 — Battle

- **Player sees:** their own board, the opponent's board (empty except for their
  own shots), both names and scores, whose turn it is, and a **10-second
  countdown**.
- **Who goes first:** the server picks **at random** for the first match. In a
  rematch, **the last winner** goes first.
- **On your turn:** click one cell on the opponent's board. Browser sends `fire`.
- **The server answers** both players with `fireResult`:
  - **hit** or **miss** for that cell,
  - **sunk** if that hit finished a ship (the whole ship is then shown),
  - **all sunk** if it was the last ship.
- **Then the turn passes** to the other player and a new 10-second countdown
  starts.
- **If time runs out:** the server fires at a random cell for that player, and the
  screen says something like *"Alice ran out of time"*. The game never gets stuck.
- **Clicking when it isn't your turn**, or on a cell you already shot, gets an
  `error` and nothing changes.

### Step 5 — Match over

- **When:** one player sinks all 4 of the opponent's ships.
- **Player sees:** **"Win"** or **"Lost"**, both players' updated scores (the
  winner got +1), and a **Rematch** button.
- **Behind the scenes:** server sends `matchEnd` to both.

### Step 6 — Rematch

- **Player does:** presses **Rematch**.
- **Behind the scenes:** browser sends `rematch` → server tells both players
  `rematchPending`.
  - The player who pressed sees *"waiting for opponent"*.
  - The other player sees *"Alice wants a rematch"*.
- **When both have pressed:** server sends a new `matchStart`. Boards are cleared,
  **scores are kept**, both players place ships again (back to Step 3), and the
  **previous winner shoots first**.

---

## 5. Things that can interrupt a game

| What happens | What the players see |
|---|---|
| **Opponent closes the game or loses connection** | Server sends `opponentLeft`. The remaining player goes back to the lobby and presses **Start game** to find a new opponent. Scores are kept — leaving is not a win or a loss. |
| **Server operator presses RESET** | Server sends `reset` to everyone. Every game stops, all scores go to **0**, and everyone goes back to the lobby. Nobody is matched until they press **Start game** again. |
| **Turn timer runs out** | Server fires a random shot for that player (see Step 4). |
| **Player does something not allowed** | Server sends `error` with a readable message. The game stays where it was. |

---

## 6. The server operator's flow

The person at Computer A opens the dashboard in a browser at
`http://localhost:8080`.

- **Sees:** the number of players online and a list of them with their status.
  This updates as people join and leave.
- **Can press RESET:** stops the current game and sets every score back to 0.

---

## 7. The AI bot's flow

The Python bot is just another client. It connects to the server on TCP port
5050 — no browser, no game client — and goes through the same steps as a human:
nickname → lobby → start game (it sends `findMatch` itself) → place ships →
take turns → match over. The server treats it
exactly like a person, so one human can play a full game against it.

---

## Not decided yet

- The port of the game client's local web page. (The prototype in
  `docs/demo/v1` used `http://localhost:3000`.)
- What happens if only one player presses Rematch and the other never does.
