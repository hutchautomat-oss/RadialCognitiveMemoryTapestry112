# Calibration derivation (NDA — stub)

> **CONFIDENTIAL — NDA only.** Do not ship in a buyer distribution.

This is the method behind the Bucket-2 values in
`artifacts/rcmt/src/lib/calibration.ts`. The *values* ship inside the engine;
*how they were chosen* is the protected knowledge and stays here.

## Scope (to be filled in)

For each calibration asset, record: the goal it tunes, how it was derived or
measured, what was tried and rejected, and the sensitivity (how much a buyer
could degrade the substrate by guessing it wrong).

- **`CLASSIFIER_SEED_PHRASES`** — why these five anchor phrases, and the
  selection process that makes the tier boundaries separable. *(TODO.)*
- **`NODE_DENSITY_BUBBLE`** — why `0.6` for constant-area annuli at the 8k cap.
  *(TODO.)*
- **`TIER_LAMBDA`** — the decay-gradient shape and why Facts barely decay while
  Dreams hyper-decay. *(TODO.)*
- **Reinforcement / promotion / health thresholds** — the tuning that makes
  reinforcement, promotion, and demotion feel right rather than thrashy.
  *(TODO.)*
- **`VLM_ACUITY_S`** — empirical; see
  [`benchmark-methodology.md`](./benchmark-methodology.md). Null until measured.

## Standing constraint

Biology/physics give the *form*; measurement gives the *number*. Empirical
constants come from a confirmation run, never from derivation.
