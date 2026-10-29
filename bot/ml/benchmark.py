"""Reproducible V1/V2 benchmark against identical hidden legal fleets."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import random
import statistics
import time

from bot.engine import DecisionEngine, random_fleet
from bot.ml.synthetic import generate_fleet
from bot.prior import load_global_prior


def play(hidden, engine):
    occupied = {cell for ship in hidden for cell in ship}
    shots = hits = 0
    decision_seconds = 0.0
    fired = set()
    while len(engine.knowledge.sunk) < 4:
        started = time.monotonic()
        cell = engine.choose()
        decision_seconds += time.monotonic() - started
        if cell is None or cell in fired:
            raise RuntimeError('Engine failed to produce a fresh shot')
        fired.add(cell)
        shots += 1
        ship = next((candidate for candidate in hidden if cell in candidate), None)
        if ship:
            hits += 1
        sunk = ship if ship and set(ship) <= fired else ()
        engine.knowledge.observe(cell, 'hit' if cell in occupied else 'miss', sunk)
    return {'shots': shots, 'hits': hits, 'decision_seconds': decision_seconds}


def summarize(results):
    shots = [row['shots'] for row in results]
    total_shots = sum(shots)
    total_seconds = sum(row['decision_seconds'] for row in results)
    return {
        'games': len(results),
        'average_shots': round(statistics.mean(shots), 3),
        'median_shots': round(statistics.median(shots), 3),
        'shot_accuracy': round(sum(row['hits'] for row in results) / total_shots, 5),
        'average_decision_ms': round(1000 * total_seconds / total_shots, 3),
        'total_decision_seconds': round(total_seconds, 3),
    }


def benchmark(games_per_group, seeds, budget, node_budget, artifact):
    prior = load_global_prior(artifact)
    config = json.loads((Path(__file__).parent / 'training_config.json').read_text(encoding='utf-8'))
    distribution = config['dataset']['style_distribution']
    groups = {
        'random_legal': [random_fleet(random.Random(900000 + i)) for i in range(games_per_group)],
        'held_out_synthetic': [generate_fleet(random.Random(800000 + i),
                                              random.Random(700000 + i).choices(
                                                  list(distribution), weights=list(distribution.values()))[0])
                               for i in range(games_per_group)],
    }
    report = {
        'benchmark_version': 1,
        'artifact': str(Path(artifact).name),
        'games_per_group': games_per_group,
        'engine_seeds': seeds,
        'decision_budget_seconds': budget,
        'deterministic_node_budget': node_budget,
        'warning': 'Synthetic performance does not establish performance against real humans.',
        'groups': {},
    }
    for group_name, fleets in groups.items():
        modes = {'v1_uniform': [], 'v2_synthetic_ml': []}
        for fleet_index, fleet in enumerate(fleets):
            seed = seeds[fleet_index % len(seeds)]
            modes['v1_uniform'].append(play(fleet, DecisionEngine(
                seed=seed, budget_seconds=budget, node_budget=node_budget)))
            modes['v2_synthetic_ml'].append(play(fleet, DecisionEngine(
                seed=seed, prior=prior, budget_seconds=budget, node_budget=node_budget)))
        report['groups'][group_name] = {name: summarize(rows) for name, rows in modes.items()}
    return report


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description='Compare Ghost Fleet V1 and V2')
    parser.add_argument('--games-per-group', type=int, default=12)
    parser.add_argument('--seeds', default='11,29,47')
    parser.add_argument('--budget', type=float, default=2.0,
                        help='safety time limit; deterministic node budget normally stops first')
    parser.add_argument('--nodes', type=int, default=25000)
    parser.add_argument('--artifact', type=Path, default=root / 'models' / 'global_prior_v2.json')
    parser.add_argument('--output', type=Path, default=root / 'benchmarks' / 'v1_vs_v2.json')
    args = parser.parse_args()
    report = benchmark(args.games_per_group, [int(value) for value in args.seeds.split(',')],
                       args.budget, args.nodes, args.artifact)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == '__main__':
    main()
