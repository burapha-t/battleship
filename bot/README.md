# Battleship AI — Ghost Fleet + Sonar/Decoy

This folder is intentionally separate from the C# server. The existing raw-TCP game protocol stays unchanged.

## Install

```bash
cd bot
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
```

## 1) Start the local AI helper (for Sonar + history recording)

```bash
python ai_service.py
```

It listens only on `127.0.0.1:8091`. The React UI calls it directly. If it is not running, normal Battleship still works; only the AI Sonar button shows an error.

Each completed human match is saved in `bot/data/player-history.jsonl`. The record contains the player's own ship placement and shot sequence. No opponent hidden board is read from the C# server.

## 2) Start Ghost Fleet

Start the normal C# server first, then:

```bash
python main.py --server 127.0.0.1 --ghost-of Prae
```

For a server on another laptop:

```bash
python main.py --server 192.168.1.20 --ghost-of Prae
```

The bot connects to TCP `5050` exactly like a normal client, sends `join`, `findMatch`, `place`, and `fire`, and learns from the recorded history of `Prae`.

### Cold start

With little/no history, the bot uses a safe fallback. After enough matches are recorded, the Random Forest models are used automatically. The console prints whether each model is ready.

## AI used

- **Ghost placement:** RandomForestClassifier learns which board cells the player tends to use, then chooses a valid 4-ship fleet with high learned score.
- **Ghost shooting:** two RandomForestClassifier models learn the player's next row/column from their previous shot, hit/miss result, turn number, and running hit/miss counts.
- **Sonar:** RandomForestClassifier learns ship-cell patterns from recorded placements. Current observed hit/miss cells modify the score. The service returns two visually identical regions: a high-likelihood signal and a plausible AI-generated decoy.

The fallback rules are only for cold start; the demo should show several recorded matches so the ML path is active.
