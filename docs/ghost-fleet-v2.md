# Ghost Fleet V2: experimental synthetic Global ML prior

Ghost Fleet V2 is an offline-trained prior layered onto the V1 full-fleet
reasoner. Its training placements are **SYNTHETIC simulations**. They are not
real match history and are not evidence of actual human behavior.

## Runtime architecture

The versioned artifact at `bot/models/global_prior_v2.json` contains 64 smoothed
cell-occupancy probabilities plus its rules, configuration, source, versions,
and held-out evaluation. Runtime code uses only Python's standard library. It
validates the artifact, converts each probability to a clipped log-odds score,
precomputes scores for the 80 possible ships, and assigns a bounded weight to
each complete fleet.

V1 still enumerates legal four-ship fleets, removes fleets that contradict
misses, requires hits to be covered, fixes sunk ships, prevents repeat shots,
and uses its safe fallback. V2 never shoots directly from a raw prediction.

The default `auto` mode loads V2 when the artifact is valid and otherwise uses
V1. The bot logs one of:

- `Ghost Fleet V1 — Uniform Prior`
- `Ghost Fleet V2 — Synthetic Global ML Prior`
- `V2 unavailable — Falling back to V1`

Force a mode for a manually launched bot:

```sh
python3 -m bot.main --mode v1 --seed 42
python3 -m bot.main --mode v2 --seed 42
```

For **Play vs Bot**, set `BATTLESHIP_GHOST_MODE=v1`, `v2`, or `auto` before
starting `Battleship.Client`. `BATTLESHIP_GHOST_MODEL` can point to another
artifact. A missing or invalid artifact never prevents the bot from starting.

## Synthetic placement generator

`bot/ml/synthetic.py` generates whole legal fleets with randomized weighted
backtracking. Strategies prefer random positions, edges, corners, the center,
horizontal or vertical orientation, or a random blend of two preferences.
Every record is labelled `SYNTHETIC` and remains outside SQLite. Generated JSONL
files are ignored by Git.

The checked-in configuration uses 5,000 fleets and seed `20261029`. It controls
the style distribution, fleet-level split, model parameters, calibration, and
model seed.

## Reproduce or retrain

From a clean checkout:

```sh
python3 -m pip install -r bot/requirements-train.txt
python3 -m bot.ml.train --generate
```

This regenerates `bot/generated/synthetic_fleets.jsonl`, splits by complete
fleet before expanding cells, trains `RandomForestClassifier`, evaluates 1,000
held-out fleets, compares train-set cell frequencies, and rewrites the artifact.
Change `bot/ml/training_config.json` for another reproducible experiment.

The loader is separate from SQLite. A future history exporter can emit the same
complete-fleet shape, but this version rejects records not explicitly labelled
`SYNTHETIC`.

## Evaluation and benchmark

Random Forest held-out metrics are Brier `0.18534600`, log loss `0.55640193`,
and ROC AUC `0.57096354`. The empirical baseline has marginally better Brier and
log loss at `0.18527364` and `0.55618919`, while its ROC AUC is marginally lower
at `0.57095443`. The artifact records this result.

Run `python3 -m bot.ml.benchmark`. Checked-in results are in
`bot/benchmarks/v1_vs_v2.md` and its JSON companion. V2 improved mean shots
slightly on held-out synthetic-style fleets, but performed worse on random legal
fleets. Synthetic gains must not be assumed to transfer to real players.

## Distribution through the client

The C# client copies Python runtime files and the artifact into `bot/models/` in
build and publish output. Teammates use the same pretrained artifact without
installing scikit-learn or accessing the server database.
