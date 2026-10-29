"""Validated, dependency-free loading for Ghost Fleet's global fleet prior."""
from __future__ import annotations

import json
import math
from pathlib import Path

from .engine import CELLS, SHIPS, Fleet

ARTIFACT_VERSION = 1
DEFAULT_ARTIFACT = Path(__file__).resolve().parent / 'models' / 'global_prior_v2.json'


class GlobalMLPrior:
    """Weights complete legal fleets from precomputed cell occupancy probabilities."""

    def __init__(self, probabilities, strength=0.35):
        if len(probabilities) != len(CELLS):
            raise ValueError('Expected 64 cell probabilities')
        values = [float(value) for value in probabilities]
        if any(not math.isfinite(value) or not 0 < value < 1 for value in values):
            raise ValueError('Cell probabilities must be finite and between zero and one')
        if not math.isfinite(strength) or not 0 <= strength <= 2:
            raise ValueError('Prior strength is out of range')
        logits = {cell: math.log(value / (1 - value)) for cell, value in zip(CELLS, values)}
        self._center = 16 * sum(logits.values()) / len(logits)
        self._strength = strength
        self._ship_scores = {ship: sum(logits[cell] for cell in ship) for ship in SHIPS}

    def weight(self, fleet: Fleet) -> float:
        score = self._strength * (sum(self._ship_scores[ship] for ship in fleet) - self._center)
        return math.exp(max(-12.0, min(12.0, score)))


def load_global_prior(path=DEFAULT_ARTIFACT):
    """Load and validate the small JSON artifact used by the runtime bot."""
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(data, dict):
        raise ValueError('Artifact root must be an object')
    if data.get('artifact_version') != ARTIFACT_VERSION:
        raise ValueError('Unsupported artifact version')
    rules = data.get('rules', {})
    if rules != {'board_size': 8, 'ship_count': 4, 'ship_length': 4, 'overlap': False}:
        raise ValueError('Artifact rules do not match this bot')
    training = data.get('training', {})
    if (training.get('data_source') != 'synthetic'
            or not isinstance(training.get('dataset_size'), int)
            or training['dataset_size'] <= 0
            or training.get('method') != 'sklearn.ensemble.RandomForestClassifier'
            or not isinstance(training.get('parameters'), dict)):
        raise ValueError('Unsupported training data source')
    if not isinstance(data.get('evaluation'), dict) or not isinstance(data.get('created_utc'), str):
        raise ValueError('Artifact metadata is incomplete')
    probabilities = data.get('cell_occupancy_probabilities')
    strength = data.get('calibration', {}).get('prior_strength', 0.35)
    return GlobalMLPrior(probabilities, strength)


def select_prior(mode='auto', path=DEFAULT_ARTIFACT):
    """Return (prior, status line); every artifact failure safely selects V1."""
    if mode not in ('auto', 'v1', 'v2'):
        raise ValueError('Mode must be auto, v1, or v2')
    if mode == 'v1':
        return None, 'Ghost Fleet V1 — Uniform Prior'
    try:
        return load_global_prior(path), 'Ghost Fleet V2 — Synthetic Global ML Prior'
    except (OSError, ValueError, TypeError, AttributeError, UnicodeError, json.JSONDecodeError):
        return None, 'V2 unavailable — Falling back to V1'
