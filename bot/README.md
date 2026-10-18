# Battleship AI — Ghost Fleet + Sonar/Decoy

This folder stays separate from the C# game server. The existing raw-TCP game protocol remains unchanged.

## First-time setup

```bash
cd bot
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

After this setup, the normal `Battleship.Client` automatically starts the local Sonar/history helper when it can find `bot/`.

## Play vs Ghost Fleet — no Ghost terminal needed

1. Start the normal Battleship server.
2. Start the normal Battleship client.
3. Enter your nickname.
4. In the lobby press **Play vs Ghost Fleet**.

The local C# client starts `bot/main.py` for you and the Ghost connects to the configured game server over TCP `5050`, exactly like a normal player.

The lobby also has **Stop Ghost Fleet** if you want to return to human matchmaking.

### Manual Ghost command (still supported)

```bash
python main.py --server 127.0.0.1 --ghost-of Prae
```

For a server on another laptop:

```bash
python main.py --server 192.168.1.20 --ghost-of Prae
```

## Sonar + history

The helper listens on `127.0.0.1:8091`. If it is unavailable, normal Battleship still works; only AI Sonar/history recording is unavailable.

Each completed human match is saved locally in:

```text
bot/data/player-history.jsonl
```

Records are grouped by player nickname and contain the player's own ship placement, shot sequence, and result. The AI never reads the current opponent's hidden board.

## AI used

- **Ghost placement:** RandomForestClassifier learns which board cells the player tends to use, then scores valid fleets.
- **Ghost shooting:** RandomForestClassifier models learn next-row/next-column tendencies from prior shots and outcomes.
- **Sonar:** RandomForestClassifier learns ship-cell patterns from recorded placements.
- **Decoy:** the service returns a plausible false signal beside the learned signal so the player cannot blindly trust Sonar.

Cold-start fallback is used when there is not enough history. The console reports when the ML models are ready.
