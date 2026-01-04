# Simulation (Ring B)

Simulation answers questions with evidence-backed precedent (retrieval-augmented, not generative), not causal claims.

## API surface

- Blast radius: what entities might be affected?
- Similar trajectories: retrieve precedents.
- Change simulation: predict outcomes given proposed changes.

## Outputs

- Evidence (trajectory_ids, matched features)
- Confidence (sample size smoothing, recency decay, variance penalty)
- `algorithm_version`, `feature_schema_version`

## Inputs

- Projections from trajectories: co-occurrence, transitions, structural signatures, outcome correlations.

## Determinism

- Fixed iteration orders and hashing; reproducible given the same projection state and inputs.
