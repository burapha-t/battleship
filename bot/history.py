from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable


@dataclass
class PlayerMatch:
    player_name: str
    match_id: str
    ships: list[list[list[int]]]
    shots: list[dict]
    won: bool


class HistoryStore:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def append(self, record: PlayerMatch) -> None:
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(asdict(record), separators=(",", ":")) + "\n")

    def all(self) -> list[PlayerMatch]:
        if not self.path.exists():
            return []
        out: list[PlayerMatch] = []
        for line in self.path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                raw = json.loads(line)
                out.append(PlayerMatch(**raw))
            except (ValueError, TypeError, json.JSONDecodeError):
                continue
        return out

    def for_player(self, player_name: str) -> list[PlayerMatch]:
        key = player_name.strip().casefold()
        return [m for m in self.all() if m.player_name.strip().casefold() == key]


def normalize_ships(ships: Iterable[Iterable[Iterable[int]]]) -> list[list[list[int]]]:
    return [
        [[int(cell[0]), int(cell[1])] for cell in ship]
        for ship in ships
    ]
