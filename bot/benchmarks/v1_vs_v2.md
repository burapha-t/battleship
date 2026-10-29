# Ghost Fleet V1 versus V2 benchmark

Reproduce this report with `python3 -m bot.ml.benchmark`. It uses 12 fleets per
group, engine seeds `11`, `29`, and `47`, and the shipped runtime
configuration: no node cap and the normal two-second per-decision time budget.
(`--nodes N` opts in to a deterministic node cap, which gives approximate
estimates and is not what the bot runs.) V1 and V2 play against the same fleet
with the same engine seed. The machine-readable result is in `v1_vs_v2.json`.
Every one of the 1,239 decisions in this run finished its exact enumeration
inside the time budget (0 truncated), so the shot counts do not depend on the
machine. Decision timing does vary by machine.

| Hidden fleet group | Mode | Games | Mean shots | Median shots | Accuracy | Mean decision |
|---|---|---:|---:|---:|---:|---:|
| Random legal | V1 uniform | 12 | 25.500 | 25.0 | 62.745% | 66.623 ms |
| Random legal | V2 synthetic ML | 12 | 26.000 | 26.0 | 61.538% | 152.193 ms |
| Held-out synthetic styles | V1 uniform | 12 | 25.917 | 26.5 | 61.736% | 47.134 ms |
| Held-out synthetic styles | V2 synthetic ML | 12 | 25.833 | 26.0 | 61.935% | 84.406 ms |

V2 improved the mean by only 0.084 shots (one shot over the 12 games) on held-out
synthetic-style fleets, was 0.5 shots worse on random legal fleets, and used
about twice the decision time. With 12 games per group these differences are
within noise, so this benchmark does not show that V2 is stronger than V1, and
it does not establish performance against real people.

| Cell estimator | Brier score ↓ | Log loss ↓ | ROC AUC ↑ |
|---|---:|---:|---:|
| Random Forest | 0.18534600 | 0.55640193 | 0.57096354 |
| Empirical cell frequency | 0.18527364 | 0.55618919 | 0.57095443 |

The empirical baseline was marginally better on Brier score and log loss; the
Random Forest was marginally better on ROC AUC. The requested Random Forest
remains the V2 artifact. Its probabilities are smoothed, clipped, and applied
only to fleets that pass every V1 constraint.
