import random
import time
import unittest
from bot.engine import CELLS, SHIPS, DecisionEngine, random_fleet


class EngineTests(unittest.TestCase):
    def test_legal_fleet_generation(self):
        for seed in range(100):
            fleet = random_fleet(random.Random(seed))
            self.assertEqual(len(fleet), 4)
            self.assertEqual(len({c for s in fleet for c in s}), 16)
            for ship in fleet:
                self.assertEqual(len(ship), 4)
                self.assertIn(ship, SHIPS)

    def test_empty_board_exact_probabilities_and_performance(self):
        start = time.monotonic()
        result = DecisionEngine(budget_seconds=8).estimate()
        self.assertTrue(result.complete)
        self.assertEqual(result.configurations, 502316)
        self.assertAlmostEqual(sum(result.probabilities.values()), 16)
        for (r, c), p in result.probabilities.items():
            self.assertTrue(0 <= p <= 1)
            self.assertAlmostEqual(p, result.probabilities[(7-r, 7-c)])
        self.assertLess(time.monotonic() - start, 10)

    def test_hit_miss_constraints(self):
        engine = DecisionEngine()
        engine.knowledge.observe((0, 0), 'hit')
        engine.knowledge.observe((0, 1), 'miss')
        result = engine.estimate()
        self.assertGreater(result.configurations, 0)
        self.assertAlmostEqual(result.probabilities[(0, 0)], 1)
        self.assertEqual(result.probabilities[(0, 1)], 0)
        # The corner hit can only belong to a vertical ship.
        self.assertAlmostEqual(result.probabilities[(3, 0)], 1)

    def test_sunk_and_touching_ships(self):
        engine = DecisionEngine()
        fleet = tuple(tuple((r, c) for c in range(4)) for r in range(4))
        for ship in fleet[:3]:
            engine.knowledge.observe(ship[-1], 'hit', ship)
        for cell in CELLS:
            if cell not in {c for s in fleet for c in s}:
                engine.knowledge.observe(cell, 'miss')
        result = engine.estimate()
        self.assertEqual(result.configurations, 1)
        self.assertTrue(all(result.probabilities[c] == 1 for s in fleet for c in s))
        self.assertIn(engine.choose(), fleet[-1])
        engine.knowledge.observe(fleet[-1][-1], 'hit', fleet[-1])
        self.assertEqual(engine.estimate().configurations, 1)
        self.assertIsNone(engine.choose())

    def test_fully_hit_ship_requires_sunk_event(self):
        engine = DecisionEngine()
        for c in range(4):
            engine.knowledge.observe((0, c), 'hit')
        for r in range(1, 8):
            for c in range(8):
                engine.knowledge.observe((r, c), 'miss')
        self.assertEqual(engine.estimate().configurations, 0)

    def test_no_repeats_fallback_and_seed(self):
        a, b = DecisionEngine(seed=7, budget_seconds=0), DecisionEngine(seed=7, budget_seconds=0)
        shots = [a.choose() for _ in range(64)]
        self.assertEqual(shots, [b.choose() for _ in range(64)])
        self.assertEqual(len(set(shots)), 64)
        self.assertIsNone(a.choose())

    def test_inconsistent_knowledge_and_failed_prior(self):
        engine = DecisionEngine()
        engine.knowledge.observe((0, 0), 'hit')
        engine.knowledge.observe((0, 0), 'miss')
        self.assertEqual(engine.estimate().configurations, 0)
        self.assertNotEqual(engine.choose(), (0, 0))
        class BrokenPrior:
            def weight(self, fleet):
                raise RuntimeError('Unavailable')
        self.assertIn(DecisionEngine(prior=BrokenPrior()).choose(), CELLS)

    def test_prior_weights_complete_fleets(self):
        fleet = random_fleet(random.Random(8))
        class Prior:
            def weight(self, candidate):
                return float(set(candidate) == set(fleet))
        engine = DecisionEngine(prior=Prior(), budget_seconds=8)
        result = engine.estimate()
        self.assertTrue(result.complete)
        occupied = {c for s in fleet for c in s}
        for cell in CELLS:
            self.assertEqual(result.probabilities[cell], float(cell in occupied))

    def test_complete_simulated_games(self):
        for seed in range(3):
            hidden = random_fleet(random.Random(seed + 100))
            engine = DecisionEngine(seed=seed)
            shots = set()
            start = time.monotonic()
            for _ in range(64):
                cell = engine.choose()
                self.assertNotIn(cell, shots)
                shots.add(cell)
                ship = next((s for s in hidden if cell in s), None)
                sunk = ship if ship and set(ship) <= shots else ()
                engine.knowledge.observe(cell, 'hit' if ship else 'miss', sunk)
                if len(engine.knowledge.sunk) == 4:
                    break
            self.assertEqual(len(engine.knowledge.sunk), 4)
            print('simulation', seed, 'shots', len(shots), 'seconds', round(time.monotonic()-start, 3))
