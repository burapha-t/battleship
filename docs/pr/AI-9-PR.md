# PR title

```text
[AI-9] AI implementation
```

# PR body

```markdown
## What this PR adds

This PR adds the AI layer for Battleship while keeping the server authoritative and leaving the frozen game TCP protocol unchanged.

### Ghost Fleet
- Python Ghost client joins through the same TCP protocol as a normal player.
- Random Forest models learn player placement and shooting tendencies from local history by nickname.
- Cold-start fallback when there is not enough history.
- Lobby **Play vs Ghost Fleet** button; no manual Ghost terminal needed.
- **Stop Ghost Fleet** control.
- Automatic Ghost rematch request.

### AI Sonar + Decoy
- Local AI helper starts automatically with `Battleship.Client`.
- Browser calls same-origin `/api/ai/*`; the C# client proxies to the local Python helper.
- Removes the previous browser hard-code to `127.0.0.1:8091`.
- Sonar works in cross-machine/LAN play because each player's AI helper stays local.
- Sonar returns learned likely regions plus a plausible decoy.
- Current opponent hidden ship positions are never read.

### Cross-machine support
- Adds `--server-host <ip-or-hostname>` and `--server-port <n>` runtime overrides.
- A remote laptop can connect without editing source code:
  `dotnet run --project src/Battleship.Client -- --server-host 192.168.1.23`
- Ghost started from that remote client automatically connects to the configured server host.
- Sonar/history remain local to each player's laptop.

### History
- Stores completed player history locally in `bot/data/player-history.jsonl`.
- Grouped by nickname.
- Stores own placement, own shots, and result only.

### Demo/docs
- Adds a local and cross-machine AI demo guide.
- Adds PR template/checklist.

## Architecture

Local player:
`Browser -> Battleship.Client -> TCP -> Battleship.Server`

Ghost:
`local Ghost -> TCP -> configured Battleship.Server`

Sonar/history:
`Browser -> Battleship.Client /api/ai/* -> local Python AI helper`

## How to test

### Local
1. `cd bot && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
2. `cd web && npm ci && npm run build`
3. `dotnet run --project src/Battleship.Server`
4. `dotnet run --project src/Battleship.Client`
5. Join and click **Play vs Ghost Fleet**.
6. Test AI Sonar.
7. Finish and verify rematch.

### Cross-machine LAN
1. On Laptop A run the server.
2. Find Laptop A's LAN IP.
3. On Laptop B run:
   `dotnet run --project src/Battleship.Client -- --server-host <Laptop-A-IP>`
4. Verify human-vs-human matchmaking.
5. Verify **Play vs Ghost Fleet** on Laptop B.
6. Verify AI Sonar works on Laptop B without changing an AI IP.

## Checklist

- [ ] `npm run build`
- [ ] `dotnet build`
- [ ] `dotnet test`
- [ ] Human vs human local
- [ ] Human vs Ghost local
- [ ] Human vs human across two laptops
- [ ] Remote laptop can Play vs Ghost Fleet
- [ ] Remote laptop Sonar works
- [ ] Ghost does not repeat fired cells
- [ ] Sonar does not reveal hidden board data
- [ ] Local history is written
- [ ] Rematch works
- [ ] Base game works if optional AI helper is unavailable
```
