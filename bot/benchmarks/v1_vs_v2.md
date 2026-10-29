# Ghost Fleet V1 versus V2 benchmark

Reproduce this report with `python3 -m bot.ml.benchmark`. It uses 12 fleets per
group, engine seeds `11`, `29`, and `47`, a deterministic 25,000-node inference
budget, and the normal two-second time budget as a safety limit. V1 and V2 play
against the same fleet with the same engine seed. The machine-readable result
is in `v1_vs_v2.json`. Timing naturally varies by machine.

| Hidden fleet group | Mode | Games | Mean shots | Median shots | Accuracy | Mean decision |
|---|---|---:|---:|---:|---:|---:|
| Random legal | V1 uniform | 12 | 26.417 | 27.0 | 60.568% | 10.037 ms |
| Random legal | V2 synthetic ML | 12 | 26.750 | 26.5 | 59.813% | 16.546 ms |
| Held-out synthetic styles | V1 uniform | 12 | 26.833 | 28.0 | 59.627% | 9.785 ms |
| Held-out synthetic styles | V2 synthetic ML | 12 | 26.500 | 26.0 | 60.377% | 16.186 ms |

V2 improved the mean by 0.333 shots on held-out synthetic-style fleets, but it
was 0.333 shots worse on random legal fleets and used more decision
time. This small synthetic benchmark does not establish performance against
real people.

| Cell estimator | Brier score ↓ | Log loss ↓ | ROC AUC ↑ |
|---|---:|---:|---:|
| Random Forest | 0.18534600 | 0.55640193 | 0.57096354 |
| Empirical cell frequency | 0.18527364 | 0.55618919 | 0.57095443 |

The empirical baseline was marginally better on Brier score and log loss; the
Random Forest was marginally better on ROC AUC. The requested Random Forest
remains the V2 artifact. Its probabilities are smoothed, clipped, and applied
only to fleets that pass every V1 constraint.
