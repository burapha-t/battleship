"""Full-fleet inference, independent of transport, accounts and board ownership."""
from __future__ import annotations

from dataclasses import dataclass, field
import math
import random
import time
from typing import Protocol

Cell = tuple[int, int]
Ship = tuple[Cell, ...]
Fleet = tuple[Ship, ...]
CELLS = tuple((r, c) for r in range(8) for c in range(8))
SHIPS = tuple(tuple((r + dr * i, c + dc * i) for i in range(4))
              for dr, dc in ((0, 1), (1, 0))
              for r in range(8 - 3 * dr) for c in range(8 - 3 * dc))


def mask(cells):
    return sum(1 << (r * 8 + c) for r, c in set(cells))


MASKS = tuple(mask(s) for s in SHIPS)


class FleetPrior(Protocol):
    """Future models supply a finite nonnegative weight for a complete fleet.

    Providers must be fast and must not perform I/O during inference.
    """
    def weight(self, fleet: Fleet) -> float: ...


@dataclass
class Knowledge:
    hits: set[Cell] = field(default_factory=set)
    misses: set[Cell] = field(default_factory=set)
    sunk: list[Ship] = field(default_factory=list)
    attempted: set[Cell] = field(default_factory=set)

    def observe(self, cell: Cell, result: str, sunk_cells=()):
        if cell not in CELLS or result not in ('hit', 'miss'):
            raise ValueError('Invalid shot result')
        ship = tuple(sorted(tuple(c) for c in sunk_cells))
        if ship and (ship not in SHIPS or result != 'hit' or cell not in ship):
            raise ValueError('Invalid sunk ship')
        self.attempted.add(cell)
        (self.hits if result == 'hit' else self.misses).add(cell)
        if ship and ship not in self.sunk:
            self.sunk.append(ship)
            self.hits.update(ship)
            self.attempted.update(ship)


@dataclass
class Estimate:
    probabilities: dict[Cell, float]
    configurations: int
    complete: bool


class DecisionEngine:
    def __init__(self, seed=42, prior: FleetPrior | None = None, budget_seconds=2.0,
                 node_budget: int | None = None):
        self.rng = random.Random(seed)
        self.prior = prior
        self.budget_seconds = budget_seconds
        self.node_budget = node_budget
        self.knowledge = Knowledge()

    def estimate(self) -> Estimate:
        """Enumerate each unordered legal fleet once, pruning public constraints.

        A deadline bounds work. If interrupted, the randomized traversal prefix
        is an approximate estimate, not an unbiased posterior sample.
        """
        k = self.knowledge
        hits, misses = mask(k.hits), mask(k.misses)
        fixed = [MASKS[SHIPS.index(s)] for s in k.sunk]
        occupied = 0
        for m in fixed:
            if occupied & m:
                return Estimate({}, 0, True)
            occupied |= m
        if hits & misses or occupied & misses or len(fixed) > 4:
            return Estimate({}, 0, True)
        candidates = [i for i, m in enumerate(MASKS)
                      if not m & (misses | occupied) and m & hits != m]
        self.rng.shuffle(candidates)
        suffix = [0] * (len(candidates) + 1)
        for j in range(len(candidates) - 1, -1, -1):
            suffix[j] = suffix[j + 1] | MASKS[candidates[j]]
        counts = [0.0] * len(SHIPS)
        total = 0.0
        found = 0
        nodes = 0
        complete = True
        deadline = time.monotonic() + max(0, self.budget_seconds)
        selected = [SHIPS.index(s) for s in k.sunk]

        def visit(start, used, remaining):
            nonlocal total, found, nodes, complete
            nodes += 1
            if self.node_budget is not None and nodes > self.node_budget:
                complete = False
                return
            if nodes % 256 == 1 and time.monotonic() >= deadline:
                complete = False
                return
            uncovered = hits & ~used
            if bin(uncovered).count('1') > remaining * 4 or uncovered & ~suffix[start]:
                return
            if remaining == 0:
                if uncovered:
                    return
                weight = 1.0 if self.prior is None else self.prior.weight(tuple(SHIPS[i] for i in selected))
                if not math.isfinite(weight) or weight < 0:
                    raise ValueError('Invalid prior weight')
                found += 1
                total += weight
                for i in selected:
                    counts[i] += weight
                return
            for j in range(start, len(candidates) - remaining + 1):
                i = candidates[j]
                if MASKS[i] & used:
                    continue
                selected.append(i)
                visit(j + 1, used | MASKS[i], remaining - 1)
                selected.pop()
                if not complete:
                    return

        visit(0, occupied, 4 - len(fixed))
        probabilities = dict.fromkeys(CELLS, 0.0)
        if total:
            for i, count in enumerate(counts):
                for cell in SHIPS[i]:
                    probabilities[cell] += count / total
        return Estimate(probabilities, found, complete)

    def choose(self) -> Cell | None:
        k = self.knowledge
        available = sorted(set(CELLS) - k.attempted - k.hits - k.misses)
        if not available:
            return None
        try:
            estimate = self.estimate()
            best = max(estimate.probabilities.get(c, 0) for c in available)
        except Exception:
            # A failed future prior must not prevent a legal turn.
            best = 0
        if best > 0:
            choices = [c for c in available if estimate.probabilities.get(c, 0) == best]
        else:
            unresolved = k.hits - {c for s in k.sunk for c in s}
            choices = [c for c in available if any(abs(c[0]-h[0]) + abs(c[1]-h[1]) == 1 for h in unresolved)]
            choices = choices or [c for c in available if sum(c) % 2 == 0] or available
        cell = self.rng.choice(choices)
        k.attempted.add(cell)
        return cell


def random_fleet(rng: random.Random) -> Fleet:
    """Randomized backtracking guarantees a legal complete placement."""
    order = list(range(len(SHIPS)))
    rng.shuffle(order)

    def search(start, used, chosen):
        if len(chosen) == 4:
            return tuple(SHIPS[i] for i in chosen)
        for j in range(start, len(order)):
            i = order[j]
            if not used & MASKS[i]:
                result = search(j + 1, used | MASKS[i], chosen + [i])
                if result:
                    return result
        return None

    return search(0, 0, [])
