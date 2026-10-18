from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Iterable

import numpy as np
from sklearn.ensemble import RandomForestClassifier

from history import PlayerMatch

GRID = 8
SHIP_LEN = 4
SHIP_COUNT = 4


def _all_ship_candidates() -> list[list[list[int]]]:
    candidates: list[list[list[int]]] = []
    for r in range(GRID):
        for c in range(GRID - SHIP_LEN + 1):
            candidates.append([[r, c + i] for i in range(SHIP_LEN)])
    for c in range(GRID):
        for r in range(GRID - SHIP_LEN + 1):
            candidates.append([[r + i, c] for i in range(SHIP_LEN)])
    return candidates


SHIP_CANDIDATES = _all_ship_candidates()


def _cell_features(row: int, col: int) -> list[float]:
    edge = min(row, col, GRID - 1 - row, GRID - 1 - col)
    center_distance = abs(row - 3.5) + abs(col - 3.5)
    corner_distance = min(
        row + col,
        row + (GRID - 1 - col),
        (GRID - 1 - row) + col,
        (GRID - 1 - row) + (GRID - 1 - col),
    )
    return [row, col, edge, center_distance, corner_distance]


class PlacementModel:
    """Learns which cells tend to contain ships from historical placements."""

    def __init__(self, seed: int = 17):
        self.model = RandomForestClassifier(
            n_estimators=160,
            max_depth=7,
            min_samples_leaf=2,
            random_state=seed,
            class_weight="balanced_subsample",
        )
        self.fitted = False

    def fit(self, matches: Iterable[PlayerMatch]) -> bool:
        x: list[list[float]] = []
        y: list[int] = []
        for match in matches:
            occupied = {
                (int(cell[0]), int(cell[1]))
                for ship in match.ships
                for cell in ship
            }
            if not occupied:
                continue
            for r in range(GRID):
                for c in range(GRID):
                    x.append(_cell_features(r, c))
                    y.append(1 if (r, c) in occupied else 0)
        if len(x) < 64 or len(set(y)) < 2:
            self.fitted = False
            return False
        self.model.fit(x, y)
        self.fitted = True
        return True

    def cell_scores(self) -> np.ndarray:
        if not self.fitted:
            return np.full((GRID, GRID), 0.5, dtype=float)
        x = [_cell_features(r, c) for r in range(GRID) for c in range(GRID)]
        probs = self.model.predict_proba(x)
        classes = list(self.model.classes_)
        positive_idx = classes.index(1)
        return probs[:, positive_idx].reshape(GRID, GRID)

    def generate_fleet(self, rng: random.Random) -> list[list[list[int]]]:
        scores = self.cell_scores()
        ranked = []
        for candidate in SHIP_CANDIDATES:
            avg = sum(scores[r, c] for r, c in candidate) / SHIP_LEN
            ranked.append((avg + rng.random() * 0.08, candidate))
        ranked.sort(reverse=True, key=lambda x: x[0])

        selected: list[list[list[int]]] = []
        occupied: set[tuple[int, int]] = set()
        for _, candidate in ranked:
            cells = {(r, c) for r, c in candidate}
            if cells & occupied:
                continue
            selected.append(candidate)
            occupied |= cells
            if len(selected) == SHIP_COUNT:
                return selected

        # Very unlikely fallback.
        return random_fleet(rng)


class ShotStyleModel:
    """Two small Random Forests that imitate a player's next row and column."""

    def __init__(self, seed: int = 31):
        kwargs = dict(
            n_estimators=180,
            max_depth=8,
            min_samples_leaf=1,
            random_state=seed,
        )
        self.row_model = RandomForestClassifier(**kwargs)
        self.col_model = RandomForestClassifier(**{**kwargs, "random_state": seed + 1})
        self.fitted = False

    @staticmethod
    def _features(turn_idx: int, prev: dict | None, hits: int, misses: int) -> list[float]:
        if prev is None:
            return [turn_idx, -1, -1, -1, hits, misses]
        return [
            turn_idx,
            int(prev["row"]),
            int(prev["col"]),
            1 if prev.get("result") == "hit" else 0,
            hits,
            misses,
        ]

    def fit(self, matches: Iterable[PlayerMatch]) -> bool:
        x: list[list[float]] = []
        y_row: list[int] = []
        y_col: list[int] = []
        for match in matches:
            hits = misses = 0
            prev = None
            for i, shot in enumerate(match.shots, start=1):
                if "row" not in shot or "col" not in shot:
                    continue
                x.append(self._features(i, prev, hits, misses))
                y_row.append(int(shot["row"]))
                y_col.append(int(shot["col"]))
                if shot.get("result") == "hit":
                    hits += 1
                else:
                    misses += 1
                prev = shot
        if len(x) < 8:
            self.fitted = False
            return False
        self.row_model.fit(x, y_row)
        self.col_model.fit(x, y_col)
        self.fitted = True
        return True

    def choose(
        self,
        own_shots: list[dict],
        available: set[tuple[int, int]],
        rng: random.Random,
    ) -> tuple[int, int]:
        if not available:
            raise RuntimeError("No available cells")
        if not self.fitted:
            return smart_fallback(own_shots, available, rng)

        hits = sum(1 for s in own_shots if s.get("result") == "hit")
        misses = sum(1 for s in own_shots if s.get("result") == "miss")
        prev = own_shots[-1] if own_shots else None
        feat = [self._features(len(own_shots) + 1, prev, hits, misses)]
        row_probs = dict(zip(self.row_model.classes_, self.row_model.predict_proba(feat)[0]))
        col_probs = dict(zip(self.col_model.classes_, self.col_model.predict_proba(feat)[0]))

        def score(cell: tuple[int, int]) -> float:
            r, c = cell
            return float(row_probs.get(r, 0.001) * col_probs.get(c, 0.001))

        ranked = sorted(available, key=score, reverse=True)
        # Add slight variety so the ghost does not become deterministic.
        top = ranked[: min(5, len(ranked))]
        weights = [max(score(c), 1e-6) for c in top]
        return rng.choices(top, weights=weights, k=1)[0]


