"""Generate reproducible, explicitly synthetic human-like legal fleets."""
from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path

from bot.engine import MASKS, SHIPS

STYLES = ('random', 'edge', 'corner', 'center', 'horizontal', 'vertical', 'mixed')


def _distance(cell, kind):
    row, col = cell
    if kind == 'edge':
        return min(row, col, 7 - row, 7 - col)
    if kind == 'corner':
        return min(row + col, row + 7 - col, 7 - row + col, 14 - row - col)
    return abs(row - 3.5) + abs(col - 3.5)


def _score(ship, style):
    if style == 'random':
        return 1.0
    if style in ('edge', 'corner', 'center'):
        scale = {'edge': 0.9, 'corner': 0.48, 'center': 0.55}[style]
        return math.exp(-scale * sum(_distance(cell, style) for cell in ship) / 4)
    horizontal = ship[0][0] == ship[-1][0]
    return 5.0 if horizontal == (style == 'horizontal') else 1.0


def _weighted_order(rng, choices):
    return [item for _, item in sorted((-math.log(max(rng.random(), 1e-12)) / weight, item)
                                        for item, weight in choices)]


def generate_fleet(rng: random.Random, style='random'):
    """Generate one legal complete fleet with a noisy placement preference."""
    if style not in STYLES:
        raise ValueError(f'Unknown synthetic style: {style}')
    if style == 'mixed':
        first, second = rng.sample(STYLES[1:-1], 2)
        blend = rng.uniform(0.3, 0.7)

        def preference(ship):
            return blend * _score(ship, first) + (1 - blend) * _score(ship, second)
    else:
        preference = lambda ship: _score(ship, style)

    def search(used, selected):
        if len(selected) == 4:
            return tuple(SHIPS[index] for index in selected)
        available = [(index, max(1e-6, preference(ship) * rng.uniform(0.7, 1.3)))
                     for index, ship in enumerate(SHIPS) if not MASKS[index] & used]
        for index in _weighted_order(rng, available):
            result = search(used | MASKS[index], selected + [index])
            if result:
                return result
        return None

    return search(0, [])


def choose_style(rng, distribution):
    names = list(distribution)
    weights = [float(distribution[name]) for name in names]
    if any(weight < 0 for weight in weights) or not sum(weights):
        raise ValueError('Style weights must be nonnegative with a positive total')
    return rng.choices(names, weights=weights, k=1)[0]


def generate_records(size, distribution, seed):
    rng = random.Random(seed)
    for index in range(size):
        style = choose_style(rng, distribution)
        fleet = generate_fleet(rng, style)
        yield {
            'id': index,
            'source': 'SYNTHETIC',
            'style': style,
            'ships': [[[row, col] for row, col in ship] for ship in fleet],
        }


def write_dataset(path, size, distribution, seed):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    metadata = {
        'record_type': 'metadata', 'dataset_version': 1, 'source': 'SYNTHETIC',
        'disclaimer': 'Simulated preferences; not evidence of real human behavior.',
        'rules': {'board_size': 8, 'ship_count': 4, 'ship_length': 4, 'overlap': False},
        'size': size, 'seed': seed, 'style_distribution': distribution,
    }
    with path.open('w', encoding='utf-8') as stream:
        stream.write(json.dumps(metadata, sort_keys=True) + '\n')
        for record in generate_records(size, distribution, seed):
            stream.write(json.dumps(record, separators=(',', ':'), sort_keys=True) + '\n')
    return metadata


def load_config(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description='Generate SYNTHETIC Ghost Fleet V2 placements')
    parser.add_argument('--config', type=Path, default=root / 'ml' / 'training_config.json')
    parser.add_argument('--output', type=Path, default=root / 'generated' / 'synthetic_fleets.jsonl')
    parser.add_argument('--size', type=int)
    parser.add_argument('--seed', type=int)
    args = parser.parse_args()
    config = load_config(args.config)['dataset']
    metadata = write_dataset(args.output, args.size or config['size'], config['style_distribution'],
                             config['seed'] if args.seed is None else args.seed)
    print(json.dumps(metadata, indent=2, sort_keys=True))


if __name__ == '__main__':
    main()
