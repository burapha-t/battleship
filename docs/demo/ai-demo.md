# AI Demo — Ghost Fleet + Sonar/Decoy

## Local one-laptop demo

One-time AI setup:

```bash
cd bot
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ../web
npm ci
npm run build
cd ..
dotnet build
```

Run only:

Terminal 1:
```bash
dotnet run --project src/Battleship.Server
```

Terminal 2:
```bash
dotnet run --project src/Battleship.Client
```

The client starts the local Sonar/history helper automatically.

Join with a nickname and click **Play vs Ghost Fleet**. No Ghost terminal is needed.

During the match:
- Ghost joins through the same TCP protocol as a normal player.
- AI Sonar shows two possible regions.
- One region can be an AI-generated decoy.
- The AI never reads the current opponent's hidden board.
- At match end Ghost requests rematch automatically.

## Cross-machine demo

Use the same Wi-Fi/LAN.

### Laptop A — server

Find Laptop A's LAN IP on macOS:

```bash
ipconfig getifaddr en0
```

Example:

```text
192.168.1.23
```

Run:

```bash
dotnet run --project src/Battleship.Server
```

Laptop A can also run its own client normally.

### Laptop B — player client

Laptop B needs the repo/build and the one-time Python AI setup in `bot/.venv`.

Run the client and point it to Laptop A without editing source code:

```bash
dotnet run --project src/Battleship.Client -- --server-host 192.168.1.23
```

Open:

```text
http://localhost:3000
```

Now Laptop B's architecture is:

```text
Browser
  -> local Battleship.Client
      -> TCP to Laptop A game server
      -> local AI helper for Sonar/history
      -> local Ghost process when Play vs Ghost Fleet is clicked
```

This fixes the previous localhost limitation:
- `127.0.0.1` for Sonar now intentionally means the AI helper on the player's own laptop.
- The browser never tries to contact Laptop A's port 8091.
- Ghost uses the configured `--server-host`, so Ghost on Laptop B connects to Laptop A automatically.

### Human vs human

Run a client on both laptops. Laptop B uses `--server-host <Laptop-A-IP>`. Both players press **Start game**.

### Human on Laptop B vs Ghost

On Laptop B:
1. join with a nickname;
2. click **Play vs Ghost Fleet**;
3. the local Ghost starts automatically;
4. Ghost connects to Laptop A using the same configured server IP.

### Sonar on both laptops

Each laptop runs its own local AI helper automatically through its own `Battleship.Client`, so each player's Sonar and local history work independently.

## Important limitations

- Both laptops must be able to reach the server's TCP port `5050`.
- macOS/Windows Firewall may ask permission; allow incoming connections for the server.
- A private IP such as `192.168.x.x` normally works only on the same LAN/Wi-Fi.
- Player history is still local to each player's laptop and grouped by nickname.
- Cross-internet play (different networks) needs an externally reachable server/VPN/tunnel and is not covered by this LAN demo.

## 60-second presentation script

> Ghost Fleet is a separate AI client, not hidden logic inside the game server. It connects through the same TCP protocol as a real player, so the server stays authoritative and the AI never receives hidden opponent ship positions. Each player's laptop stores that player's own match history locally by nickname. Random Forest models learn placement and shooting tendencies from that history. AI Sonar also runs locally: it predicts likely regions from learned placement patterns and adds a believable decoy region, so the player cannot blindly trust the AI. For cross-machine play, only the game TCP connection points to the server laptop; Sonar/history stay local on each player's machine.
