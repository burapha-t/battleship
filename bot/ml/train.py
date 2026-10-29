"""Offline Random Forest training; runtime Ghost Fleet never imports sklearn."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import random

from bot.engine import CELLS
from bot.ml.synthetic import write_dataset


def cell_features(cell):
    row, col = cell
    edge = min(row, col, 7 - row, 7 - col)
    corner = min(row + col, row + 7 - col, 7 - row + col, 14 - row - col)
    center = abs(row - 3.5) + abs(col - 3.5)
    return [row / 7, col / 7, edge / 3, corner / 7, center / 7,
            float(edge == 0), float(corner == 0), (row - 3.5) ** 2 / 12.25,
            (col - 3.5) ** 2 / 12.25]


def load_dataset(path):
    with Path(path).open(encoding='utf-8') as stream:
        metadata = json.loads(next(stream))
        records = [json.loads(line) for line in stream if line.strip()]
    if metadata.get('source') != 'SYNTHETIC' or any(row.get('source') != 'SYNTHETIC' for row in records):
        raise ValueError('This V2 trainer requires explicitly labelled SYNTHETIC data')
    return metadata, records


def split_indices(size, test_fraction, seed):
    indices = list(range(size))
    random.Random(seed).shuffle(indices)
    test_size = max(1, round(size * test_fraction))
    return indices[test_size:], indices[:test_size]


def expand(records, indices):
    features, targets = [], []
    for index in indices:
        occupied = {tuple(cell) for ship in records[index]['ships'] for cell in ship}
        for cell in CELLS:
            features.append(cell_features(cell))
            targets.append(int(cell in occupied))
    return features, targets


def _metrics(targets, probabilities):
    from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
    return {
        'brier_score': round(float(brier_score_loss(targets, probabilities)), 8),
        'log_loss': round(float(log_loss(targets, probabilities)), 8),
        'roc_auc': round(float(roc_auc_score(targets, probabilities)), 8),
    }


def train(dataset_path, artifact_path, config_path):
    import numpy as np
    import sklearn
    from sklearn.ensemble import RandomForestClassifier

    config = json.loads(Path(config_path).read_text(encoding='utf-8'))
    metadata, records = load_dataset(dataset_path)
    split = config['split']
    train_ids, test_ids = split_indices(len(records), split['test_fraction'], split['seed'])
    train_x, train_y = expand(records, train_ids)
    test_x, test_y = expand(records, test_ids)
    parameters = dict(config['model'])
    model = RandomForestClassifier(**parameters)
    model.fit(train_x, train_y)

    raw_cells = model.predict_proba([cell_features(cell) for cell in CELLS])[:, 1]
    calibration = config['calibration']
    base = 16 / 64
    smoothed = calibration['shrinkage'] * base + (1 - calibration['shrinkage']) * raw_cells
    clipped = np.clip(smoothed, calibration['clip_min'], calibration['clip_max'])
    test_rf = [float(clipped[index % 64]) for index in range(len(test_y))]

    train_counts = np.zeros(64)
    for record_id in train_ids:
        occupied = {tuple(cell) for ship in records[record_id]['ships'] for cell in ship}
        train_counts += np.array([cell in occupied for cell in CELLS])
    empirical_cells = np.clip(train_counts / len(train_ids), calibration['clip_min'], calibration['clip_max'])
    test_empirical = [float(empirical_cells[index % 64]) for index in range(len(test_y))]
    evaluation = {
        'held_out_fleets': len(test_ids),
        'train_fleets': len(train_ids),
        'random_forest': _metrics(test_y, test_rf),
        'empirical_cell_frequency': _metrics(test_y, test_empirical),
        'comparison': 'Lower Brier score and log loss are better; higher ROC AUC is better.',
    }
    artifact = {
        'artifact_version': 1,
        'name': 'Ghost Fleet V2 Synthetic Global ML Prior',
        'created_utc': datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        'created_by': 'bot.ml.train',
        'rules': {'board_size': 8, 'ship_count': 4, 'ship_length': 4, 'overlap': False},
        'training': {
            'data_source': 'synthetic',
            'disclaimer': 'Simulated preferences; not evidence of real human behavior.',
            'dataset_size': len(records), 'dataset_seed': metadata['seed'],
            'style_distribution': metadata['style_distribution'],
            'split_seed': split['seed'], 'test_fraction': split['test_fraction'],
            'method': 'sklearn.ensemble.RandomForestClassifier',
            'parameters': parameters, 'sklearn_version': sklearn.__version__,
            'features': config['features'],
        },
        'calibration': calibration,
        'evaluation': evaluation,
        'cell_order': 'row-major, index = row * 8 + column',
        'cell_occupancy_probabilities': [round(float(value), 10) for value in clipped],
    }
    artifact_path = Path(artifact_path)
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    artifact_path.write_text(json.dumps(artifact, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    return artifact


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description='Train Ghost Fleet V2 offline')
    parser.add_argument('--config', type=Path, default=root / 'ml' / 'training_config.json')
    parser.add_argument('--dataset', type=Path, default=root / 'generated' / 'synthetic_fleets.jsonl')
    parser.add_argument('--artifact', type=Path, default=root / 'models' / 'global_prior_v2.json')
    parser.add_argument('--generate', action='store_true', help='regenerate the SYNTHETIC dataset first')
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding='utf-8'))
    if args.generate:
        dataset = config['dataset']
        write_dataset(args.dataset, dataset['size'], dataset['style_distribution'], dataset['seed'])
    artifact = train(args.dataset, args.artifact, args.config)
    print(json.dumps(artifact['evaluation'], indent=2, sort_keys=True))


if __name__ == '__main__':
    main()
