import json
import random
import tempfile
import unittest
from pathlib import Path

from bot.engine import CELLS, SHIPS, DecisionEngine, random_fleet
from bot.ml.synthetic import STYLES, generate_fleet, generate_records
from bot.ml.train import split_indices
from bot.prior import DEFAULT_ARTIFACT, GlobalMLPrior, load_global_prior, select_prior


class GhostFleetV2Tests(unittest.TestCase):
    def test_every_synthetic_style_is_legal_and_reproducible(self):
        for style in STYLES:
            first = generate_fleet(random.Random(100 + STYLES.index(style)), style)
            second = generate_fleet(random.Random(100 + STYLES.index(style)), style)
            self.assertEqual(first, second)
            self.assertEqual(len(first), 4)
            self.assertEqual(len({cell for ship in first for cell in ship}), 16)
            self.assertTrue(all(ship in SHIPS for ship in first))
        distribution = {style: 1 for style in STYLES}
        records = list(generate_records(200, distribution, 9))
        self.assertEqual(records, list(generate_records(200, distribution, 9)))
        for record in records:
            fleet = tuple(tuple(tuple(cell) for cell in ship) for ship in record['ships'])
            self.assertEqual(record['source'], 'SYNTHETIC')
            self.assertEqual(len({cell for ship in fleet for cell in ship}), 16)
            self.assertTrue(all(ship in SHIPS for ship in fleet))

    def test_split_is_by_complete_fleet_without_leakage(self):
        train, test = split_indices(100, 0.2, 7)
        self.assertFalse(set(train) & set(test))
        self.assertEqual(set(train) | set(test), set(range(100)))
        self.assertEqual(len(test), 20)

    def test_pretrained_artifact_loads_and_changes_complete_fleet_weights(self):
        prior = load_global_prior(DEFAULT_ARTIFACT)
        top = tuple(tuple((row, col) for col in range(4)) for row in range(4))
        bottom = tuple(tuple((row, col) for col in range(4, 8)) for row in range(4, 8))
        self.assertGreater(prior.weight(top), 0)
        self.assertGreater(prior.weight(bottom), 0)
        self.assertNotEqual(prior.weight(top), prior.weight(bottom))

    def test_missing_and_invalid_artifacts_fall_back_to_v1(self):
        with tempfile.TemporaryDirectory() as folder:
            missing = Path(folder) / 'missing.json'
            for mode in ('auto', 'v2'):
                prior, status = select_prior(mode, missing)
                self.assertIsNone(prior)
                self.assertIn('Falling back', status)
            invalid = Path(folder) / 'bad.json'
            invalid.write_text('{"artifact_version":999}', encoding='utf-8')
            self.assertIsNone(select_prior('v2', invalid)[0])
            invalid.write_text('[]', encoding='utf-8')
            self.assertIsNone(select_prior('auto', invalid)[0])
        self.assertIsNone(select_prior('v1')[0])
        self.assertIn('Uniform', select_prior('v1')[1])

    def test_v2_weights_only_legal_constraint_consistent_fleets(self):
        probabilities = [0.65 if row < 4 else 0.12 for row, _ in CELLS]
        engine = DecisionEngine(seed=5, prior=GlobalMLPrior(probabilities), budget_seconds=8)
        engine.knowledge.observe((0, 0), 'hit')
        engine.knowledge.observe((0, 1), 'miss')
        result = engine.estimate()
        self.assertGreater(result.configurations, 0)
        self.assertAlmostEqual(result.probabilities[(0, 0)], 1)
        self.assertEqual(result.probabilities[(0, 1)], 0)
        self.assertAlmostEqual(result.probabilities[(3, 0)], 1)

        ship = tuple((7, col) for col in range(4))
        engine.knowledge.observe(ship[-1], 'hit', ship)
        self.assertTrue(all(engine.estimate().probabilities[cell] > 0 for cell in ship))

    def test_v1_selection_preserves_uniform_engine_and_v2_never_repeats(self):
        hidden = random_fleet(random.Random(99))
        a = DecisionEngine(seed=12, budget_seconds=0)
        b = DecisionEngine(seed=12, prior=select_prior('v1')[0], budget_seconds=0)
        self.assertEqual([a.choose() for _ in range(64)], [b.choose() for _ in range(64)])

        engine = DecisionEngine(seed=4, prior=load_global_prior(), budget_seconds=0.02)
        fired = set()
        for _ in range(64):
            cell = engine.choose()
            self.assertNotIn(cell, fired)
            fired.add(cell)
            ship = next((candidate for candidate in hidden if cell in candidate), None)
            sunk = ship if ship and set(ship) <= fired else ()
            engine.knowledge.observe(cell, 'hit' if ship else 'miss', sunk)
            if len(engine.knowledge.sunk) == 4:
                break
        self.assertEqual(len(engine.knowledge.sunk), 4)

    def test_benchmark_node_budget_is_reproducible(self):
        first = DecisionEngine(seed=77, budget_seconds=2, node_budget=25000).estimate()
        second = DecisionEngine(seed=77, budget_seconds=2, node_budget=25000).estimate()
        self.assertFalse(first.complete)
        self.assertEqual(first.configurations, second.configurations)
        self.assertEqual(first.probabilities, second.probabilities)


if __name__ == '__main__':
    unittest.main()