def smart_fallback(
    shots: list[dict],
    available: set[tuple[int, int]],
    rng: random.Random,
) -> tuple[int, int]:
    # After a hit, prefer valid orthogonal neighbours. This is a fallback only,
    # not the ML behaviour used once enough history exists.
    if shots and shots[-1].get("result") == "hit":
        r, c = int(shots[-1]["row"]), int(shots[-1]["col"])
        neighbours = [(r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)]
        neighbours = [p for p in neighbours if p in available]
        if neighbours:
            return rng.choice(neighbours)
    # Checkerboard search is more efficient than pure random and keeps demos short.
    checker = [p for p in available if (p[0] + p[1]) % 2 == 0]
    return rng.choice(checker or list(available))


def random_fleet(rng: random.Random) -> list[list[list[int]]]:
    candidates = SHIP_CANDIDATES[:]
    rng.shuffle(candidates)
    out: list[list[list[int]]] = []
    occupied: set[tuple[int, int]] = set()
    for candidate in candidates:
        cells = {(r, c) for r, c in candidate}
        if cells & occupied:
            continue
        out.append(candidate)
        occupied |= cells
        if len(out) == SHIP_COUNT:
            return out
    raise RuntimeError("Could not generate fleet")


@dataclass
class SonarResult:
    cells: list[list[int]]
    confidence: float


class SonarModel:
    """ML-backed sonar plus one plausible decoy region."""

    def __init__(self, matches: Iterable[PlayerMatch], seed: int = 73):
        self.rng = random.Random(seed)
        self.placement = PlacementModel(seed=seed)
        self.placement.fit(matches)

    def scan(self, shots: list[dict]) -> list[SonarResult]:
        scores = self.placement.cell_scores().copy()
        shot_map = {(int(s["row"]), int(s["col"])): s.get("result") for s in shots}

        # Respect observed information: misses are impossible, hits are highly likely.
        for (r, c), result in shot_map.items():
            if 0 <= r < GRID and 0 <= c < GRID:
                scores[r, c] = 0.0 if result == "miss" else 1.0
                if result == "hit":
                    for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
                        if 0 <= nr < GRID and 0 <= nc < GRID and (nr, nc) not in shot_map:
                            scores[nr, nc] = min(1.0, scores[nr, nc] + 0.20)

        real = self._best_region(scores, excluded=set(shot_map))
        blocked = set(map(tuple, real.cells)) | set(shot_map)
        decoy = self._believable_decoy(scores, blocked)
        # Shuffle so the UI/player cannot know which signal is the decoy.
        results = [real, decoy]
        self.rng.shuffle(results)
        return results

    def _best_region(self, scores: np.ndarray, excluded: set[tuple[int, int]]) -> SonarResult:
        candidates = []
        for r in range(GRID - 1):
            for c in range(GRID - 1):
                cells = [(r, c), (r + 1, c), (r, c + 1), (r + 1, c + 1)]
                usable = [p for p in cells if p not in excluded]
                if not usable:
                    continue
                mean = float(np.mean([scores[a, b] for a, b in usable]))
                candidates.append((mean, cells))
        mean, cells = max(candidates, key=lambda x: x[0])
        return SonarResult([[r, c] for r, c in cells], round(mean, 3))

    def _believable_decoy(self, scores: np.ndarray, blocked: set[tuple[int, int]]) -> SonarResult:
        candidates = []
        for r in range(GRID - 1):
            for c in range(GRID - 1):
                cells = [(r, c), (r + 1, c), (r, c + 1), (r + 1, c + 1)]
                if any(p in blocked for p in cells):
                    continue
                mean = float(np.mean([scores[a, b] for a, b in cells]))
                # A good decoy should be plausible but not simply the #2 maximum.
                plausibility = mean + self.rng.random() * 0.12
                candidates.append((plausibility, mean, cells))
        if not candidates:
            free = [(r, c) for r in range(GRID) for c in range(GRID) if (r, c) not in blocked]
            cell = self.rng.choice(free)
            return SonarResult([[cell[0], cell[1]]], 0.5)
        _, mean, cells = max(candidates, key=lambda x: x[0])
        return SonarResult([[r, c] for r, c in cells], round(mean, 3))
