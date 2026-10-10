from __future__ import annotations

import argparse
import random
from pathlib import Path

from history import HistoryStore
from models import PlacementModel, ShotStyleModel, random_fleet
from protocol_client import JsonLineClient


class GhostFleetBot:
    def __init__(self, host: str, port: int, ghost_of: str, history_path: str, seed: int = 42):
        self.client = JsonLineClient(host, port)
        self.ghost_of = ghost_of
        self.name = f"Ghost of {ghost_of}"[:16]
        self.history = HistoryStore(history_path)
        self.rng = random.Random(seed)
        self.my_id: str | None = None
        self.opponent_id: str | None = None
        self.own_shots: list[dict] = []
        self.available = {(r, c) for r in range(8) for c in range(8)}

        records = self.history.for_player(ghost_of)
        self.placement_model = PlacementModel(seed)
        self.shot_model = ShotStyleModel(seed)
        placement_ready = self.placement_model.fit(records)
        shot_ready = self.shot_model.fit(records)
        print(f"[ghost] learning from {len(records)} recorded match(es) of {ghost_of}")
        print(f"[ghost] placement ML: {'ready' if placement_ready else 'fallback until more data'}")
        print(f"[ghost] shooting ML: {'ready' if shot_ready else 'fallback until more data'}")

    def run(self) -> None:
        self.client.connect()
        print("[ghost] connected to server")
        try:
            self.client.run(self.on_message)
        finally:
            self.client.close()

    def on_message(self, msg: dict) -> None:
        t = msg.get("type")
        if t == "connected":
            self.my_id = msg.get("id")
            self.client.send({"type": "join", "nickname": self.name})

        elif t == "welcome":
            print(f"[ghost] joined as {msg.get('nickname')}")
            self.client.send({"type": "findMatch"})

        elif t == "matchStart":
            players = msg.get("players", [])
            self.opponent_id = next((p.get("id") for p in players if p.get("id") != self.my_id), None)
            self.own_shots = []
            self.available = {(r, c) for r in range(8) for c in range(8)}
            fleet = self.placement_model.generate_fleet(self.rng) if self.placement_model.fitted else random_fleet(self.rng)
            self.client.send({"type": "place", "ships": fleet})
            print("[ghost] placed fleet")

        elif t == "turn" and msg.get("activePlayerId") == self.my_id:
            row, col = self.shot_model.choose(self.own_shots, self.available, self.rng)
            self.available.discard((row, col))
            self.client.send({"type": "fire", "row": row, "col": col})
            print(f"[ghost] fires {chr(65 + col)}{row + 1}")

        elif t == "fireResult" and msg.get("by") == self.my_id:
            self.own_shots.append({
                "row": int(msg["row"]),
                "col": int(msg["col"]),
                "result": msg.get("result", "miss"),
            })

        elif t == "matchEnd":
            won = msg.get("winnerId") == self.my_id
            print("[ghost] " + ("won" if won else "lost"))

        elif t == "opponentLeft":
            print("[ghost] opponent left; searching again")
            self.client.send({"type": "findMatch"})

        elif t == "reset":
            print("[ghost] server reset; searching again")
            self.client.send({"type": "findMatch"})

        elif t == "error":
            print(f"[ghost] server error: {msg.get('code')}: {msg.get('message')}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Battleship Ghost Fleet AI client")
    parser.add_argument("--server", default="127.0.0.1", help="Battleship server IP")
    parser.add_argument("--port", type=int, default=5050)
    parser.add_argument("--ghost-of", required=True, help="nickname whose style should be copied")
    parser.add_argument("--history", default=str(Path(__file__).with_name("data") / "player-history.jsonl"))
    args = parser.parse_args()
    GhostFleetBot(args.server, args.port, args.ghost_of, args.history).run()


if __name__ == "__main__":
    main()
